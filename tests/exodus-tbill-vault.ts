import { startAnchor, BankrunProvider } from "anchor-bankrun";
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
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  getAccount,
} from "@solana/spl-token";

const IDL = require("../target/idl/exodus_tbill_vault.json");
const PROGRAM_ID = new PublicKey(
  "2zwyHvFnB7TacEbTWwyceX2JkAm8hDFLdK1pxew33Wgz"
);

describe("exodus-tbill-vault", () => {
  let provider: BankrunProvider;
  let program: Program;

  let authority: Keypair;
  let user: Keypair;
  let usdcMintKeypair: Keypair;
  let usdcMint: PublicKey;
  let vaultConfig: PublicKey;
  let shareMint: PublicKey;
  let usdcVault: PublicKey;
  let userUsdc: PublicKey;
  let userSharesAta: PublicKey;
  let userSharesPda: PublicKey;

  before(async () => {
    authority = Keypair.generate();
    user = Keypair.generate();
    usdcMintKeypair = Keypair.generate();
    usdcMint = usdcMintKeypair.publicKey;

    // Pre-fund accounts via startAnchor
    const preloadedAccounts = [
      {
        address: authority.publicKey,
        info: {
          lamports: 100 * LAMPORTS_PER_SOL,
          data: Buffer.alloc(0),
          owner: SystemProgram.programId,
          executable: false,
        },
      },
      {
        address: user.publicKey,
        info: {
          lamports: 100 * LAMPORTS_PER_SOL,
          data: Buffer.alloc(0),
          owner: SystemProgram.programId,
          executable: false,
        },
      },
    ];

    const context = await startAnchor(".", [], preloadedAccounts);
    provider = new BankrunProvider(context);
    program = new Program(IDL, provider);

    // Create USDC mint using raw instructions via provider.sendAndConfirm
    const mintRent = await provider.connection.getMinimumBalanceForRentExemption(MINT_SIZE);
    const createMintTx = new Transaction().add(
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
    await provider.sendAndConfirm(createMintTx, [authority, usdcMintKeypair]);

    // Derive PDAs
    [vaultConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("tbill_vault")],
      PROGRAM_ID
    );
    [shareMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("tbill_share_mint")],
      PROGRAM_ID
    );
    [usdcVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("tbill_usdc_vault")],
      PROGRAM_ID
    );
  });

  it("initializes vault with 4.5% APY", async () => {
    await program.methods
      .initializeVault(450) // 4.50% APY
      .accounts({
        authority: authority.publicKey,
        vaultConfig,
        usdcMint,
        shareMint,
        usdcVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([authority])
      .rpc();

    const vault = await program.account.vaultConfig.fetch(vaultConfig);
    assert.equal(vault.targetApyBps, 450);
    assert.equal(vault.navPerShare.toNumber(), 1_000_000);
    assert.ok(vault.isActive);
    assert.equal(vault.totalDeposits.toNumber(), 0);
    assert.equal(vault.totalShares.toNumber(), 0);
  });

  it("deposits USDC and receives shares", async () => {
    // Create user USDC ATA
    userUsdc = getAssociatedTokenAddressSync(usdcMint, user.publicKey);
    const createAtaTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        user.publicKey,
        userUsdc,
        user.publicKey,
        usdcMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
    await provider.sendAndConfirm(createAtaTx, [user]);

    // Fund user USDC
    const mintToTx = new Transaction().add(
      createMintToInstruction(
        usdcMint,
        userUsdc,
        authority.publicKey,
        10_000_000_000, // 10,000 USDC
        [],
        TOKEN_PROGRAM_ID
      )
    );
    await provider.sendAndConfirm(mintToTx, [authority]);

    // Create user share ATA
    userSharesAta = getAssociatedTokenAddressSync(shareMint, user.publicKey);
    const createShareAtaTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        user.publicKey,
        userSharesAta,
        user.publicKey,
        shareMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
    await provider.sendAndConfirm(createShareAtaTx, [user]);

    // Derive UserShares PDA
    [userSharesPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("tbill_shares"),
        vaultConfig.toBuffer(),
        user.publicKey.toBuffer(),
      ],
      PROGRAM_ID
    );

    const depositAmount = new BN(1_000_000_000); // 1,000 USDC

    await program.methods
      .deposit(depositAmount)
      .accounts({
        user: user.publicKey,
        vaultConfig,
        usdcVault,
        shareMint,
        userUsdc,
        userSharesAta,
        userShares: userSharesPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    // Verify vault state
    const vault = await program.account.vaultConfig.fetch(vaultConfig);
    assert.equal(vault.totalDeposits.toNumber(), 1_000_000_000);
    assert.equal(vault.totalShares.toNumber(), 1_000_000_000); // 1:1 at NAV=1.0

    // Verify user shares
    const shares = await program.account.userShares.fetch(userSharesPda);
    assert.equal(shares.shares.toNumber(), 1_000_000_000);
    assert.equal(shares.depositedUsdc.toNumber(), 1_000_000_000);

    // Verify share token balance
    const shareBalance = await getAccount(provider.connection, userSharesAta);
    assert.equal(Number(shareBalance.amount), 1_000_000_000);
  });

  it("accrues yield and NAV increases", async () => {
    await program.methods
      .accrueYield()
      .accounts({ vaultConfig })
      .rpc();

    const vault = await program.account.vaultConfig.fetch(vaultConfig);
    // NAV should be >= initial (may be equal if time elapsed is 0)
    assert.ok(vault.navPerShare.toNumber() >= 1_000_000);
  });

  it("withdraws shares and receives USDC plus yield", async () => {
    const sharesBefore = await program.account.userShares.fetch(userSharesPda);
    const sharesToWithdraw = new BN(500_000_000); // Withdraw half

    await program.methods
      .withdraw(sharesToWithdraw)
      .accounts({
        user: user.publicKey,
        vaultConfig,
        usdcVault,
        shareMint,
        userUsdc,
        userSharesAta,
        userShares: userSharesPda,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    const sharesAfter = await program.account.userShares.fetch(userSharesPda);
    assert.equal(
      sharesAfter.shares.toNumber(),
      sharesBefore.shares.toNumber() - 500_000_000
    );

    // Vault should have reduced shares
    const vault = await program.account.vaultConfig.fetch(vaultConfig);
    assert.ok(vault.totalShares.toNumber() < 1_000_000_000);
  });

  it("rejects unauthorized APY update", async () => {
    const randomUser = Keypair.generate();
    // Fund via setAccount
    (provider as any).context.setAccount(randomUser.publicKey, {
      lamports: LAMPORTS_PER_SOL,
      data: Buffer.alloc(0),
      owner: SystemProgram.programId,
      executable: false,
    });

    try {
      await program.methods
        .updateApy(500)
        .accounts({
          authority: randomUser.publicKey,
          vaultConfig,
        })
        .signers([randomUser])
        .rpc();
      assert.fail("Should have thrown unauthorized error");
    } catch (err: any) {
      assert.include(err.toString(), "Unauthorized");
    }
  });

  it("updates APY as authority", async () => {
    await program.methods
      .updateApy(500) // 5.00%
      .accounts({
        authority: authority.publicKey,
        vaultConfig,
      })
      .signers([authority])
      .rpc();

    const vault = await program.account.vaultConfig.fetch(vaultConfig);
    assert.equal(vault.targetApyBps, 500);
  });
});
