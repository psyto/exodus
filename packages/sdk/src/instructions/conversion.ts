import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  findProtocolConfigPda,
  findUserPositionPda,
  findYieldSourcePda,
  findConversionRecordPda,
} from "../pda";

// ─── executeConversion ───────────────────────────────────────────────────────

export interface BuildExecuteConversionAccounts {
  /** The PendingDeposit PDA to convert. */
  pendingDeposit: PublicKey;
  /** The owner of the pending deposit (needed to derive position & record PDAs). */
  depositUser: PublicKey;
  /** The nonce stored on the PendingDeposit (needed to derive ConversionRecord PDA). */
  depositNonce: bigint;
  /** Protocol JPY vault (validated against protocolConfig.jpyVault). */
  jpyVault: PublicKey;
  /** Protocol USDC vault (validated against protocolConfig.usdcVault). */
  usdcVault: PublicKey;
  /** Oracle PriceFeed PDA (validated against protocolConfig.oracle). */
  oracle: PublicKey;
  /** The token mint of the yield source that will receive the converted USDC. */
  yieldSourceMint: PublicKey;
  /** Yield source deposit vault where USDC lands after conversion. */
  yieldDepositVault: PublicKey;
}

/**
 * Build an `executeConversion` TransactionInstruction.
 *
 * Executed by a keeper to convert a pending JPY deposit into USDC using
 * the oracle price, deduct the conversion fee, and deposit the net USDC
 * into the designated yield source.  A ConversionRecord PDA is created
 * as an on-chain receipt.
 *
 * @param program  - Anchor Program instance for exodus-core.
 * @param keeper   - The keeper wallet that triggers (and pays for) the
 *                   conversion (signer / fee-payer for the ConversionRecord
 *                   account).
 * @param accounts - Remaining account addresses that cannot be derived from
 *                   seeds alone.
 */
export async function buildExecuteConversionIx(
  program: Program,
  keeper: PublicKey,
  accounts: BuildExecuteConversionAccounts,
): Promise<TransactionInstruction> {
  const programId = program.programId;
  const [protocolConfig] = findProtocolConfigPda(programId);
  const [userPosition] = findUserPositionPda(
    protocolConfig,
    accounts.depositUser,
    programId,
  );
  const [yieldSource] = findYieldSourcePda(
    protocolConfig,
    accounts.yieldSourceMint,
    programId,
  );
  const [conversionRecord] = findConversionRecordPda(
    protocolConfig,
    accounts.depositUser,
    accounts.depositNonce,
    programId,
  );

  return program.methods
    .executeConversion()
    .accounts({
      keeper,
      protocolConfig,
      pendingDeposit: accounts.pendingDeposit,
      userPosition,
      jpyVault: accounts.jpyVault,
      usdcVault: accounts.usdcVault,
      oracle: accounts.oracle,
      yieldSource,
      yieldDepositVault: accounts.yieldDepositVault,
      conversionRecord,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}
