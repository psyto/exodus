import { Connection } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import { ExodusClient, ExodusProgramIds } from "@exodus/sdk";
import { PROGRAM_IDS, RPC_URL } from "./constants";

let clientInstance: ExodusClient | null = null;

/**
 * Get or create a singleton ExodusClient instance.
 */
export function getExodusClient(provider: AnchorProvider): ExodusClient {
  if (clientInstance) return clientInstance;

  const connection = new Connection(RPC_URL, "confirmed");
  const programIds: ExodusProgramIds = {
    core: PROGRAM_IDS.EXODUS_CORE,
    tbillVault: PROGRAM_IDS.TBILL_VAULT,
  };

  clientInstance = new ExodusClient(connection, provider, programIds);
  return clientInstance;
}

/**
 * Reset the singleton (e.g., on wallet disconnect).
 */
export function resetExodusClient(): void {
  clientInstance = null;
}
