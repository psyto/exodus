"use client";

import { FC } from "react";
import { useI18n } from "@/providers/I18nProvider";
import { formatDate } from "@/lib/format";

interface KYCStatusCardProps {
  isVerified: boolean;
  kycLevel: number;
  jurisdiction: string;
  expiresAt: number;
}

export const KYCStatusCard: FC<KYCStatusCardProps> = ({
  isVerified,
  kycLevel,
  jurisdiction,
  expiresAt,
}) => {
  const { t, locale } = useI18n();

  const now = Math.floor(Date.now() / 1000);
  const isExpired = expiresAt > 0 && expiresAt < now;

  let statusLabel: string;
  let statusStyle: { bg: string; text: string; dot: string };

  if (!isVerified) {
    statusLabel = t("compliance.none");
    statusStyle = {
      bg: "bg-gray-500/10",
      text: "text-gray-400",
      dot: "bg-gray-400",
    };
  } else if (isExpired) {
    statusLabel = t("compliance.expired");
    statusStyle = {
      bg: "bg-red-500/10",
      text: "text-red-400",
      dot: "bg-red-400",
    };
  } else {
    statusLabel = t("compliance.active");
    statusStyle = {
      bg: "bg-green-500/10",
      text: "text-green-400",
      dot: "bg-green-400",
    };
  }

  return (
    <div className="card rounded-xl border border-navy-700 bg-navy-800/80 p-6 shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          {t("compliance.kycStatus")}
        </h3>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
        >
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${statusStyle.dot}`}
            aria-hidden="true"
          />
          {statusLabel}
        </span>
      </div>

      <div className="space-y-3">
        {/* KYC Level */}
        <div className="flex items-center justify-between border-b border-navy-700/50 pb-3">
          <span className="stat-label text-sm text-gray-400">
            {t("compliance.level")}
          </span>
          <span className="stat-value text-sm font-semibold text-white">
            {kycLevel}
          </span>
        </div>

        {/* Jurisdiction */}
        <div className="flex items-center justify-between border-b border-navy-700/50 pb-3">
          <span className="stat-label text-sm text-gray-400">
            {t("compliance.jurisdiction")}
          </span>
          <span className="stat-value text-sm font-semibold text-white">
            {jurisdiction}
          </span>
        </div>

        {/* Expiry */}
        <div className="flex items-center justify-between">
          <span className="stat-label text-sm text-gray-400">
            {t("compliance.expires")}
          </span>
          <span
            className={`stat-value text-sm font-semibold ${
              isExpired ? "text-red-400" : "text-white"
            }`}
          >
            {expiresAt > 0 ? formatDate(expiresAt, locale) : "--"}
          </span>
        </div>
      </div>
    </div>
  );
};
