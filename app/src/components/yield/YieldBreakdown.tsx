"use client";

import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useI18n } from "@/providers/I18nProvider";

interface YieldSource {
  name: string;
  value: number;
  color: string;
}

interface YieldBreakdownProps {
  realizedYield: number;
  unrealizedYield: number;
  sources: YieldSource[];
}

export function YieldBreakdown({
  realizedYield,
  unrealizedYield,
  sources,
}: YieldBreakdownProps) {
  const { t } = useI18n();

  const totalYield = realizedYield + unrealizedYield;

  const realizedUnrealizedData = [
    {
      name: t("yield.realized", "Realized"),
      value: realizedYield,
      color: "#f59e0b",
    },
    {
      name: t("yield.unrealized", "Unrealized"),
      value: unrealizedYield,
      color: "#64748b",
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-700 bg-[#0a1628] p-6 shadow-xl">
      <h2 className="mb-6 text-xl font-bold text-amber-400">
        {t("yield.breakdownTitle", "Yield Breakdown")}
      </h2>

      {/* Total Yield */}
      <div className="mb-6 text-center">
        <p className="text-sm text-slate-400">
          {t("yield.totalYield", "Total Yield")}
        </p>
        <p className="font-mono text-3xl font-bold text-amber-400">
          {totalYield.toFixed(4)} <span className="text-lg">USDC</span>
        </p>
      </div>

      {/* Yield by Source - Pie Chart */}
      <div className="mb-6">
        <h3 className="mb-3 text-sm font-medium text-slate-400">
          {t("yield.bySource", "By Source")}
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sources}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
                nameKey="name"
                stroke="none"
              >
                {sources.map((source, index) => (
                  <Cell key={`source-${index}`} fill={source.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0d1d35",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#e2e8f0",
                  fontSize: "13px",
                }}
                formatter={(value: number) => [
                  `${value.toFixed(4)} USDC`,
                  "",
                ]}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                wrapperStyle={{ color: "#94a3b8", fontSize: "12px" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Realized vs Unrealized */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-slate-400">
          {t("yield.realizedVsUnrealized", "Realized vs Unrealized")}
        </h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={realizedUnrealizedData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                paddingAngle={3}
                dataKey="value"
                nameKey="name"
                stroke="none"
              >
                {realizedUnrealizedData.map((entry, index) => (
                  <Cell key={`ru-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0d1d35",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#e2e8f0",
                  fontSize: "13px",
                }}
                formatter={(value: number) => [
                  `${value.toFixed(4)} USDC`,
                  "",
                ]}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                wrapperStyle={{ color: "#94a3b8", fontSize: "12px" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Realized / Unrealized Summary */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-slate-700 bg-[#0d1d35] p-3 text-center">
            <p className="text-xs text-slate-400">
              {t("yield.realized", "Realized")}
            </p>
            <p className="font-mono text-lg font-bold text-amber-400">
              {realizedYield.toFixed(4)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-[#0d1d35] p-3 text-center">
            <p className="text-xs text-slate-400">
              {t("yield.unrealized", "Unrealized")}
            </p>
            <p className="font-mono text-lg font-bold text-slate-300">
              {unrealizedYield.toFixed(4)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
