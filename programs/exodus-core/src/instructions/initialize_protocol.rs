use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use anchor_spl::token_interface::Mint as MintInterface;

use crate::errors::ExodusError;
use crate::events::ProtocolInitialized;
use crate::state::ProtocolConfig;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeProtocolParams {
    pub oracle: Pubkey,
    pub kyc_registry: Pubkey,
    pub sovereign_program: Pubkey,
    pub conversion_fee_bps: u16,
    pub management_fee_bps: u16,
    pub performance_fee_bps: u16,
}

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = ProtocolConfig::LEN,
        seeds = [ProtocolConfig::SEED],
        bump,
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// JPY stablecoin mint (Token-2022)
    pub jpy_mint: InterfaceAccount<'info, MintInterface>,

    /// USDC mint (SPL Token)
    pub usdc_mint: Account<'info, Mint>,

    /// JPY vault — holds pending JPY deposits.
    /// We use a regular token account here; Token-2022 transfers happen at user level.
    #[account(
        init,
        payer = authority,
        seeds = [ProtocolConfig::JPY_VAULT_SEED],
        bump,
        token::mint = jpy_mint,
        token::authority = protocol_config,
        token::token_program = token_2022_program,
    )]
    pub jpy_vault: InterfaceAccount<'info, anchor_spl::token_interface::TokenAccount>,

    #[account(
        init,
        payer = authority,
        seeds = [ProtocolConfig::USDC_VAULT_SEED],
        bump,
        token::mint = usdc_mint,
        token::authority = protocol_config,
    )]
    pub usdc_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    /// CHECK: Token-2022 program
    pub token_2022_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<InitializeProtocol>, params: InitializeProtocolParams) -> Result<()> {
    require!(params.conversion_fee_bps <= 1000, ExodusError::InvalidFee);
    require!(params.management_fee_bps <= 500, ExodusError::InvalidFee);
    require!(params.performance_fee_bps <= 5000, ExodusError::InvalidFee);

    let now = Clock::get()?.unix_timestamp;
    let config = &mut ctx.accounts.protocol_config;

    config.authority = ctx.accounts.authority.key();
    config.jpy_mint = ctx.accounts.jpy_mint.key();
    config.usdc_mint = ctx.accounts.usdc_mint.key();
    config.jpy_vault = ctx.accounts.jpy_vault.key();
    config.usdc_vault = ctx.accounts.usdc_vault.key();
    config.oracle = params.oracle;
    config.kyc_registry = params.kyc_registry;
    config.sovereign_program = params.sovereign_program;
    config.conversion_fee_bps = params.conversion_fee_bps;
    config.management_fee_bps = params.management_fee_bps;
    config.performance_fee_bps = params.performance_fee_bps;
    config.total_deposits_usdc = 0;
    config.total_yield_earned = 0;
    config.pending_jpy_conversion = 0;
    config.deposit_nonce = 0;
    config.is_active = true;
    config.created_at = now;
    config.updated_at = now;
    config.bump = ctx.bumps.protocol_config;
    config.jpy_vault_bump = ctx.bumps.jpy_vault;
    config.usdc_vault_bump = ctx.bumps.usdc_vault;

    emit!(ProtocolInitialized {
        authority: config.authority,
        jpy_mint: config.jpy_mint,
        usdc_mint: config.usdc_mint,
        timestamp: now,
    });

    msg!("EXODUS protocol initialized");
    Ok(())
}
