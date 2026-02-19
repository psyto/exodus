"use client";

import { useI18n } from "@/providers/I18nProvider";
import { useWallet } from "@solana/wallet-adapter-react";
import { ConversionTable } from "@/components/history/ConversionTable";

export default function HistoryPage() {
  const { t } = useI18n();
  const { publicKey } = useWallet();

  if (!publicKey) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-navy-300">{t("common.connect")}</p>
      </div>
    );
  }

  // Mock conversion records for demo
  const mockRecords = [
    {
      date: Math.floor(Date.now() / 1000) - 86400 * 7,
      direction: "JPY → USDC",
      jpyAmount: 1_000_000_000_000,
      usdcAmount: 6_451_000_000,
      rate: 155_000_000,
      fee: 19_354_000,
      status: "converted",
    },
    {
      date: Math.floor(Date.now() / 1000) - 86400 * 14,
      direction: "JPY → USDC",
      jpyAmount: 500_000_000_000,
      usdcAmount: 3_225_000_000,
      rate: 155_100_000,
      fee: 9_677_000,
      status: "converted",
    },
    {
      date: Math.floor(Date.now() / 1000) - 86400,
      direction: "JPY → USDC",
      jpyAmount: 2_000_000_000_000,
      usdcAmount: 0,
      rate: 0,
      fee: 0,
      status: "pending",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t("history.title")}</h1>
      <ConversionTable records={mockRecords} />
    </div>
  );
}
