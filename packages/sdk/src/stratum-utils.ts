import { MerkleTree, Bitfield } from '@stratum/core';

// ---------------------------------------------------------------------------
// KYC Batch Verification Merkle Proofs
// ---------------------------------------------------------------------------

/**
 * Build a merkle tree from KYC-verified user records.
 * Each leaf encodes `walletAddress:kycLevel:tier`.
 *
 * Enables proving a user's KYC status as part of a batch without
 * loading all individual KYC PDAs for each conversion.
 *
 * Uses @stratum/core MerkleTree.
 */
export function buildKycBatchTree(
  users: Array<{ wallet: string; kycLevel: number; tier: string }>,
): MerkleTree {
  const leaves = users.map(
    (u) => `${u.wallet}:${u.kycLevel}:${u.tier}`,
  );
  return new MerkleTree(leaves);
}

/**
 * Generate a merkle proof for a user's KYC status.
 */
export function getKycProof(
  tree: MerkleTree,
  wallet: string,
  kycLevel: number,
  tier: string,
): { proof: number[][]; root: number[]; index: number } {
  const index = tree.findLeafIndex(`${wallet}:${kycLevel}:${tier}`);
  if (index < 0) throw new Error('User not found in KYC tree');
  return {
    proof: tree.getProofArray(index),
    root: tree.rootArray,
    index,
  };
}

// ---------------------------------------------------------------------------
// Conversion Limit Tracking
// ---------------------------------------------------------------------------

/**
 * Track which users have hit their monthly JPY→USDC conversion limit
 * using a compact bitfield. Each bit = one user slot.
 *
 * Use case: keeper bot checks limit status before batching conversions,
 * avoiding failed transactions for capped users.
 */
export function createConversionLimitTracker(userCount: number): Bitfield {
  const bytesNeeded = Math.ceil(userCount / 8);
  return new Bitfield(bytesNeeded);
}

/**
 * Restore a conversion limit tracker from stored bytes.
 */
export function restoreConversionTracker(data: Uint8Array): Bitfield {
  return Bitfield.fromBytes(data);
}

// ---------------------------------------------------------------------------
// Conversion History Merkle Tree
// ---------------------------------------------------------------------------

/**
 * Build a merkle tree of completed JPY→USDC conversion records for auditing.
 * Each leaf encodes `wallet:jpyAmount:usdcAmount:rate:timestamp`.
 *
 * Enables compact proof that a specific conversion occurred as part of
 * a batch, useful for regulatory reporting and dispute resolution.
 */
export function buildConversionHistoryTree(
  conversions: Array<{
    wallet: string;
    jpyAmount: string;
    usdcAmount: string;
    rate: string;
    timestamp: number;
  }>,
): MerkleTree {
  const leaves = conversions.map(
    (c) => `${c.wallet}:${c.jpyAmount}:${c.usdcAmount}:${c.rate}:${c.timestamp}`,
  );
  return new MerkleTree(leaves);
}
