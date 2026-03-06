# EXODUS Protocol

**A proof-of-concept for compliant JPY→USD yield on Solana.**

Japanese savings accounts yield 0.1%. U.S. Treasury Bills yield 4.5%. That's a 45x gap. EXODUS is a technical prototype exploring how that gap could be bridged on-chain — with compliance built in from the start.

## The Thesis

**The structural problem:** Japan's Bank of Japan maintains ultra-low interest rates while the Fed keeps US rates elevated. This creates a persistent yield gap that Japanese savers can't easily exploit. Traditional brokerages charge high fees, require complex account setups, and don't offer real-time settlement.

**The regulatory opening:** Japan's megabanks (MUFG, SMBC, Mizuho) are actively building regulated JPY stablecoin infrastructure under the revised Payment Services Act. For the first time, compliant JPY could flow on-chain — but there's nowhere for it to earn yield.

**What EXODUS demonstrates:** A Solana-based architecture where compliant JPY stablecoins come in, get converted to USDC at oracle-sourced rates, and get deposited into a T-Bill yield vault — with KYC verification and tier-gated deposit limits enforced on-chain.

## What This Actually Is

This is a **working technical prototype** — not a deployable product. The Solana programs compile, 16 integration tests pass, and the dashboard renders. It proves the on-chain mechanics work: compliance hooks, two-step conversion flow, NAV-based share accounting, yield accrual, and a bilingual user interface.

**What works today:**
- Two Solana programs (exodus-core + exodus-tbill-vault) with full instruction sets
- 16 passing integration tests covering deposits, conversions, withdrawals, yield accrual, and access control
- TypeScript SDK with client, PDA helpers, instruction builders, and keeper bots
- Next.js 15 dashboard with Japanese/English support, wallet connection, and all dashboard pages
- On-chain compliance integration points (Accredit KYC + Sovereign Identity tiers)

**What's mock / simulated:**
- The T-Bill vault accrues yield based on a configurable APY and elapsed time — it doesn't hold real T-Bills
- The JPY→USDC conversion reads a mock oracle — no real price feed or DEX integration
- KYC status returns mock data when no Accredit program is deployed
- The dashboard shows mock portfolio data when no wallet position exists on-chain

## Honest Assessment: What Would It Take to Make This Real

### 1. Regulation (the hardest part)

A protocol that takes JPY, converts to USDC, and earns T-Bill yield would almost certainly be classified as a **Type I Financial Instruments Business** under Japan's FIEA (Financial Instruments and Exchange Act). That requires:
- A license from Japan's FSA
- Minimum capital requirements
- Ongoing compliance and reporting obligations
- Likely partnership with or operation by a licensed financial institution

You can't just deploy smart contracts and call it a product.

### 2. Tax economics

Crypto gains in Japan are taxed as **miscellaneous income at up to 55%** (income tax + resident tax). A user earning 4.5% APY but paying 55% tax effectively earns ~2% after tax. Still better than 0.1%, but much less compelling than the headline number.

For the economics to truly work, the protocol would need regulatory recognition as a securities product to qualify for Japan's **20.315% separated taxation** rate on financial income. That requires the regulatory licensing mentioned above.

### 3. JPY stablecoins on Solana don't exist yet

The megabank stablecoin projects (MUFG Progmat, etc.) are mostly on Ethereum or private/permissioned chains. There is no widely available regulated JPY stablecoin on Solana today. EXODUS's Token-2022 transfer hook integration assumes one will exist — but that's an assumption, not a certainty.

### 4. The T-Bill vault is mock

Real tokenized T-Bill access (Ondo OUSG, Superstate USTB, Backed bIB01, etc.) requires integration with regulated issuers who have their own accreditation requirements. You can't just pipe USDC into T-Bills without a regulated intermediary. The mock vault demonstrates the share accounting mechanics, but connecting to real yield requires real partnerships.

### 5. Liquidity for FX conversion

The "keeper pre-loads USDC via Jupiter" design assumes real market-making capital. Someone needs to provide the USDC liquidity for JPY→USDC conversion. This requires either institutional liquidity partners, integration with on-chain DEXs, or a treasury operation.

### 6. Security

The smart contracts have not been audited. Any protocol handling real funds would need at least one professional security audit before deployment.

### Summary

| Requirement | Status |
|---|---|
| On-chain architecture | Built and tested |
| Compliance integration points | Designed, mock-verified |
| FSA licensing | Not started — requires legal counsel |
| JPY stablecoin on Solana | Does not exist yet |
| Real T-Bill yield source | Requires partnership with tokenized treasury issuer |
| FX liquidity | Requires market-making capital or DEX integration |
| Security audit | Not done |
| Tax-efficient structure | Requires regulatory classification |

**Bottom line:** The thesis is sound, and the code proves the mechanics work. This is a prototype for exploring and demonstrating the idea — not a finished product. The regulatory and business challenges are where the real work would be.

---

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

A self-contained yield vault with a clean interface — designed to be swapped for real T-Bill protocols without changing core logic:

- **NAV-based accounting:** `nav_per_share` starts at 1.000000 (scaled 1e6), increases over time
- **Time-weighted yield:** `accrual = nav × apy_bps × elapsed / (10000 × seconds_per_year)`
- **Share math:** deposit → `shares = usdc × 1e6 / nav`, withdraw → `usdc = shares × nav / 1e6`

### Compliance

EXODUS uses a layered compliance stack combining on-chain and off-chain checks. The SDK exposes a unified compliance utility at `packages/sdk/src/compliance.ts`.

**On-chain (KYC / identity verification):**

- **@accredit/sdk + @accredit/types** — On-chain KYC and identity verification. Validates KYC status, jurisdiction (blocks sanctioned regions), and credential expiry. The Accredit transfer hook fires automatically on Token-2022 JPY transfers.
- **Sovereign Identity** (tier gating) — Maps identity verification tiers to monthly deposit caps.

**Off-chain (sanctions / PEP screening):**

- **@complr/sdk** — Off-chain sanctions and politically-exposed-person (PEP) screening. Key functions: `screenWallet` (check a wallet against sanctions/PEP lists) and `checkConversionCompliance` (verify a JPY-to-USDC conversion is permitted before execution).

**Stratum data structures (`@stratum/core`):**

- **Batch KYC verification** — `buildKycBatchTree()` builds a `MerkleTree` from KYC-verified user records (each leaf encodes `wallet:kycLevel:tier`). `getKycProof()` generates a merkle proof for a single user's KYC status, enabling batch verification without loading individual KYC PDAs.
- **Conversion limit tracking** — `createConversionLimitTracker()` creates a compact `Bitfield` where each bit represents a user slot, letting the keeper bot check monthly JPY→USDC conversion limit status before batching conversions. `restoreConversionTracker()` restores a tracker from stored bytes.
- **Conversion history auditing** — `buildConversionHistoryTree()` builds a `MerkleTree` of completed JPY→USDC conversion records (each leaf encodes `wallet:jpyAmount:usdcAmount:rate:timestamp`), enabling compact proofs that a specific conversion occurred for regulatory reporting and dispute resolution.

All Stratum utilities are exported from `packages/sdk/src/stratum-utils.ts`.

| Tier | Monthly JPY Limit | Monthly USDC Limit |
|---|---|---|
| Bronze | 500,000 | 3,500 |
| Silver | 5,000,000 | 35,000 |
| Gold | 50,000,000 | 350,000 |
| Diamond | Unlimited | Unlimited |

## Dashboard

Next.js 15 dashboard with bilingual support (Japanese / English):

| Page | Features |
|---|---|
| **Portfolio** | Total value, yield earned, current APY, FX P&L, position details |
| **Deposit** | JPY/USDC toggle, live conversion preview, slippage settings, tier limit display |
| **Withdraw** | Share amount input, USDC/JPY output toggle, yield claim |
| **Yield Analytics** | Realized vs unrealized breakdown, APY history chart, projection calculator |
| **History** | Conversion table with date/direction/amount/rate/fee/status, CSV export |
| **Admin** | Protocol stats, yield source management, fee config, pause/resume |

## SDK

The `@exodus/sdk` package provides:

- **ExodusClient** — High-level client for reads (positions, yield, pending deposits) and writes (deposit, withdraw, claim)
- **PDA derivation** — All program account address derivation functions
- **Instruction builders** — Low-level transaction instruction constructors
- **Keeper bots** — `ConversionBot` (polls pending JPY→USDC conversions) and `NavUpdater` (cranks yield accrual)
- **Compliance** (`compliance.ts`) — Unified compliance checks combining on-chain Accredit KYC verification with off-chain Complr sanctions/PEP screening
- **Stratum utilities** (`stratum-utils.ts`) — Batch KYC merkle proofs, conversion limit bitfield tracking, and conversion history audit trees powered by `@stratum/core`
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
- **Two-step deposit flow** — `deposit_jpy` creates a pending deposit; `execute_conversion` (keeper) performs the actual conversion. This separates user intent from execution and enables off-chain JPY→USDC sourcing.
- **Read-only compliance + off-chain screening** — On-chain, the program deserializes Accredit/Sovereign PDA accounts directly (no CPI). Off-chain, `@complr/sdk` provides sanctions/PEP screening via `screenWallet` and `checkConversionCompliance` before transactions are submitted.
- **Stratum-backed batch verification** — `@stratum/core` merkle trees enable batch KYC verification (avoiding per-user PDA lookups) and conversion history audit proofs. Bitfields provide compact conversion limit tracking for keeper bots.
- **Swappable yield sources** — The `YieldSource` abstraction supports multiple strategies. The mock T-Bill vault can be replaced with real protocols without changing core logic.
- **Oracle with staleness check** — Simplified PriceFeed PDA with 300-second staleness threshold. Designed for migration to Pyth or Switchboard.

## Related

- [Stablebonds Analysis](docs/stablebonds-analysis.md) — Commentary on Etherfuse's "Stablebonds" thesis and implications for EXODUS

## License

All rights reserved.
