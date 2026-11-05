import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import type { AccountMeta } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  addExtraAccountMetasForExecute,
  getMint,
  getTransferHook,
} from "@solana/spl-token";

/**
 * Accounts a program must forward (as remaining accounts) when it CPIs a
 * Token-2022 `transfer_checked` on a mint with a transfer hook: the hook's
 * resolved extra accounts, the hook program and its ExtraAccountMeta list.
 *
 * Returns an empty list for a mint without a transfer hook or a classic SPL
 * Token mint.
 */
export async function resolveTransferHookAccounts(
  connection: Connection,
  mint: PublicKey,
  source: PublicKey,
  destination: PublicKey,
  owner: PublicKey,
  amount: bigint,
  tokenProgram: PublicKey = TOKEN_2022_PROGRAM_ID,
): Promise<AccountMeta[]> {
  if (!tokenProgram.equals(TOKEN_2022_PROGRAM_ID)) return [];
  const mintInfo = await getMint(connection, mint, undefined, tokenProgram);
  const hook = getTransferHook(mintInfo);
  if (!hook) return [];
  const ix = new TransactionInstruction({ programId: tokenProgram, keys: [] });
  await addExtraAccountMetasForExecute(
    connection,
    ix,
    hook.programId,
    source,
    mint,
    destination,
    owner,
    amount,
  );
  return ix.keys;
}
