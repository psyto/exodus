"use client";

import { FC } from "react";
import { useI18n } from "@/providers/I18nProvider";

type Status =
  | "pending"
  | "converting"
  | "converted"
  | "cancelled"
  | "expired"
  | "active";

interface StatusBadgeProps {
  status: Status;
}

const statusStyles: Record<Status, { bg: string; text: string; dot: string }> = {
  pending: {
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    dot: "bg-yellow-400",
  },
  converting: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    dot: "bg-blue-400",
  },
  converted: {
    bg: "bg-green-500/10",
    text: "text-green-400",
    dot: "bg-green-400",
  },
  cancelled: {
    bg: "bg-gray-500/10",
    text: "text-gray-400",
    dot: "bg-gray-400",
  },
  expired: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    dot: "bg-red-400",
  },
  active: {
    bg: "bg-green-500/10",
    text: "text-green-400",
    dot: "bg-green-400",
  },
};

const statusLabels: Record<Status, string> = {
  pending: "Pending",
  converting: "Converting",
  converted: "Converted",
  cancelled: "Cancelled",
  expired: "Expired",
  active: "Active",
};

export const StatusBadge: FC<StatusBadgeProps> = ({ status }) => {
  // useI18n is imported per the project convention
  const { locale } = useI18n();

  const style = statusStyles[status];
  const label = statusLabels[status];

  // Japanese labels
  const jaLabels: Record<Status, string> = {
    pending: "保留中",
    converting: "変換中",
    converted: "変換済",
    cancelled: "キャンセル",
    expired: "期限切れ",
    active: "有効",
  };

  const displayLabel = locale === "ja" ? jaLabels[status] : label;

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full px-2.5 py-1
        text-xs font-medium
        ${style.bg} ${style.text}
      `}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${style.dot}`}
        aria-hidden="true"
      />
      {displayLabel}
    </span>
  );
};
