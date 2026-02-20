# EXODUS Protocol

**Earn 4.5% on your yen. On-chain. Compliant.**

Japanese savings accounts yield 0.1%. U.S. Treasury Bills yield 4.5%. That's a 45x gap. EXODUS bridges it.

EXODUS is a Solana protocol that lets Japanese users deposit JPY stablecoins, automatically convert to USDC, and allocate to a T-Bill yield vault — all while staying compliant with Japan's FSA regulations through on-chain KYC (Accredit) and privacy-preserving identity (Sovereign).

## Why This Matters

**The structural problem:** Japan's Bank of Japan maintains ultra-low interest rates while the Fed keeps US rates elevated. This creates a persistent yield gap that Japanese savers can't easily exploit. Traditional brokerages charge high fees, require complex account setups, and don't offer real-time settlement.

**The regulatory opening:** Japan's megabanks (MUFG, SMBC, Mizuho) are actively building regulated JPY stablecoin infrastructure under the revised Payment Services Act. For the first time, compliant JPY can flow on-chain — but there's nowhere for it to earn yield.

**What EXODUS does:** Takes compliant JPY stablecoins in, converts them to USDC at oracle-sourced rates, and deposits into a T-Bill yield vault. Users earn ~4.5% APY on what was previously earning 0.1%. Withdrawals return USDC (or convert back to JPY). All deposits are KYC-verified and tier-gated by identity level.

## How It Works

```
1. Deposit JPY stablecoin
   └─ KYC verified via Accredit transfer hooks
   └─ Deposit limits enforced by Sovereign Identity tier

2. Keeper converts JPY → USDC
   └─ Oracle-sourced exchange rate (300s staleness check)
   └─ Slippage protection (user-defined minimum output)
   └─ Conversion fee deducted (configurable bps)

3. USDC allocated to T-Bill vault
   └─ NAV-based share accounting (1 share ≈ 1 USDC at launch)
   └─ Yield accrues continuously via keeper cranks
   └─ APY configurable by admin (default 4.5%)

4. Withdraw anytime
   └─ Burn shares → receive USDC at current NAV
   └─ Optional: convert back to JPY
```

## Architecture

Two Solana programs, a TypeScript SDK, and a bilingual dashboard:

```
exodus/
├── programs/
│   ├── exodus-core/             # Deposits, conversions, yield routing, compliance
│   └── exodus-tbill-vault/      # T-Bill yield vault (NAV-based share accounting)
├── crates/
│   └── exodus-types/            # Shared Rust types (enums, tier limits)
├── packages/
│   ├── types/                   # TypeScript type definitions
│   └── sdk/                     # Client SDK, instruction builders, keeper bots
├── app/                         # Next.js 15 dashboard (Japanese/English)
└── tests/                       # Integration tests (anchor-bankrun)
```

### exodus-core

The main protocol program. Handles the full lifecycle:

| Instruction | What it does |
|---|---|
| `initialize_protocol` | Create protocol config, JPY vault (Token-2022), USDC vault |
| `register_yield_source` | Link a yield strategy (e.g., T-Bill vault) |
| `deposit_jpy` | Accept JPY with KYC check + tier limit → create PendingDeposit |
| `deposit_usdc` | Direct USDC deposit → allocate to yield source |
| `execute_conversion` | Keeper: read oracle, convert JPY→USDC, allocate to vault |
| `withdraw` | Burn shares, return USDC to user |
| `claim_yield` | Withdraw accrued yield (performance fee deducted) |
| `update_nav` | Keeper: sync NAV from T-Bill vault |
| `update_protocol_config` | Admin: update fees, oracle, registry |
| `pause_protocol` / `resume_protocol` | Emergency controls |

### exodus-tbill-vault

A self-contained yield vault with a clean interface — designed to be swapped for real T-Bill protocols (Ondo, Superstate, etc.) without changing core logic:

- **NAV-based accounting:** `nav_per_share` starts at 1.000000 (scaled 1e6), increases over time
- **Time-weighted yield:** `accrual = nav × apy_bps × elapsed / (10000 × seconds_per_year)`
- **Share math:** deposit → `shares = usdc × 1e6 / nav`, withdraw → `usdc = shares × nav / 1e6`

### Compliance

EXODUS reads two external programs on-chain for regulatory compliance:

- **Accredit** (transfer hooks) — Validates KYC status, jurisdiction (blocks sanctioned regions), expiry. The transfer hook fires automatically on Token-2022 JPY transfers.
- **Sovereign Identity** (tier gating) — Maps identity verification tiers to monthly deposit caps:

| Tier | Monthly JPY Limit | Monthly USDC Limit |
|---|---|---|
| Bronze | 500,000 | 3,500 |
| Silver | 5,000,000 | 35,000 |
| Gold | 50,000,000 | 350,000 |
| Diamond | Unlimited | Unlimited |

## Dashboard

Full-featured Next.js 15 dashboard with bilingual support (Japanese / English):

| Page | Features |
|---|---|
| **Portfolio** | Total value, yield earned, current APY, FX P&L, position details |
| **Deposit** | JPY/USDC toggle, live conversion preview, slippage settings, tier limit display |
| **Withdraw** | Share amount input, USDC/JPY output toggle, yield claim |
| **Yield Analytics** | Realized vs unrealized breakdown, APY history chart, projection calculator |
| **History** | Conversion table with date/direction/amount/rate/fee/status, CSV export |
| **Admin** | Protocol stats, yield source management, fee config, pause/resume |

The locale switcher in the header changes the URL (`/ja/dashboard` ↔ `/en/dashboard`) and all UI text.

## SDK

The `@exodus/sdk` package (`packages/sdk/`) provides everything needed to interact with the protocol:

- **ExodusClient** — High-level client for reads (positions, yield, pending deposits) and writes (deposit, withdraw, claim)
- **PDA derivation** — All program account address derivation functions
- **Instruction builders** — Low-level transaction instruction constructors for custom integrations
- **Keeper bots** — `ConversionBot` (polls and executes pending JPY→USDC conversions) and `NavUpdater` (cranks yield accrual on the T-Bill vault)
- **Utilities** — Tier limit checks, share/NAV math, yield projections

## Development

### Prerequisites

- Rust 1.75+ with `cargo-build-sbf` (Solana BPF compiler)
- Solana CLI 2.1+
- Anchor 0.32.1
- Node.js 18+
- pnpm 9+

### Build and Test

```bash
# Install dependencies
pnpm install

# Build Solana programs
cargo-build-sbf --tools-version v1.52

# Run integration tests (16 tests: 10 exodus-core + 6 tbill-vault)
anchor test

# Start the dashboard (http://localhost:3000)
cd app && pnpm dev
```

### Key Design Decisions

- **Token-2022 for JPY, SPL Token for USDC** — JPY stablecoin uses Token-2022 with transfer hooks for automatic compliance enforcement. USDC uses standard SPL Token.
- **Two-step deposit flow** — `deposit_jpy` creates a pending deposit; `execute_conversion` (keeper) performs the actual conversion. This separates user intent from execution and enables off-chain JPY→USDC sourcing (Jupiter, market makers).
- **Read-only compliance** — Rather than CPI to Accredit/Sovereign, the program deserializes their PDA accounts directly. Simpler, cheaper, and the transfer hook handles enforcement automatically.
- **Swappable yield sources** — The `YieldSource` abstraction supports multiple strategies. Phase 1 uses a mock T-Bill vault; real protocols plug in without changing core logic.
- **Oracle with staleness check** — Simplified PriceFeed PDA (Meridian pattern) with 300-second staleness threshold. Designed for easy migration to Pyth or Switchboard.

## Roadmap

| Phase | Scope |
|---|---|
| **Phase 1 (current)** | Mock T-Bill vault, two-step JPY→USDC conversion, full dashboard, KYC + tier gating |
| **Phase 1.5** | On-chain Jupiter CPI for JPY→USDC, reverse conversion (USDC→JPY withdrawal), real oracle integration |
| **Phase 2** | Real T-Bill vault integration (Ondo/Superstate), multi-source yield routing, leveraged yield strategies |
| **Phase 3** | Cross-chain JPY rails, institutional API, mobile app |

## Related

- [Stablebonds Analysis](docs/stablebonds-analysis.md) — Commentary on Etherfuse's "Stablebonds" thesis and implications for EXODUS

## License

All rights reserved.
