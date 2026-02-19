"use client";

import { FC } from "react";
import { useI18n } from "@/providers/I18nProvider";

type SpinnerSize = "sm" | "md" | "lg";

interface LoadingSpinnerProps {
  size?: SpinnerSize;
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-2",
  lg: "h-12 w-12 border-3",
};

export const LoadingSpinner: FC<LoadingSpinnerProps> = ({ size = "md" }) => {
  const { t } = useI18n();

  return (
    <div
      className="inline-flex items-center justify-center"
      role="status"
      aria-label={t("common.loading")}
    >
      <div
        className={`
          animate-spin rounded-full
          border-gold-500/30 border-t-gold-400
          ${sizeClasses[size]}
        `}
      />
      <span className="sr-only">{t("common.loading")}</span>
    </div>
  );
};
