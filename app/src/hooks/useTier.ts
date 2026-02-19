"use client";

import { useMemo } from "react";
import {
  Tier,
  TierInfo,
  MONTHLY_JPY_LIMITS,
  MONTHLY_USDC_LIMITS,
  TIER_YIELD_SOURCES,
} from "@exodus/types";
import { useUserPosition } from "./useUserPosition";

/**
 * Hook to get user's tier info including limits and usage.
 */
export function useTier(): { tierInfo: TierInfo | null; loading: boolean } {
  const { position, loading } = useUserPosition();

  const tierInfo = useMemo<TierInfo | null>(() => {
    if (!position) return null;

    const tier = position.sovereignTier as Tier;
    return {
      tier,
      monthlyJpyLimit: MONTHLY_JPY_LIMITS[tier] ?? 0n,
      monthlyUsdcLimit: MONTHLY_USDC_LIMITS[tier] ?? 0n,
      monthlyJpyUsed: position.monthlyDepositedJpy,
      monthlyUsdcUsed: position.monthlyDepositedUsdc,
      allowedSources: TIER_YIELD_SOURCES[tier] ?? [],
    };
  }, [position]);

  return { tierInfo, loading };
}
