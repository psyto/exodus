"use client";

import { FC } from "react";
import { useI18n } from "@/providers/I18nProvider";
import { Tier, TIER_NAMES, TIER_COLORS } from "@exodus/types";

interface TierProgressBarProps {
  currentTier: number;
  compositeScore: number;
}

/** Tier thresholds on a 0-100 composite score scale. */
const TIER_THRESHOLDS: Record<Tier, number> = {
  [Tier.Unverified]: 0,
  [Tier.Bronze]: 20,
  [Tier.Silver]: 40,
  [Tier.Gold]: 65,
  [Tier.Diamond]: 85,
};

const TIER_ORDER: Tier[] = [
  Tier.Unverified,
  Tier.Bronze,
  Tier.Silver,
  Tier.Gold,
  Tier.Diamond,
];

export const TierProgressBar: FC<TierProgressBarProps> = ({
  currentTier,
  compositeScore,
}) => {
  const { t, locale } = useI18n();

  const tierEnum = currentTier as Tier;
  const currentIndex = TIER_ORDER.indexOf(tierEnum);
  const nextTier =
    currentIndex < TIER_ORDER.length - 1
      ? TIER_ORDER[currentIndex + 1]
      : null;

  const currentTierName =
    locale === "ja"
      ? TIER_NAMES[tierEnum].ja
      : TIER_NAMES[tierEnum].en;

  const nextTierName = nextTier
    ? locale === "ja"
      ? TIER_NAMES[nextTier].ja
      : TIER_NAMES[nextTier].en
    : null;

  /** Clamp composite score to 0-100 for display. */
  const clampedScore = Math.max(0, Math.min(100, compositeScore));

  return (
    <div className="card rounded-xl border border-navy-700 bg-navy-800/80 p-6 shadow-lg">
      <h3 className="mb-4 text-lg font-semibold text-white">
        {t("compliance.tierProgress")}
      </h3>

      {/* Current / Next tier labels */}
      <div className="mb-2 flex items-center justify-between">
        <div>
          <span className="stat-label text-xs text-gray-500">
            {t("compliance.currentTier")}
          </span>
          <p
            className="text-sm font-bold"
            style={{ color: TIER_COLORS[tierEnum] }}
          >
            {currentTierName}
          </p>
        </div>
        {nextTier !== null && nextTierName && (
          <div className="text-right">
            <span className="stat-label text-xs text-gray-500">
              {t("compliance.nextTier")}
            </span>
            <p
              className="text-sm font-bold"
              style={{ color: TIER_COLORS[nextTier] }}
            >
              {nextTierName}
            </p>
          </div>
        )}
      </div>

      {/* Graduated progress bar */}
      <div className="relative mb-3 h-3 w-full overflow-hidden rounded-full bg-navy-900">
        {/* Gradient fill up to the composite score */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${clampedScore}%`,
            background: `linear-gradient(to right, ${TIER_COLORS[Tier.Bronze]}, ${TIER_COLORS[Tier.Silver]}, ${TIER_COLORS[Tier.Gold]}, ${TIER_COLORS[Tier.Diamond]})`,
          }}
        />

        {/* Tier threshold markers */}
        {TIER_ORDER.slice(1).map((tier) => {
          const threshold = TIER_THRESHOLDS[tier];
          return (
            <div
              key={tier}
              className="absolute top-0 h-full w-px bg-navy-700"
              style={{ left: `${threshold}%` }}
              aria-hidden="true"
            />
          );
        })}
      </div>

      {/* Tier labels beneath the bar */}
      <div className="relative mb-4 flex justify-between text-[10px] text-gray-500">
        {TIER_ORDER.map((tier) => {
          const name =
            locale === "ja" ? TIER_NAMES[tier].ja : TIER_NAMES[tier].en;
          return (
            <span
              key={tier}
              style={{
                color:
                  tier <= tierEnum ? TIER_COLORS[tier] : undefined,
              }}
            >
              {name}
            </span>
          );
        })}
      </div>

      {/* Composite score */}
      <div className="flex items-center justify-between">
        <span className="stat-label text-sm text-gray-400">
          {t("compliance.compositeScore")}
        </span>
        <span className="stat-value text-sm font-bold text-white">
          {clampedScore}
          <span className="text-gray-500"> / 100</span>
        </span>
      </div>
    </div>
  );
};
