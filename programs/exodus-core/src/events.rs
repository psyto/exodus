use anchor_lang::prelude::*;
use exodus_types::ConversionDirection;

#[event]
pub struct ProtocolInitialized {
    pub authority: Pubkey,
    pub jpy_mint: Pubkey,
    pub usdc_mint: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct YieldSourceRegistered {
    pub yield_source: Pubkey,
    pub name: [u8; 32],
    pub source_type: u8,
    pub token_mint: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct DepositInitiated {
    pub user: Pubkey,
    pub pending_deposit: Pubkey,
    pub jpy_amount: u64,
    pub min_usdc_out: u64,
    pub nonce: u64,
    pub timestamp: i64,
}

#[event]
pub struct DirectUsdcDeposit {
    pub user: Pubkey,
    pub usdc_amount: u64,
    pub shares_received: u64,
    pub timestamp: i64,
}

#[event]
pub struct ConversionExecuted {
    pub user: Pubkey,
    pub jpy_amount: u64,
    pub usdc_received: u64,
    pub exchange_rate: u64,
    pub fee_paid: u64,
    pub shares_issued: u64,
    pub nonce: u64,
    pub timestamp: i64,
}

#[event]
pub struct WithdrawalExecuted {
    pub user: Pubkey,
    pub shares_burned: u64,
    pub usdc_received: u64,
    pub timestamp: i64,
}

#[event]
pub struct YieldClaimed {
    pub user: Pubkey,
    pub yield_amount: u64,
    pub performance_fee: u64,
    pub net_yield: u64,
    pub timestamp: i64,
}

#[event]
pub struct NavUpdated {
    pub yield_source: Pubkey,
    pub old_nav: u64,
    pub new_nav: u64,
    pub timestamp: i64,
}

#[event]
pub struct ProtocolPaused {
    pub authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ProtocolResumed {
    pub authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ConversionRecordCreated {
    pub user: Pubkey,
    pub jpy_amount: u64,
    pub usdc_amount: u64,
    pub exchange_rate: u64,
    pub direction: ConversionDirection,
    pub nonce: u64,
    pub timestamp: i64,
}
