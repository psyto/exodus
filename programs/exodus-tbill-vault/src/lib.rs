use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer};

pub mod errors;
pub mod state;

use errors::TBillVaultError;
use state::{UserShares, VaultConfig};

declare_id!("2zwyHvFnB7TacEbTWwyceX2JkAm8hDFLdK1pxew33Wgz");

const SECONDS_PER_YEAR: u64 = 365 * 24 * 60 * 60;
const NAV_SCALE: u64 = 1_000_000;

#[program]
pub mod exodus_tbill_vault {
    use super::*;

    /// Initialize the T-Bill vault with a target APY.
    pub fn initialize_vault(ctx: Context<InitializeVault>, target_apy_bps: u16) -> Result<()> {
        require!(target_apy_bps <= 5000, TBillVaultError::InvalidApy);

        let vault = &mut ctx.accounts.vault_config;
        vault.authority = ctx.accounts.authority.key();
        vault.usdc_mint = ctx.accounts.usdc_mint.key();
        vault.share_mint = ctx.accounts.share_mint.key();
        vault.usdc_vault = ctx.accounts.usdc_vault.key();
        vault.target_apy_bps = target_apy_bps;
        vault.total_deposits = 0;
        vault.total_shares = 0;
        vault.nav_per_share = NAV_SCALE; // 1.000000
        vault.last_accrual = Clock::get()?.unix_timestamp;
        vault.is_active = true;
        vault.bump = ctx.bumps.vault_config;
        vault.share_mint_bump = ctx.bumps.share_mint;
        vault.vault_bump = ctx.bumps.usdc_vault;

        msg!("T-Bill vault initialized with APY: {} bps", target_apy_bps);
        Ok(())
    }

    /// Deposit USDC into the vault and receive shares.
    pub fn deposit(ctx: Context<Deposit>, usdc_amount: u64) -> Result<()> {
        let vault = &ctx.accounts.vault_config;
        require!(vault.is_active, TBillVaultError::VaultNotActive);
        require!(usdc_amount > 0, TBillVaultError::ZeroDeposit);

        // Calculate shares: shares = usdc_amount * NAV_SCALE / nav_per_share
        let shares = usdc_amount
            .checked_mul(NAV_SCALE)
            .ok_or(TBillVaultError::MathOverflow)?
            .checked_div(vault.nav_per_share)
            .ok_or(TBillVaultError::MathOverflow)?;

        // Transfer USDC from depositor to vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_usdc.to_account_info(),
                    to: ctx.accounts.usdc_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            usdc_amount,
        )?;

        // Mint shares to depositor
        let vault_seeds: &[&[u8]] = &[VaultConfig::SEED, &[ctx.accounts.vault_config.bump]];
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.share_mint.to_account_info(),
                    to: ctx.accounts.user_shares_ata.to_account_info(),
                    authority: ctx.accounts.vault_config.to_account_info(),
                },
                &[vault_seeds],
            ),
            shares,
        )?;

        // Update vault state
        let vault = &mut ctx.accounts.vault_config;
        vault.total_deposits = vault
            .total_deposits
            .checked_add(usdc_amount)
            .ok_or(TBillVaultError::MathOverflow)?;
        vault.total_shares = vault
            .total_shares
            .checked_add(shares)
            .ok_or(TBillVaultError::MathOverflow)?;

        // Update user shares tracking
        let user_shares = &mut ctx.accounts.user_shares;
        user_shares.user = ctx.accounts.user.key();
        user_shares.vault = ctx.accounts.vault_config.key();
        user_shares.shares = user_shares
            .shares
            .checked_add(shares)
            .ok_or(TBillVaultError::MathOverflow)?;
        user_shares.deposited_usdc = user_shares
            .deposited_usdc
            .checked_add(usdc_amount)
            .ok_or(TBillVaultError::MathOverflow)?;
        user_shares.last_deposit_at = Clock::get()?.unix_timestamp;

        msg!(
            "Deposited {} USDC, minted {} shares",
            usdc_amount,
            shares
        );
        Ok(())
    }

    /// Withdraw shares and receive USDC based on current NAV.
    pub fn withdraw(ctx: Context<Withdraw>, shares: u64) -> Result<()> {
        let vault = &ctx.accounts.vault_config;
        require!(vault.is_active, TBillVaultError::VaultNotActive);
        require!(shares > 0, TBillVaultError::ZeroWithdrawal);

        let user_shares_account = &ctx.accounts.user_shares;
        require!(
            user_shares_account.shares >= shares,
            TBillVaultError::InsufficientShares
        );

        // Calculate USDC out: usdc_out = shares * nav_per_share / NAV_SCALE
        let usdc_out = shares
            .checked_mul(vault.nav_per_share)
            .ok_or(TBillVaultError::MathOverflow)?
            .checked_div(NAV_SCALE)
            .ok_or(TBillVaultError::MathOverflow)?;

        require!(
            ctx.accounts.usdc_vault.amount >= usdc_out,
            TBillVaultError::InsufficientVaultBalance
        );

        // Burn shares from user
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.share_mint.to_account_info(),
                    from: ctx.accounts.user_shares_ata.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            shares,
        )?;

        // Transfer USDC from vault to user
        let vault_seeds: &[&[u8]] = &[VaultConfig::SEED, &[ctx.accounts.vault_config.bump]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.usdc_vault.to_account_info(),
                    to: ctx.accounts.user_usdc.to_account_info(),
                    authority: ctx.accounts.vault_config.to_account_info(),
                },
                &[vault_seeds],
            ),
            usdc_out,
        )?;

        // Update vault state
        let vault = &mut ctx.accounts.vault_config;
        vault.total_deposits = vault.total_deposits.saturating_sub(usdc_out);
        vault.total_shares = vault
            .total_shares
            .checked_sub(shares)
            .ok_or(TBillVaultError::MathOverflow)?;

        // Update user shares
        let user_shares_mut = &mut ctx.accounts.user_shares;
        user_shares_mut.shares = user_shares_mut
            .shares
            .checked_sub(shares)
            .ok_or(TBillVaultError::MathOverflow)?;

        msg!("Withdrew {} shares for {} USDC", shares, usdc_out);
        Ok(())
    }

    /// Keeper crank: accrue yield based on elapsed time and target APY.
    pub fn accrue_yield(ctx: Context<AccrueYield>) -> Result<()> {
        let vault = &mut ctx.accounts.vault_config;
        require!(vault.is_active, TBillVaultError::VaultNotActive);

        let now = Clock::get()?.unix_timestamp;
        let elapsed = (now - vault.last_accrual) as u64;

        if elapsed == 0 || vault.total_shares == 0 {
            return Ok(());
        }

        // accrual = nav_per_share * target_apy_bps * elapsed / (10000 * SECONDS_PER_YEAR)
        let accrual = (vault.nav_per_share as u128)
            .checked_mul(vault.target_apy_bps as u128)
            .ok_or(TBillVaultError::MathOverflow)?
            .checked_mul(elapsed as u128)
            .ok_or(TBillVaultError::MathOverflow)?
            .checked_div(10_000u128 * SECONDS_PER_YEAR as u128)
            .ok_or(TBillVaultError::MathOverflow)?;

        vault.nav_per_share = vault
            .nav_per_share
            .checked_add(accrual as u64)
            .ok_or(TBillVaultError::MathOverflow)?;
        vault.last_accrual = now;

        msg!(
            "Yield accrued: NAV per share now {}",
            vault.nav_per_share
        );
        Ok(())
    }

    /// Admin: update the target APY.
    pub fn update_apy(ctx: Context<UpdateApy>, new_apy_bps: u16) -> Result<()> {
        require!(new_apy_bps <= 5000, TBillVaultError::InvalidApy);
        require!(
            ctx.accounts.authority.key() == ctx.accounts.vault_config.authority,
            TBillVaultError::Unauthorized
        );

        ctx.accounts.vault_config.target_apy_bps = new_apy_bps;
        msg!("APY updated to {} bps", new_apy_bps);
        Ok(())
    }
}

// ─── Account Contexts ──────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = VaultConfig::LEN,
        seeds = [VaultConfig::SEED],
        bump,
    )]
    pub vault_config: Account<'info, VaultConfig>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        seeds = [VaultConfig::SHARE_MINT_SEED],
        bump,
        mint::decimals = 6,
        mint::authority = vault_config,
    )]
    pub share_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        seeds = [VaultConfig::USDC_VAULT_SEED],
        bump,
        token::mint = usdc_mint,
        token::authority = vault_config,
    )]
    pub usdc_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [VaultConfig::SEED],
        bump = vault_config.bump,
    )]
    pub vault_config: Account<'info, VaultConfig>,

    #[account(
        mut,
        seeds = [VaultConfig::USDC_VAULT_SEED],
        bump = vault_config.vault_bump,
    )]
    pub usdc_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [VaultConfig::SHARE_MINT_SEED],
        bump = vault_config.share_mint_bump,
    )]
    pub share_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = user_usdc.owner == user.key(),
        constraint = user_usdc.mint == vault_config.usdc_mint,
    )]
    pub user_usdc: Account<'info, TokenAccount>,

    /// User's share token ATA
    #[account(
        mut,
        constraint = user_shares_ata.owner == user.key(),
        constraint = user_shares_ata.mint == share_mint.key(),
    )]
    pub user_shares_ata: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        space = UserShares::LEN,
        seeds = [UserShares::SEED, vault_config.key().as_ref(), user.key().as_ref()],
        bump,
    )]
    pub user_shares: Account<'info, UserShares>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [VaultConfig::SEED],
        bump = vault_config.bump,
    )]
    pub vault_config: Account<'info, VaultConfig>,

    #[account(
        mut,
        seeds = [VaultConfig::USDC_VAULT_SEED],
        bump = vault_config.vault_bump,
    )]
    pub usdc_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [VaultConfig::SHARE_MINT_SEED],
        bump = vault_config.share_mint_bump,
    )]
    pub share_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = user_usdc.owner == user.key(),
        constraint = user_usdc.mint == vault_config.usdc_mint,
    )]
    pub user_usdc: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_shares_ata.owner == user.key(),
        constraint = user_shares_ata.mint == share_mint.key(),
    )]
    pub user_shares_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [UserShares::SEED, vault_config.key().as_ref(), user.key().as_ref()],
        bump = user_shares.bump,
    )]
    pub user_shares: Account<'info, UserShares>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AccrueYield<'info> {
    #[account(
        mut,
        seeds = [VaultConfig::SEED],
        bump = vault_config.bump,
    )]
    pub vault_config: Account<'info, VaultConfig>,
}

#[derive(Accounts)]
pub struct UpdateApy<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [VaultConfig::SEED],
        bump = vault_config.bump,
    )]
    pub vault_config: Account<'info, VaultConfig>,
}
