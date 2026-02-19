import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, TransactionInstruction, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  findProtocolConfigPda,
  findYieldSourcePda,
  findJpyVaultPda,
  findUsdcVaultPda,
} from "../pda";

// ─── initializeProtocol ──────────────────────────────────────────────────────

export interface InitializeProtocolParams {
  oracle: PublicKey;
  kycRegistry: PublicKey;
  sovereignProgram: PublicKey;
  conversionFeeBps: number;
  managementFeeBps: number;
  performanceFeeBps: number;
}

export interface BuildInitializeProtocolAccounts {
  /** JPY stablecoin mint (Token-2022). */
  jpyMint: PublicKey;
  /** USDC mint (SPL Token). */
  usdcMint: PublicKey;
  /** Token-2022 program ID (needed to initialise the JPY vault). */
  token2022Program: PublicKey;
}

/**
 * Build an `initializeProtocol` TransactionInstruction.
 *
 * Creates the global ProtocolConfig PDA, the protocol JPY vault, and the
 * protocol USDC vault.  Can only be called once (the PDA seed is a
 * singleton).
 *
 * @param program   - Anchor Program instance for exodus-core.
 * @param authority - The deployer / admin wallet (signer / fee-payer).
 * @param params    - Configuration parameters for the new protocol.
 * @param accounts  - Mint addresses and Token-2022 program ID.
 */
export async function buildInitializeProtocolIx(
  program: Program,
  authority: PublicKey,
  params: InitializeProtocolParams,
  accounts: BuildInitializeProtocolAccounts,
): Promise<TransactionInstruction> {
  const programId = program.programId;
  const [protocolConfig] = findProtocolConfigPda(programId);
  const [jpyVault] = findJpyVaultPda(programId);
  const [usdcVault] = findUsdcVaultPda(programId);

  return program.methods
    .initializeProtocol({
      oracle: params.oracle,
      kycRegistry: params.kycRegistry,
      sovereignProgram: params.sovereignProgram,
      conversionFeeBps: params.conversionFeeBps,
      managementFeeBps: params.managementFeeBps,
      performanceFeeBps: params.performanceFeeBps,
    })
    .accounts({
      authority,
      protocolConfig,
      jpyMint: accounts.jpyMint,
      usdcMint: accounts.usdcMint,
      jpyVault,
      usdcVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      token2022Program: accounts.token2022Program,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .instruction();
}

// ─── registerYieldSource ─────────────────────────────────────────────────────

export interface RegisterYieldSourceParams {
  /** 32-byte name (padded with zeroes). */
  name: number[];
  /** Numeric yield-source type enum value (e.g. 0 = TBill). */
  sourceType: object;
  /** Vault that holds deposited USDC for this yield source. */
  depositVault: PublicKey;
  /** Vault that holds the yield-bearing token (e.g. T-Bill shares). */
  yieldTokenVault: PublicKey;
  /** Allocation weight in basis points. */
  allocationWeightBps: number;
  /** Minimum deposit amount (6-decimal USDC). */
  minDeposit: BN;
  /** Maximum total allocation (6-decimal USDC). */
  maxAllocation: BN;
}

export interface BuildRegisterYieldSourceAccounts {
  /** The SPL token mint that identifies this yield source. */
  tokenMint: PublicKey;
}

/**
 * Build a `registerYieldSource` TransactionInstruction.
 *
 * Creates a new YieldSource PDA that the protocol can route deposits
 * into.  Only callable by the protocol authority.
 *
 * @param program   - Anchor Program instance for exodus-core.
 * @param authority - The protocol authority wallet (signer / fee-payer).
 * @param params    - Yield source configuration parameters.
 * @param accounts  - The token mint for the new yield source.
 */
export async function buildRegisterYieldSourceIx(
  program: Program,
  authority: PublicKey,
  params: RegisterYieldSourceParams,
  accounts: BuildRegisterYieldSourceAccounts,
): Promise<TransactionInstruction> {
  const programId = program.programId;
  const [protocolConfig] = findProtocolConfigPda(programId);
  const [yieldSource] = findYieldSourcePda(protocolConfig, accounts.tokenMint, programId);

  return program.methods
    .registerYieldSource({
      name: params.name,
      sourceType: params.sourceType,
      depositVault: params.depositVault,
      yieldTokenVault: params.yieldTokenVault,
      allocationWeightBps: params.allocationWeightBps,
      minDeposit: params.minDeposit,
      maxAllocation: params.maxAllocation,
    })
    .accounts({
      authority,
      protocolConfig,
      tokenMint: accounts.tokenMint,
      yieldSource,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

// ─── updateProtocolConfig ────────────────────────────────────────────────────

export interface UpdateProtocolConfigParams {
  oracle: PublicKey | null;
  conversionFeeBps: number | null;
  managementFeeBps: number | null;
  performanceFeeBps: number | null;
}

/**
 * Build an `updateProtocolConfig` TransactionInstruction.
 *
 * Updates one or more mutable fields on the ProtocolConfig PDA.  Only
 * callable by the protocol authority.
 *
 * @param program   - Anchor Program instance for exodus-core.
 * @param authority - The protocol authority wallet (signer).
 * @param params    - Fields to update.  Pass `null` for any field that
 *                    should remain unchanged.
 */
export async function buildUpdateProtocolConfigIx(
  program: Program,
  authority: PublicKey,
  params: UpdateProtocolConfigParams,
): Promise<TransactionInstruction> {
  const programId = program.programId;
  const [protocolConfig] = findProtocolConfigPda(programId);

  return program.methods
    .updateProtocolConfig({
      oracle: params.oracle,
      conversionFeeBps: params.conversionFeeBps,
      managementFeeBps: params.managementFeeBps,
      performanceFeeBps: params.performanceFeeBps,
    })
    .accounts({
      authority,
      protocolConfig,
    })
    .instruction();
}

// ─── updateYieldSource ───────────────────────────────────────────────────────

export interface UpdateYieldSourceParams {
  allocationWeightBps: number | null;
  minDeposit: BN | null;
  maxAllocation: BN | null;
  isActive: boolean | null;
}

export interface BuildUpdateYieldSourceAccounts {
  /** The token mint that identifies the yield source to update. */
  yieldSourceMint: PublicKey;
}

/**
 * Build an `updateYieldSource` TransactionInstruction.
 *
 * Updates one or more mutable fields on a YieldSource PDA.  Only
 * callable by the protocol authority.
 *
 * @param program   - Anchor Program instance for exodus-core.
 * @param authority - The protocol authority wallet (signer).
 * @param params    - Fields to update.  Pass `null` for any field that
 *                    should remain unchanged.
 * @param accounts  - The yield source's token mint (used to derive its PDA).
 */
export async function buildUpdateYieldSourceIx(
  program: Program,
  authority: PublicKey,
  params: UpdateYieldSourceParams,
  accounts: BuildUpdateYieldSourceAccounts,
): Promise<TransactionInstruction> {
  const programId = program.programId;
  const [protocolConfig] = findProtocolConfigPda(programId);
  const [yieldSource] = findYieldSourcePda(protocolConfig, accounts.yieldSourceMint, programId);

  return program.methods
    .updateYieldSource({
      allocationWeightBps: params.allocationWeightBps,
      minDeposit: params.minDeposit,
      maxAllocation: params.maxAllocation,
      isActive: params.isActive,
    })
    .accounts({
      authority,
      protocolConfig,
      yieldSource,
    })
    .instruction();
}

// ─── pauseProtocol ───────────────────────────────────────────────────────────

/**
 * Build a `pauseProtocol` TransactionInstruction.
 *
 * Sets `protocolConfig.isActive = false`, preventing all user-facing
 * operations (deposits, withdrawals, conversions).  Only callable by
 * the protocol authority.
 *
 * @param program   - Anchor Program instance for exodus-core.
 * @param authority - The protocol authority wallet (signer).
 */
export async function buildPauseProtocolIx(
  program: Program,
  authority: PublicKey,
): Promise<TransactionInstruction> {
  const programId = program.programId;
  const [protocolConfig] = findProtocolConfigPda(programId);

  return program.methods
    .pauseProtocol()
    .accounts({
      authority,
      protocolConfig,
    })
    .instruction();
}

// ─── resumeProtocol ──────────────────────────────────────────────────────────

/**
 * Build a `resumeProtocol` TransactionInstruction.
 *
 * Sets `protocolConfig.isActive = true`, re-enabling all user-facing
 * operations.  Only callable by the protocol authority.
 *
 * @param program   - Anchor Program instance for exodus-core.
 * @param authority - The protocol authority wallet (signer).
 */
export async function buildResumeProtocolIx(
  program: Program,
  authority: PublicKey,
): Promise<TransactionInstruction> {
  const programId = program.programId;
  const [protocolConfig] = findProtocolConfigPda(programId);

  return program.methods
    .resumeProtocol()
    .accounts({
      authority,
      protocolConfig,
    })
    .instruction();
}
