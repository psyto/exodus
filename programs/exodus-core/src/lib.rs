use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("A59QJtaFuap54ZBq8GfMDAAW7tWCJ4hHAGrbL8v22ZRU");

#[program]
pub mod exodus_core {
    use super::*;

    pub fn initialize_protocol(
        ctx: Context<InitializeProtocol>,
        params: InitializeProtocolParams,
    ) -> Result<()> {
        instructions::initialize_protocol::handler(ctx, params)
    }

    pub fn register_yield_source(
        ctx: Context<RegisterYieldSource>,
        params: RegisterYieldSourceParams,
    ) -> Result<()> {
        instructions::register_yield_source::handler(ctx, params)
    }

    pub fn deposit_jpy(
        ctx: Context<DepositJpy>,
        jpy_amount: u64,
        min_usdc_out: u64,
    ) -> Result<()> {
        instructions::deposit_jpy::handler(ctx, jpy_amount, min_usdc_out)
    }

    pub fn deposit_usdc(ctx: Context<DepositUsdc>, usdc_amount: u64) -> Result<()> {
        instructions::deposit_usdc::handler(ctx, usdc_amount)
    }

    pub fn execute_conversion(ctx: Context<ExecuteConversion>) -> Result<()> {
        instructions::execute_conversion::handler(ctx)
    }

    pub fn withdraw(ctx: Context<Withdraw>, shares: u64, withdraw_as_jpy: bool) -> Result<()> {
        instructions::withdraw::handler(ctx, shares, withdraw_as_jpy)
    }

    pub fn claim_yield(ctx: Context<ClaimYield>) -> Result<()> {
        instructions::claim_yield::handler(ctx)
    }

    pub fn update_nav(ctx: Context<UpdateNav>) -> Result<()> {
        instructions::update_nav::handler(ctx)
    }

    pub fn update_protocol_config(
        ctx: Context<UpdateProtocolConfig>,
        params: UpdateProtocolConfigParams,
    ) -> Result<()> {
        instructions::admin::handle_update_protocol_config(ctx, params)
    }

    pub fn update_yield_source(
        ctx: Context<UpdateYieldSource>,
        params: UpdateYieldSourceParams,
    ) -> Result<()> {
        instructions::admin::handle_update_yield_source(ctx, params)
    }

    pub fn pause_protocol(ctx: Context<PauseProtocol>) -> Result<()> {
        instructions::admin::handle_pause_protocol(ctx)
    }

    pub fn resume_protocol(ctx: Context<PauseProtocol>) -> Result<()> {
        instructions::admin::handle_resume_protocol(ctx)
    }
}
