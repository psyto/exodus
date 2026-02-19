"use client";

import { useState } from "react";
import { useI18n } from "@/providers/I18nProvider";
import { useWallet } from "@solana/wallet-adapter-react";
import { useYieldData } from "@/hooks/useYieldData";
import { formatUSDC, formatAPY } from "@/lib/format";

export default function AdminPage() {
  const { t } = useI18n();
  const { publicKey } = useWallet();
  const { yieldSource } = useYieldData();

  const [conversionFeeBps, setConversionFeeBps] = useState(30);
  const [managementFeeBps, setManagementFeeBps] = useState(50);
  const [performanceFeeBps, setPerformanceFeeBps] = useState(1000);

  if (!publicKey) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-navy-300">{t("common.connect")}</p>
      </div>
    );
  }

  // Mock protocol stats
  const stats = {
    tvl: 12_500_000_000_000,
    totalUsers: 342,
    totalYieldDistributed: 156_000_000_000,
    pendingDeposits: 5,
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t("admin.title")}</h1>

      {/* Protocol Stats */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-navy-200">
          {t("admin.protocolStats")}
        </h2>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="card">
            <div className="stat-label">{t("admin.tvl")}</div>
            <div className="stat-value text-white">
              {formatUSDC(stats.tvl)}
            </div>
          </div>
          <div className="card">
            <div className="stat-label">{t("admin.totalUsers")}</div>
            <div className="stat-value text-white">{stats.totalUsers}</div>
          </div>
          <div className="card">
            <div className="stat-label">{t("admin.totalYieldDistributed")}</div>
            <div className="stat-value text-accent-green">
              {formatUSDC(stats.totalYieldDistributed)}
            </div>
          </div>
          <div className="card">
            <div className="stat-label">{t("admin.pendingDeposits")}</div>
            <div className="stat-value text-gold-400">
              {stats.pendingDeposits}
            </div>
          </div>
        </div>
      </div>

      {/* Yield Sources */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-navy-200">
          {t("admin.yieldSources")}
        </h2>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">US T-Bill 4.5%</h3>
              <p className="text-sm text-navy-300">
                APY: {formatAPY(yieldSource?.currentApyBps ?? 450)} | TVL:{" "}
                {formatUSDC(yieldSource?.totalDeposited ?? 0n)}
              </p>
            </div>
            <div className="flex gap-2">
              <span className="badge-success">Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Fee Configuration */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-navy-200">
          {t("admin.feeConfig")}
        </h2>
        <div className="card space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm text-navy-300">
                Conversion Fee (bps)
              </label>
              <input
                type="number"
                value={conversionFeeBps}
                onChange={(e) => setConversionFeeBps(Number(e.target.value))}
                className="input-field w-full"
                min={0}
                max={1000}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-navy-300">
                Management Fee (bps)
              </label>
              <input
                type="number"
                value={managementFeeBps}
                onChange={(e) => setManagementFeeBps(Number(e.target.value))}
                className="input-field w-full"
                min={0}
                max={500}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-navy-300">
                Performance Fee (bps)
              </label>
              <input
                type="number"
                value={performanceFeeBps}
                onChange={(e) => setPerformanceFeeBps(Number(e.target.value))}
                className="input-field w-full"
                min={0}
                max={5000}
              />
            </div>
          </div>
          <button className="btn-primary">Update Fees</button>
        </div>
      </div>

      {/* Protocol Controls */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-navy-200">
          Protocol Controls
        </h2>
        <div className="card flex gap-4">
          <button className="btn-secondary border-accent-red text-accent-red hover:bg-accent-red/10">
            Pause Protocol
          </button>
          <button className="btn-secondary border-accent-green text-accent-green hover:bg-accent-green/10">
            Resume Protocol
          </button>
        </div>
      </div>
    </div>
  );
}
