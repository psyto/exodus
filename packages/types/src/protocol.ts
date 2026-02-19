import { PublicKey } from "@solana/web3.js";

export interface ProtocolConfig {
  authority: PublicKey;
  jpyMint: PublicKey;
  usdcMint: PublicKey;
  jpyVault: PublicKey;
  usdcVault: PublicKey;
  oracle: PublicKey;
  kycRegistry: PublicKey;
  sovereignProgram: PublicKey;
  conversionFeeBps: number;
  managementFeeBps: number;
  performanceFeeBps: number;
  totalDepositsUsdc: bigint;
  totalYieldEarned: bigint;
  pendingJpyConversion: bigint;
  depositNonce: bigint;
  isActive: boolean;
  createdAt: bigint;
  updatedAt: bigint;
  bump: number;
  jpyVaultBump: number;
  usdcVaultBump: number;
}

export interface YieldSourceAccount {
  protocolConfig: PublicKey;
  name: Uint8Array;
  sourceType: number;
  tokenMint: PublicKey;
  depositVault: PublicKey;
  yieldTokenVault: PublicKey;
  currentApyBps: number;
  totalDeposited: bigint;
  totalShares: bigint;
  allocationWeightBps: number;
  minDeposit: bigint;
  maxAllocation: bigint;
  isActive: boolean;
  lastNavUpdate: bigint;
  navPerShare: bigint;
  bump: number;
}

export interface UserPosition {
  owner: PublicKey;
  protocolConfig: PublicKey;
  totalDepositedJpy: bigint;
  totalDepositedUsdc: bigint;
  currentShares: bigint;
  unrealizedYieldUsdc: bigint;
  realizedYieldUsdc: bigint;
  avgConversionRate: bigint;
  sovereignTier: number;
  monthlyDepositedJpy: bigint;
  monthlyDepositedUsdc: bigint;
  monthStart: bigint;
  depositCount: number;
  withdrawalCount: number;
  lastDepositAt: bigint;
  lastWithdrawalAt: bigint;
  depositNonce: bigint;
  createdAt: bigint;
  bump: number;
}
