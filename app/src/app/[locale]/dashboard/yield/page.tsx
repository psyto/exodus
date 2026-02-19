"use client";

import { useI18n } from "@/providers/I18nProvider";
import { useWallet } from "@solana/wallet-adapter-react";
import { useUserPosition } from "@/hooks/useUserPosition";
import { useYieldData } from "@/hooks/useYieldData";
import { YieldBreakdown } from "@/components/yield/YieldBreakdown";
import { APYHistoryChart } from "@/components/yield/APYHistoryChart";
import { ProjectionCalculator } from "@/components/yield/ProjectionCalculator";
import { YieldSourceCard } from "@/components/yield/YieldSourceCard";
import { formatUSDC, formatAPY } from "@/lib/format";

export default function YieldPage() {
  const { t } = useI18n();
  const { publicKey } = useWallet();
  const { position } = useUserPosition();
  const { yieldSource } = useYieldData();

  if (!publicKey) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-navy-300">{t("common.connect")}</p>
      </div>
    );
  }

  const realizedYield = position ? Number(position.realizedYieldUsdc) : 0;
  const unrealizedYield = position ? Number(position.unrealizedYieldUsdc) : 0;
  const currentApyBps = yieldSource ? yieldSource.currentApyBps : 450;

  // Mock APY history data
  const apyHistory = Array.from({ length: 90 }, (_, i) => ({
    date: new Date(Date.now() - (89 - i) * 86400000)
      .toISOString()
      .split("T")[0],
    apy: 4.3 + Math.random() * 0.4,
  }));

  const yieldSources = [
    {
      name: "T-Bill",
      value: realizedYield + unrealizedYield || 1000000,
      color: "#f59e0b",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t("yield.title")}</h1>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <div className="stat-label">{t("yield.realized")}</div>
          <div className="stat-value text-accent-green">
            {formatUSDC(realizedYield)}
          </div>
        </div>
        <div className="card">
          <div className="stat-label">{t("yield.unrealized")}</div>
          <div className="stat-value text-gold-400">
            {formatUSDC(unrealizedYield)}
          </div>
        </div>
        <div className="card">
          <div className="stat-label">{t("dashboard.currentApy")}</div>
          <div className="stat-value text-white">{formatAPY(currentApyBps)}</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <YieldBreakdown
          realizedYield={realizedYield}
          unrealizedYield={unrealizedYield}
          sources={yieldSources}
        />
        <APYHistoryChart data={apyHistory} />
      </div>

      {/* Projection Calculator */}
      <ProjectionCalculator />

      {/* Yield Sources */}
      <div>
        <h2 className="mb-4 text-xl font-semibold text-white">
          {t("yield.sourceDetails")}
        </h2>
        {yieldSource && (
          <YieldSourceCard
            name="US T-Bill 4.5%"
            apyBps={yieldSource.currentApyBps}
            tvl={Number(yieldSource.totalDeposited)}
            navPerShare={Number(yieldSource.navPerShare)}
            allocationWeightBps={yieldSource.allocationWeightBps}
            isActive={yieldSource.isActive}
          />
        )}
        {!yieldSource && (
          <YieldSourceCard
            name="US T-Bill 4.5%"
            apyBps={450}
            tvl={1_250_000_000_000}
            navPerShare={1_002_340}
            allocationWeightBps={10000}
            isActive={true}
          />
        )}
      </div>
    </div>
  );
}
