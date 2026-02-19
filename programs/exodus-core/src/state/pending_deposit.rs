use anchor_lang::prelude::*;
use exodus_types::DepositStatus;

/// Pending JPY deposit awaiting conversion. PDA seeds: ["pending_deposit", config, user, nonce_bytes]
#[account]
#[derive(Debug)]
pub struct PendingDeposit {
    /// Depositor
    pub user: Pubkey,
    /// Reference to ProtocolConfig
    pub protocol_config: Pubkey,
    /// JPY amount deposited (minor units)
    pub jpy_amount: u64,
    /// Minimum USDC output (slippage protection)
    pub min_usdc_out: u64,
    /// Deposit timestamp
    pub deposited_at: i64,
    /// Expiry timestamp (24h after deposit)
    pub expires_at: i64,
    /// Current status
    pub status: DepositStatus,
    /// Conversion rate used (JPY per USD, scaled 1e6) — set on conversion
    pub conversion_rate: u64,
    /// USDC received after conversion — set on conversion
    pub usdc_received: u64,
    /// Fee paid in USDC — set on conversion
    pub fee_paid: u64,
    /// Deposit nonce (unique per user)
    pub nonce: u64,
    /// PDA bump
    pub bump: u8,
}

impl PendingDeposit {
    pub const LEN: usize = 8  // discriminator
        + 32  // user
        + 32  // protocol_config
        + 8   // jpy_amount
        + 8   // min_usdc_out
        + 8   // deposited_at
        + 8   // expires_at
        + 1   // status (enum)
        + 8   // conversion_rate
        + 8   // usdc_received
        + 8   // fee_paid
        + 8   // nonce
        + 1;  // bump

    pub const SEED: &'static [u8] = b"pending_deposit";

    /// 24 hours in seconds
    pub const EXPIRY_SECONDS: i64 = 24 * 60 * 60;
}
