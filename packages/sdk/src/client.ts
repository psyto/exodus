import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  ProtocolConfig,
  UserPosition,
  YieldSourceAccount,
  PendingDeposit,
  ConversionRecord,
} from "@exodus/types";
import {
  findProtocolConfigPda,
  findYieldSourcePda,
  findUserPositionPda,
  findPendingDepositPda,
  findConversionRecordPda,
  findJpyVaultPda,
  findUsdcVaultPda,
} from "./pda";

export interface ExodusProgramIds {
  core: PublicKey;
  tbillVault: PublicKey;
}

export class ExodusClient {
  public readonly connection: Connection;
  public readonly provider: AnchorProvider;
  public readonly programIds: ExodusProgramIds;
  private coreProgram: Program | null = null;

  constructor(
    connection: Connection,
    provider: AnchorProvider,
    programIds: ExodusProgramIds
  ) {
    this.connection = connection;
    this.provider = provider;
    this.programIds = programIds;
  }

  // ─── Read Methods ────────────────────────────────────────────────────────────

  get configPda(): PublicKey {
    return findProtocolConfigPda(this.programIds.core)[0];
  }

  async getProtocolConfig(): Promise<ProtocolConfig | null> {
    const info = await this.connection.getAccountInfo(this.configPda);
    if (!info) return null;
    // Deserialize via Anchor program if available, otherwise raw
    return this.deserializeProtocolConfig(info.data);
  }

  async getYieldSource(tokenMint: PublicKey): Promise<YieldSourceAccount | null> {
    const [pda] = findYieldSourcePda(
      this.configPda,
      tokenMint,
      this.programIds.core
    );
    const info = await this.connection.getAccountInfo(pda);
    if (!info) return null;
    return this.deserializeYieldSource(info.data);
  }

  async getUserPosition(owner: PublicKey): Promise<UserPosition | null> {
    const [pda] = findUserPositionPda(
      this.configPda,
      owner,
      this.programIds.core
    );
    const info = await this.connection.getAccountInfo(pda);
    if (!info) return null;
    return this.deserializeUserPosition(info.data);
  }

  async getPendingDeposits(user: PublicKey): Promise<PendingDeposit[]> {
    // Fetch user position to get nonce range
    const position = await this.getUserPosition(user);
    if (!position) return [];

    const deposits: PendingDeposit[] = [];
    const nonce = position.depositNonce;

    // Scan last 20 deposits (most recent)
    const start = nonce > 20n ? nonce - 20n : 1n;
    for (let i = start; i <= nonce; i++) {
      const [pda] = findPendingDepositPda(
        this.configPda,
        user,
        i,
        this.programIds.core
      );
      const info = await this.connection.getAccountInfo(pda);
      if (info) {
        const deposit = this.deserializePendingDeposit(info.data);
        if (deposit) deposits.push(deposit);
      }
    }

    return deposits;
  }

  async getConversionHistory(user: PublicKey): Promise<ConversionRecord[]> {
    const position = await this.getUserPosition(user);
    if (!position) return [];

    const records: ConversionRecord[] = [];
    const nonce = position.depositNonce;

    const start = nonce > 50n ? nonce - 50n : 1n;
    for (let i = start; i <= nonce; i++) {
      const [pda] = findConversionRecordPda(
        this.configPda,
        user,
        i,
        this.programIds.core
      );
      const info = await this.connection.getAccountInfo(pda);
      if (info) {
        const record = this.deserializeConversionRecord(info.data);
        if (record) records.push(record);
      }
    }

    return records;
  }

  async getPortfolioValue(
    owner: PublicKey
  ): Promise<{ totalUsdc: bigint; totalJpyEquivalent: bigint } | null> {
    const position = await this.getUserPosition(owner);
    if (!position) return null;

    // Get the yield source to read current NAV
    const config = await this.getProtocolConfig();
    if (!config) return null;

    // Calculate current value from shares * nav_per_share
    // For now return deposited amounts (full NAV calculation needs yield source)
    const totalUsdc = position.totalDepositedUsdc;
    // Use avg conversion rate to estimate JPY equivalent
    const rate = position.avgConversionRate;
    const totalJpyEquivalent =
      rate > 0n ? (totalUsdc * rate) / 1_000_000n : 0n;

    return { totalUsdc, totalJpyEquivalent };
  }

  // ─── Transaction Methods ─────────────────────────────────────────────────────

  async depositJpy(
    jpyAmount: BN,
    minUsdcOut: BN,
    accounts: {
      jpyMint: PublicKey;
      userJpyAta: PublicKey;
      whitelistEntry: PublicKey;
      sovereignIdentity: PublicKey;
      token2022Program: PublicKey;
    }
  ): Promise<string> {
    const config = await this.getProtocolConfig();
    if (!config) throw new Error("Protocol not initialized");

    const nonce = config.depositNonce + 1n;
    const user = this.provider.wallet.publicKey;

    const [userPositionPda] = findUserPositionPda(
      this.configPda,
      user,
      this.programIds.core
    );
    const nonceBuffer = Buffer.alloc(8);
    nonceBuffer.writeBigUInt64LE(nonce);
    const [pendingDepositPda] = findPendingDepositPda(
      this.configPda,
      user,
      nonce,
      this.programIds.core
    );
    const [jpyVault] = findJpyVaultPda(this.programIds.core);

    const program = await this.getCoreProgram();
    const tx = await program.methods
      .depositJpy(jpyAmount, minUsdcOut)
      .accounts({
        user,
        protocolConfig: this.configPda,
        jpyMint: accounts.jpyMint,
        userJpyAta: accounts.userJpyAta,
        jpyVault,
        userPosition: userPositionPda,
        pendingDeposit: pendingDepositPda,
        whitelistEntry: accounts.whitelistEntry,
        sovereignIdentity: accounts.sovereignIdentity,
        token2022Program: accounts.token2022Program,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  async depositUsdc(
    usdcAmount: BN,
    accounts: {
      yieldSourceMint: PublicKey;
      userUsdc: PublicKey;
      depositVault: PublicKey;
      whitelistEntry: PublicKey;
      sovereignIdentity: PublicKey;
      tbillVaultProgram: PublicKey;
      tbillVaultConfig: PublicKey;
      tbillShareMint: PublicKey;
      tbillUsdcVault: PublicKey;
      userTbillSharesAta: PublicKey;
      tbillUserShares: PublicKey;
    }
  ): Promise<string> {
    const user = this.provider.wallet.publicKey;
    const [yieldSourcePda] = findYieldSourcePda(
      this.configPda,
      accounts.yieldSourceMint,
      this.programIds.core
    );
    const [userPositionPda] = findUserPositionPda(
      this.configPda,
      user,
      this.programIds.core
    );

    const program = await this.getCoreProgram();
    const tx = await program.methods
      .depositUsdc(usdcAmount)
      .accounts({
        user,
        protocolConfig: this.configPda,
        yieldSource: yieldSourcePda,
        usdcMint: accounts.yieldSourceMint,
        userUsdc: accounts.userUsdc,
        depositVault: accounts.depositVault,
        userPosition: userPositionPda,
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
      .rpc();

    return tx;
  }

  async withdraw(
    shares: BN,
    asJpy: boolean,
    accounts: {
      yieldSourceMint: PublicKey;
      depositVault: PublicKey;
      userUsdc: PublicKey;
    }
  ): Promise<string> {
    const user = this.provider.wallet.publicKey;
    const [yieldSourcePda] = findYieldSourcePda(
      this.configPda,
      accounts.yieldSourceMint,
      this.programIds.core
    );
    const [userPositionPda] = findUserPositionPda(
      this.configPda,
      user,
      this.programIds.core
    );

    const program = await this.getCoreProgram();
    const tx = await program.methods
      .withdraw(shares, asJpy)
      .accounts({
        user,
        protocolConfig: this.configPda,
        yieldSource: yieldSourcePda,
        userPosition: userPositionPda,
        depositVault: accounts.depositVault,
        userUsdc: accounts.userUsdc,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return tx;
  }

  async claimYield(accounts: {
    yieldSourceMint: PublicKey;
    depositVault: PublicKey;
    userUsdc: PublicKey;
  }): Promise<string> {
    const user = this.provider.wallet.publicKey;
    const [yieldSourcePda] = findYieldSourcePda(
      this.configPda,
      accounts.yieldSourceMint,
      this.programIds.core
    );
    const [userPositionPda] = findUserPositionPda(
      this.configPda,
      user,
      this.programIds.core
    );

    const program = await this.getCoreProgram();
    const tx = await program.methods
      .claimYield()
      .accounts({
        user,
        protocolConfig: this.configPda,
        yieldSource: yieldSourcePda,
        userPosition: userPositionPda,
        depositVault: accounts.depositVault,
        userUsdc: accounts.userUsdc,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return tx;
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private async getCoreProgram(): Promise<Program> {
    if (!this.coreProgram) {
      // In production, load IDL from chain or bundled file
      // For now, return a placeholder
      throw new Error(
        "Program not initialized — load IDL via ExodusClient.withIdl()"
      );
    }
    return this.coreProgram;
  }

  /** Attach a loaded Anchor Program instance. */
  withProgram(program: Program): ExodusClient {
    this.coreProgram = program;
    return this;
  }

  // Raw deserialization helpers (simplified — in production use Anchor's coder)

  private deserializeProtocolConfig(data: Buffer): ProtocolConfig {
    let offset = 8; // skip discriminator
    const authority = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    const jpyMint = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    const usdcMint = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    const jpyVault = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    const usdcVault = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    const oracle = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    const kycRegistry = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    const sovereignProgram = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    const conversionFeeBps = data.readUInt16LE(offset);
    offset += 2;
    const managementFeeBps = data.readUInt16LE(offset);
    offset += 2;
    const performanceFeeBps = data.readUInt16LE(offset);
    offset += 2;
    const totalDepositsUsdc = data.readBigUInt64LE(offset);
    offset += 8;
    const totalYieldEarned = data.readBigUInt64LE(offset);
    offset += 8;
    const pendingJpyConversion = data.readBigUInt64LE(offset);
    offset += 8;
    const depositNonce = data.readBigUInt64LE(offset);
    offset += 8;
    const isActive = data[offset] !== 0;
    offset += 1;
    const createdAt = data.readBigInt64LE(offset);
    offset += 8;
    const updatedAt = data.readBigInt64LE(offset);
    offset += 8;
    const bump = data[offset];
    offset += 1;
    const jpyVaultBump = data[offset];
    offset += 1;
    const usdcVaultBump = data[offset];

    return {
      authority,
      jpyMint,
      usdcMint,
      jpyVault,
      usdcVault,
      oracle,
      kycRegistry,
      sovereignProgram,
      conversionFeeBps,
      managementFeeBps,
      performanceFeeBps,
      totalDepositsUsdc,
      totalYieldEarned,
      pendingJpyConversion,
      depositNonce,
      isActive,
      createdAt,
      updatedAt,
      bump,
      jpyVaultBump,
      usdcVaultBump,
    };
  }

  private deserializeYieldSource(data: Buffer): YieldSourceAccount {
    let offset = 8;
    const protocolConfig = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    const name = new Uint8Array(data.subarray(offset, offset + 32));
    offset += 32;
    const sourceType = data[offset];
    offset += 1;
    const tokenMint = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    const depositVault = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    const yieldTokenVault = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    const currentApyBps = data.readUInt16LE(offset);
    offset += 2;
    const totalDeposited = data.readBigUInt64LE(offset);
    offset += 8;
    const totalShares = data.readBigUInt64LE(offset);
    offset += 8;
    const allocationWeightBps = data.readUInt16LE(offset);
    offset += 2;
    const minDeposit = data.readBigUInt64LE(offset);
    offset += 8;
    const maxAllocation = data.readBigUInt64LE(offset);
    offset += 8;
    const isActive = data[offset] !== 0;
    offset += 1;
    const lastNavUpdate = data.readBigInt64LE(offset);
    offset += 8;
    const navPerShare = data.readBigUInt64LE(offset);
    offset += 8;
    const bump = data[offset];

    return {
      protocolConfig,
      name,
      sourceType,
      tokenMint,
      depositVault,
      yieldTokenVault,
      currentApyBps,
      totalDeposited,
      totalShares,
      allocationWeightBps,
      minDeposit,
      maxAllocation,
      isActive,
      lastNavUpdate,
      navPerShare,
      bump,
    };
  }

  private deserializeUserPosition(data: Buffer): UserPosition {
    let offset = 8;
    const owner = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    const protocolConfig = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    const totalDepositedJpy = data.readBigUInt64LE(offset);
    offset += 8;
    const totalDepositedUsdc = data.readBigUInt64LE(offset);
    offset += 8;
    const currentShares = data.readBigUInt64LE(offset);
    offset += 8;
    const unrealizedYieldUsdc = data.readBigUInt64LE(offset);
    offset += 8;
    const realizedYieldUsdc = data.readBigUInt64LE(offset);
    offset += 8;
    const avgConversionRate = data.readBigUInt64LE(offset);
    offset += 8;
    const sovereignTier = data[offset];
    offset += 1;
    const monthlyDepositedJpy = data.readBigUInt64LE(offset);
    offset += 8;
    const monthlyDepositedUsdc = data.readBigUInt64LE(offset);
    offset += 8;
    const monthStart = data.readBigInt64LE(offset);
    offset += 8;
    const depositCount = data.readUInt32LE(offset);
    offset += 4;
    const withdrawalCount = data.readUInt32LE(offset);
    offset += 4;
    const lastDepositAt = data.readBigInt64LE(offset);
    offset += 8;
    const lastWithdrawalAt = data.readBigInt64LE(offset);
    offset += 8;
    const depositNonce = data.readBigUInt64LE(offset);
    offset += 8;
    const createdAt = data.readBigInt64LE(offset);
    offset += 8;
    const bump = data[offset];

    return {
      owner,
      protocolConfig,
      totalDepositedJpy,
      totalDepositedUsdc,
      currentShares,
      unrealizedYieldUsdc,
      realizedYieldUsdc,
      avgConversionRate,
      sovereignTier,
      monthlyDepositedJpy,
      monthlyDepositedUsdc,
      monthStart,
      depositCount,
      withdrawalCount,
      lastDepositAt,
      lastWithdrawalAt,
      depositNonce,
      createdAt,
      bump,
    };
  }

  private deserializePendingDeposit(data: Buffer): PendingDeposit {
    let offset = 8;
    const user = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    const protocolConfig = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    const jpyAmount = data.readBigUInt64LE(offset);
    offset += 8;
    const minUsdcOut = data.readBigUInt64LE(offset);
    offset += 8;
    const depositedAt = data.readBigInt64LE(offset);
    offset += 8;
    const expiresAt = data.readBigInt64LE(offset);
    offset += 8;
    const status = data[offset];
    offset += 1;
    const conversionRate = data.readBigUInt64LE(offset);
    offset += 8;
    const usdcReceived = data.readBigUInt64LE(offset);
    offset += 8;
    const feePaid = data.readBigUInt64LE(offset);
    offset += 8;
    const nonce = data.readBigUInt64LE(offset);
    offset += 8;
    const bump = data[offset];

    return {
      user,
      protocolConfig,
      jpyAmount,
      minUsdcOut,
      depositedAt,
      expiresAt,
      status,
      conversionRate,
      usdcReceived,
      feePaid,
      nonce,
      bump,
    };
  }

  private deserializeConversionRecord(data: Buffer): ConversionRecord {
    let offset = 8;
    const user = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    const protocolConfig = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    const jpyAmount = data.readBigUInt64LE(offset);
    offset += 8;
    const usdcAmount = data.readBigUInt64LE(offset);
    offset += 8;
    const exchangeRate = data.readBigUInt64LE(offset);
    offset += 8;
    const feeAmount = data.readBigUInt64LE(offset);
    offset += 8;
    const direction = data[offset];
    offset += 1;
    const timestamp = data.readBigInt64LE(offset);
    offset += 8;
    const nonce = data.readBigUInt64LE(offset);
    offset += 8;
    const bump = data[offset];

    return {
      user,
      protocolConfig,
      jpyAmount,
      usdcAmount,
      exchangeRate,
      feeAmount,
      direction,
      timestamp,
      nonce,
      bump,
    };
  }
}
