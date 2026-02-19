"use client";

import { FC } from "react";
import { useI18n } from "@/providers/I18nProvider";
import { Tier, TIER_COLORS, TIER_NAMES } from "@exodus/types";

interface TierBadgeProps {
  tier: number;
  monthlyJpyUsed: number;
  monthlyJpyLimit: number;
}

export const TierBadge: FC<TierBadgeProps> = ({
  tier,
  monthlyJpyUsed,
  monthlyJpyLimit,
}) => {
  const { locale, t } = useI18n();

  const tierEnum = tier as Tier;
  const tierName = TIER_NAMES[tierEnum];
  const tierColor = TIER_COLORS[tierEnum];
  const displayName = locale === "ja" ? tierName.ja : tierName.en;

  const usagePercent =
    monthlyJpyLimit > 0
      ? Math.min((monthlyJpyUsed / monthlyJpyLimit) * 100, 100)
      : 0;

  const formattedUsed = (monthlyJpyUsed / 1_000_000).toLocaleString("ja-JP", {
    maximumFractionDigits: 0,
  });
  const formattedLimit =
    monthlyJpyLimit >= Number.MAX_SAFE_INTEGER
      ? "Unlimited"
      : (monthlyJpyLimit / 1_000_000).toLocaleString("ja-JP", {
          maximumFractionDigits: 0,
        });

  return (
    <div className="card rounded-xl border border-navy-700 bg-navy-800/80 p-6 shadow-lg">
      {/* Tier badge */}
      <div className="mb-4 flex items-center gap-3">
        <span
          className="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-bold"
          style={{
            backgroundColor: `${tierColor}20`,
            color: tierColor,
            border: `1px solid ${tierColor}40`,
          }}
        >
          {displayName}
        </span>
      </div>

      {/* Monthly usage */}
      <div className="mb-2 flex items-center justify-between">
        <span className="stat-label text-sm text-gray-400">
          {t("tier.monthlyUsage")}
        </span>
        <span className="stat-value text-xs font-medium text-gray-300">
          {`\u00a5${formattedUsed}`} / {formattedLimit === "Unlimited" ? formattedLimit : `\u00a5${formattedLimit}`}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-navy-900">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${usagePercent}%`,
            backgroundColor: tierColor,
          }}
        />
      </div>

      <p className="mt-2 text-right text-xs text-gray-500">
        {usagePercent.toFixed(1)}%
      </p>
    </div>
  );
};
