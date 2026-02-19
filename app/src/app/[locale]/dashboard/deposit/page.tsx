"use client";

import { useState, useCallback } from "react";
import { useI18n } from "@/providers/I18nProvider";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConversionRate } from "@/hooks/useConversionRate";
import { useTier } from "@/hooks/useTier";
import { DepositForm } from "@/components/deposit/DepositForm";
import { DepositConfirmation } from "@/components/deposit/DepositConfirmation";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

export default function DepositPage() {
  const { t } = useI18n();
  const { publicKey } = useWallet();
  const { rate } = useConversionRate();
  const { tierInfo } = useTier();

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [depositParams, setDepositParams] = useState<{
    amount: number;
    currency: "JPY" | "USDC";
    slippageBps: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = useCallback(
    (amount: number, currency: "JPY" | "USDC", slippageBps: number) => {
      setDepositParams({ amount, currency, slippageBps });
      setShowConfirmation(true);
    },
    []
  );

  const handleConfirm = useCallback(async () => {
    if (!depositParams) return;
    setSubmitting(true);
    try {
      // In production: call ExodusClient.depositJpy() or depositUsdc()
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Mock
      setSuccess(true);
      setShowConfirmation(false);
    } catch (error) {
      console.error("Deposit failed:", error);
    } finally {
      setSubmitting(false);
    }
  }, [depositParams]);

  if (!publicKey) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-navy-300">{t("common.connect")}</p>
      </div>
    );
  }

  const currentRate = rate ? rate.jpyPerUsd : 155.0;
  const conversionFeeBps = 30; // 0.30%

  const estimatedUsdc = depositParams
    ? depositParams.currency === "JPY"
      ? (depositParams.amount / currentRate) *
        (1 - conversionFeeBps / 10000)
      : depositParams.amount
    : 0;

  const fee = depositParams
    ? depositParams.currency === "JPY"
      ? (depositParams.amount / currentRate) * (conversionFeeBps / 10000)
      : 0
    : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-white">{t("deposit.title")}</h1>

      {success ? (
        <div className="card text-center">
          <div className="mb-4 text-4xl">{"\u2705"}</div>
          <h2 className="mb-2 text-xl font-semibold text-accent-green">
            {t("deposit.depositSuccess")}
          </h2>
          <p className="text-navy-300">
            {depositParams?.currency === "JPY"
              ? t("deposit.pendingConversion")
              : t("deposit.depositSuccess")}
          </p>
          <button
            onClick={() => {
              setSuccess(false);
              setDepositParams(null);
            }}
            className="btn-primary mt-6"
          >
            {t("deposit.title")}
          </button>
        </div>
      ) : (
        <DepositForm onSubmit={handleSubmit} />
      )}

      {showConfirmation && depositParams && (
        <DepositConfirmation
          amount={depositParams.amount}
          currency={depositParams.currency}
          estimatedUsdc={estimatedUsdc}
          rate={currentRate}
          fee={fee}
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
