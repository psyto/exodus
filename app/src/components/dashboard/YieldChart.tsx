"use client";

import { FC, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useI18n } from "@/providers/I18nProvider";

type Period = "7d" | "30d" | "90d" | "all";

interface YieldDataPoint {
  date: string;
  value: number;
}

interface YieldChartProps {
  data: YieldDataPoint[];
  period: Period;
}

const PERIODS: { key: Period; labelKey: string }[] = [
  { key: "7d", labelKey: "dashboard.period7d" },
  { key: "30d", labelKey: "dashboard.period30d" },
  { key: "90d", labelKey: "dashboard.period90d" },
  { key: "all", labelKey: "dashboard.periodAll" },
];

/** Generate mock yield data for demo purposes. */
function generateMockData(period: Period): YieldDataPoint[] {
  const now = Date.now();
  const dayMs = 86_400_000;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 365;
  const points: YieldDataPoint[] = [];
  let cumulative = 1000;

  for (let i = days; i >= 0; i--) {
    const date = new Date(now - i * dayMs);
    const dailyYield = cumulative * (0.045 / 365) + (Math.random() - 0.4) * 0.5;
    cumulative += dailyYield;
    points.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: Math.round(cumulative * 100) / 100,
    });
  }

  return points;
}

export const YieldChart: FC<YieldChartProps> = ({
  data: externalData,
  period: initialPeriod,
}) => {
  const { t } = useI18n();
  const [activePeriod, setActivePeriod] = useState<Period>(initialPeriod);

  const chartData = useMemo(() => {
    if (externalData.length > 0) return externalData;
    return generateMockData(activePeriod);
  }, [externalData, activePeriod]);

  return (
    <div className="card rounded-xl border border-navy-700 bg-navy-800/80 p-6 shadow-lg">
      {/* Period toggle buttons */}
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          {t("yield.apyHistory")}
        </h3>
        <div className="flex gap-1 rounded-lg bg-navy-900 p-1">
          {PERIODS.map(({ key, labelKey }) => (
            <button
              key={key}
              onClick={() => setActivePeriod(key)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activePeriod === key
                  ? "bg-gold-500 text-navy-900"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <XAxis
              dataKey="date"
              tick={{ fill: "#ffffff", fontSize: 11 }}
              tickLine={{ stroke: "#374151" }}
              axisLine={{ stroke: "#374151" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "#ffffff", fontSize: 11 }}
              tickLine={{ stroke: "#374151" }}
              axisLine={{ stroke: "#374151" }}
              tickFormatter={(val: number) => `$${val.toLocaleString()}`}
              width={80}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                border: "1px solid #374151",
                borderRadius: "8px",
                color: "#ffffff",
              }}
              labelStyle={{ color: "#9ca3af" }}
              formatter={(value: number) => [`$${value.toFixed(2)}`, "Value"]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#f59e0b", stroke: "#0f172a", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
