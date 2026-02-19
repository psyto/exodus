"use client";

import React from "react";
import { useI18n } from "@/providers/I18nProvider";

interface WithdrawConfirmationProps {
  shares: number;
  usdcValue: number;
  asJpy: boolean;
  estimatedJpy: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function WithdrawConfirmation({
  shares,
  usdcValue,
  asJpy,
  estimatedJpy,
  onConfirm,
  onCancel,
}: WithdrawConfirmationProps) {
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#0a1628] p-6 shadow-2xl">
        <h3 className="mb-6 text-center text-lg font-bold text-amber-400">
          {t("withdraw.confirmTitle", "Confirm Withdrawal")}
        </h3>

        {/* Review Details */}
        <div className="space-y-3 rounded-lg border border-slate-700 bg-[#0d1d35] p-4">
          <DetailRow
            label={t("withdraw.sharesToRedeem", "Shares to Redeem")}
            value={shares.toLocaleString()}
          />
          <DetailRow
            label={t("withdraw.usdcValue", "USDC Value")}
            value={`${usdcValue.toFixed(4)} USDC`}
          />

          {asJpy && (
            <>
              <div className="border-t border-slate-600" />
              <DetailRow
                label={t("withdraw.convertToJpy", "Convert to JPY")}
                value={t("common.yes", "Yes")}
              />
              <DetailRow
                label={t("withdraw.estimatedJpy", "Estimated JPY")}
                value={`${estimatedJpy.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })} JPY`}
                highlight
              />
            </>
          )}

          {!asJpy && (
            <>
              <div className="border-t border-slate-600" />
              <DetailRow
                label={t("withdraw.receiveAs", "Receive As")}
                value="USDC"
                highlight
              />
            </>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          {t(
            "withdraw.confirmDisclaimer",
            "Withdrawal will be processed within the current epoch. Final amounts may vary."
          )}
        </p>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-600 bg-transparent px-4 py-3 text-sm font-semibold text-slate-300 transition-all hover:border-slate-400 hover:text-slate-100"
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 text-sm font-bold text-[#0a1628] shadow-lg transition-all hover:from-amber-400 hover:to-amber-500"
          >
            {t("common.confirm", "Confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span
        className={`font-mono ${
          highlight ? "text-lg font-bold text-amber-400" : "text-slate-200"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
