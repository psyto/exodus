import {
  Tier,
  MONTHLY_JPY_LIMITS,
  MONTHLY_USDC_LIMITS,
} from "@exodus/types";

// ─── JPY Deposit Checks ──────────────────────────────────────────────────────

/**
 * Check whether a JPY deposit of the given amount is allowed for the
 * specified tier, given how much has already been deposited this month.
 *
 * All amounts are in minor units (6 decimal places).
 *
 * @param tier           - The user's Sovereign tier
 * @param currentMonthlyJpy - JPY already deposited this month (minor units)
 * @param depositAmount  - The JPY amount to deposit (minor units)
 * @returns true if the deposit would not exceed the monthly limit
 */
export function checkJpyDepositAllowed(
  tier: Tier,
  currentMonthlyJpy: bigint,
  depositAmount: bigint
): boolean {
  if (depositAmount <= 0n) return false;
  const limit = MONTHLY_JPY_LIMITS[tier];
  return currentMonthlyJpy + depositAmount <= limit;
}

/**
 * Get the remaining JPY deposit capacity for the current month.
 *
 * @param tier              - The user's Sovereign tier
 * @param currentMonthlyJpy - JPY already deposited this month (minor units)
 * @returns The remaining JPY that can be deposited (minor units), or 0n if at/over limit
 */
export function getRemainingJpyLimit(
  tier: Tier,
  currentMonthlyJpy: bigint
): bigint {
  const limit = MONTHLY_JPY_LIMITS[tier];
  if (currentMonthlyJpy >= limit) return 0n;
  return limit - currentMonthlyJpy;
}

/**
 * Format a JPY amount in minor units (6 decimals) to a human-readable string.
 *
 * @param amount - JPY amount in minor units
 * @returns Formatted string, e.g. "500,000.000000"
 */
export function formatJpyLimit(amount: bigint): string {
  if (amount >= BigInt(Number.MAX_SAFE_INTEGER)) {
    return "Unlimited";
  }

  const DECIMALS = 6;
  const divisor = 10n ** BigInt(DECIMALS);
  const whole = amount / divisor;
  const fractional = amount % divisor;

  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fracStr = fractional.toString().padStart(DECIMALS, "0");

  return `\u00a5${wholeStr}.${fracStr}`;
}

// ─── USDC Deposit Checks ─────────────────────────────────────────────────────

/**
 * Check whether a USDC deposit of the given amount is allowed for the
 * specified tier, given how much has already been deposited this month.
 *
 * All amounts are in minor units (6 decimal places).
 *
 * @param tier             - The user's Sovereign tier
 * @param currentMonthlyUsdc - USDC already deposited this month (minor units)
 * @param depositAmount    - The USDC amount to deposit (minor units)
 * @returns true if the deposit would not exceed the monthly limit
 */
export function checkUsdcDepositAllowed(
  tier: Tier,
  currentMonthlyUsdc: bigint,
  depositAmount: bigint
): boolean {
  if (depositAmount <= 0n) return false;
  const limit = MONTHLY_USDC_LIMITS[tier];
  return currentMonthlyUsdc + depositAmount <= limit;
}

/**
 * Get the remaining USDC deposit capacity for the current month.
 *
 * @param tier               - The user's Sovereign tier
 * @param currentMonthlyUsdc - USDC already deposited this month (minor units)
 * @returns The remaining USDC that can be deposited (minor units), or 0n if at/over limit
 */
export function getRemainingUsdcLimit(
  tier: Tier,
  currentMonthlyUsdc: bigint
): bigint {
  const limit = MONTHLY_USDC_LIMITS[tier];
  if (currentMonthlyUsdc >= limit) return 0n;
  return limit - currentMonthlyUsdc;
}

/**
 * Format a USDC amount in minor units (6 decimals) to a human-readable string.
 *
 * @param amount - USDC amount in minor units
 * @returns Formatted string, e.g. "$3,500.000000"
 */
export function formatUsdcLimit(amount: bigint): string {
  if (amount >= BigInt(Number.MAX_SAFE_INTEGER)) {
    return "Unlimited";
  }

  const DECIMALS = 6;
  const divisor = 10n ** BigInt(DECIMALS);
  const whole = amount / divisor;
  const fractional = amount % divisor;

  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fracStr = fractional.toString().padStart(DECIMALS, "0");

  return `$${wholeStr}.${fracStr}`;
}
