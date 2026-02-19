"use client";

import { FC } from "react";
import { useI18n } from "@/providers/I18nProvider";
import { formatUSDC, formatAPY } from "@/lib/format";

interface PortfolioSummaryProps {
  totalValueUsdc: number;
  totalYieldUsdc: number;
  currentApyBps: number;
  unrealizedYieldUsdc: number;
}

export const PortfolioSummary: FC<PortfolioSummaryProps> = ({
  totalValueUsdc,
  totalYieldUsdc,
  currentApyBps,
  unrealizedYieldUsdc,
}) => {
  const { t } = useI18n();

  const cards = [
    {
      label: t("dashboard.totalValue"),
      value: formatUSDC(totalValueUsdc),
    },
    {
      label: t("dashboard.totalYield"),
      value: formatUSDC(totalYieldUsdc),
    },
    {
      label: t("dashboard.currentApy"),
      value: formatAPY(currentApyBps),
    },
    {
      label: t("dashboard.unrealizedYield"),
      value: formatUSDC(unrealizedYieldUsdc),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="card rounded-xl border border-navy-700 bg-navy-800/80 p-6 shadow-lg transition-colors hover:border-gold-500/30"
        >
          <p className="stat-label text-sm font-medium text-gray-400">
            {card.label}
          </p>
          <p className="stat-value mt-2 text-2xl font-bold tracking-tight text-white">
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
};
