import { PublicKey } from "@solana/web3.js";

export enum DepositStatus {
  Pending = 0,
  Converting = 1,
  Converted = 2,
  Cancelled = 3,
  Expired = 4,
}

export enum ConversionDirection {
  JpyToUsdc = 0,
  UsdcToJpy = 1,
}

export const DEPOSIT_STATUS_LABELS: Record<
  DepositStatus,
  { en: string; ja: string }
> = {
  [DepositStatus.Pending]: { en: "Pending", ja: "保留中" },
  [DepositStatus.Converting]: { en: "Converting", ja: "変換中" },
  [DepositStatus.Converted]: { en: "Converted", ja: "変換済み" },
  [DepositStatus.Cancelled]: { en: "Cancelled", ja: "キャンセル" },
  [DepositStatus.Expired]: { en: "Expired", ja: "期限切れ" },
};

export const CONVERSION_DIRECTION_LABELS: Record<
  ConversionDirection,
  { en: string; ja: string }
> = {
  [ConversionDirection.JpyToUsdc]: { en: "JPY → USDC", ja: "JPY → USDC" },
  [ConversionDirection.UsdcToJpy]: { en: "USDC → JPY", ja: "USDC → JPY" },
};

export interface PendingDeposit {
  user: PublicKey;
  protocolConfig: PublicKey;
  jpyAmount: bigint;
  minUsdcOut: bigint;
  depositedAt: bigint;
  expiresAt: bigint;
  status: DepositStatus;
  conversionRate: bigint;
  usdcReceived: bigint;
  feePaid: bigint;
  nonce: bigint;
  bump: number;
}

export interface ConversionRecord {
  user: PublicKey;
  protocolConfig: PublicKey;
  jpyAmount: bigint;
  usdcAmount: bigint;
  exchangeRate: bigint;
  feeAmount: bigint;
  direction: ConversionDirection;
  timestamp: bigint;
  nonce: bigint;
  bump: number;
}
