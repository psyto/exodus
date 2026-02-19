"use client";

import { useState, useEffect, useCallback } from "react";
import { YieldSourceAccount } from "@exodus/types";
import { useExodus } from "./useExodus";
import { TOKEN_MINTS } from "@/lib/constants";

export function useYieldData() {
  const { client } = useExodus();
  const [yieldSource, setYieldSource] = useState<YieldSourceAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!client) return;

    setLoading(true);
    setError(null);
    try {
      const ys = await client.getYieldSource(TOKEN_MINTS.USDC);
      setYieldSource(ys);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 60_000); // Poll every 60s
    return () => clearInterval(interval);
  }, [fetch]);

  return { yieldSource, loading, error, refetch: fetch };
}
