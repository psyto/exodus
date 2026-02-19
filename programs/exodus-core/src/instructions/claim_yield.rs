use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::ExodusError;
use crate::events::YieldClaimed;
use crate::state::{ProtocolConfig, UserPosition, YieldSource};

#[derive(Accounts)]
pub struct ClaimYield<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [ProtocolConfig::SEED],
        bump = protocol_config.bump,
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(
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

    /// Yield source deposit vault
    #[account(
        mut,
        constraint = deposit_vault.key() == yield_source.deposit_vault,
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

pub fn handler(ctx: Context<ClaimYield>) -> Result<()> {
    let config = &ctx.accounts.protocol_config;
    require!(config.is_active, ExodusError::ProtocolNotActive);

    let user_pos = &ctx.accounts.user_position;
    let ys = &ctx.accounts.yield_source;

    // Calculate current value of user's shares
    let current_value = (user_pos.current_shares as u128)
        .checked_mul(ys.nav_per_share as u128)
        .ok_or(ExodusError::MathOverflow)?
        .checked_div(1_000_000)
        .ok_or(ExodusError::MathOverflow)? as u64;

    // Yield = current_value - total_deposited_usdc - already_realized
    let cost_basis = user_pos.total_deposited_usdc;
    let total_gain = current_value.saturating_sub(cost_basis);
    let yield_amount = total_gain.saturating_sub(user_pos.realized_yield_usdc);

    require!(yield_amount > 0, ExodusError::NoYieldToClaim);

    // Deduct performance fee
    let performance_fee = (yield_amount as u128)
        .checked_mul(config.performance_fee_bps as u128)
        .ok_or(ExodusError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(ExodusError::MathOverflow)? as u64;
    let net_yield = yield_amount
        .checked_sub(performance_fee)
        .ok_or(ExodusError::MathOverflow)?;

    // Transfer net yield from deposit vault to user
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
        net_yield,
    )?;

    let now = Clock::get()?.unix_timestamp;

    // Update user position
    let user_pos_mut = &mut ctx.accounts.user_position;
    user_pos_mut.realized_yield_usdc = user_pos_mut
        .realized_yield_usdc
        .checked_add(yield_amount)
        .ok_or(ExodusError::MathOverflow)?;

    // Update protocol totals
    let config_mut = &mut ctx.accounts.protocol_config;
    config_mut.total_yield_earned = config_mut
        .total_yield_earned
        .checked_add(yield_amount)
        .ok_or(ExodusError::MathOverflow)?;
    config_mut.updated_at = now;

    emit!(YieldClaimed {
        user: ctx.accounts.user.key(),
        yield_amount,
        performance_fee,
        net_yield,
        timestamp: now,
    });

    msg!(
        "Yield claimed: {} total, {} fee, {} net to user",
        yield_amount,
        performance_fee,
        net_yield
    );
    Ok(())
}
