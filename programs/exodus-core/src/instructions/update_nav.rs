use anchor_lang::prelude::*;

use crate::errors::ExodusError;
use crate::events::NavUpdated;
use crate::state::{ProtocolConfig, YieldSource};

/// Reads the T-Bill vault's NAV per share.
/// VaultConfig layout after 8-byte discriminator:
///   authority(32) + usdc_mint(32) + share_mint(32) + usdc_vault(32)
///   + target_apy_bps(2) + total_deposits(8) + total_shares(8)
///   + nav_per_share(8) ...
const TBILL_NAV_OFFSET: usize = 8 + 32 + 32 + 32 + 32 + 2 + 8 + 8;

#[derive(Accounts)]
pub struct UpdateNav<'info> {
    /// Keeper that triggers the NAV update
    pub keeper: Signer<'info>,

    #[account(
        mut,
        seeds = [ProtocolConfig::SEED],
        bump = protocol_config.bump,
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        seeds = [
            YieldSource::SEED,
            protocol_config.key().as_ref(),
            yield_source.token_mint.as_ref(),
        ],
        bump = yield_source.bump,
    )]
    pub yield_source: Account<'info, YieldSource>,

    /// The T-Bill VaultConfig account to read NAV from
    /// CHECK: Manually deserialized
    pub tbill_vault_config: AccountInfo<'info>,
}

pub fn handler(ctx: Context<UpdateNav>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    // Read NAV from T-Bill vault
    let vault_data = ctx.accounts.tbill_vault_config.try_borrow_data()?;
    require!(
        vault_data.len() >= TBILL_NAV_OFFSET + 8,
        ExodusError::InvalidAccountData
    );

    let new_nav = u64::from_le_bytes(
        vault_data[TBILL_NAV_OFFSET..TBILL_NAV_OFFSET + 8]
            .try_into()
            .unwrap(),
    );
    drop(vault_data);

    require!(new_nav > 0, ExodusError::InvalidAccountData);

    let old_nav = ctx.accounts.yield_source.nav_per_share;

    // Update yield source NAV
    let ys = &mut ctx.accounts.yield_source;
    ys.nav_per_share = new_nav;
    ys.last_nav_update = now;

    // Read T-Bill vault's APY (offset = nav_offset - 8 - 8 - 2 → target_apy_bps)
    // Actually, let's read it properly
    let vault_data = ctx.accounts.tbill_vault_config.try_borrow_data()?;
    let apy_offset = 8 + 32 + 32 + 32 + 32; // after authority, usdc_mint, share_mint, usdc_vault
    if vault_data.len() >= apy_offset + 2 {
        let apy_bps = u16::from_le_bytes(vault_data[apy_offset..apy_offset + 2].try_into().unwrap());
        ys.current_apy_bps = apy_bps;
    }
    drop(vault_data);

    // Update protocol config timestamp
    ctx.accounts.protocol_config.updated_at = now;

    emit!(NavUpdated {
        yield_source: ys.key(),
        old_nav,
        new_nav,
        timestamp: now,
    });

    msg!("NAV updated: {} → {}", old_nav, new_nav);
    Ok(())
}
