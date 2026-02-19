"use client";

import React from "react";
import { useI18n } from "@/providers/I18nProvider";

interface YieldSourceCardProps {
  name: string;
  apyBps: number;
  tvl: number;
  navPerShare: number;
  allocationWeightBps: number;
  isActive: boolean;
}

export function YieldSourceCard({
  name,
  apyBps,
  tvl,
  navPerShare,
  allocationWeightBps,
  isActive,
}: YieldSourceCardProps) {
  const { t } = useI18n();

  const apyPct = (apyBps / 100).toFixed(2);
  const allocationPct = (allocationWeightBps / 100).toFixed(1);

  const formatTvl = (value: number): string => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  };

  return (
    <div
      className={`rounded-2xl border p-5 shadow-lg transition-all ${
        isActive
          ? "border-amber-500/40 bg-[#0a1628]"
          : "border-slate-700 bg-[#0a1628] opacity-60"
      }`}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-100">{name}</h3>
        <span
          className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
            isActive
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-slate-700 text-slate-400"
          }`}
        >
          {isActive
            ? t("yield.active", "Active")
            : t("yield.inactive", "Inactive")}
        </span>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCell
          label={t("yield.apy", "APY")}
          value={`${apyPct}%`}
          highlight
        />
        <MetricCell
          label={t("yield.allocation", "Allocation")}
          value={`${allocationPct}%`}
        />
        <MetricCell
          label={t("yield.tvl", "TVL")}
          value={formatTvl(tvl)}
        />
        <MetricCell
          label={t("yield.navPerShare", "NAV / Share")}
          value={`$${navPerShare.toFixed(4)}`}
        />
      </div>

      {/* Allocation Bar */}
      <div className="mt-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isActive
                ? "bg-gradient-to-r from-amber-500 to-amber-400"
                : "bg-slate-600"
            }`}
            style={{ width: `${Math.min(Number(allocationPct), 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function MetricCell({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-700/50 bg-[#0d1d35] px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`font-mono text-sm font-semibold ${
          highlight ? "text-amber-400" : "text-slate-200"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
