use anchor_lang::prelude::*;
use anchor_spl::token_2022::spl_token_2022;
use anchor_spl::token_interface::TokenInterface;
use exodus_types::{monthly_jpy_limit, DepositStatus};

use crate::errors::ExodusError;
use crate::events::DepositInitiated;
use crate::state::{PendingDeposit, ProtocolConfig, UserPosition};

/// Accredit transfer-hook WhitelistEntry PDA prefix: ["whitelist", wallet]
pub const WHITELIST_SEED: &[u8] = b"whitelist";
/// Sovereign SovereignIdentity PDA prefix: ["identity", owner]
pub const SOVEREIGN_IDENTITY_SEED: &[u8] = b"identity";

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
    /// CHECK: Owned by the configured KYC program at ["whitelist", user]; fields read in the handler.
    #[account(
        owner = protocol_config.kyc_registry @ ExodusError::KycRequired,
        seeds = [WHITELIST_SEED, user.key().as_ref()],
        bump,
        seeds::program = protocol_config.kyc_registry,
    )]
    pub whitelist_entry: AccountInfo<'info>,

    /// Sovereign Identity PDA for this user.
    /// CHECK: Owned by the configured Sovereign program at ["identity", user]; tier read in the handler.
    #[account(
        owner = protocol_config.sovereign_program @ ExodusError::SovereignIdentityNotFound,
        seeds = [SOVEREIGN_IDENTITY_SEED, user.key().as_ref()],
        bump,
        seeds::program = protocol_config.sovereign_program,
    )]
    pub sovereign_identity: AccountInfo<'info>,

    /// Token program for the JPY transfer: Token-2022, or SPL Token for a
    /// classic test mint. Interface pins the key to one of those two programs.
    pub token_2022_program: Interface<'info, TokenInterface>,

    pub system_program: Program<'info, System>,
}

// Accredit transfer-hook WhitelistEntry layout (after the 8-byte discriminator):
// wallet(32) registry(32) kyc_level(1) jurisdiction(1) kyc_hash(32) is_active(1)
// daily_limit(8) daily_volume(8) volume_reset_time(8) verified_at(8)
// expiry_timestamp(8) last_activity(8) created_at(8) bump(1)
const WL_OFFSET_WALLET: usize = 8;
const WL_OFFSET_REGISTRY: usize = 8 + 32; // 40
const WL_OFFSET_JURISDICTION: usize = 8 + 32 + 32 + 1; // 73
const WL_OFFSET_IS_ACTIVE: usize = 8 + 32 + 32 + 1 + 1 + 32; // 106
const WL_OFFSET_EXPIRY: usize = WL_OFFSET_IS_ACTIVE + 1 + 8 + 8 + 8 + 8; // 139
const WL_MIN_SIZE: usize = WL_OFFSET_EXPIRY + 8 + 8 + 8 + 1; // 164
/// Accredit Jurisdiction::Usa
const JURISDICTION_USA: u8 = 4;
/// Accredit KycRegistry PDA prefix: ["kyc_registry", mint]
pub const KYC_REGISTRY_SEED: &[u8] = b"kyc_registry";

// Sovereign SovereignIdentity layout: owner(32) created_at(8) 5 authorities(32 each)
// 6 scores(u16 each) tier(u8) ...
const SOV_OFFSET_OWNER: usize = 8;
const SOV_OFFSET_TIER: usize = 8 + 32 + 8 + 32 * 5 + 2 * 6; // 220

/// The registry whose whitelist entries the protocol trusts: Accredit's
/// KycRegistry PDA for the protocol's JPY mint, under the configured KYC program.
pub(crate) fn trusted_kyc_registry(config: &ProtocolConfig) -> Pubkey {
    Pubkey::find_program_address(
        &[KYC_REGISTRY_SEED, config.jpy_mint.as_ref()],
        &config.kyc_registry,
    )
    .0
}

/// Validate an Accredit WhitelistEntry (owner program and PDA are pinned by
/// the account constraints).
pub(crate) fn validate_kyc(whitelist_entry: &AccountInfo, user: &Pubkey, registry: &Pubkey) -> Result<()> {
    let data = whitelist_entry.try_borrow_data()?;
    require!(data.len() >= WL_MIN_SIZE, ExodusError::KycRequired);

    let wallet = Pubkey::try_from(&data[WL_OFFSET_WALLET..WL_OFFSET_WALLET + 32])
        .map_err(|_| ExodusError::InvalidAccountData)?;
    require!(wallet == *user, ExodusError::KycRequired);

    let entry_registry = Pubkey::try_from(&data[WL_OFFSET_REGISTRY..WL_OFFSET_REGISTRY + 32])
        .map_err(|_| ExodusError::InvalidAccountData)?;
    require!(entry_registry == *registry, ExodusError::KycRequired);

    require!(data[WL_OFFSET_IS_ACTIVE] == 1, ExodusError::KycRequired);

    require!(
        data[WL_OFFSET_JURISDICTION] != JURISDICTION_USA,
        ExodusError::JurisdictionRestricted
    );

    // Accredit semantics: expiry 0 = no expiry
    let expires_at = i64::from_le_bytes(
        data[WL_OFFSET_EXPIRY..WL_OFFSET_EXPIRY + 8].try_into().unwrap(),
    );
    if expires_at != 0 {
        require!(expires_at > Clock::get()?.unix_timestamp, ExodusError::KycExpired);
    }

    Ok(())
}

/// Read the tier from a Sovereign SovereignIdentity PDA.
pub(crate) fn read_sovereign_tier(sovereign_identity: &AccountInfo, user: &Pubkey) -> Result<u8> {
    let data = sovereign_identity.try_borrow_data()?;
    require!(data.len() > SOV_OFFSET_TIER, ExodusError::SovereignIdentityNotFound);

    let owner = Pubkey::try_from(&data[SOV_OFFSET_OWNER..SOV_OFFSET_OWNER + 32])
        .map_err(|_| ExodusError::InvalidAccountData)?;
    require!(owner == *user, ExodusError::SovereignIdentityNotFound);

    Ok(data[SOV_OFFSET_TIER])
}

pub fn handler(ctx: Context<DepositJpy>, jpy_amount: u64, min_usdc_out: u64) -> Result<()> {
    let config = &ctx.accounts.protocol_config;
    require!(config.is_active, ExodusError::ProtocolNotActive);
    require!(jpy_amount > 0, ExodusError::ZeroDeposit);

    // 1. Validate KYC via Accredit WhitelistEntry
    validate_kyc(
        &ctx.accounts.whitelist_entry,
        &ctx.accounts.user.key(),
        &trusted_kyc_registry(config),
    )?;

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
