use anchor_lang::prelude::*;
use exodus_types::ConversionDirection;

/// Historical conversion record. PDA seeds: ["conversion", config, user, nonce_bytes]
#[account]
#[derive(Debug)]
pub struct ConversionRecord {
    /// User who initiated the conversion
    pub user: Pubkey,
    /// Reference to ProtocolConfig
    pub protocol_config: Pubkey,
    /// JPY amount (minor units)
    pub jpy_amount: u64,
    /// USDC amount (minor units)
    pub usdc_amount: u64,
    /// Exchange rate used (JPY per USD, scaled 1e6)
    pub exchange_rate: u64,
    /// Fee amount in USDC (minor units)
    pub fee_amount: u64,
    /// Direction of conversion
    pub direction: ConversionDirection,
    /// Timestamp of conversion
    pub timestamp: i64,
    /// Conversion nonce
    pub nonce: u64,
    /// PDA bump
    pub bump: u8,
}

impl ConversionRecord {
    pub const LEN: usize = 8  // discriminator
        + 32  // user
        + 32  // protocol_config
        + 8   // jpy_amount
        + 8   // usdc_amount
        + 8   // exchange_rate
        + 8   // fee_amount
        + 1   // direction (enum)
        + 8   // timestamp
        + 8   // nonce
        + 1;  // bump

    pub const SEED: &'static [u8] = b"conversion";
}
