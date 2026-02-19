"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { UserPosition } from "@exodus/types";
import { useExodus } from "./useExodus";

export function useUserPosition() {
  const { client } = useExodus();
  const { publicKey } = useWallet();
  const [position, setPosition] = useState<UserPosition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!client || !publicKey) {
      setPosition(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const pos = await client.getUserPosition(publicKey);
      setPosition(pos);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [client, publicKey]);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 30_000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetch]);

  return { position, loading, error, refetch: fetch };
}
