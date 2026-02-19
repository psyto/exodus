import { Program, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  findProtocolConfigPda,
  findYieldSourcePda,
  findTBillVaultConfigPda,
  findTBillShareMintPda,
  findTBillUsdcVaultPda,
} from "../pda";

/**
 * NavUpdater is a keeper bot that periodically cranks the NAV (Net Asset Value)
 * update instruction on the exodus-core program, and also calls accrueYield
 * on the T-Bill vault to keep yield accrual up to date.
 */
export class NavUpdater {
  private connection: Connection;
  private coreProgram: Program;
  private tbillProgram: Program;
  private keeper: Keypair;
  private coreProgramId: PublicKey;
  private tbillProgramId: PublicKey;
  private interval: NodeJS.Timer | null = null;

  constructor(
    connection: Connection,
    coreProgram: Program,
    tbillProgram: Program,
    keeper: Keypair,
    coreProgramId: PublicKey,
    tbillProgramId: PublicKey
  ) {
    this.connection = connection;
    this.coreProgram = coreProgram;
    this.tbillProgram = tbillProgram;
    this.keeper = keeper;
    this.coreProgramId = coreProgramId;
    this.tbillProgramId = tbillProgramId;
  }

  /**
   * Start the periodic NAV update loop.
   * @param pollIntervalMs - How often to crank, in milliseconds (default: 60s)
   */
  async start(pollIntervalMs: number = 60_000): Promise<void> {
    console.log(
      `[NavUpdater] Starting with poll interval ${pollIntervalMs}ms`
    );
    console.log(`[NavUpdater] Keeper: ${this.keeper.publicKey.toBase58()}`);
    console.log(`[NavUpdater] Core program: ${this.coreProgramId.toBase58()}`);
    console.log(
      `[NavUpdater] T-Bill program: ${this.tbillProgramId.toBase58()}`
    );

    // Run once immediately, then set up the interval
    await this.updateAll();

    this.interval = setInterval(async () => {
      try {
        await this.updateAll();
      } catch (err) {
        console.error("[NavUpdater] Error during update:", err);
      }
    }, pollIntervalMs);
  }

  /**
   * Stop the polling loop.
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log("[NavUpdater] Stopped");
    }
  }

  /**
   * Execute both accrueYield on the T-Bill vault and updateNav on the core
   * program. The T-Bill vault yield accrual must happen first so the NAV
   * update on the core side picks up the latest share values.
   */
  private async updateAll(): Promise<void> {
    // Step 1: Accrue yield on the T-Bill vault
    await this.accrueYield();

    // Step 2: Update NAV on the core program
    await this.updateNav();
  }

  /**
   * Call accrueYield on the exodus-tbill-vault program. This updates the
   * vault's internal accounting to reflect time-based yield accrual based
   * on the configured APY.
   */
  private async accrueYield(): Promise<void> {
    const [tbillVaultConfig] = findTBillVaultConfigPda(this.tbillProgramId);
    const [tbillShareMint] = findTBillShareMintPda(this.tbillProgramId);
    const [tbillUsdcVault] = findTBillUsdcVaultPda(this.tbillProgramId);

    try {
      const tx = await this.tbillProgram.methods
        .accrueYield()
        .accounts({
          keeper: this.keeper.publicKey,
          vaultConfig: tbillVaultConfig,
          shareMint: tbillShareMint,
          usdcVault: tbillUsdcVault,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([this.keeper])
        .rpc();

      console.log(`[NavUpdater] T-Bill yield accrued: ${tx}`);
    } catch (err) {
      console.error("[NavUpdater] Failed to accrue T-Bill yield:", err);
    }
  }

  /**
   * Call updateNav on the exodus-core program. This reads the latest
   * yield source state (including the T-Bill vault's updated NAV) and
   * recalculates the per-share NAV for the protocol's yield sources.
   */
  private async updateNav(): Promise<void> {
    const [configPda] = findProtocolConfigPda(this.coreProgramId);

    // Read the protocol config to get the USDC mint for the yield source PDA
    const configInfo = await this.connection.getAccountInfo(configPda);
    if (!configInfo) {
      console.warn("[NavUpdater] Protocol config not found, skipping NAV update");
      return;
    }

    // Parse the USDC mint from the config (offset: 8 discriminator + 32 authority + 32 jpyMint = 72)
    const usdcMint = new PublicKey(configInfo.data.subarray(72, 104));

    const [yieldSourcePda] = findYieldSourcePda(
      configPda,
      usdcMint,
      this.coreProgramId
    );

    // Verify yield source exists
    const yieldSourceInfo =
      await this.connection.getAccountInfo(yieldSourcePda);
    if (!yieldSourceInfo) {
      console.warn("[NavUpdater] Yield source not found, skipping NAV update");
      return;
    }

    // T-Bill vault PDAs needed for cross-program read
    const [tbillVaultConfig] = findTBillVaultConfigPda(this.tbillProgramId);

    try {
      const tx = await this.coreProgram.methods
        .updateNav()
        .accounts({
          keeper: this.keeper.publicKey,
          protocolConfig: configPda,
          yieldSource: yieldSourcePda,
          tbillVaultConfig,
          tbillVaultProgram: this.tbillProgramId,
        })
        .signers([this.keeper])
        .rpc();

      console.log(`[NavUpdater] NAV updated: ${tx}`);
    } catch (err) {
      console.error("[NavUpdater] Failed to update NAV:", err);
    }
  }
}
