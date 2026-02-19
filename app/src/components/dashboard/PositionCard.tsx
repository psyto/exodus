"use client";

import { FC } from "react";
import { useI18n } from "@/providers/I18nProvider";
import { formatShares, formatUSDC, formatRate, formatPercentChange } from "@/lib/format";

interface PositionCardProps {
  shares: number;
  navPerShare: number;
  entryRate: number;
  currentRate: number;
}

export const PositionCard: FC<PositionCardProps> = ({
  shares,
  navPerShare,
  entryRate,
  currentRate,
}) => {
  const { t } = useI18n();

  const usdcValue = (shares / 1_000_000) * (navPerShare / 1_000_000);
  const fxPnl = ((currentRate - entryRate) / entryRate) * 100;
  const isGain = fxPnl >= 0;

  const rows = [
    {
      label: t("dashboard.shares"),
      value: formatShares(shares),
    },
    {
      label: t("dashboard.navPerShare"),
      value: formatUSDC(navPerShare),
    },
    {
      label: t("dashboard.usdcValue"),
      value: `$${usdcValue.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    },
    {
      label: t("dashboard.entryRate"),
      value: formatRate(entryRate),
    },
    {
      label: t("dashboard.fxPnl"),
      value: formatPercentChange(fxPnl),
      highlight: true,
    },
  ];

  return (
    <div className="card rounded-xl border border-navy-700 bg-navy-800/80 p-6 shadow-lg">
      <h3 className="mb-4 text-lg font-semibold text-white">
        {t("dashboard.positions")}
      </h3>
      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between border-b border-navy-700/50 pb-3 last:border-0 last:pb-0"
          >
            <span className="stat-label text-sm text-gray-400">{row.label}</span>
            <span
              className={`stat-value text-sm font-semibold ${
                row.highlight
                  ? isGain
                    ? "text-green-400"
                    : "text-red-400"
                  : "text-white"
              }`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
