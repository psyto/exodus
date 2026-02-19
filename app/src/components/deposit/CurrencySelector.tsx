"use client";

import React from "react";
import { useI18n } from "@/providers/I18nProvider";

interface CurrencySelectorProps {
  selected: "JPY" | "USDC";
  onChange: (currency: "JPY" | "USDC") => void;
}

const currencies: Array<{ value: "JPY" | "USDC"; icon: string; label: string }> = [
  { value: "JPY", icon: "\u00A5", label: "JPY" },
  { value: "USDC", icon: "$", label: "USDC" },
];

export function CurrencySelector({
  selected,
  onChange,
}: CurrencySelectorProps) {
  const { t } = useI18n();

  return (
    <div className="inline-flex rounded-lg border border-slate-700 bg-[#0d1d35] p-1">
      {currencies.map((cur) => {
        const isActive = selected === cur.value;
        return (
          <button
            key={cur.value}
            type="button"
            onClick={() => onChange(cur.value)}
            className={`flex items-center gap-2 rounded-md px-5 py-2 text-sm font-semibold transition-all ${
              isActive
                ? "border border-amber-500 bg-[#0a1628] text-amber-400 shadow-md shadow-amber-500/10"
                : "border border-transparent text-slate-400 hover:text-slate-200"
            }`}
            aria-pressed={isActive}
            aria-label={t(
              `deposit.select_${cur.value}`,
              `Select ${cur.label}`
            )}
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                isActive
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-slate-700 text-slate-400"
              }`}
            >
              {cur.icon}
            </span>
            <span>{cur.label}</span>
          </button>
        );
      })}
    </div>
  );
}
