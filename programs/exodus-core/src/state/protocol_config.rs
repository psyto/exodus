use anchor_lang::prelude::*;

/// Global protocol configuration. PDA seeds: ["exodus_config"]
#[account]
#[derive(Debug)]
pub struct ProtocolConfig {
    /// Admin authority
    pub authority: Pubkey,
    /// JPY stablecoin mint (Token-2022)
    pub jpy_mint: Pubkey,
    /// USDC mint (SPL Token)
    pub usdc_mint: Pubkey,
    /// Protocol JPY vault token account
    pub jpy_vault: Pubkey,
    /// Protocol USDC vault token account
    pub usdc_vault: Pubkey,
    /// Price oracle account (JPY/USD PriceFeed)
    pub oracle: Pubkey,
    /// Accredit KYC registry program ID
    pub kyc_registry: Pubkey,
    /// Sovereign identity program ID
    pub sovereign_program: Pubkey,
    /// Fee for JPY↔USDC conversion (basis points)
    pub conversion_fee_bps: u16,
    /// Management fee on AUM (basis points, annualized)
    pub management_fee_bps: u16,
    /// Performance fee on yield (basis points)
    pub performance_fee_bps: u16,
    /// Total USDC deposits across all yield sources
    pub total_deposits_usdc: u64,
    /// Total yield earned across all users
    pub total_yield_earned: u64,
    /// Total JPY pending conversion
    pub pending_jpy_conversion: u64,
    /// Nonce for deposit IDs
    pub deposit_nonce: u64,
    /// Protocol active flag
    pub is_active: bool,
    /// Creation timestamp
    pub created_at: i64,
    /// Last update timestamp
    pub updated_at: i64,
    /// PDA bump
    pub bump: u8,
    /// JPY vault PDA bump
    pub jpy_vault_bump: u8,
    /// USDC vault PDA bump
    pub usdc_vault_bump: u8,
}

impl ProtocolConfig {
    pub const LEN: usize = 8  // discriminator
        + 32  // authority
        + 32  // jpy_mint
        + 32  // usdc_mint
        + 32  // jpy_vault
        + 32  // usdc_vault
        + 32  // oracle
        + 32  // kyc_registry
        + 32  // sovereign_program
        + 2   // conversion_fee_bps
        + 2   // management_fee_bps
        + 2   // performance_fee_bps
        + 8   // total_deposits_usdc
        + 8   // total_yield_earned
        + 8   // pending_jpy_conversion
        + 8   // deposit_nonce
        + 1   // is_active
        + 8   // created_at
        + 8   // updated_at
        + 1   // bump
        + 1   // jpy_vault_bump
        + 1;  // usdc_vault_bump

    pub const SEED: &'static [u8] = b"exodus_config";
    pub const JPY_VAULT_SEED: &'static [u8] = b"exodus_jpy_vault";
    pub const USDC_VAULT_SEED: &'static [u8] = b"exodus_usdc_vault";
}
