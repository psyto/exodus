"use client";

import { useI18n } from "@/providers/I18nProvider";
import { useUserPosition } from "@/hooks/useUserPosition";
import { useYieldData } from "@/hooks/useYieldData";
import { useConversionRate } from "@/hooks/useConversionRate";
import { useKYCStatus } from "@/hooks/useKYCStatus";
import { useTier } from "@/hooks/useTier";
import { useWallet } from "@solana/wallet-adapter-react";
import { PortfolioSummary } from "@/components/dashboard/PortfolioSummary";
import { YieldChart } from "@/components/dashboard/YieldChart";
import { PositionCard } from "@/components/dashboard/PositionCard";
import { ConversionRateCard } from "@/components/dashboard/ConversionRateCard";
import { TierBadge } from "@/components/dashboard/TierBadge";
import { KYCStatusCard } from "@/components/compliance/KYCStatusCard";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useState } from "react";

export default function DashboardPage() {
  const { t } = useI18n();
  const { publicKey } = useWallet();
  const { position, loading: posLoading } = useUserPosition();
  const { yieldSource } = useYieldData();
  const { rate } = useConversionRate();
  const { status: kycStatus } = useKYCStatus();
  const { tierInfo } = useTier();
  const [chartPeriod, setChartPeriod] = useState<"7d" | "30d" | "90d" | "all">("30d");

  if (!publicKey) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <h2 className="mb-4 text-2xl font-bold text-white">
            {t("common.connect")}
          </h2>
          <p className="text-navy-300">
            Connect your wallet to view your portfolio
          </p>
        </div>
      </div>
    );
  }

  if (posLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Calculate display values
  const totalValueUsdc = position
    ? Number(position.currentShares) *
      (yieldSource ? Number(yieldSource.navPerShare) / 1_000_000 : 1)
    : 0;
  const totalYieldUsdc = position ? Number(position.realizedYieldUsdc) : 0;
  const unrealizedYieldUsdc = position
    ? Number(position.unrealizedYieldUsdc)
    : 0;
  const currentApyBps = yieldSource ? yieldSource.currentApyBps : 450;
  const navPerShare = yieldSource ? Number(yieldSource.navPerShare) : 1_000_000;
  const currentRate = rate ? rate.jpyPerUsd * 1_000_000 : 155_000_000;
  const entryRate = position ? Number(position.avgConversionRate) : currentRate;

  // Mock chart data
  const chartData = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toLocaleDateString(),
    value: totalValueUsdc * (0.98 + i * 0.001 + Math.random() * 0.005),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t("dashboard.title")}</h1>

      {/* Portfolio Summary Cards */}
      <PortfolioSummary
        totalValueUsdc={totalValueUsdc}
        totalYieldUsdc={totalYieldUsdc}
        currentApyBps={currentApyBps}
        unrealizedYieldUsdc={unrealizedYieldUsdc}
      />

      {/* Charts and Position */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <YieldChart data={chartData} period={chartPeriod} />
        </div>
        <div className="space-y-6">
          <ConversionRateCard
            currentRate={currentRate}
            userAvgRate={entryRate}
          />
          {tierInfo && (
            <TierBadge
              tier={tierInfo.tier}
              monthlyJpyUsed={Number(tierInfo.monthlyJpyUsed)}
              monthlyJpyLimit={Number(tierInfo.monthlyJpyLimit)}
            />
          )}
        </div>
      </div>

      {/* Position & KYC */}
      <div className="grid gap-6 lg:grid-cols-2">
        <PositionCard
          shares={position ? Number(position.currentShares) : 0}
          navPerShare={navPerShare}
          entryRate={entryRate}
          currentRate={currentRate}
        />
        {kycStatus && (
          <KYCStatusCard
            isVerified={kycStatus.isVerified}
            kycLevel={kycStatus.kycLevel}
            jurisdiction="Japan"
            expiresAt={kycStatus.expiresAt}
          />
        )}
      </div>
    </div>
  );
}
