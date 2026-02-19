"use client";

import { FC } from "react";
import { useI18n } from "@/providers/I18nProvider";
import { formatRate, formatPercentChange } from "@/lib/format";

interface ConversionRateCardProps {
  currentRate: number;
  userAvgRate: number;
}

export const ConversionRateCard: FC<ConversionRateCardProps> = ({
  currentRate,
  userAvgRate,
}) => {
  const { t } = useI18n();

  const fxPnlPercent = ((currentRate - userAvgRate) / userAvgRate) * 100;
  const isGain = fxPnlPercent >= 0;

  return (
    <div className="card rounded-xl border border-navy-700 bg-navy-800/80 p-6 shadow-lg">
      <h3 className="mb-4 text-lg font-semibold text-white">
        {t("landing.exchangeRate")}
      </h3>

      {/* Live rate */}
      <div className="mb-6">
        <p className="stat-label text-sm text-gray-400">JPY/USD</p>
        <p className="stat-value mt-1 text-3xl font-bold tracking-tight text-gold-400">
          {formatRate(currentRate)}
        </p>
      </div>

      {/* User avg rate */}
      <div className="mb-4 flex items-center justify-between border-b border-navy-700/50 pb-4">
        <span className="stat-label text-sm text-gray-400">
          {t("dashboard.entryRate")}
        </span>
        <span className="stat-value text-sm font-semibold text-white">
          {formatRate(userAvgRate)}
        </span>
      </div>

      {/* FX P&L */}
      <div className="flex items-center justify-between">
        <span className="stat-label text-sm text-gray-400">
          {t("dashboard.fxPnl")}
        </span>
        <span
          className={`stat-value inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${
            isGain
              ? "bg-green-500/10 text-green-400"
              : "bg-red-500/10 text-red-400"
          }`}
        >
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              isGain ? "bg-green-400" : "bg-red-400"
            }`}
            aria-hidden="true"
          />
          {formatPercentChange(fxPnlPercent)}
        </span>
      </div>
    </div>
  );
};
