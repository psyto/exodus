"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useI18n } from "@/providers/I18nProvider";

interface APYHistoryChartProps {
  data: Array<{ date: string; apy: number }>;
}

export function APYHistoryChart({ data }: APYHistoryChartProps) {
  const { t } = useI18n();

  const JPY_SAVINGS_BENCHMARK = 0.1; // 0.1% JPY savings rate

  return (
    <div className="rounded-2xl border border-slate-700 bg-[#0a1628] p-6 shadow-xl">
      <h2 className="mb-2 text-xl font-bold text-amber-400">
        {t("yield.apyHistoryTitle", "APY History")}
      </h2>
      <p className="mb-6 text-sm text-slate-400">
        {t(
          "yield.apyHistoryDescription",
          "Historical annualized percentage yield with JPY savings benchmark"
        )}
      </p>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1e293b"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={{ stroke: "#334155" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={{ stroke: "#334155" }}
              tickLine={false}
              tickFormatter={(value: number) => `${value.toFixed(1)}%`}
              domain={[0, "auto"]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0d1d35",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#e2e8f0",
                fontSize: "13px",
              }}
              formatter={(value: number) => [
                `${value.toFixed(2)}%`,
                "APY",
              ]}
              labelStyle={{ color: "#94a3b8" }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ color: "#94a3b8", fontSize: "12px" }}
            />

            {/* APY Line - gold */}
            <Line
              type="monotone"
              dataKey="apy"
              name={t("yield.exodusApy", "EXODUS APY")}
              stroke="#f59e0b"
              strokeWidth={2.5}
              dot={false}
              activeDot={{
                r: 5,
                fill: "#f59e0b",
                stroke: "#0a1628",
                strokeWidth: 2,
              }}
            />

            {/* Benchmark Line - dashed gray */}
            <ReferenceLine
              y={JPY_SAVINGS_BENCHMARK}
              stroke="#64748b"
              strokeDasharray="6 4"
              label={{
                value: t(
                  "yield.jpySavingsBenchmark",
                  `JPY Savings (${JPY_SAVINGS_BENCHMARK}%)`
                ),
                position: "right",
                fill: "#64748b",
                fontSize: 11,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
