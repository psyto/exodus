use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::ExodusError;
use crate::events::WithdrawalExecuted;
use crate::state::{ProtocolConfig, UserPosition, YieldSource};

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [ProtocolConfig::SEED],
        bump = protocol_config.bump,
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        seeds = [
            YieldSource::SEED,
            protocol_config.key().as_ref(),
            yield_source.token_mint.as_ref(),
        ],
        bump = yield_source.bump,
    )]
    pub yield_source: Account<'info, YieldSource>,

    #[account(
        mut,
        seeds = [UserPosition::SEED, protocol_config.key().as_ref(), user.key().as_ref()],
        bump = user_position.bump,
    )]
    pub user_position: Account<'info, UserPosition>,

    /// Protocol USDC vault (source of USDC for withdrawals)
    #[account(
        mut,
        constraint = deposit_vault.key() == protocol_config.usdc_vault,
    )]
    pub deposit_vault: Account<'info, TokenAccount>,

    /// User's USDC token account
    #[account(
        mut,
        constraint = user_usdc.owner == user.key(),
        constraint = user_usdc.mint == protocol_config.usdc_mint,
    )]
    pub user_usdc: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<Withdraw>, shares: u64, _withdraw_as_jpy: bool) -> Result<()> {
    let config = &ctx.accounts.protocol_config;
    require!(config.is_active, ExodusError::ProtocolNotActive);
    require!(shares > 0, ExodusError::ZeroWithdrawal);

    let user_pos = &ctx.accounts.user_position;
    require!(
        user_pos.current_shares >= shares,
        ExodusError::InsufficientShares
    );

    // Calculate USDC out based on NAV
    let ys = &ctx.accounts.yield_source;
    let usdc_out = (shares as u128)
        .checked_mul(ys.nav_per_share as u128)
        .ok_or(ExodusError::MathOverflow)?
        .checked_div(1_000_000)
        .ok_or(ExodusError::MathOverflow)? as u64;

    // Transfer USDC from yield source vault to user
    // The yield source vault authority is the protocol config PDA
    let config_seeds: &[&[u8]] = &[ProtocolConfig::SEED, &[config.bump]];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.deposit_vault.to_account_info(),
                to: ctx.accounts.user_usdc.to_account_info(),
                authority: ctx.accounts.protocol_config.to_account_info(),
            },
            &[config_seeds],
        ),
        usdc_out,
    )?;

    let now = Clock::get()?.unix_timestamp;

    // Update yield source
    let ys_mut = &mut ctx.accounts.yield_source;
    ys_mut.total_shares = ys_mut
        .total_shares
        .checked_sub(shares)
        .ok_or(ExodusError::MathOverflow)?;
    ys_mut.total_deposited = ys_mut.total_deposited.saturating_sub(usdc_out);

    // Update user position
    let user_pos_mut = &mut ctx.accounts.user_position;
    user_pos_mut.current_shares = user_pos_mut
        .current_shares
        .checked_sub(shares)
        .ok_or(ExodusError::MathOverflow)?;
    user_pos_mut.withdrawal_count = user_pos_mut
        .withdrawal_count
        .checked_add(1)
        .ok_or(ExodusError::MathOverflow)?;
    user_pos_mut.last_withdrawal_at = now;

    // Update protocol config
    let config_mut = &mut ctx.accounts.protocol_config;
    config_mut.total_deposits_usdc = config_mut.total_deposits_usdc.saturating_sub(usdc_out);
    config_mut.updated_at = now;

    // Note: withdraw_as_jpy would trigger a reverse conversion in Phase 1.5
    // For MVP, we always return USDC

    emit!(WithdrawalExecuted {
        user: ctx.accounts.user.key(),
        shares_burned: shares,
        usdc_received: usdc_out,
        timestamp: now,
    });

    msg!("Withdrew {} shares for {} USDC", shares, usdc_out);
    Ok(())
}
