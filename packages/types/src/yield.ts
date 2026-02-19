export enum YieldSourceType {
  TBill = 0,
  Lending = 1,
  Staking = 2,
  Synthetic = 3,
}

export const YIELD_SOURCE_LABELS: Record<YieldSourceType, string> = {
  [YieldSourceType.TBill]: "T-Bill",
  [YieldSourceType.Lending]: "Lending",
  [YieldSourceType.Staking]: "Staking",
  [YieldSourceType.Synthetic]: "Synthetic",
};

export interface YieldCalculation {
  /** Current portfolio value in USDC (minor units) */
  currentValue: bigint;
  /** Total cost basis in USDC (minor units) */
  costBasis: bigint;
  /** Unrealized yield in USDC (minor units) */
  unrealizedYield: bigint;
  /** Realized yield in USDC (minor units) */
  realizedYield: bigint;
  /** Current APY in basis points */
  currentApyBps: number;
  /** Projected annual yield at current APY in USDC (minor units) */
  projectedAnnualYield: bigint;
}

export interface YieldHistoryPoint {
  timestamp: number;
  navPerShare: number;
  apyBps: number;
  totalValueUsdc: number;
}
