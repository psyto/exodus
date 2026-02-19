"use client";

import React, { useState } from "react";
import { useI18n } from "@/providers/I18nProvider";

interface SlippageSettingsProps {
  value: number;
  onChange: (bps: number) => void;
}

const PRESETS: Array<{ label: string; bps: number }> = [
  { label: "0.5%", bps: 50 },
  { label: "1%", bps: 100 },
  { label: "2%", bps: 200 },
];

export function SlippageSettings({
  value,
  onChange,
}: SlippageSettingsProps) {
  const { t } = useI18n();
  const [isCustom, setIsCustom] = useState(
    !PRESETS.some((p) => p.bps === value)
  );
  const [customInput, setCustomInput] = useState(
    isCustom ? (value / 100).toString() : ""
  );

  const handlePreset = (bps: number) => {
    setIsCustom(false);
    setCustomInput("");
    onChange(bps);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setCustomInput(raw);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 50) {
      onChange(Math.round(parsed * 100));
    }
  };

  const handleCustomFocus = () => {
    setIsCustom(true);
  };

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-400">
        {t("deposit.slippageTolerance", "Slippage Tolerance")}
      </label>
      <div className="flex items-center gap-2">
        {PRESETS.map((preset) => {
          const isActive = !isCustom && value === preset.bps;
          return (
            <button
              key={preset.bps}
              type="button"
              onClick={() => handlePreset(preset.bps)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                isActive
                  ? "border border-amber-500 bg-amber-500/10 text-amber-400"
                  : "border border-slate-700 bg-[#0d1d35] text-slate-400 hover:border-slate-500 hover:text-slate-200"
              }`}
            >
              {preset.label}
            </button>
          );
        })}

        {/* Custom Input */}
        <div
          className={`flex items-center overflow-hidden rounded-lg border transition-all ${
            isCustom
              ? "border-amber-500 bg-amber-500/10"
              : "border-slate-700 bg-[#0d1d35]"
          }`}
        >
          <input
            type="number"
            step="0.1"
            min="0.01"
            max="50"
            placeholder={t("deposit.custom", "Custom")}
            value={customInput}
            onChange={handleCustomChange}
            onFocus={handleCustomFocus}
            className="w-20 bg-transparent px-3 py-2 text-sm font-mono text-slate-200 placeholder-slate-500 outline-none"
          />
          <span className="pr-3 text-sm text-slate-500">%</span>
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {t(
          "deposit.slippageHint",
          `Current: ${(value / 100).toFixed(2)}% (${value} bps)`
        )}
      </p>
    </div>
  );
}
