"use client";

import { FC } from "react";
import { useI18n } from "@/providers/I18nProvider";

type TokenType = "JPY" | "USDC" | "SHARES";
type IconSize = "sm" | "md" | "lg";

interface TokenIconProps {
  token: TokenType;
  size?: IconSize;
}

const sizeClasses: Record<IconSize, string> = {
  sm: "h-6 w-6 text-xs",
  md: "h-8 w-8 text-sm",
  lg: "h-12 w-12 text-base",
};

const tokenConfig: Record<TokenType, { bg: string; text: string; symbol: string }> = {
  JPY: {
    bg: "bg-red-600",
    text: "text-white",
    symbol: "\u00A5",
  },
  USDC: {
    bg: "bg-blue-600",
    text: "text-white",
    symbol: "$",
  },
  SHARES: {
    bg: "bg-gold-500",
    text: "text-navy-900",
    symbol: "S",
  },
};

export const TokenIcon: FC<TokenIconProps> = ({ token, size = "md" }) => {
  // useI18n is imported per the project convention
  useI18n();

  const config = tokenConfig[token];
  const sizeClass = sizeClasses[size];

  return (
    <span
      className={`
        inline-flex items-center justify-center rounded-full font-bold
        ${config.bg} ${config.text} ${sizeClass}
      `}
      aria-label={token}
      role="img"
    >
      {config.symbol}
    </span>
  );
};
