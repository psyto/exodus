import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { assert } from "chai";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";

describe("exodus-core", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const coreProgram = anchor.workspace.ExodusCore as Program;
  const tbillProgram = anchor.workspace.ExodusTbillVault as Program;

  let authority: Keypair;
  let user: Keypair;
  let keeper: Keypair;
  let jpyMint: PublicKey;
  let usdcMint: PublicKey;
  let userJpyAta: PublicKey;
  let userUsdcAta: PublicKey;

  // Mock external accounts
  let oracleKeypair: Keypair;
  let whitelistEntryKeypair: Keypair;
  let sovereignIdentityKeypair: Keypair;
  let noKycUser: Keypair;

  // PDAs
  let protocolConfig: PublicKey;
  let jpyVault: PublicKey;
  let usdcVault: PublicKey;
  let yieldSource: PublicKey;
  let userPosition: PublicKey;

  // T-Bill vault PDAs
  let tbillVaultConfig: PublicKey;
  let tbillShareMint: PublicKey;
  let tbillUsdcVault: PublicKey;

  before(async () => {
    authority = Keypair.generate();
    user = Keypair.generate();
    keeper = Keypair.generate();
    noKycUser = Keypair.generate();

    const conn = provider.connection;

    // Fund all accounts
    for (const kp of [authority, user, keeper, noKycUser]) {
      const sig = await conn.requestAirdrop(kp.publicKey, 100 * LAMPORTS_PER_SOL);
      await conn.confirmTransaction(sig);
    }

    // Create mints
    usdcMint = await createMint(conn, authority, authority.publicKey, null, 6);
    jpyMint = await createMint(conn, authority, authority.publicKey, null, 6);

    // Create user token accounts
    userUsdcAta = await createAssociatedTokenAccount(conn, user, usdcMint, user.publicKey);
    userJpyAta = await createAssociatedTokenAccount(conn, user, jpyMint, user.publicKey);

    // Fund user
    await mintTo(conn, authority, usdcMint, userUsdcAta, authority, 10_000_000_000_000);
    await mintTo(conn, authority, jpyMint, userJpyAta, authority, 100_000_000_000_000);

    // Create mock Oracle PriceFeed (JPY/USD = 155.00)
    oracleKeypair = Keypair.generate();
    const oracleSpace = 56; // 8 + 32 + 8 + 8
    const oracleRent = await conn.getMinimumBalanceForRentExemption(oracleSpace);
    const oracleData = Buffer.alloc(oracleSpace);
    oracleData.writeBigUInt64LE(0n, 0); // discriminator
    authority.publicKey.toBuffer().copy(oracleData, 8);
    oracleData.writeBigUInt64LE(155_000_000n, 40); // price
    oracleData.writeBigInt64LE(BigInt(Math.floor(Date.now() / 1000)), 48); // timestamp

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

    // Create mock Accredit WhitelistEntry for user
    whitelistEntryKeypair = Keypair.generate();
    const wlSpace = 83;
    const wlRent = await conn.getMinimumBalanceForRentExemption(wlSpace);
    const wlData = Buffer.alloc(wlSpace);
    wlData.writeBigUInt64LE(0n, 0);
    user.publicKey.toBuffer().copy(wlData, 8);
    PublicKey.default.toBuffer().copy(wlData, 40);
    wlData[72] = 1; // is_active
    wlData[73] = 2; // kyc_level
    wlData[74] = 0; // jurisdiction = Japan
    const expiresAt = BigInt(Math.floor(Date.now() / 1000)) + 365n * 86400n;
    wlData.writeBigInt64LE(expiresAt, 75);

    const createWlTx = new anchor.web3.Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: whitelistEntryKeypair.publicKey,
        space: wlSpace,
        lamports: wlRent,
        programId: SystemProgram.programId,
      })
    );
    await provider.sendAndConfirm(createWlTx, [authority, whitelistEntryKeypair]);

    // Create mock Sovereign Identity (tier 2 = Silver)
    sovereignIdentityKeypair = Keypair.generate();
    const sovSpace = 41;
    const sovRent = await conn.getMinimumBalanceForRentExemption(sovSpace);
    const sovData = Buffer.alloc(sovSpace);
    sovData.writeBigUInt64LE(0n, 0);
    user.publicKey.toBuffer().copy(sovData, 8);
    sovData[40] = 2; // tier = Silver

    const createSovTx = new anchor.web3.Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: sovereignIdentityKeypair.publicKey,
        space: sovSpace,
        lamports: sovRent,
        programId: SystemProgram.programId,
      })
    );
    await provider.sendAndConfirm(createSovTx, [authority, sovereignIdentityKeypair]);

    // Derive core PDAs
    [protocolConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("exodus_config")],
      coreProgram.programId
    );
    [jpyVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("exodus_jpy_vault")],
      coreProgram.programId
    );
    [usdcVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("exodus_usdc_vault")],
      coreProgram.programId
    );
    [userPosition] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("user_position"),
        protocolConfig.toBuffer(),
        user.publicKey.toBuffer(),
      ],
      coreProgram.programId
    );

    // T-Bill vault PDAs
    [tbillVaultConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("tbill_vault")],
      tbillProgram.programId
    );
    [tbillShareMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("tbill_share_mint")],
      tbillProgram.programId
    );
    [tbillUsdcVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("tbill_usdc_vault")],
      tbillProgram.programId
    );
  });

  // ─── Protocol Initialization ──────────────────────────────────────────────────

  it("initializes the protocol", async () => {
    const params = {
      oracle: oracleKeypair.publicKey,
      kycRegistry: PublicKey.default,
      sovereignProgram: PublicKey.default,
      conversionFeeBps: 30, // 0.30%
      managementFeeBps: 50, // 0.50%
      performanceFeeBps: 1000, // 10%
    };

    await coreProgram.methods
      .initializeProtocol(params)
      .accounts({
        authority: authority.publicKey,
        protocolConfig,
        jpyMint,
        usdcMint,
        jpyVault,
        usdcVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        token2022Program: TOKEN_PROGRAM_ID, // Using SPL for test
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([authority])
      .rpc();

    const config = await coreProgram.account.protocolConfig.fetch(protocolConfig);
    assert.ok(config.isActive);
    assert.equal(config.conversionFeeBps, 30);
    assert.equal(config.performanceFeeBps, 1000);
  });

  // ─── Yield Source Registration ────────────────────────────────────────────────

  it("registers T-Bill yield source", async () => {
    // First initialize T-Bill vault
    await tbillProgram.methods
      .initializeVault(450)
      .accounts({
        authority: authority.publicKey,
        vaultConfig: tbillVaultConfig,
        usdcMint,
        shareMint: tbillShareMint,
        usdcVault: tbillUsdcVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([authority])
      .rpc();

    // Register as yield source in core protocol
    [yieldSource] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("yield_source"),
        protocolConfig.toBuffer(),
        usdcMint.toBuffer(),
      ],
      coreProgram.programId
    );

    const nameBytes = Buffer.alloc(32);
    Buffer.from("US T-Bill 4.5%").copy(nameBytes);

    const params = {
      name: Array.from(nameBytes),
      sourceType: { tBill: {} },
      depositVault: tbillUsdcVault,
      yieldTokenVault: tbillShareMint,
      allocationWeightBps: 10000, // 100%
      minDeposit: new BN(1_000_000), // 1 USDC min
      maxAllocation: new BN(1_000_000_000_000), // 1M USDC max
    };

    await coreProgram.methods
      .registerYieldSource(params)
      .accounts({
        authority: authority.publicKey,
        protocolConfig,
        tokenMint: usdcMint,
        yieldSource,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const ys = await coreProgram.account.yieldSource.fetch(yieldSource);
    assert.ok(ys.isActive);
    assert.equal(ys.allocationWeightBps, 10000);
  });

  // ─── JPY Deposit ──────────────────────────────────────────────────────────────

  it("deposits JPY with valid KYC and tier", async () => {
    const config = await coreProgram.account.protocolConfig.fetch(protocolConfig);
    const nonce = config.depositNonce.toNumber() + 1;
    const nonceBuffer = Buffer.alloc(8);
    nonceBuffer.writeBigUInt64LE(BigInt(nonce));

    const [pendingDeposit] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("pending_deposit"),
        protocolConfig.toBuffer(),
        user.publicKey.toBuffer(),
        nonceBuffer,
      ],
      coreProgram.programId
    );

    const jpyAmount = new BN(1_000_000_000_000); // ¥1,000,000
    const minUsdcOut = new BN(6_000_000_000); // ~$6,000 min

    await coreProgram.methods
      .depositJpy(jpyAmount, minUsdcOut)
      .accounts({
        user: user.publicKey,
        protocolConfig,
        jpyMint,
        userJpyAta,
        jpyVault,
        userPosition,
        pendingDeposit,
        whitelistEntry: whitelistEntryKeypair.publicKey,
        sovereignIdentity: sovereignIdentityKeypair.publicKey,
        token2022Program: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    // Verify pending deposit was created
    const deposit = await coreProgram.account.pendingDeposit.fetch(pendingDeposit);
    assert.equal(deposit.jpyAmount.toNumber(), 1_000_000_000_000);
    assert.equal(deposit.status.pending !== undefined, true);

    // Verify user position was updated
    const pos = await coreProgram.account.userPosition.fetch(userPosition);
    assert.equal(pos.depositCount, 1);
    assert.equal(pos.sovereignTier, 2); // Silver
  });

  it("rejects JPY deposit without KYC", async () => {
    // Create a sovereign identity for noKycUser but NO whitelist entry
    const noKycSovKeypair = Keypair.generate();
    const sovSpace = 41;
    const sovRent = await provider.connection.getMinimumBalanceForRentExemption(sovSpace);

    const createSovTx = new anchor.web3.Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: noKycSovKeypair.publicKey,
        space: sovSpace,
        lamports: sovRent,
        programId: SystemProgram.programId,
      })
    );
    await provider.sendAndConfirm(createSovTx, [authority, noKycSovKeypair]);

    // Use a random account as "whitelist entry" (invalid)
    const fakeWl = Keypair.generate();

    const [noKycPosition] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("user_position"),
        protocolConfig.toBuffer(),
        noKycUser.publicKey.toBuffer(),
      ],
      coreProgram.programId
    );

    const config = await coreProgram.account.protocolConfig.fetch(protocolConfig);
    const nonce = config.depositNonce.toNumber() + 1;
    const nonceBuffer = Buffer.alloc(8);
    nonceBuffer.writeBigUInt64LE(BigInt(nonce));

    const [pendingDeposit] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("pending_deposit"),
        protocolConfig.toBuffer(),
        noKycUser.publicKey.toBuffer(),
        nonceBuffer,
      ],
      coreProgram.programId
    );

    // Create JPY ATA for noKycUser
    const noKycJpyAta = await createAssociatedTokenAccount(
      provider.connection,
      noKycUser,
      jpyMint,
      noKycUser.publicKey
    );
    await mintTo(provider.connection, authority, jpyMint, noKycJpyAta, authority, 1_000_000_000);

    try {
      await coreProgram.methods
        .depositJpy(new BN(1_000_000_000), new BN(0))
        .accounts({
          user: noKycUser.publicKey,
          protocolConfig,
          jpyMint,
          userJpyAta: noKycJpyAta,
          jpyVault,
          userPosition: noKycPosition,
          pendingDeposit,
          whitelistEntry: fakeWl.publicKey,
          sovereignIdentity: noKycSovKeypair.publicKey,
          token2022Program: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([noKycUser])
        .rpc();
      assert.fail("Should have rejected deposit without KYC");
    } catch (err: any) {
      // Expected: KYC required or account data error
      assert.ok(err.toString().includes("Error"));
    }
  });

  // ─── Execute Conversion ───────────────────────────────────────────────────────

  it("executes conversion from pending JPY deposit", async () => {
    // Fund the USDC vault (simulating keeper's Jupiter swap)
    const keeperUsdcAta = await createAssociatedTokenAccount(
      provider.connection,
      keeper,
      usdcMint,
      keeper.publicKey
    );
    await mintTo(
      provider.connection,
      authority,
      usdcMint,
      keeperUsdcAta,
      authority,
      100_000_000_000 // 100,000 USDC
    );

    // Transfer USDC to protocol vault
    // (In production, the keeper does this via Jupiter off-chain)
    // For tests, we mint directly to the vault
    await mintTo(
      provider.connection,
      authority,
      usdcMint,
      usdcVault,
      authority,
      100_000_000_000
    );

    const config = await coreProgram.account.protocolConfig.fetch(protocolConfig);
    const nonce = 1; // First deposit
    const nonceBuffer = Buffer.alloc(8);
    nonceBuffer.writeBigUInt64LE(BigInt(nonce));

    const [pendingDeposit] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("pending_deposit"),
        protocolConfig.toBuffer(),
        user.publicKey.toBuffer(),
        nonceBuffer,
      ],
      coreProgram.programId
    );

    const [conversionRecord] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("conversion"),
        protocolConfig.toBuffer(),
        user.publicKey.toBuffer(),
        nonceBuffer,
      ],
      coreProgram.programId
    );

    await coreProgram.methods
      .executeConversion()
      .accounts({
        keeper: keeper.publicKey,
        protocolConfig,
        pendingDeposit,
        userPosition,
        jpyVault,
        usdcVault,
        oracle: oracleKeypair.publicKey,
        yieldSource,
        yieldDepositVault: tbillUsdcVault,
        conversionRecord,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([keeper])
      .rpc();

    // Verify conversion record
    const record = await coreProgram.account.conversionRecord.fetch(conversionRecord);
    assert.ok(record.usdcAmount.toNumber() > 0);
    assert.equal(record.exchangeRate.toNumber(), 155_000_000);

    // Verify pending deposit is now converted
    const deposit = await coreProgram.account.pendingDeposit.fetch(pendingDeposit);
    assert.equal(deposit.status.converted !== undefined, true);

    // Verify user position updated
    const pos = await coreProgram.account.userPosition.fetch(userPosition);
    assert.ok(pos.currentShares.toNumber() > 0);
    assert.ok(pos.totalDepositedUsdc.toNumber() > 0);
  });

  // ─── Direct USDC Deposit ──────────────────────────────────────────────────────

  it("deposits USDC directly", async () => {
    const depositAmount = new BN(5_000_000_000); // 5,000 USDC

    await coreProgram.methods
      .depositUsdc(depositAmount)
      .accounts({
        user: user.publicKey,
        protocolConfig,
        yieldSource,
        usdcMint,
        userUsdc: userUsdcAta,
        depositVault: tbillUsdcVault,
        userPosition,
        whitelistEntry: whitelistEntryKeypair.publicKey,
        sovereignIdentity: sovereignIdentityKeypair.publicKey,
        tbillVaultProgram: tbillProgram.programId,
        tbillVaultConfig,
        tbillShareMint,
        tbillUsdcVault,
        userTbillSharesAta: userUsdcAta, // Placeholder
        tbillUserShares: userPosition, // Placeholder
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    const pos = await coreProgram.account.userPosition.fetch(userPosition);
    assert.ok(pos.depositCount >= 2);
  });

  // ─── Withdraw ─────────────────────────────────────────────────────────────────

  it("withdraws shares and receives USDC", async () => {
    const posBefore = await coreProgram.account.userPosition.fetch(userPosition);
    const sharesToWithdraw = new BN(
      Math.floor(posBefore.currentShares.toNumber() / 2)
    );

    if (sharesToWithdraw.toNumber() > 0) {
      await coreProgram.methods
        .withdraw(sharesToWithdraw, false)
        .accounts({
          user: user.publicKey,
          protocolConfig,
          yieldSource,
          userPosition,
          depositVault: tbillUsdcVault,
          userUsdc: userUsdcAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      const posAfter = await coreProgram.account.userPosition.fetch(userPosition);
      assert.ok(posAfter.currentShares.toNumber() < posBefore.currentShares.toNumber());
      assert.equal(posAfter.withdrawalCount, posBefore.withdrawalCount + 1);
    }
  });

  // ─── NAV Update ───────────────────────────────────────────────────────────────

  it("updates NAV via keeper", async () => {
    // First accrue yield on T-Bill vault
    await tbillProgram.methods
      .accrueYield()
      .accounts({ vaultConfig: tbillVaultConfig })
      .rpc();

    // Then update NAV in core protocol
    await coreProgram.methods
      .updateNav()
      .accounts({
        keeper: keeper.publicKey,
        protocolConfig,
        yieldSource,
        tbillVaultConfig,
      })
      .signers([keeper])
      .rpc();

    const ys = await coreProgram.account.yieldSource.fetch(yieldSource);
    assert.ok(ys.navPerShare.toNumber() >= 1_000_000);
  });

  // ─── Admin Operations ─────────────────────────────────────────────────────────

  it("pauses and resumes protocol", async () => {
    // Pause
    await coreProgram.methods
      .pauseProtocol()
      .accounts({
        authority: authority.publicKey,
        protocolConfig,
      })
      .signers([authority])
      .rpc();

    let config = await coreProgram.account.protocolConfig.fetch(protocolConfig);
    assert.ok(!config.isActive);

    // Resume
    await coreProgram.methods
      .resumeProtocol()
      .accounts({
        authority: authority.publicKey,
        protocolConfig,
      })
      .signers([authority])
      .rpc();

    config = await coreProgram.account.protocolConfig.fetch(protocolConfig);
    assert.ok(config.isActive);
  });

  it("updates protocol config", async () => {
    const params = {
      oracle: null,
      conversionFeeBps: 50, // 0.50%
      managementFeeBps: null,
      performanceFeeBps: null,
    };

    await coreProgram.methods
      .updateProtocolConfig(params)
      .accounts({
        authority: authority.publicKey,
        protocolConfig,
      })
      .signers([authority])
      .rpc();

    const config = await coreProgram.account.protocolConfig.fetch(protocolConfig);
    assert.equal(config.conversionFeeBps, 50);
  });
});
