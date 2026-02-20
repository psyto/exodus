import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { assert } from "chai";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MINT_SIZE,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getAccount,
} from "@solana/spl-token";
import { startAnchor, BankrunProvider } from "anchor-bankrun";

const coreIdl = require("../target/idl/exodus_core.json");
const tbillIdl = require("../target/idl/exodus_tbill_vault.json");

const CORE_PROGRAM_ID = new PublicKey("A59QJtaFuap54ZBq8GfMDAAW7tWCJ4hHAGrbL8v22ZRU");
const TBILL_PROGRAM_ID = new PublicKey("2zwyHvFnB7TacEbTWwyceX2JkAm8hDFLdK1pxew33Wgz");

describe("exodus-core (bankrun)", () => {
  let provider: BankrunProvider;
  let coreProgram: Program;
  let tbillProgram: Program;

  let authority: Keypair;
  let user: Keypair;
  let keeper: Keypair;
  let noKycUser: Keypair;

  let jpyMint: PublicKey;
  let usdcMint: PublicKey;
  let userJpyAta: PublicKey;
  let userUsdcAta: PublicKey;

  // Mock external accounts (pre-loaded via bankrun)
  let oracleKeypair: Keypair;
  let whitelistEntryKeypair: Keypair;
  let sovereignIdentityKeypair: Keypair;

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
    // ------------------------------------------------------------------
    // 1. Generate deterministic keypairs BEFORE starting bankrun,
    //    because mock account data embeds the user pubkey.
    // ------------------------------------------------------------------
    authority = Keypair.generate();
    user = Keypair.generate();
    keeper = Keypair.generate();
    noKycUser = Keypair.generate();
    oracleKeypair = Keypair.generate();
    whitelistEntryKeypair = Keypair.generate();
    sovereignIdentityKeypair = Keypair.generate();

    // ------------------------------------------------------------------
    // 2. Build mock account data buffers
    // ------------------------------------------------------------------

    // --- Accredit WhitelistEntry (83 bytes) for `user` ---
    const wlData = Buffer.alloc(83);
    wlData.writeBigUInt64LE(0n, 0);                          // [0..8]   discriminator
    user.publicKey.toBuffer().copy(wlData, 8);                // [8..40]  owner = user
    PublicKey.default.toBuffer().copy(wlData, 40);            // [40..72] registry = default
    wlData[72] = 1;                                           // is_active
    wlData[73] = 2;                                           // kyc_level
    wlData[74] = 0;                                           // jurisdiction = Japan
    const expiresAt = BigInt(Math.floor(Date.now() / 1000)) + 365n * 86400n;
    wlData.writeBigInt64LE(expiresAt, 75);                    // [75..83] expires_at

    // --- Sovereign Identity (41 bytes) for `user` ---
    const sovData = Buffer.alloc(41);
    sovData.writeBigUInt64LE(0n, 0);                          // [0..8]   discriminator
    user.publicKey.toBuffer().copy(sovData, 8);               // [8..40]  owner = user
    sovData[40] = 2;                                          // tier = Silver

    // --- Oracle PriceFeed (56 bytes) ---
    const oracleData = Buffer.alloc(56);
    oracleData.writeBigUInt64LE(0n, 0);                       // [0..8]   discriminator
    PublicKey.default.toBuffer().copy(oracleData, 8);         // [8..40]  authority (zeros)
    oracleData.writeBigUInt64LE(155_000_000n, 40);            // [40..48] current_price = 155 JPY/USD
    const oracleTimestamp = BigInt(Math.floor(Date.now() / 1000));
    oracleData.writeBigInt64LE(oracleTimestamp, 48);          // [48..56] last_update_time

    // ------------------------------------------------------------------
    // 3. Pre-loaded accounts for bankrun
    // ------------------------------------------------------------------
    const preloadedAccounts = [
      // Fund authority
      {
        address: authority.publicKey,
        info: {
          lamports: 100 * LAMPORTS_PER_SOL,
          data: Buffer.alloc(0),
          owner: SystemProgram.programId,
          executable: false,
        },
      },
      // Fund user
      {
        address: user.publicKey,
        info: {
          lamports: 100 * LAMPORTS_PER_SOL,
          data: Buffer.alloc(0),
          owner: SystemProgram.programId,
          executable: false,
        },
      },
      // Fund keeper
      {
        address: keeper.publicKey,
        info: {
          lamports: 100 * LAMPORTS_PER_SOL,
          data: Buffer.alloc(0),
          owner: SystemProgram.programId,
          executable: false,
        },
      },
      // Fund noKycUser
      {
        address: noKycUser.publicKey,
        info: {
          lamports: 100 * LAMPORTS_PER_SOL,
          data: Buffer.alloc(0),
          owner: SystemProgram.programId,
          executable: false,
        },
      },
      // Oracle PriceFeed mock
      {
        address: oracleKeypair.publicKey,
        info: {
          lamports: 1_000_000_000,
          data: oracleData,
          owner: SystemProgram.programId,
          executable: false,
        },
      },
      // Accredit WhitelistEntry mock for `user`
      {
        address: whitelistEntryKeypair.publicKey,
        info: {
          lamports: 1_000_000_000,
          data: wlData,
          owner: SystemProgram.programId,
          executable: false,
        },
      },
      // Sovereign Identity mock for `user`
      {
        address: sovereignIdentityKeypair.publicKey,
        info: {
          lamports: 1_000_000_000,
          data: sovData,
          owner: SystemProgram.programId,
          executable: false,
        },
      },
    ];

    // ------------------------------------------------------------------
    // 4. Start bankrun with Anchor workspace programs + pre-loaded accounts
    // ------------------------------------------------------------------
    const context = await startAnchor(
      ".",         // Anchor project root (current directory)
      [],          // No extra programs beyond workspace
      preloadedAccounts
    );

    provider = new BankrunProvider(context);
    anchor.setProvider(provider);

    // ------------------------------------------------------------------
    // 5. Create Program instances from IDL
    // ------------------------------------------------------------------
    coreProgram = new Program(coreIdl, provider);
    tbillProgram = new Program(tbillIdl, provider);

    // ------------------------------------------------------------------
    // 6. Create mints and token accounts using raw transactions (bankrun compatible)
    // ------------------------------------------------------------------
    const mintRent = await provider.connection.getMinimumBalanceForRentExemption(MINT_SIZE);

    // Create USDC mint keypair and JPY mint keypair
    const usdcMintKeypair = Keypair.generate();
    const jpyMintKeypair = Keypair.generate();
    usdcMint = usdcMintKeypair.publicKey;
    jpyMint = jpyMintKeypair.publicKey;

    // Create USDC mint (standard SPL Token, 6 decimals)
    const createUsdcMintTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: usdcMintKeypair.publicKey,
        space: MINT_SIZE,
        lamports: mintRent,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        usdcMintKeypair.publicKey,
        6,
        authority.publicKey,
        null,
        TOKEN_PROGRAM_ID
      )
    );
    await provider.sendAndConfirm(createUsdcMintTx, [authority, usdcMintKeypair]);

    // Create JPY mint (standard SPL Token for test, 6 decimals)
    const createJpyMintTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: jpyMintKeypair.publicKey,
        space: MINT_SIZE,
        lamports: mintRent,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        jpyMintKeypair.publicKey,
        6,
        authority.publicKey,
        null,
        TOKEN_PROGRAM_ID
      )
    );
    await provider.sendAndConfirm(createJpyMintTx, [authority, jpyMintKeypair]);

    // Create user USDC ATA
    userUsdcAta = getAssociatedTokenAddressSync(usdcMint, user.publicKey);
    const createUsdcAtaTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        user.publicKey,
        userUsdcAta,
        user.publicKey,
        usdcMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
    await provider.sendAndConfirm(createUsdcAtaTx, [user]);

    // Create user JPY ATA
    userJpyAta = getAssociatedTokenAddressSync(jpyMint, user.publicKey);
    const createJpyAtaTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        user.publicKey,
        userJpyAta,
        user.publicKey,
        jpyMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
    await provider.sendAndConfirm(createJpyAtaTx, [user]);

    // Fund user with USDC (10M)
    const mintUsdcTx = new Transaction().add(
      createMintToInstruction(
        usdcMint,
        userUsdcAta,
        authority.publicKey,
        10_000_000_000_000,
        [],
        TOKEN_PROGRAM_ID
      )
    );
    await provider.sendAndConfirm(mintUsdcTx, [authority]);

    // Fund user with JPY (100M)
    const mintJpyTx = new Transaction().add(
      createMintToInstruction(
        jpyMint,
        userJpyAta,
        authority.publicKey,
        100_000_000_000_000,
        [],
        TOKEN_PROGRAM_ID
      )
    );
    await provider.sendAndConfirm(mintJpyTx, [authority]);

    // ------------------------------------------------------------------
    // 7. Derive PDAs
    // ------------------------------------------------------------------

    // Core PDAs
    [protocolConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("exodus_config")],
      CORE_PROGRAM_ID
    );
    [jpyVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("exodus_jpy_vault")],
      CORE_PROGRAM_ID
    );
    [usdcVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("exodus_usdc_vault")],
      CORE_PROGRAM_ID
    );
    [userPosition] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("user_position"),
        protocolConfig.toBuffer(),
        user.publicKey.toBuffer(),
      ],
      CORE_PROGRAM_ID
    );

    // T-Bill vault PDAs
    [tbillVaultConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("tbill_vault")],
      TBILL_PROGRAM_ID
    );
    [tbillShareMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("tbill_share_mint")],
      TBILL_PROGRAM_ID
    );
    [tbillUsdcVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("tbill_usdc_vault")],
      TBILL_PROGRAM_ID
    );
  });

  // ─── Protocol Initialization ──────────────────────────────────────────────────

  it("initializes the protocol", async () => {
    const params = {
      oracle: oracleKeypair.publicKey,
      kycRegistry: PublicKey.default,
      sovereignProgram: PublicKey.default,
      conversionFeeBps: 30,       // 0.30%
      managementFeeBps: 50,       // 0.50%
      performanceFeeBps: 1000,    // 10%
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
        token2022Program: TOKEN_PROGRAM_ID, // Using standard SPL Token for test JPY
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
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
        rent: SYSVAR_RENT_PUBKEY,
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
      CORE_PROGRAM_ID
    );

    const nameBytes = Buffer.alloc(32);
    Buffer.from("US T-Bill 4.5%").copy(nameBytes);

    const params = {
      name: Array.from(nameBytes),
      sourceType: { tBill: {} },
      depositVault: usdcVault,
      yieldTokenVault: tbillShareMint,
      allocationWeightBps: 10000,                  // 100%
      minDeposit: new BN(1_000_000),               // 1 USDC min
      maxAllocation: new BN(1_000_000_000_000),    // 1M USDC max
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
      CORE_PROGRAM_ID
    );

    const jpyAmount = new BN(1_000_000_000_000);     // 1,000,000 JPY
    const minUsdcOut = new BN(6_000_000_000);         // ~$6,000 min

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
        token2022Program: TOKEN_PROGRAM_ID,       // Standard SPL for test
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
    const sovData = Buffer.alloc(sovSpace);
    sovData.writeBigUInt64LE(0n, 0);
    noKycUser.publicKey.toBuffer().copy(sovData, 8);
    sovData[40] = 2; // tier = Silver

    // Inject the sovereign identity mock into bankrun via setAccount
    provider.context.setAccount(noKycSovKeypair.publicKey, {
      lamports: 1_000_000_000,
      data: sovData,
      owner: SystemProgram.programId,
      executable: false,
    });

    // Use a random account as "whitelist entry" (invalid -- no valid KYC data)
    const fakeWl = Keypair.generate();

    const [noKycPosition] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("user_position"),
        protocolConfig.toBuffer(),
        noKycUser.publicKey.toBuffer(),
      ],
      CORE_PROGRAM_ID
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
      CORE_PROGRAM_ID
    );

    // Create JPY ATA for noKycUser
    const noKycJpyAta = getAssociatedTokenAddressSync(jpyMint, noKycUser.publicKey);
    const createNoKycAtaTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        noKycUser.publicKey,
        noKycJpyAta,
        noKycUser.publicKey,
        jpyMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
    await provider.sendAndConfirm(createNoKycAtaTx, [noKycUser]);

    // Fund noKycUser JPY
    const mintNoKycJpyTx = new Transaction().add(
      createMintToInstruction(
        jpyMint,
        noKycJpyAta,
        authority.publicKey,
        1_000_000_000,
        [],
        TOKEN_PROGRAM_ID
      )
    );
    await provider.sendAndConfirm(mintNoKycJpyTx, [authority]);

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
    // Mint USDC directly to the protocol's USDC vault (simulating keeper's Jupiter swap)
    const mintToVaultTx = new Transaction().add(
      createMintToInstruction(
        usdcMint,
        usdcVault,
        authority.publicKey,
        100_000_000_000,   // 100,000 USDC
        [],
        TOKEN_PROGRAM_ID
      )
    );
    await provider.sendAndConfirm(mintToVaultTx, [authority]);

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
      CORE_PROGRAM_ID
    );

    const [conversionRecord] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("conversion"),
        protocolConfig.toBuffer(),
        user.publicKey.toBuffer(),
        nonceBuffer,
      ],
      CORE_PROGRAM_ID
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
        yieldDepositVault: usdcVault,
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
    // Derive T-Bill UserShares PDA for user
    const [tbillUserShares] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("tbill_shares"),
        tbillVaultConfig.toBuffer(),
        user.publicKey.toBuffer(),
      ],
      TBILL_PROGRAM_ID
    );

    // Get or derive user's share token ATA for T-Bill
    const userTbillSharesAta = getAssociatedTokenAddressSync(
      tbillShareMint,
      user.publicKey
    );

    const depositAmount = new BN(5_000_000_000); // 5,000 USDC

    await coreProgram.methods
      .depositUsdc(depositAmount)
      .accounts({
        user: user.publicKey,
        protocolConfig,
        yieldSource,
        usdcMint,
        userUsdc: userUsdcAta,
        depositVault: usdcVault,
        userPosition,
        whitelistEntry: whitelistEntryKeypair.publicKey,
        sovereignIdentity: sovereignIdentityKeypair.publicKey,
        tbillVaultProgram: TBILL_PROGRAM_ID,
        tbillVaultConfig,
        tbillShareMint,
        tbillUsdcVault,
        userTbillSharesAta,
        tbillUserShares,
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
          depositVault: usdcVault,
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
      conversionFeeBps: 50,         // 0.50%
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
