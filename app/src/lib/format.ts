import { JPY_DECIMALS, USDC_DECIMALS } from "./constants";

/**
 * Format JPY amount from minor units to display string.
 * e.g., 1_000_000_000_000 → "¥1,000,000"
 */
export function formatJPY(amount: bigint | number, decimals = JPY_DECIMALS): string {
  const value = Number(amount) / Math.pow(10, decimals);
  return `¥${value.toLocaleString("ja-JP", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

/**
 * Format USDC amount from minor units to display string.
 * e.g., 1_000_000_000 → "$1,000.00"
 */
export function formatUSDC(amount: bigint | number, decimals = USDC_DECIMALS): string {
  const value = Number(amount) / Math.pow(10, decimals);
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format APY from basis points to percentage string.
 * e.g., 450 → "4.50%"
 */
export function formatAPY(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

/**
 * Format exchange rate (JPY per USD, scaled 1e6) to display.
 * e.g., 155_000_000 → "¥155.00"
 */
export function formatRate(rate: bigint | number): string {
  const value = Number(rate) / 1_000_000;
  return `¥${value.toFixed(2)}`;
}

/**
 * Format a number of shares from minor units.
 */
export function formatShares(shares: bigint | number): string {
  const value = Number(shares) / 1_000_000;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

/**
 * Format a Unix timestamp to locale date string.
 */
export function formatDate(timestamp: bigint | number, locale: string = "ja-JP"): string {
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Shorten a Solana public key for display.
 * e.g., "7Xy3...4Abc"
 */
export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Format percentage change with sign.
 */
export function formatPercentChange(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}
