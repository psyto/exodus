use anchor_lang::prelude::*;

/// Global vault configuration. PDA seeds: ["tbill_vault"]
#[account]
#[derive(Debug)]
pub struct VaultConfig {
    /// Authority that can admin the vault
    pub authority: Pubkey,
    /// USDC mint address
    pub usdc_mint: Pubkey,
    /// Share token mint (minted to represent vault shares)
    pub share_mint: Pubkey,
    /// Token account holding vault's USDC deposits
    pub usdc_vault: Pubkey,
    /// Target APY in basis points (e.g., 450 = 4.50%)
    pub target_apy_bps: u16,
    /// Total USDC deposited (accounting value, not vault balance)
    pub total_deposits: u64,
    /// Total shares outstanding
    pub total_shares: u64,
    /// NAV per share scaled by 1e6 (starts at 1_000_000 = 1.000000 USDC)
    pub nav_per_share: u64,
    /// Last time yield was accrued (unix timestamp)
    pub last_accrual: i64,
    /// Whether vault accepts deposits/withdrawals
    pub is_active: bool,
    /// PDA bump for VaultConfig
    pub bump: u8,
    /// PDA bump for share_mint
    pub share_mint_bump: u8,
    /// PDA bump for usdc_vault token account
    pub vault_bump: u8,
}

impl VaultConfig {
    pub const LEN: usize = 8  // discriminator
        + 32  // authority
        + 32  // usdc_mint
        + 32  // share_mint
        + 32  // usdc_vault
        + 2   // target_apy_bps
        + 8   // total_deposits
        + 8   // total_shares
        + 8   // nav_per_share
        + 8   // last_accrual
        + 1   // is_active
        + 1   // bump
        + 1   // share_mint_bump
        + 1;  // vault_bump

    pub const SEED: &'static [u8] = b"tbill_vault";
    pub const USDC_VAULT_SEED: &'static [u8] = b"tbill_usdc_vault";
    pub const SHARE_MINT_SEED: &'static [u8] = b"tbill_share_mint";
}

/// Per-user share tracking. PDA seeds: ["tbill_shares", vault, user]
#[account]
#[derive(Debug)]
pub struct UserShares {
    /// User who owns these shares
    pub user: Pubkey,
    /// Reference to the VaultConfig
    pub vault: Pubkey,
    /// Number of share tokens held
    pub shares: u64,
    /// Total USDC deposited by this user (for P&L tracking)
    pub deposited_usdc: u64,
    /// Timestamp of last deposit
    pub last_deposit_at: i64,
    /// PDA bump
    pub bump: u8,
}

impl UserShares {
    pub const LEN: usize = 8  // discriminator
        + 32  // user
        + 32  // vault
        + 8   // shares
        + 8   // deposited_usdc
        + 8   // last_deposit_at
        + 1;  // bump

    pub const SEED: &'static [u8] = b"tbill_shares";
}
