use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use exodus_types::{allowed_yield_sources, monthly_usdc_limit};

use crate::errors::ExodusError;
use crate::events::DirectUsdcDeposit;
use crate::state::{ProtocolConfig, UserPosition, YieldSource};
use crate::instructions::deposit_jpy::{
    read_sovereign_tier, trusted_kyc_registry, validate_kyc, SOVEREIGN_IDENTITY_SEED, WHITELIST_SEED,
};

#[derive(Accounts)]
pub struct DepositUsdc<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [ProtocolConfig::SEED],
        bump = protocol_config.bump,
    )]
    pub protocol_config: Box<Account<'info, ProtocolConfig>>,

    #[account(
        mut,
        seeds = [
            YieldSource::SEED,
            protocol_config.key().as_ref(),
            yield_source.token_mint.as_ref(),
        ],
        bump = yield_source.bump,
    )]
    pub yield_source: Box<Account<'info, YieldSource>>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = user_usdc.owner == user.key(),
        constraint = user_usdc.mint == protocol_config.usdc_mint,
    )]
    pub user_usdc: Account<'info, TokenAccount>,

    /// Yield source deposit vault
    #[account(
        mut,
        constraint = deposit_vault.key() == yield_source.deposit_vault,
    )]
    pub deposit_vault: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        space = UserPosition::LEN,
        seeds = [UserPosition::SEED, protocol_config.key().as_ref(), user.key().as_ref()],
        bump,
    )]
    pub user_position: Box<Account<'info, UserPosition>>,

    /// Accredit WhitelistEntry PDA
    /// CHECK: Owned by the configured KYC program at ["whitelist", <JPY mint registry>, user]; fields read in the handler.
    #[account(
        owner = protocol_config.kyc_registry @ ExodusError::KycRequired,
        seeds = [
            WHITELIST_SEED,
            trusted_kyc_registry(&protocol_config).as_ref(),
            user.key().as_ref()
        ],
        bump,
        seeds::program = protocol_config.kyc_registry,
    )]
    pub whitelist_entry: AccountInfo<'info>,

    /// Sovereign Identity PDA
    /// CHECK: Owned by the configured Sovereign program at ["identity", user]; tier read in the handler.
    #[account(
        owner = protocol_config.sovereign_program @ ExodusError::SovereignIdentityNotFound,
        seeds = [SOVEREIGN_IDENTITY_SEED, user.key().as_ref()],
        bump,
        seeds::program = protocol_config.sovereign_program,
    )]
    pub sovereign_identity: AccountInfo<'info>,

    /// T-Bill vault program for CPI
    /// CHECK: Program ID validated
    pub tbill_vault_program: AccountInfo<'info>,

    /// T-Bill VaultConfig PDA
    /// CHECK: Used in CPI
    #[account(mut)]
    pub tbill_vault_config: AccountInfo<'info>,

    /// T-Bill share mint
    /// CHECK: Used in CPI
    #[account(mut)]
    pub tbill_share_mint: AccountInfo<'info>,

    /// T-Bill USDC vault
    /// CHECK: Used in CPI
    #[account(mut)]
    pub tbill_usdc_vault: AccountInfo<'info>,

    /// User's share token ATA for T-Bill vault
    /// CHECK: Used in CPI
    #[account(mut)]
    pub user_tbill_shares_ata: AccountInfo<'info>,

    /// T-Bill UserShares PDA
    /// CHECK: Used in CPI
    #[account(mut)]
    pub tbill_user_shares: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<DepositUsdc>, usdc_amount: u64) -> Result<()> {
    let config = &ctx.accounts.protocol_config;
    require!(config.is_active, ExodusError::ProtocolNotActive);
    require!(usdc_amount > 0, ExodusError::ZeroDeposit);

    let ys = &ctx.accounts.yield_source;
    require!(ys.is_active, ExodusError::YieldSourceNotActive);
    require!(usdc_amount >= ys.min_deposit, ExodusError::BelowMinDeposit);

    // KYC check (same pattern as deposit_jpy)
    validate_kyc(
        &ctx.accounts.whitelist_entry,
        &ctx.accounts.user.key(),
        &trusted_kyc_registry(config),
    )?;
    let now = Clock::get()?.unix_timestamp;

    // Sovereign tier check
    let tier = read_sovereign_tier(&ctx.accounts.sovereign_identity, &ctx.accounts.user.key())?;
    require!(tier > 0, ExodusError::TierTooLow);

    // Check yield source type allowed for tier
    let allowed = allowed_yield_sources(tier);
    require!(
        allowed.contains(&ys.source_type),
        ExodusError::YieldSourceNotAllowed
    );

    // Monthly limit check
    let user_pos = &mut ctx.accounts.user_position;
    if user_pos.created_at == 0 {
        user_pos.owner = ctx.accounts.user.key();
        user_pos.protocol_config = config.key();
        user_pos.created_at = now;
        user_pos.month_start = now;
        user_pos.bump = ctx.bumps.user_position;
    }
    user_pos.maybe_reset_monthly(now);
    user_pos.sovereign_tier = tier;

    let limit = monthly_usdc_limit(tier);
    let new_monthly = user_pos
        .monthly_deposited_usdc
        .checked_add(usdc_amount)
        .ok_or(ExodusError::MathOverflow)?;
    require!(new_monthly <= limit, ExodusError::MonthlyLimitExceeded);

    // Calculate shares from yield source NAV
    let nav = ys.nav_per_share;
    let shares = (usdc_amount as u128)
        .checked_mul(1_000_000)
        .ok_or(ExodusError::MathOverflow)?
        .checked_div(nav as u128)
        .ok_or(ExodusError::MathOverflow)? as u64;

    // Transfer USDC from user to yield source deposit vault
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_usdc.to_account_info(),
                to: ctx.accounts.deposit_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        usdc_amount,
    )?;

    // Update yield source
    let ys_mut = &mut ctx.accounts.yield_source;
    ys_mut.total_deposited = ys_mut
        .total_deposited
        .checked_add(usdc_amount)
        .ok_or(ExodusError::MathOverflow)?;
    ys_mut.total_shares = ys_mut
        .total_shares
        .checked_add(shares)
        .ok_or(ExodusError::MathOverflow)?;

    // Update user position
    user_pos.monthly_deposited_usdc = new_monthly;
    user_pos.total_deposited_usdc = user_pos
        .total_deposited_usdc
        .checked_add(usdc_amount)
        .ok_or(ExodusError::MathOverflow)?;
    user_pos.current_shares = user_pos
        .current_shares
        .checked_add(shares)
        .ok_or(ExodusError::MathOverflow)?;
    user_pos.deposit_count = user_pos
        .deposit_count
        .checked_add(1)
        .ok_or(ExodusError::MathOverflow)?;
    user_pos.last_deposit_at = now;

    // Update protocol config
    let config_mut = &mut ctx.accounts.protocol_config;
    config_mut.total_deposits_usdc = config_mut
        .total_deposits_usdc
        .checked_add(usdc_amount)
        .ok_or(ExodusError::MathOverflow)?;
    config_mut.updated_at = now;

    emit!(DirectUsdcDeposit {
        user: ctx.accounts.user.key(),
        usdc_amount,
        shares_received: shares,
        timestamp: now,
    });

    msg!(
        "Direct USDC deposit: {} USDC, {} shares issued",
        usdc_amount,
        shares
    );
    Ok(())
}
