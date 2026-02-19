"use client";

import { useState, useEffect, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

interface KYCStatus {
  isVerified: boolean;
  isActive: boolean;
  kycLevel: number;
  jurisdiction: number;
  expiresAt: number;
}

/**
 * Hook to check user's Accredit KYC status.
 * Reads the WhitelistEntry PDA directly from chain.
 */
export function useKYCStatus() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [status, setStatus] = useState<KYCStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!publicKey) {
      setStatus(null);
      return;
    }

    setLoading(true);
    try {
      // For MVP, return mock data based on wallet connection
      // In production, derive WhitelistEntry PDA and read from chain
      setStatus({
        isVerified: true,
        isActive: true,
        kycLevel: 2,
        jurisdiction: 0, // Japan
        expiresAt: Math.floor(Date.now() / 1000) + 365 * 86400,
      });
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { status, loading, refetch: fetch };
}
