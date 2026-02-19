"use client";

import { useState, useEffect, useCallback } from "react";

interface ConversionRate {
  jpyPerUsd: number;
  lastUpdate: number;
  source: string;
}

/**
 * Hook to get live JPY/USD conversion rate.
 * Uses API route for server-side price fetching.
 */
export function useConversionRate() {
  const [rate, setRate] = useState<ConversionRate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await globalThis.fetch("/api/v1/price");
      if (!res.ok) throw new Error("Failed to fetch price");
      const data = await res.json();
      setRate(data);
    } catch (err: any) {
      setError(err.message);
      // Fallback to approximate rate
      setRate({
        jpyPerUsd: 155.0,
        lastUpdate: Date.now() / 1000,
        source: "fallback",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 30_000);
    return () => clearInterval(interval);
  }, [fetch]);

  return { rate, loading, error, refetch: fetch };
}
