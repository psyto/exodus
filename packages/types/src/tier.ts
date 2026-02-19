import { YieldSourceType } from "./yield";

export enum Tier {
  Unverified = 0,
  Bronze = 1,
  Silver = 2,
  Gold = 3,
  Diamond = 4,
}

export const TIER_NAMES: Record<Tier, { en: string; ja: string }> = {
  [Tier.Unverified]: { en: "Unverified", ja: "未認証" },
  [Tier.Bronze]: { en: "Bronze", ja: "ブロンズ" },
  [Tier.Silver]: { en: "Silver", ja: "シルバー" },
  [Tier.Gold]: { en: "Gold", ja: "ゴールド" },
  [Tier.Diamond]: { en: "Diamond", ja: "ダイヤモンド" },
};

export const TIER_COLORS: Record<Tier, string> = {
  [Tier.Unverified]: "#6B7280",
  [Tier.Bronze]: "#CD7F32",
  [Tier.Silver]: "#C0C0C0",
  [Tier.Gold]: "#FFD700",
  [Tier.Diamond]: "#B9F2FF",
};

/** Monthly JPY deposit limits by tier (minor units, 6 decimals). */
export const MONTHLY_JPY_LIMITS: Record<Tier, bigint> = {
  [Tier.Unverified]: 0n,
  [Tier.Bronze]: 500_000_000_000n, // ¥500,000
  [Tier.Silver]: 5_000_000_000_000n, // ¥5,000,000
  [Tier.Gold]: 50_000_000_000_000n, // ¥50,000,000
  [Tier.Diamond]: BigInt(Number.MAX_SAFE_INTEGER),
};

/** Monthly USDC deposit limits by tier (minor units, 6 decimals). */
export const MONTHLY_USDC_LIMITS: Record<Tier, bigint> = {
  [Tier.Unverified]: 0n,
  [Tier.Bronze]: 3_500_000_000n, // $3,500
  [Tier.Silver]: 35_000_000_000n, // $35,000
  [Tier.Gold]: 350_000_000_000n, // $350,000
  [Tier.Diamond]: BigInt(Number.MAX_SAFE_INTEGER),
};

/** Yield source types allowed per tier. */
export const TIER_YIELD_SOURCES: Record<Tier, YieldSourceType[]> = {
  [Tier.Unverified]: [],
  [Tier.Bronze]: [YieldSourceType.TBill],
  [Tier.Silver]: [YieldSourceType.TBill, YieldSourceType.Lending],
  [Tier.Gold]: [
    YieldSourceType.TBill,
    YieldSourceType.Lending,
    YieldSourceType.Staking,
  ],
  [Tier.Diamond]: [
    YieldSourceType.TBill,
    YieldSourceType.Lending,
    YieldSourceType.Staking,
    YieldSourceType.Synthetic,
  ],
};

export interface TierInfo {
  tier: Tier;
  monthlyJpyLimit: bigint;
  monthlyUsdcLimit: bigint;
  monthlyJpyUsed: bigint;
  monthlyUsdcUsed: bigint;
  allowedSources: YieldSourceType[];
}
