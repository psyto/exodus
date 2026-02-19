use anchor_lang::prelude::*;

/// Per-user position tracking. PDA seeds: ["user_position", config, owner]
#[account]
#[derive(Debug)]
pub struct UserPosition {
    /// Position owner
    pub owner: Pubkey,
    /// Reference to ProtocolConfig
    pub protocol_config: Pubkey,
    /// Total JPY deposited (lifetime, minor units)
    pub total_deposited_jpy: u64,
    /// Total USDC deposited (lifetime, minor units)
    pub total_deposited_usdc: u64,
    /// Current shares held across all yield sources
    pub current_shares: u64,
    /// Unrealized yield in USDC minor units
    pub unrealized_yield_usdc: u64,
    /// Realized yield in USDC minor units (already withdrawn)
    pub realized_yield_usdc: u64,
    /// Weighted average JPY/USD conversion rate (scaled 1e6)
    pub avg_conversion_rate: u64,
    /// User's Sovereign tier at last check
    pub sovereign_tier: u8,
    /// JPY deposited in current month (minor units)
    pub monthly_deposited_jpy: u64,
    /// USDC deposited in current month (minor units)
    pub monthly_deposited_usdc: u64,
    /// Timestamp of current month start
    pub month_start: i64,
    /// Total number of deposits
    pub deposit_count: u32,
    /// Total number of withdrawals
    pub withdrawal_count: u32,
    /// Last deposit timestamp
    pub last_deposit_at: i64,
    /// Last withdrawal timestamp
    pub last_withdrawal_at: i64,
    /// User's deposit nonce (for PendingDeposit PDAs)
    pub deposit_nonce: u64,
    /// Account creation timestamp
    pub created_at: i64,
    /// PDA bump
    pub bump: u8,
}

impl UserPosition {
    pub const LEN: usize = 8  // discriminator
        + 32  // owner
        + 32  // protocol_config
        + 8   // total_deposited_jpy
        + 8   // total_deposited_usdc
        + 8   // current_shares
        + 8   // unrealized_yield_usdc
        + 8   // realized_yield_usdc
        + 8   // avg_conversion_rate
        + 1   // sovereign_tier
        + 8   // monthly_deposited_jpy
        + 8   // monthly_deposited_usdc
        + 8   // month_start
        + 4   // deposit_count
        + 4   // withdrawal_count
        + 8   // last_deposit_at
        + 8   // last_withdrawal_at
        + 8   // deposit_nonce
        + 8   // created_at
        + 1;  // bump

    pub const SEED: &'static [u8] = b"user_position";

    /// Reset monthly counters if we're in a new month.
    pub fn maybe_reset_monthly(&mut self, now: i64) {
        // Simple 30-day rolling window
        const MONTH_SECONDS: i64 = 30 * 24 * 60 * 60;
        if now - self.month_start >= MONTH_SECONDS {
            self.monthly_deposited_jpy = 0;
            self.monthly_deposited_usdc = 0;
            self.month_start = now;
        }
    }
}
