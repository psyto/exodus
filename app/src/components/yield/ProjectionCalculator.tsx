"use client";

import React, { useState, useMemo } from "react";
import { useI18n } from "@/providers/I18nProvider";

function calculateProjectedYield(
  principal: number,
  apyPct: number,
  months: number
): number {
  // Compound monthly: A = P * (1 + r/12)^months - P
  const monthlyRate = apyPct / 100 / 12;
  const futureValue = principal * Math.pow(1 + monthlyRate, months);
  return futureValue - principal;
}

export function ProjectionCalculator() {
  const { t } = useI18n();
  const [depositAmount, setDepositAmount] = useState<number>(10000);
  const [durationMonths, setDurationMonths] = useState<number>(12);

  // Current APY — replace with live data
  const currentApyPct = 4.5;
  const jpySavingsApyPct = 0.1;

  const exodusYield = useMemo(
    () => calculateProjectedYield(depositAmount, currentApyPct, durationMonths),
    [depositAmount, currentApyPct, durationMonths]
  );

  const jpyYield = useMemo(
    () =>
      calculateProjectedYield(depositAmount, jpySavingsApyPct, durationMonths),
    [depositAmount, jpySavingsApyPct, durationMonths]
  );

  const exodusTotal = depositAmount + exodusYield;
  const jpyTotal = depositAmount + jpyYield;
  const advantage = exodusYield - jpyYield;

  return (
    <div className="rounded-2xl border border-slate-700 bg-[#0a1628] p-6 shadow-xl">
      <h2 className="mb-2 text-xl font-bold text-amber-400">
        {t("yield.projectionTitle", "Yield Projection Calculator")}
      </h2>
      <p className="mb-6 text-sm text-slate-400">
        {t(
          "yield.projectionDescription",
          "Estimate your returns at the current APY"
        )}
      </p>

      {/* Deposit Amount Input */}
      <div className="mb-5">
        <label className="mb-2 block text-sm font-medium text-slate-400">
          {t("yield.depositAmount", "Deposit Amount (USDC)")}
        </label>
        <input
          type="number"
          min={0}
          step={100}
          value={depositAmount}
          onChange={(e) => setDepositAmount(Math.max(0, Number(e.target.value)))}
          className="w-full rounded-lg border border-slate-700 bg-[#0d1d35] px-4 py-3 font-mono text-lg text-slate-100 outline-none transition-colors focus:border-amber-500"
          placeholder="10000"
        />
      </div>

      {/* Duration Slider */}
      <div className="mb-6">
        <label className="mb-2 flex items-center justify-between text-sm font-medium text-slate-400">
          <span>{t("yield.duration", "Duration")}</span>
          <span className="font-mono text-amber-400">
            {durationMonths} {t("yield.months", "months")}
          </span>
        </label>
        <input
          type="range"
          min={1}
          max={60}
          step={1}
          value={durationMonths}
          onChange={(e) => setDurationMonths(Number(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-amber-500 outline-none"
        />
        <div className="mt-1 flex justify-between text-xs text-slate-500">
          <span>1mo</span>
          <span>12mo</span>
          <span>24mo</span>
          <span>36mo</span>
          <span>48mo</span>
          <span>60mo</span>
        </div>
      </div>

      {/* Projection Output */}
      <div className="mb-6 rounded-lg border border-slate-700 bg-[#0d1d35] p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">
            {t("yield.projectedYield", "Projected Yield")}
          </span>
          <span className="font-mono text-lg font-bold text-emerald-400">
            +{exodusYield.toFixed(2)} USDC
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-slate-400">
            {t("yield.totalValue", "Total Value")}
          </span>
          <span className="font-mono text-lg font-bold text-amber-400">
            {exodusTotal.toFixed(2)} USDC
          </span>
        </div>
      </div>

      {/* Comparison Table: EXODUS vs JPY Savings */}
      <div className="overflow-hidden rounded-lg border border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#0d1d35]">
              <th className="px-4 py-3 text-left font-medium text-slate-400">
                {t("yield.metric", "Metric")}
              </th>
              <th className="px-4 py-3 text-right font-medium text-amber-400">
                EXODUS ({currentApyPct}%)
              </th>
              <th className="px-4 py-3 text-right font-medium text-slate-400">
                JPY Savings ({jpySavingsApyPct}%)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            <tr className="bg-[#0a1628]">
              <td className="px-4 py-3 text-slate-300">
                {t("yield.principal", "Principal")}
              </td>
              <td className="px-4 py-3 text-right font-mono text-slate-200">
                {depositAmount.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right font-mono text-slate-200">
                {depositAmount.toLocaleString()}
              </td>
            </tr>
            <tr className="bg-[#0d1d35]">
              <td className="px-4 py-3 text-slate-300">
                {t("yield.yieldEarned", "Yield Earned")}
              </td>
              <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-400">
                +{exodusYield.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-slate-400">
                +{jpyYield.toFixed(2)}
              </td>
            </tr>
            <tr className="bg-[#0a1628]">
              <td className="px-4 py-3 text-slate-300">
                {t("yield.totalValue", "Total Value")}
              </td>
              <td className="px-4 py-3 text-right font-mono font-bold text-amber-400">
                {exodusTotal.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-slate-300">
                {jpyTotal.toFixed(2)}
              </td>
            </tr>
            <tr className="bg-[#0d1d35]">
              <td className="px-4 py-3 font-medium text-slate-300">
                {t("yield.advantage", "EXODUS Advantage")}
              </td>
              <td
                colSpan={2}
                className="px-4 py-3 text-right font-mono text-lg font-bold text-emerald-400"
              >
                +{advantage.toFixed(2)} USDC
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
