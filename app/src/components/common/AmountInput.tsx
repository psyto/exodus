"use client";

import { FC, useCallback, ChangeEvent } from "react";
import { useI18n } from "@/providers/I18nProvider";
import { TokenIcon } from "./TokenIcon";

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  token: "JPY" | "USDC";
  maxAmount?: string;
  disabled?: boolean;
}

/**
 * Format a numeric string with commas for display in the input.
 * Preserves decimal point and trailing digits.
 */
function formatWithCommas(value: string): string {
  if (!value) return "";

  // Split on decimal point
  const parts = value.split(".");
  const integerPart = parts[0];
  const decimalPart = parts.length > 1 ? `.${parts[1]}` : "";

  // Add commas to integer part
  const formatted = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${formatted}${decimalPart}`;
}

/**
 * Strip commas and non-numeric characters (except decimal point) from input.
 */
function stripFormatting(value: string): string {
  return value.replace(/[^0-9.]/g, "");
}

export const AmountInput: FC<AmountInputProps> = ({
  value,
  onChange,
  token,
  maxAmount,
  disabled = false,
}) => {
  const { t } = useI18n();

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const raw = stripFormatting(e.target.value);

      // Prevent multiple decimal points
      const decimalCount = (raw.match(/\./g) || []).length;
      if (decimalCount > 1) return;

      // Prevent negative numbers (already handled by stripping non-numeric)
      // Validate it's a proper number format
      if (raw && !/^\d*\.?\d*$/.test(raw)) return;

      onChange(raw);
    },
    [onChange]
  );

  const handleMaxClick = useCallback(() => {
    if (maxAmount) {
      onChange(maxAmount);
    }
  }, [maxAmount, onChange]);

  const displayValue = formatWithCommas(value);

  return (
    <div
      className={`
        flex items-center gap-3 rounded-xl border border-navy-700
        bg-navy-800/50 px-4 py-3 transition-colors
        focus-within:border-gold-500/50 focus-within:ring-1 focus-within:ring-gold-500/20
        ${disabled ? "cursor-not-allowed opacity-50" : ""}
      `}
    >
      {/* Token icon */}
      <TokenIcon token={token} size="md" />

      {/* Input field */}
      <div className="flex flex-1 flex-col">
        <input
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          disabled={disabled}
          placeholder="0.00"
          className="w-full bg-transparent text-lg font-semibold text-white outline-none placeholder:text-gray-600 disabled:cursor-not-allowed"
          aria-label={`${t("common.amount")} (${token})`}
        />
        <span className="text-xs text-gray-500">{token}</span>
      </div>

      {/* Max button */}
      {maxAmount && !disabled && (
        <button
          type="button"
          onClick={handleMaxClick}
          className="rounded-md border border-gold-500/30 px-2.5 py-1 text-xs font-semibold text-gold-400 transition-colors hover:border-gold-500/60 hover:bg-gold-500/10"
        >
          {t("common.max")}
        </button>
      )}
    </div>
  );
};
