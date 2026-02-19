"use client";

import React, { useState, useMemo } from "react";
import { useI18n } from "@/providers/I18nProvider";
import { AmountInput } from "@/components/common/AmountInput";
import { CurrencySelector } from "@/components/deposit/CurrencySelector";
import { SlippageSettings } from "@/components/deposit/SlippageSettings";

interface DepositFormProps {
  onSubmit: (
    amount: number,
    currency: "JPY" | "USDC",
    slippageBps: number
  ) => void;
}

export function DepositForm({ onSubmit }: DepositFormProps) {
  const { t } = useI18n();
  const [currency, setCurrency] = useState<"JPY" | "USDC">("JPY");
  const [amount, setAmount] = useState<number>(0);
  const [slippageBps, setSlippageBps] = useState<number>(50);

  // Mock rate and tier data — replace with live data from API/context
  const jpyToUsdcRate = 0.0067; // 1 JPY ≈ 0.0067 USDC (≈150 JPY/USD)
  const conversionFeeBps = 30; // 0.30%
  const tierLimit = 1_000_000; // USDC
  const tierUsed = 320_000; // USDC

  const estimatedUsdc = useMemo(() => {
    if (currency !== "JPY" || amount <= 0) return 0;
    const gross = amount * jpyToUsdcRate;
    const fee = gross * (conversionFeeBps / 10_000);
    return gross - fee;
  }, [amount, currency, jpyToUsdcRate, conversionFeeBps]);

  const conversionFee = useMemo(() => {
    if (currency !== "JPY" || amount <= 0) return 0;
    return amount * jpyToUsdcRate * (conversionFeeBps / 10_000);
  }, [amount, currency, jpyToUsdcRate, conversionFeeBps]);

  const tierRemainingPct = ((tierLimit - tierUsed) / tierLimit) * 100;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;
    onSubmit(amount, currency, slippageBps);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-700 bg-[#0a1628] p-6 shadow-xl"
    >
      <h2 className="mb-6 text-xl font-bold text-amber-400">
        {t("deposit.title", "Deposit")}
      </h2>

      {/* Currency Toggle */}
      <div className="mb-6">
        <label className="mb-2 block text-sm font-medium text-slate-400">
          {t("deposit.currency", "Currency")}
        </label>
        <CurrencySelector selected={currency} onChange={setCurrency} />
      </div>

      {/* Amount Input */}
      <div className="mb-6">
        <label className="mb-2 block text-sm font-medium text-slate-400">
          {t("deposit.amount", "Amount")}
        </label>
        <AmountInput
          value={amount}
          onChange={setAmount}
          currency={currency}
        />
      </div>

      {/* JPY Conversion Details */}
      {currency === "JPY" && amount > 0 && (
        <div className="mb-6 rounded-lg border border-slate-700 bg-[#0d1d35] p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">
              {t("deposit.rate", "Rate")}
            </span>
            <span className="font-mono text-slate-200">
              1 JPY = {jpyToUsdcRate.toFixed(6)} USDC
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-slate-400">
              {t("deposit.conversionFee", "Conversion Fee")} ({conversionFeeBps} bps)
            </span>
            <span className="font-mono text-slate-200">
              {conversionFee.toFixed(4)} USDC
            </span>
          </div>
          <div className="mt-3 border-t border-slate-600 pt-3 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">
              {t("deposit.estimatedUsdc", "Estimated USDC")}
            </span>
            <span className="font-mono text-lg font-bold text-amber-400">
              {estimatedUsdc.toFixed(4)} USDC
            </span>
          </div>
        </div>
      )}

      {/* USDC Direct Flow */}
      {currency === "USDC" && amount > 0 && (
        <div className="mb-6 rounded-lg border border-slate-700 bg-[#0d1d35] p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">
              {t("deposit.directDeposit", "Direct USDC Deposit")}
            </span>
            <span className="font-mono text-lg font-bold text-amber-400">
              {amount.toLocaleString()} USDC
            </span>
          </div>
        </div>
      )}

      {/* Slippage Tolerance */}
      <div className="mb-6">
        <SlippageSettings value={slippageBps} onChange={setSlippageBps} />
      </div>

      {/* Tier Limit Remaining Bar */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-slate-400">
            {t("deposit.tierLimit", "Tier Limit Remaining")}
          </span>
          <span className="font-mono text-slate-300">
            {(tierLimit - tierUsed).toLocaleString()} / {tierLimit.toLocaleString()} USDC
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-300"
            style={{ width: `${tierRemainingPct}%` }}
          />
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={amount <= 0}
        className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-3 text-base font-bold text-[#0a1628] shadow-lg transition-all hover:from-amber-400 hover:to-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {t("deposit.submit", "Deposit")}
      </button>
    </form>
  );
}
