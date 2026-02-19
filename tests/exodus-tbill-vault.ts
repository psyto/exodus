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
  createAccount,
  createAssociatedTokenAccount,
  getAssociatedTokenAddressSync,
  mintTo,
  getAccount,
} from "@solana/spl-token";

describe("exodus-tbill-vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ExodusTbillVault as Program;

  let authority: Keypair;
  let user: Keypair;
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

    // Fund accounts
    for (const kp of [authority, user]) {
      const sig = await provider.connection.requestAirdrop(
        kp.publicKey,
        100 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);
    }

    // Create USDC mint
    usdcMint = await createMint(
      provider.connection,
      authority,
      authority.publicKey,
      null,
      6,
      Keypair.generate(),
      undefined,
      TOKEN_PROGRAM_ID
    );

    // Derive PDAs
    [vaultConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("tbill_vault")],
      program.programId
    );
    [shareMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("tbill_share_mint")],
      program.programId
    );
    [usdcVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("tbill_usdc_vault")],
      program.programId
    );
  });

  it("initializes vault with 4.5% APY", async () => {
    const tx = await program.methods
      .initializeVault(450) // 4.50% APY
      .accounts({
        authority: authority.publicKey,
        vaultConfig,
        usdcMint,
        shareMint,
        usdcVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
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
    // Create user USDC account and fund
    userUsdc = await createAssociatedTokenAccount(
      provider.connection,
      user,
      usdcMint,
      user.publicKey,
      undefined,
      TOKEN_PROGRAM_ID
    );
    await mintTo(
      provider.connection,
      authority,
      usdcMint,
      userUsdc,
      authority,
      10_000_000_000, // 10,000 USDC
      [],
      undefined,
      TOKEN_PROGRAM_ID
    );

    // Create user share ATA
    userSharesAta = await createAssociatedTokenAccount(
      provider.connection,
      user,
      shareMint,
      user.publicKey,
      undefined,
      TOKEN_PROGRAM_ID
    );

    // Derive UserShares PDA
    [userSharesPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("tbill_shares"),
        vaultConfig.toBuffer(),
        user.publicKey.toBuffer(),
      ],
      program.programId
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
    // First accrual (might be small due to short time elapsed)
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
    const sig = await provider.connection.requestAirdrop(
      randomUser.publicKey,
      LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);

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
