"use client";

import React, { useState } from "react";
import { useI18n } from "@/providers/I18nProvider";

interface TransactionDetailProps {
  txSignature: string;
  record: Record<string, any>;
}

export function TransactionDetail({
  txSignature,
  record,
}: TransactionDetailProps) {
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState(false);

  const explorerUrl = `https://explorer.solana.com/tx/${txSignature}`;

  const formatValue = (key: string, value: any): string => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "number") {
      if (key.toLowerCase().includes("date") || key.toLowerCase().includes("timestamp")) {
        return new Date(value).toLocaleString("ja-JP");
      }
      return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
    }
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
  };

  const formatKey = (key: string): string => {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (s) => s.toUpperCase())
      .trim();
  };

  const recordEntries = Object.entries(record);

  return (
    <div className="rounded-xl border border-slate-700 bg-[#0a1628] shadow-lg">
      {/* Toggle Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-[#0d1d35]"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-200">
            {t("history.transactionDetail", "Transaction Detail")}
          </span>
          <span className="font-mono text-xs text-slate-500">
            {txSignature.slice(0, 8)}...{txSignature.slice(-8)}
          </span>
        </div>
        <svg
          className={`h-4 w-4 text-slate-400 transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="border-t border-slate-700 px-5 pb-5 pt-4">
          {/* Transaction Signature */}
          <div className="mb-4">
            <p className="mb-1 text-xs font-medium text-slate-500">
              {t("history.txSignature", "Transaction Signature")}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-lg border border-slate-700 bg-[#0d1d35] px-3 py-2 font-mono text-xs text-slate-300">
                {txSignature}
              </code>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-amber-400 transition-all hover:border-amber-500 hover:bg-amber-500/10"
              >
                {t("history.viewOnExplorer", "View on Explorer")}
              </a>
            </div>
          </div>

          {/* Record Fields Grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {recordEntries.map(([key, value]) => (
              <div
                key={key}
                className="rounded-lg border border-slate-700/50 bg-[#0d1d35] px-3 py-2"
              >
                <p className="text-xs text-slate-500">{formatKey(key)}</p>
                <p className="mt-0.5 font-mono text-sm text-slate-200">
                  {formatValue(key, value)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
