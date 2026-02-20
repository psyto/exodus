import { PublicKey } from "@solana/web3.js";

export const PROGRAM_IDS = {
  EXODUS_CORE: new PublicKey("A59QJtaFuap54ZBq8GfMDAAW7tWCJ4hHAGrbL8v22ZRU"),
  TBILL_VAULT: new PublicKey("2zwyHvFnB7TacEbTWwyceX2JkAm8hDFLdK1pxew33Wgz"),
  ACCREDIT_TRANSFER_HOOK: new PublicKey(
    "5DLH2UrDD5bJFadn1gV1rof6sJ7MzJbVNnUfVMtGJgSL"
  ),
  ACCREDIT_REGISTRY: new PublicKey(
    "66tKcQqpv8GH2igWWBcLVrTjvo8cgpVJJAE8xadAgnYA"
  ),
};

export const TOKEN_MINTS = {
  USDC: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
  JPY_STABLECOIN: new PublicKey("11111111111111111111111111111111"), // placeholder
};

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";

export const EXPLORER_BASE = "https://explorer.solana.com";

export const ORACLE_STALENESS_THRESHOLD = 300; // 5 minutes

export const DEFAULT_SLIPPAGE_BPS = 100; // 1%

export const NAV_SCALE = 1_000_000;
export const USDC_DECIMALS = 6;
export const JPY_DECIMALS = 6;
