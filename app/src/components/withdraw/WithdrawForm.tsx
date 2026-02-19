"use client";

import React, { useState, useMemo } from "react";
import { useI18n } from "@/providers/I18nProvider";

interface WithdrawFormProps {
  maxShares: number;
  navPerShare: number;
  onSubmit: (shares: number, asJpy: boolean) => void;
}

export function WithdrawForm({
  maxShares,
  navPerShare,
  onSubmit,
}: WithdrawFormProps) {
  const { t } = useI18n();
  const [shares, setShares] = useState<number>(0);
  const [asJpy, setAsJpy] = useState<boolean>(false);

  // Mock conversion rate — replace with live data
  const usdcToJpyRate = 149.5;

  const estimatedUsdc = useMemo(() => shares * navPerShare, [shares, navPerShare]);
  const estimatedJpy = useMemo(
    () => estimatedUsdc * usdcToJpyRate,
    [estimatedUsdc, usdcToJpyRate]
  );

  // Mock yield to claim
  const yieldToClaim = useMemo(() => {
    return shares * navPerShare * 0.012; // illustrative 1.2% accrued yield
  }, [shares, navPerShare]);

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    setShares(Number(e.target.value));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.min(Math.max(0, Number(e.target.value)), maxShares);
    setShares(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (shares <= 0) return;
    onSubmit(shares, asJpy);
  };

  const sliderPct = maxShares > 0 ? (shares / maxShares) * 100 : 0;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-700 bg-[#0a1628] p-6 shadow-xl"
    >
      <h2 className="mb-6 text-xl font-bold text-amber-400">
        {t("withdraw.title", "Withdraw")}
      </h2>

      {/* Shares Input */}
      <div className="mb-4">
        <label className="mb-2 block text-sm font-medium text-slate-400">
          {t("withdraw.shares", "Shares to Withdraw")}
        </label>
        <input
          type="number"
          min={0}
          max={maxShares}
          step={1}
          value={shares}
          onChange={handleInputChange}
          className="w-full rounded-lg border border-slate-700 bg-[#0d1d35] px-4 py-3 font-mono text-lg text-slate-100 outline-none transition-colors focus:border-amber-500"
          placeholder="0"
        />
        <p className="mt-1 text-xs text-slate-500">
          {t("withdraw.maxShares", "Max")}: {maxShares.toLocaleString()}
        </p>
      </div>

      {/* Slider */}
      <div className="relative mb-6">
        <input
          type="range"
          min={0}
          max={maxShares}
          step={1}
          value={shares}
          onChange={handleSlider}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-amber-500 outline-none"
        />
        <div className="mt-1 flex justify-between text-xs text-slate-500">
          <span>0</span>
          <span>{Math.round(maxShares * 0.25).toLocaleString()}</span>
          <span>{Math.round(maxShares * 0.5).toLocaleString()}</span>
          <span>{Math.round(maxShares * 0.75).toLocaleString()}</span>
          <span>{maxShares.toLocaleString()}</span>
        </div>
      </div>

      {/* Withdraw-as Toggle */}
      <div className="mb-6">
        <label className="mb-2 block text-sm font-medium text-slate-400">
          {t("withdraw.withdrawAs", "Withdraw As")}
        </label>
        <div className="inline-flex rounded-lg border border-slate-700 bg-[#0d1d35] p-1">
          <button
            type="button"
            onClick={() => setAsJpy(false)}
            className={`rounded-md px-5 py-2 text-sm font-semibold transition-all ${
              !asJpy
                ? "border border-amber-500 bg-[#0a1628] text-amber-400 shadow-md shadow-amber-500/10"
                : "border border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            USDC
          </button>
          <button
            type="button"
            onClick={() => setAsJpy(true)}
            className={`rounded-md px-5 py-2 text-sm font-semibold transition-all ${
              asJpy
                ? "border border-amber-500 bg-[#0a1628] text-amber-400 shadow-md shadow-amber-500/10"
                : "border border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            JPY
          </button>
        </div>
      </div>

      {/* Estimated Values */}
      {shares > 0 && (
        <div className="mb-6 rounded-lg border border-slate-700 bg-[#0d1d35] p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">
              {t("withdraw.estimatedUsdc", "Estimated USDC Value")}
            </span>
            <span className="font-mono text-slate-200">
              {estimatedUsdc.toFixed(4)} USDC
            </span>
          </div>

          {asJpy && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">
                {t("withdraw.estimatedJpy", "Estimated JPY")}
              </span>
              <span className="font-mono text-slate-200">
                {estimatedJpy.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}{" "}
                JPY
              </span>
            </div>
          )}

          <div className="border-t border-slate-600" />

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">
              {t("withdraw.yieldToClaim", "Yield to Claim")}
            </span>
            <span className="font-mono font-semibold text-emerald-400">
              +{yieldToClaim.toFixed(4)} USDC
            </span>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={shares <= 0}
        className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-3 text-base font-bold text-[#0a1628] shadow-lg transition-all hover:from-amber-400 hover:to-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {t("withdraw.submit", "Withdraw")}
      </button>
    </form>
  );
}
