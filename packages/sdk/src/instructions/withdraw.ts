import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  findProtocolConfigPda,
  findUserPositionPda,
  findYieldSourcePda,
} from "../pda";

// ─── withdraw ────────────────────────────────────────────────────────────────

export interface BuildWithdrawAccounts {
  /** The token mint used by the target yield source (typically USDC). */
  yieldSourceMint: PublicKey;
  /** Yield source deposit vault token account (source of USDC). */
  depositVault: PublicKey;
  /** User's USDC associated token account (destination). */
  userUsdc: PublicKey;
}

/**
 * Build a `withdraw` TransactionInstruction.
 *
 * Burns the specified number of yield-source shares and transfers the
 * corresponding USDC amount from the yield source deposit vault back to
 * the user's token account.
 *
 * @param program          - Anchor Program instance for exodus-core.
 * @param user             - The withdrawer (signer).
 * @param shares           - Number of shares to redeem.
 * @param withdrawAsJpy    - Whether the user wants the proceeds converted
 *                           back to JPY (reserved for Phase 1.5; currently
 *                           always returns USDC regardless of this flag).
 * @param accounts         - Remaining account addresses that cannot be derived.
 */
export async function buildWithdrawIx(
  program: Program,
  user: PublicKey,
  shares: BN,
  withdrawAsJpy: boolean,
  accounts: BuildWithdrawAccounts,
): Promise<TransactionInstruction> {
  const programId = program.programId;
  const [protocolConfig] = findProtocolConfigPda(programId);
  const [yieldSource] = findYieldSourcePda(protocolConfig, accounts.yieldSourceMint, programId);
  const [userPosition] = findUserPositionPda(protocolConfig, user, programId);

  return program.methods
    .withdraw(shares, withdrawAsJpy)
    .accounts({
      user,
      protocolConfig,
      yieldSource,
      userPosition,
      depositVault: accounts.depositVault,
      userUsdc: accounts.userUsdc,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}
