import { NextResponse } from "next/server";

/**
 * GET /api/v1/price
 * Returns the current JPY/USD exchange rate.
 * For MVP, returns a mock rate. In production, fetches from Pyth/CoinGecko.
 */
export async function GET() {
  // Mock rate for MVP — in production, integrate with oracle or price API
  const mockRate = 155.0 + (Math.random() - 0.5) * 2; // ~154-156

  return NextResponse.json({
    jpyPerUsd: Math.round(mockRate * 1_000_000) / 1_000_000,
    lastUpdate: Math.floor(Date.now() / 1000),
    source: "mock",
    pair: "JPY/USD",
  });
}
