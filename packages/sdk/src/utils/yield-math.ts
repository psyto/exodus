/**
 * Yield calculation utilities for the EXODUS Protocol.
 *
 * All amounts are in minor units (6 decimal places, matching USDC).
 * NAV (Net Asset Value) per share is scaled by NAV_SCALE (1_000_000).
 * A navPerShare of 1_000_000n means 1:1 (1 share = 1 USDC).
 */

/** NAV is expressed with 6 decimal places of precision. */
export const NAV_SCALE = 1_000_000n;

/** Seconds in a non-leap year (365 days). */
export const SECONDS_PER_YEAR = 365n * 24n * 60n * 60n;

/**
 * Calculate the number of shares received for a USDC deposit at the
 * current NAV per share.
 *
 * shares = (usdcAmount * NAV_SCALE) / navPerShare
 *
 * @param usdcAmount  - USDC amount to deposit (minor units, 6 decimals)
 * @param navPerShare - Current NAV per share (scaled by NAV_SCALE)
 * @returns Number of shares (scaled by NAV_SCALE)
 */
export function calculateShares(
  usdcAmount: bigint,
  navPerShare: bigint
): bigint {
  if (navPerShare === 0n) {
    throw new Error("navPerShare must be greater than zero");
  }
  return (usdcAmount * NAV_SCALE) / navPerShare;
}

/**
 * Calculate the USDC value of a given number of shares at the current
 * NAV per share.
 *
 * usdcValue = (shares * navPerShare) / NAV_SCALE
 *
 * @param shares      - Number of shares (scaled by NAV_SCALE)
 * @param navPerShare - Current NAV per share (scaled by NAV_SCALE)
 * @returns USDC value (minor units, 6 decimals)
 */
export function calculateUsdcFromShares(
  shares: bigint,
  navPerShare: bigint
): bigint {
  return (shares * navPerShare) / NAV_SCALE;
}

/**
 * Calculate the unrealized yield (profit or loss) for a position.
 *
 * yield = currentValue - costBasis
 *       = (shares * navPerShare / NAV_SCALE) - costBasis
 *
 * @param shares      - Number of shares held (scaled by NAV_SCALE)
 * @param navPerShare - Current NAV per share (scaled by NAV_SCALE)
 * @param costBasis   - Total USDC cost basis (minor units, 6 decimals)
 * @returns Yield in USDC (minor units); negative if at a loss
 */
export function calculateYield(
  shares: bigint,
  navPerShare: bigint,
  costBasis: bigint
): bigint {
  const currentValue = calculateUsdcFromShares(shares, navPerShare);
  return currentValue - costBasis;
}

/**
 * Calculate projected yield over a given duration at a fixed APY.
 *
 * Uses simple interest: projectedYield = principal * apyBps * durationDays / (10000 * 365)
 *
 * @param principal    - Principal amount in USDC (minor units, 6 decimals)
 * @param apyBps       - Annual percentage yield in basis points (e.g., 450 = 4.50%)
 * @param durationDays - Duration in days to project over
 * @returns Projected yield in USDC (minor units, 6 decimals)
 */
export function calculateProjectedYield(
  principal: bigint,
  apyBps: bigint,
  durationDays: bigint
): bigint {
  // projectedYield = principal * apyBps * durationDays / (10_000 * 365)
  return (principal * apyBps * durationDays) / (10_000n * 365n);
}

/**
 * Convert an APY in basis points to a percentage number.
 *
 * @param apyBps - APY in basis points (e.g., 450)
 * @returns APY as a percentage (e.g., 4.5)
 */
export function apyBpsToPercent(apyBps: number): number {
  return apyBps / 100;
}

/**
 * Calculate the new NAV per share after continuous yield accrual over a
 * period of time.
 *
 * Uses linear approximation for small time intervals:
 *   newNav = currentNav + (currentNav * apyBps * elapsedSeconds) / (10_000 * SECONDS_PER_YEAR)
 *
 * This is suitable for frequent (e.g., every minute) crank updates where
 * the compounding effect within a single interval is negligible.
 *
 * @param currentNav     - Current NAV per share (scaled by NAV_SCALE)
 * @param apyBps         - Annual percentage yield in basis points
 * @param elapsedSeconds - Number of seconds since the last update
 * @returns Updated NAV per share (scaled by NAV_SCALE)
 */
export function calculateNavAccrual(
  currentNav: bigint,
  apyBps: bigint,
  elapsedSeconds: bigint
): bigint {
  // accrual = currentNav * apyBps * elapsedSeconds / (10_000 * SECONDS_PER_YEAR)
  const accrual =
    (currentNav * apyBps * elapsedSeconds) / (10_000n * SECONDS_PER_YEAR);
  return currentNav + accrual;
}
