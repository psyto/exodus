import { PublicKey } from "@solana/web3.js";

// ─── exodus-core PDAs ──────────────────────────────────────────────────────────

export function findProtocolConfigPda(
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("exodus_config")],
    programId
  );
}

export function findYieldSourcePda(
  config: PublicKey,
  tokenMint: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("yield_source"), config.toBuffer(), tokenMint.toBuffer()],
    programId
  );
}

export function findUserPositionPda(
  config: PublicKey,
  owner: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user_position"), config.toBuffer(), owner.toBuffer()],
    programId
  );
}

export function findPendingDepositPda(
  config: PublicKey,
  user: PublicKey,
  nonce: bigint,
  programId: PublicKey
): [PublicKey, number] {
  const nonceBuffer = Buffer.alloc(8);
  nonceBuffer.writeBigUInt64LE(nonce);
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("pending_deposit"),
      config.toBuffer(),
      user.toBuffer(),
      nonceBuffer,
    ],
    programId
  );
}

export function findConversionRecordPda(
  config: PublicKey,
  user: PublicKey,
  nonce: bigint,
  programId: PublicKey
): [PublicKey, number] {
  const nonceBuffer = Buffer.alloc(8);
  nonceBuffer.writeBigUInt64LE(nonce);
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("conversion"),
      config.toBuffer(),
      user.toBuffer(),
      nonceBuffer,
    ],
    programId
  );
}

export function findJpyVaultPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("exodus_jpy_vault")],
    programId
  );
}

export function findUsdcVaultPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("exodus_usdc_vault")],
    programId
  );
}

// ─── exodus-tbill-vault PDAs ────────────────────────────────────────────────────

export function findTBillVaultConfigPda(
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("tbill_vault")],
    programId
  );
}

export function findTBillShareMintPda(
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("tbill_share_mint")],
    programId
  );
}

export function findTBillUsdcVaultPda(
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("tbill_usdc_vault")],
    programId
  );
}

export function findTBillSharesPda(
  vault: PublicKey,
  user: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("tbill_shares"), vault.toBuffer(), user.toBuffer()],
    programId
  );
}
