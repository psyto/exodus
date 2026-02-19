import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccount,
} from "@solana/spl-token";

// Token-2022 program ID
export const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
);

export interface TestContext {
  provider: anchor.AnchorProvider;
  authority: Keypair;
  user: Keypair;
  keeper: Keypair;
  jpyMint: PublicKey;
  usdcMint: PublicKey;
  userJpyAta: PublicKey;
  userUsdcAta: PublicKey;
  oracleKeypair: Keypair;
  oracle: PublicKey;
  whitelistEntry: PublicKey;
  sovereignIdentity: PublicKey;
}

/**
 * Set up a full test environment:
 * - Fund authority, user, keeper
 * - Create JPY mint (Token-2022) and USDC mint (SPL Token)
 * - Create user token accounts and fund them
 * - Create mock Accredit WhitelistEntry PDA
 * - Create mock Sovereign Identity PDA
 * - Create mock Oracle PriceFeed account
 */
export async function setupTestContext(
  provider: anchor.AnchorProvider
): Promise<TestContext> {
  const authority = Keypair.generate();
  const user = Keypair.generate();
  const keeper = Keypair.generate();

  // Fund accounts
  const conn = provider.connection;
  for (const kp of [authority, user, keeper]) {
    const sig = await conn.requestAirdrop(kp.publicKey, 100 * LAMPORTS_PER_SOL);
    await conn.confirmTransaction(sig);
  }

  // Create USDC mint (standard SPL Token, 6 decimals)
  const usdcMint = await createMint(
    conn,
    authority,
    authority.publicKey,
    null,
    6,
    Keypair.generate(),
    undefined,
    TOKEN_PROGRAM_ID
  );

  // Create user USDC ATA and fund with 1,000,000 USDC
  const userUsdcAta = await createAssociatedTokenAccount(
    conn,
    user,
    usdcMint,
    user.publicKey,
    undefined,
    TOKEN_PROGRAM_ID
  );
  await mintTo(
    conn,
    authority,
    usdcMint,
    userUsdcAta,
    authority,
    1_000_000_000_000, // 1,000,000 USDC
    [],
    undefined,
    TOKEN_PROGRAM_ID
  );

  // For JPY Token-2022 mint, we'll create a regular SPL mint for testing
  // (Token-2022 with transfer hooks requires more complex setup)
  const jpyMint = await createMint(
    conn,
    authority,
    authority.publicKey,
    null,
    6,
    Keypair.generate(),
    undefined,
    TOKEN_PROGRAM_ID
  );

  const userJpyAta = await createAssociatedTokenAccount(
    conn,
    user,
    jpyMint,
    user.publicKey,
    undefined,
    TOKEN_PROGRAM_ID
  );
  await mintTo(
    conn,
    authority,
    jpyMint,
    userJpyAta,
    authority,
    100_000_000_000_000, // ¥100,000,000 JPY
    [],
    undefined,
    TOKEN_PROGRAM_ID
  );

  // Create mock Oracle PriceFeed account
  // Layout: discriminator(8) + authority(32) + current_price(8) + last_update_time(8)
  const oracleKeypair = Keypair.generate();
  const oracleSpace = 8 + 32 + 8 + 8;
  const oracleRent = await conn.getMinimumBalanceForRentExemption(oracleSpace);

  const createOracleTx = new anchor.web3.Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: authority.publicKey,
      newAccountPubkey: oracleKeypair.publicKey,
      space: oracleSpace,
      lamports: oracleRent,
      programId: SystemProgram.programId,
    })
  );
  await provider.sendAndConfirm(createOracleTx, [authority, oracleKeypair]);

  // Write oracle data: JPY/USD = 155.00 (155_000_000 scaled 1e6)
  const oracleData = Buffer.alloc(oracleSpace);
  // Discriminator (mock)
  oracleData.writeBigUInt64LE(0n, 0);
  // Authority
  authority.publicKey.toBuffer().copy(oracleData, 8);
  // Price: 155.000000 JPY per USD
  oracleData.writeBigUInt64LE(155_000_000n, 40);
  // Last update time: now
  const now = BigInt(Math.floor(Date.now() / 1000));
  oracleData.writeBigInt64LE(now, 48);

  // Create mock Accredit WhitelistEntry for user
  // Layout: discriminator(8) + owner(32) + registry(32) + is_active(1) + kyc_level(1) + jurisdiction(1) + expires_at(8)
  const whitelistKeypair = Keypair.generate();
  const wlSpace = 83;
  const wlRent = await conn.getMinimumBalanceForRentExemption(wlSpace);

  const createWlTx = new anchor.web3.Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: authority.publicKey,
      newAccountPubkey: whitelistKeypair.publicKey,
      space: wlSpace,
      lamports: wlRent,
      programId: SystemProgram.programId,
    })
  );
  await provider.sendAndConfirm(createWlTx, [authority, whitelistKeypair]);

  // Write whitelist data
  const wlData = Buffer.alloc(wlSpace);
  wlData.writeBigUInt64LE(0n, 0); // discriminator
  user.publicKey.toBuffer().copy(wlData, 8); // owner
  PublicKey.default.toBuffer().copy(wlData, 40); // registry
  wlData[72] = 1; // is_active = true
  wlData[73] = 2; // kyc_level = 2 (enhanced)
  wlData[74] = 0; // jurisdiction = 0 (Japan)
  // expires_at: 1 year from now
  const expiresAt = now + 365n * 24n * 60n * 60n;
  wlData.writeBigInt64LE(expiresAt, 75);

  // Create mock Sovereign Identity for user
  // Layout: discriminator(8) + owner(32) + tier(1)
  const sovereignKeypair = Keypair.generate();
  const sovSpace = 41;
  const sovRent = await conn.getMinimumBalanceForRentExemption(sovSpace);

  const createSovTx = new anchor.web3.Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: authority.publicKey,
      newAccountPubkey: sovereignKeypair.publicKey,
      space: sovSpace,
      lamports: sovRent,
      programId: SystemProgram.programId,
    })
  );
  await provider.sendAndConfirm(createSovTx, [authority, sovereignKeypair]);

  // Write sovereign data: tier 2 (Silver)
  const sovData = Buffer.alloc(sovSpace);
  sovData.writeBigUInt64LE(0n, 0); // discriminator
  user.publicKey.toBuffer().copy(sovData, 8); // owner
  sovData[40] = 2; // tier = Silver

  return {
    provider,
    authority,
    user,
    keeper,
    jpyMint,
    usdcMint,
    userJpyAta,
    userUsdcAta,
    oracleKeypair,
    oracle: oracleKeypair.publicKey,
    whitelistEntry: whitelistKeypair.publicKey,
    sovereignIdentity: sovereignKeypair.publicKey,
  };
}

/**
 * Create additional user test context (no KYC, different tier, etc.)
 */
export async function createUserWithoutKyc(
  provider: anchor.AnchorProvider
): Promise<Keypair> {
  const user = Keypair.generate();
  const sig = await provider.connection.requestAirdrop(
    user.publicKey,
    10 * LAMPORTS_PER_SOL
  );
  await provider.connection.confirmTransaction(sig);
  return user;
}

/**
 * Advance the on-chain clock by the given number of seconds.
 * Only works on localnet/test validator with warp capabilities.
 */
export async function advanceClock(
  provider: anchor.AnchorProvider,
  seconds: number
): Promise<void> {
  // On test validator, we can use BanksClient or just wait
  // For basic Anchor tests, we typically use sleep or skip this
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}
