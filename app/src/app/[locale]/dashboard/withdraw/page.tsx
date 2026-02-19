"use client";

import { useState, useCallback } from "react";
import { useI18n } from "@/providers/I18nProvider";
import { useWallet } from "@solana/wallet-adapter-react";
import { useUserPosition } from "@/hooks/useUserPosition";
import { useYieldData } from "@/hooks/useYieldData";
import { WithdrawForm } from "@/components/withdraw/WithdrawForm";
import { WithdrawConfirmation } from "@/components/withdraw/WithdrawConfirmation";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useConversionRate } from "@/hooks/useConversionRate";

export default function WithdrawPage() {
  const { t } = useI18n();
  const { publicKey } = useWallet();
  const { position } = useUserPosition();
  const { yieldSource } = useYieldData();
  const { rate } = useConversionRate();

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [withdrawParams, setWithdrawParams] = useState<{
    shares: number;
    asJpy: boolean;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const navPerShare = yieldSource ? Number(yieldSource.navPerShare) : 1_000_000;
  const maxShares = position ? Number(position.currentShares) : 0;
  const currentRate = rate ? rate.jpyPerUsd : 155.0;

  const handleSubmit = useCallback((shares: number, asJpy: boolean) => {
    setWithdrawParams({ shares, asJpy });
    setShowConfirmation(true);
  }, []);

  const handleConfirm = useCallback(async () => {
    setSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setSuccess(true);
      setShowConfirmation(false);
    } catch (error) {
      console.error("Withdrawal failed:", error);
    } finally {
      setSubmitting(false);
    }
  }, []);

  if (!publicKey) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-navy-300">{t("common.connect")}</p>
      </div>
    );
  }

  const usdcValue = withdrawParams
    ? (withdrawParams.shares * navPerShare) / 1_000_000
    : 0;
  const estimatedJpy = usdcValue * currentRate;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-white">{t("withdraw.title")}</h1>

      {success ? (
        <div className="card text-center">
          <div className="mb-4 text-4xl">{"\u2705"}</div>
          <h2 className="mb-2 text-xl font-semibold text-accent-green">
            {t("withdraw.withdrawSuccess")}
          </h2>
          <button
            onClick={() => {
              setSuccess(false);
              setWithdrawParams(null);
            }}
            className="btn-primary mt-6"
          >
            {t("withdraw.title")}
          </button>
        </div>
      ) : (
        <WithdrawForm
          maxShares={maxShares}
          navPerShare={navPerShare}
          onSubmit={handleSubmit}
        />
      )}

      {showConfirmation && withdrawParams && (
        <WithdrawConfirmation
          shares={withdrawParams.shares}
          usdcValue={usdcValue}
          asJpy={withdrawParams.asJpy}
          estimatedJpy={estimatedJpy}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirmation(false)}
        />
      )}

      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="card flex items-center gap-4">
            <LoadingSpinner size="md" />
            <span className="text-white">Processing...</span>
          </div>
        </div>
      )}
    </div>
  );
}
