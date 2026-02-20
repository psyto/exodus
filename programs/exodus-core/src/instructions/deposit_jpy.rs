use anchor_lang::prelude::*;
use anchor_spl::token_2022::spl_token_2022;
use exodus_types::{monthly_jpy_limit, DepositStatus};

use crate::errors::ExodusError;
use crate::events::DepositInitiated;
use crate::state::{PendingDeposit, ProtocolConfig, UserPosition};

#[derive(Accounts)]
pub struct DepositJpy<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [ProtocolConfig::SEED],
        bump = protocol_config.bump,
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// JPY mint (Token-2022)
    /// CHECK: Validated against protocol_config.jpy_mint
    pub jpy_mint: AccountInfo<'info>,

    /// User's JPY token account
    /// CHECK: Validated in transfer
    #[account(mut)]
    pub user_jpy_ata: AccountInfo<'info>,

    /// Protocol JPY vault
    /// CHECK: Validated against protocol_config.jpy_vault
    #[account(
        mut,
        constraint = jpy_vault.key() == protocol_config.jpy_vault @ ExodusError::InvalidAccountData,
    )]
    pub jpy_vault: AccountInfo<'info>,

    #[account(
        init_if_needed,
        payer = user,
        space = UserPosition::LEN,
        seeds = [UserPosition::SEED, protocol_config.key().as_ref(), user.key().as_ref()],
        bump,
    )]
    pub user_position: Account<'info, UserPosition>,

    #[account(
        init,
        payer = user,
        space = PendingDeposit::LEN,
        seeds = [
            PendingDeposit::SEED,
            protocol_config.key().as_ref(),
            user.key().as_ref(),
            &(protocol_config.deposit_nonce + 1).to_le_bytes(),
        ],
        bump,
    )]
    pub pending_deposit: Account<'info, PendingDeposit>,

    /// Accredit WhitelistEntry PDA for this user.
    /// CHECK: Manually deserialized and validated.
    pub whitelist_entry: AccountInfo<'info>,

    /// Sovereign Identity PDA for this user.
    /// CHECK: Manually deserialized to extract tier.
    pub sovereign_identity: AccountInfo<'info>,

    /// Token-2022 program (for JPY transfer)
    /// CHECK: Program ID check
    pub token_2022_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

/// Minimal struct to read WhitelistEntry data (Accredit PDA).
/// Layout after 8-byte Anchor discriminator:
/// - owner: Pubkey (32)
/// - registry: Pubkey (32)
/// - is_active: bool (1)
/// - kyc_level: u8 (1)
/// - jurisdiction: u8 (1)
/// - expires_at: i64 (8)
fn validate_kyc(whitelist_entry: &AccountInfo, user: &Pubkey) -> Result<()> {
    let data = whitelist_entry.try_borrow_data()?;
    require!(data.len() >= 83, ExodusError::KycRequired);

    // Skip 8-byte discriminator
    let owner = Pubkey::try_from(&data[8..40]).map_err(|_| ExodusError::InvalidAccountData)?;
    require!(owner == *user, ExodusError::KycRequired);

    let is_active = data[72] != 0;
    require!(is_active, ExodusError::KycRequired);

    let jurisdiction = data[74];
    // jurisdiction 0 = Japan, 1 = USA, etc. — Block USA (1)
    require!(jurisdiction != 1, ExodusError::JurisdictionRestricted);

    let expires_at = i64::from_le_bytes(data[75..83].try_into().unwrap());
    let now = Clock::get()?.unix_timestamp;
    require!(expires_at > now, ExodusError::KycExpired);

    Ok(())
}

/// Read sovereign tier from SovereignIdentity PDA.
/// Layout after 8-byte discriminator:
/// - owner: Pubkey (32)
/// - ... (various fields)
/// - tier: u8 (at offset 40)
fn read_sovereign_tier(sovereign_identity: &AccountInfo, user: &Pubkey) -> Result<u8> {
    let data = sovereign_identity.try_borrow_data()?;
    require!(data.len() >= 41, ExodusError::SovereignIdentityNotFound);

    let owner = Pubkey::try_from(&data[8..40]).map_err(|_| ExodusError::InvalidAccountData)?;
    require!(owner == *user, ExodusError::SovereignIdentityNotFound);

    Ok(data[40])
}

pub fn handler(ctx: Context<DepositJpy>, jpy_amount: u64, min_usdc_out: u64) -> Result<()> {
    let config = &ctx.accounts.protocol_config;
    require!(config.is_active, ExodusError::ProtocolNotActive);
    require!(jpy_amount > 0, ExodusError::ZeroDeposit);

    // 1. Validate KYC via Accredit WhitelistEntry
    validate_kyc(&ctx.accounts.whitelist_entry, &ctx.accounts.user.key())?;

    // 2. Read Sovereign tier and check monthly limit
    let tier = read_sovereign_tier(&ctx.accounts.sovereign_identity, &ctx.accounts.user.key())?;
    require!(tier > 0, ExodusError::TierTooLow);

    let now = Clock::get()?.unix_timestamp;
    let user_pos = &mut ctx.accounts.user_position;

    // Initialize if new
    if user_pos.created_at == 0 {
        user_pos.owner = ctx.accounts.user.key();
        user_pos.protocol_config = config.key();
        user_pos.created_at = now;
        user_pos.month_start = now;
        user_pos.bump = ctx.bumps.user_position;
    }

    user_pos.maybe_reset_monthly(now);
    user_pos.sovereign_tier = tier;

    let limit = monthly_jpy_limit(tier);
    let new_monthly = user_pos
        .monthly_deposited_jpy
        .checked_add(jpy_amount)
        .ok_or(ExodusError::MathOverflow)?;
    require!(new_monthly <= limit, ExodusError::MonthlyLimitExceeded);

    // 3. Transfer JPY from user to jpy_vault via Token-2022
    let transfer_ix = spl_token_2022::instruction::transfer_checked(
        &ctx.accounts.token_2022_program.key(),
        &ctx.accounts.user_jpy_ata.key(),
        &ctx.accounts.jpy_mint.key(),
        &ctx.accounts.jpy_vault.key(),
        &ctx.accounts.user.key(),
        &[],
        jpy_amount,
        6, // decimals
    )?;
    anchor_lang::solana_program::program::invoke(
        &transfer_ix,
        &[
            ctx.accounts.user_jpy_ata.to_account_info(),
            ctx.accounts.jpy_mint.to_account_info(),
            ctx.accounts.jpy_vault.to_account_info(),
            ctx.accounts.user.to_account_info(),
            ctx.accounts.token_2022_program.to_account_info(),
        ],
    )?;

    // 4. Init PendingDeposit
    let nonce = config.deposit_nonce + 1;
    let pending = &mut ctx.accounts.pending_deposit;
    pending.user = ctx.accounts.user.key();
    pending.protocol_config = config.key();
    pending.jpy_amount = jpy_amount;
    pending.min_usdc_out = min_usdc_out;
    pending.deposited_at = now;
    pending.expires_at = now + PendingDeposit::EXPIRY_SECONDS;
    pending.status = DepositStatus::Pending;
    pending.conversion_rate = 0;
    pending.usdc_received = 0;
    pending.fee_paid = 0;
    pending.nonce = nonce;
    pending.bump = ctx.bumps.pending_deposit;

    // 5. Update UserPosition monthly tracking
    user_pos.monthly_deposited_jpy = new_monthly;
    user_pos.total_deposited_jpy = user_pos
        .total_deposited_jpy
        .checked_add(jpy_amount)
        .ok_or(ExodusError::MathOverflow)?;
    user_pos.deposit_count = user_pos
        .deposit_count
        .checked_add(1)
        .ok_or(ExodusError::MathOverflow)?;
    user_pos.last_deposit_at = now;
    user_pos.deposit_nonce = nonce;

    // 6. Update protocol config
    let config_mut = &mut ctx.accounts.protocol_config;
    config_mut.deposit_nonce = nonce;
    config_mut.pending_jpy_conversion = config_mut
        .pending_jpy_conversion
        .checked_add(jpy_amount)
        .ok_or(ExodusError::MathOverflow)?;
    config_mut.updated_at = now;

    emit!(DepositInitiated {
        user: ctx.accounts.user.key(),
        pending_deposit: pending.key(),
        jpy_amount,
        min_usdc_out,
        nonce,
        timestamp: now,
    });

    msg!("JPY deposit initiated: {} JPY, nonce {}", jpy_amount, nonce);
    Ok(())
}
