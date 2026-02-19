import { NextResponse } from "next/server";

/**
 * GET /api/v1/yield
 * Returns current yield data for all sources.
 * For MVP, returns mock T-Bill yield data.
 */
export async function GET() {
  return NextResponse.json({
    sources: [
      {
        name: "US T-Bill 4.5%",
        type: "TBill",
        apyBps: 450,
        tvl: 1_250_000_000_000, // $1.25M TVL in minor units
        navPerShare: 1_002_340, // ~1.002340 USDC per share
        allocationWeight: 10000,
        isActive: true,
      },
    ],
    totalTvl: 1_250_000_000_000,
    weightedApy: 450,
    lastUpdate: Math.floor(Date.now() / 1000),
  });
}
