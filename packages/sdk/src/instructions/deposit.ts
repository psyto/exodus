import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  findProtocolConfigPda,
  findUserPositionPda,
  findPendingDepositPda,
  findJpyVaultPda,
  findYieldSourcePda,
} from "../pda";

// ─── depositJpy ──────────────────────────────────────────────────────────────

export interface BuildDepositJpyAccounts {
  /** JPY stablecoin mint (Token-2022). */
  jpyMint: PublicKey;
  /** User's associated token account for the JPY mint. */
  userJpyAta: PublicKey;
  /** Accredit WhitelistEntry PDA that proves the user's KYC status. */
  whitelistEntry: PublicKey;
  /** Sovereign Identity PDA that encodes the user's tier. */
  sovereignIdentity: PublicKey;
  /** Token-2022 program ID (the JPY mint lives under Token-2022). */
  token2022Program: PublicKey;
}

/**
 * Build a `depositJpy` TransactionInstruction.
 *
 * Transfers JPY from the user into the protocol JPY vault, creates a
 * PendingDeposit PDA that a keeper will later convert to USDC.
 *
 * @param program    - Anchor Program instance for exodus-core.
 * @param user       - The depositor (signer / fee-payer).
 * @param jpyAmount  - Amount of JPY tokens to deposit (6 decimals).
 * @param minUsdcOut - Minimum USDC the user will accept after conversion.
 * @param nonce      - The next deposit nonce (protocolConfig.depositNonce + 1).
 * @param accounts   - Remaining account addresses that cannot be derived.
 */
export async function buildDepositJpyIx(
  program: Program,
  user: PublicKey,
  jpyAmount: BN,
  minUsdcOut: BN,
  nonce: bigint,
  accounts: BuildDepositJpyAccounts,
): Promise<TransactionInstruction> {
  const programId = program.programId;
  const [protocolConfig] = findProtocolConfigPda(programId);
  const [userPosition] = findUserPositionPda(protocolConfig, user, programId);
  const [pendingDeposit] = findPendingDepositPda(protocolConfig, user, nonce, programId);
  const [jpyVault] = findJpyVaultPda(programId);

  return program.methods
    .depositJpy(jpyAmount, minUsdcOut)
    .accounts({
      user,
      protocolConfig,
      jpyMint: accounts.jpyMint,
      userJpyAta: accounts.userJpyAta,
      jpyVault,
      userPosition,
      pendingDeposit,
      whitelistEntry: accounts.whitelistEntry,
      sovereignIdentity: accounts.sovereignIdentity,
      token2022Program: accounts.token2022Program,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

// ─── depositUsdc ─────────────────────────────────────────────────────────────

export interface BuildDepositUsdcAccounts {
  /** The token mint used by the target yield source (typically USDC). */
  yieldSourceMint: PublicKey;
  /** User's USDC associated token account. */
  userUsdc: PublicKey;
  /** Yield source deposit vault token account. */
  depositVault: PublicKey;
  /** Accredit WhitelistEntry PDA for KYC. */
  whitelistEntry: PublicKey;
  /** Sovereign Identity PDA for tier resolution. */
  sovereignIdentity: PublicKey;
  /** T-Bill vault program ID (CPI target). */
  tbillVaultProgram: PublicKey;
  /** T-Bill VaultConfig PDA. */
  tbillVaultConfig: PublicKey;
  /** T-Bill share mint. */
  tbillShareMint: PublicKey;
  /** T-Bill USDC vault token account. */
  tbillUsdcVault: PublicKey;
  /** User's share-token ATA for the T-Bill vault. */
  userTbillSharesAta: PublicKey;
  /** T-Bill UserShares PDA. */
  tbillUserShares: PublicKey;
}

/**
 * Build a `depositUsdc` TransactionInstruction.
 *
 * Deposits USDC directly into a yield source, bypassing the JPY
 * conversion path.  The user receives yield-source shares immediately.
 *
 * @param program    - Anchor Program instance for exodus-core.
 * @param user       - The depositor (signer / fee-payer).
 * @param usdcAmount - Amount of USDC to deposit (6 decimals).
 * @param accounts   - Remaining account addresses that cannot be derived.
 */
export async function buildDepositUsdcIx(
  program: Program,
  user: PublicKey,
  usdcAmount: BN,
  accounts: BuildDepositUsdcAccounts,
): Promise<TransactionInstruction> {
  const programId = program.programId;
  const [protocolConfig] = findProtocolConfigPda(programId);
  const [yieldSource] = findYieldSourcePda(protocolConfig, accounts.yieldSourceMint, programId);
  const [userPosition] = findUserPositionPda(protocolConfig, user, programId);

  return program.methods
    .depositUsdc(usdcAmount)
    .accounts({
      user,
      protocolConfig,
      yieldSource,
      usdcMint: accounts.yieldSourceMint,
      userUsdc: accounts.userUsdc,
      depositVault: accounts.depositVault,
      userPosition,
      whitelistEntry: accounts.whitelistEntry,
      sovereignIdentity: accounts.sovereignIdentity,
      tbillVaultProgram: accounts.tbillVaultProgram,
      tbillVaultConfig: accounts.tbillVaultConfig,
      tbillShareMint: accounts.tbillShareMint,
      tbillUsdcVault: accounts.tbillUsdcVault,
      userTbillSharesAta: accounts.userTbillSharesAta,
      tbillUserShares: accounts.tbillUserShares,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}
