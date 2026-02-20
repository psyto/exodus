use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use exodus_types::{ConversionDirection, DepositStatus};

use crate::errors::ExodusError;
use crate::events::{ConversionExecuted, ConversionRecordCreated};
use crate::state::{ConversionRecord, PendingDeposit, ProtocolConfig, UserPosition, YieldSource};

/// Oracle PriceFeed — simplified Meridian-style layout.
/// After 8-byte discriminator:
///   - authority: Pubkey (32)
///   - current_price: u64 (8)  — JPY per USD, scaled 1e6 (e.g., 155_000_000 = ¥155.00)
///   - last_update_time: i64 (8)
const ORACLE_PRICE_OFFSET: usize = 8 + 32; // after discrim + authority
const ORACLE_UPDATE_OFFSET: usize = ORACLE_PRICE_OFFSET + 8;
const MAX_ORACLE_STALENESS: i64 = 300; // 5 minutes

#[derive(Accounts)]
pub struct ExecuteConversion<'info> {
    /// Keeper that triggers the conversion
    #[account(mut)]
    pub keeper: Signer<'info>,

    #[account(
        mut,
        seeds = [ProtocolConfig::SEED],
        bump = protocol_config.bump,
    )]
    pub protocol_config: Box<Account<'info, ProtocolConfig>>,

    #[account(
        mut,
        constraint = pending_deposit.protocol_config == protocol_config.key() @ ExodusError::InvalidPendingDeposit,
        constraint = pending_deposit.status == DepositStatus::Pending @ ExodusError::InvalidPendingDeposit,
    )]
    pub pending_deposit: Box<Account<'info, PendingDeposit>>,

    #[account(
        mut,
        seeds = [UserPosition::SEED, protocol_config.key().as_ref(), pending_deposit.user.as_ref()],
        bump = user_position.bump,
    )]
    pub user_position: Box<Account<'info, UserPosition>>,

    /// Protocol JPY vault
    /// CHECK: Validated against protocol_config
    #[account(
        mut,
        constraint = jpy_vault.key() == protocol_config.jpy_vault @ ExodusError::InvalidAccountData,
    )]
    pub jpy_vault: AccountInfo<'info>,

    /// Protocol USDC vault (keeper pre-loads this with USDC from Jupiter)
    #[account(
        mut,
        constraint = usdc_vault.key() == protocol_config.usdc_vault @ ExodusError::InvalidAccountData,
    )]
    pub usdc_vault: Account<'info, TokenAccount>,

    /// Oracle PriceFeed PDA
    /// CHECK: Manually deserialized
    #[account(
        constraint = oracle.key() == protocol_config.oracle @ ExodusError::InvalidOraclePrice,
    )]
    pub oracle: AccountInfo<'info>,

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

    /// Yield source deposit vault (where USDC goes after conversion)
    #[account(
        mut,
        constraint = yield_deposit_vault.key() == yield_source.deposit_vault,
    )]
    pub yield_deposit_vault: Account<'info, TokenAccount>,

    /// ConversionRecord to create
    #[account(
        init,
        payer = keeper,
        space = ConversionRecord::LEN,
        seeds = [
            ConversionRecord::SEED,
            protocol_config.key().as_ref(),
            pending_deposit.user.as_ref(),
            &pending_deposit.nonce.to_le_bytes(),
        ],
        bump,
    )]
    pub conversion_record: Box<Account<'info, ConversionRecord>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ExecuteConversion>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let pending = &ctx.accounts.pending_deposit;

    // 1. Check not expired
    require!(now <= pending.expires_at, ExodusError::DepositExpired);

    // 2. Read oracle price
    let oracle_data = ctx.accounts.oracle.try_borrow_data()?;
    require!(
        oracle_data.len() >= ORACLE_UPDATE_OFFSET + 8,
        ExodusError::InvalidOraclePrice
    );

    let exchange_rate = u64::from_le_bytes(
        oracle_data[ORACLE_PRICE_OFFSET..ORACLE_PRICE_OFFSET + 8]
            .try_into()
            .unwrap(),
    );
    let last_update = i64::from_le_bytes(
        oracle_data[ORACLE_UPDATE_OFFSET..ORACLE_UPDATE_OFFSET + 8]
            .try_into()
            .unwrap(),
    );
    drop(oracle_data);

    require!(exchange_rate > 0, ExodusError::InvalidOraclePrice);
    require!(
        now - last_update <= MAX_ORACLE_STALENESS,
        ExodusError::StalePriceOracle
    );

    // 3. Calculate USDC output
    // exchange_rate = JPY per USD, scaled 1e6
    // usdc_out = jpy_amount * 1_000_000 / exchange_rate
    let jpy_amount = pending.jpy_amount;
    let gross_usdc = (jpy_amount as u128)
        .checked_mul(1_000_000)
        .ok_or(ExodusError::MathOverflow)?
        .checked_div(exchange_rate as u128)
        .ok_or(ExodusError::MathOverflow)? as u64;

    // 4. Deduct conversion fee
    let config = &ctx.accounts.protocol_config;
    let fee = (gross_usdc as u128)
        .checked_mul(config.conversion_fee_bps as u128)
        .ok_or(ExodusError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(ExodusError::MathOverflow)? as u64;
    let usdc_received = gross_usdc
        .checked_sub(fee)
        .ok_or(ExodusError::MathOverflow)?;

    // 5. Slippage check
    require!(
        usdc_received >= pending.min_usdc_out,
        ExodusError::SlippageExceeded
    );

    // 6. Transfer USDC from protocol vault to yield source deposit vault
    let config_seeds: &[&[u8]] = &[ProtocolConfig::SEED, &[config.bump]];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.usdc_vault.to_account_info(),
                to: ctx.accounts.yield_deposit_vault.to_account_info(),
                authority: ctx.accounts.protocol_config.to_account_info(),
            },
            &[config_seeds],
        ),
        usdc_received,
    )?;

    // 7. Calculate shares from yield source NAV
    let ys = &ctx.accounts.yield_source;
    let shares = (usdc_received as u128)
        .checked_mul(1_000_000)
        .ok_or(ExodusError::MathOverflow)?
        .checked_div(ys.nav_per_share as u128)
        .ok_or(ExodusError::MathOverflow)? as u64;

    // 8. Update PendingDeposit
    let pending_mut = &mut ctx.accounts.pending_deposit;
    pending_mut.status = DepositStatus::Converted;
    pending_mut.conversion_rate = exchange_rate;
    pending_mut.usdc_received = usdc_received;
    pending_mut.fee_paid = fee;

    // 9. Update UserPosition
    let user_pos = &mut ctx.accounts.user_position;
    user_pos.current_shares = user_pos
        .current_shares
        .checked_add(shares)
        .ok_or(ExodusError::MathOverflow)?;
    user_pos.total_deposited_usdc = user_pos
        .total_deposited_usdc
        .checked_add(usdc_received)
        .ok_or(ExodusError::MathOverflow)?;

    // Update weighted average conversion rate
    let total_jpy = user_pos.total_deposited_jpy;
    if total_jpy > 0 {
        // Simplified: just store the latest rate for MVP
        user_pos.avg_conversion_rate = exchange_rate;
    }

    // 10. Update YieldSource
    let ys_mut = &mut ctx.accounts.yield_source;
    ys_mut.total_deposited = ys_mut
        .total_deposited
        .checked_add(usdc_received)
        .ok_or(ExodusError::MathOverflow)?;
    ys_mut.total_shares = ys_mut
        .total_shares
        .checked_add(shares)
        .ok_or(ExodusError::MathOverflow)?;

    // 11. Update ProtocolConfig
    let config_mut = &mut ctx.accounts.protocol_config;
    config_mut.total_deposits_usdc = config_mut
        .total_deposits_usdc
        .checked_add(usdc_received)
        .ok_or(ExodusError::MathOverflow)?;
    config_mut.pending_jpy_conversion = config_mut
        .pending_jpy_conversion
        .saturating_sub(jpy_amount);
    config_mut.updated_at = now;

    // 12. Create ConversionRecord
    let record = &mut ctx.accounts.conversion_record;
    record.user = pending_mut.user;
    record.protocol_config = config_mut.key();
    record.jpy_amount = jpy_amount;
    record.usdc_amount = usdc_received;
    record.exchange_rate = exchange_rate;
    record.fee_amount = fee;
    record.direction = ConversionDirection::JpyToUsdc;
    record.timestamp = now;
    record.nonce = pending_mut.nonce;
    record.bump = ctx.bumps.conversion_record;

    emit!(ConversionExecuted {
        user: pending_mut.user,
        jpy_amount,
        usdc_received,
        exchange_rate,
        fee_paid: fee,
        shares_issued: shares,
        nonce: pending_mut.nonce,
        timestamp: now,
    });

    emit!(ConversionRecordCreated {
        user: pending_mut.user,
        jpy_amount,
        usdc_amount: usdc_received,
        exchange_rate,
        direction: ConversionDirection::JpyToUsdc,
        nonce: pending_mut.nonce,
        timestamp: now,
    });

    msg!(
        "Conversion executed: {} JPY → {} USDC at rate {}, fee {}",
        jpy_amount,
        usdc_received,
        exchange_rate,
        fee
    );
    Ok(())
}
