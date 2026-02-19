import { Program, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { DepositStatus } from "@exodus/types";
import {
  findProtocolConfigPda,
  findConversionRecordPda,
  findUserPositionPda,
  findUsdcVaultPda,
  findJpyVaultPda,
  findYieldSourcePda,
} from "../pda";

/**
 * ConversionBot watches for PendingDeposit accounts with status=Pending
 * and calls executeConversion on them. This is a keeper process that runs
 * off-chain and cranks the protocol's JPY-to-USDC conversion pipeline.
 */
export class ConversionBot {
  private connection: Connection;
  private program: Program;
  private keeper: Keypair;
  private programId: PublicKey;
  private interval: NodeJS.Timer | null = null;

  constructor(
    connection: Connection,
    program: Program,
    keeper: Keypair,
    programId: PublicKey
  ) {
    this.connection = connection;
    this.program = program;
    this.keeper = keeper;
    this.programId = programId;
  }

  /**
   * Start polling for pending deposits and executing conversions.
   * @param pollIntervalMs - How often to scan, in milliseconds (default: 10s)
   */
  async start(pollIntervalMs: number = 10_000): Promise<void> {
    console.log(
      `[ConversionBot] Starting with poll interval ${pollIntervalMs}ms`
    );
    console.log(`[ConversionBot] Keeper: ${this.keeper.publicKey.toBase58()}`);
    console.log(`[ConversionBot] Program: ${this.programId.toBase58()}`);

    // Run once immediately, then set up the interval
    await this.scanAndConvert();

    this.interval = setInterval(async () => {
      try {
        await this.scanAndConvert();
      } catch (err) {
        console.error("[ConversionBot] Error during scan:", err);
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
      console.log("[ConversionBot] Stopped");
    }
  }

  /**
   * Scan for all PendingDeposit accounts with status=Pending (byte value 0)
   * and attempt to execute the conversion for each one.
   */
  private async scanAndConvert(): Promise<void> {
    const [configPda] = findProtocolConfigPda(this.programId);

    // The PendingDeposit account layout starts with an 8-byte discriminator.
    // The status byte is located at a known offset within the account data.
    // Layout: discriminator(8) + user(32) + protocolConfig(32) + jpyAmount(8)
    //         + minUsdcOut(8) + depositedAt(8) + expiresAt(8) + status(1)
    // Offset of status byte = 8 + 32 + 32 + 8 + 8 + 8 + 8 = 104
    const STATUS_OFFSET = 104;

    const pendingAccounts = await this.connection.getProgramAccounts(
      this.programId,
      {
        filters: [
          // Filter for PendingDeposit accounts by discriminator
          // The Anchor discriminator for "PendingDeposit" is the first 8 bytes
          {
            memcmp: {
              offset: STATUS_OFFSET,
              bytes: "1", // base58 encoding of byte 0x00 (Pending status)
            },
          },
        ],
      }
    );

    if (pendingAccounts.length === 0) {
      return;
    }

    console.log(
      `[ConversionBot] Found ${pendingAccounts.length} pending deposit(s)`
    );

    for (const { pubkey, account } of pendingAccounts) {
      try {
        await this.executeConversion(pubkey, account.data);
      } catch (err) {
        console.error(
          `[ConversionBot] Failed to convert deposit ${pubkey.toBase58()}:`,
          err
        );
      }
    }
  }

  /**
   * Execute a single conversion for a pending deposit account.
   */
  private async executeConversion(
    pendingDepositPda: PublicKey,
    data: Buffer
  ): Promise<void> {
    // Parse user and nonce from the account data
    const user = new PublicKey(data.subarray(8, 40));
    const protocolConfig = new PublicKey(data.subarray(40, 72));
    const nonce = data.readBigUInt64LE(104 + 1 + 8 + 8 + 8); // after status + conversionRate + usdcReceived + feePaid

    // Re-read nonce from the correct offset:
    // status(1) is at offset 104, then conversionRate(8), usdcReceived(8), feePaid(8), nonce(8)
    const nonceOffset = 104 + 1 + 8 + 8 + 8;
    const depositNonce = data.readBigUInt64LE(nonceOffset);

    const [configPda] = findProtocolConfigPda(this.programId);
    const [userPositionPda] = findUserPositionPda(
      configPda,
      user,
      this.programId
    );
    const [conversionRecordPda] = findConversionRecordPda(
      configPda,
      user,
      depositNonce,
      this.programId
    );
    const [jpyVault] = findJpyVaultPda(this.programId);
    const [usdcVault] = findUsdcVaultPda(this.programId);

    console.log(
      `[ConversionBot] Executing conversion for deposit ${pendingDepositPda.toBase58()} ` +
        `(user=${user.toBase58()}, nonce=${depositNonce})`
    );

    const tx = await this.program.methods
      .executeConversion()
      .accounts({
        keeper: this.keeper.publicKey,
        protocolConfig: configPda,
        pendingDeposit: pendingDepositPda,
        userPosition: userPositionPda,
        conversionRecord: conversionRecordPda,
        user,
        jpyVault,
        usdcVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([this.keeper])
      .rpc();

    console.log(
      `[ConversionBot] Conversion executed: ${tx} (deposit=${pendingDepositPda.toBase58()})`
    );
  }
}
