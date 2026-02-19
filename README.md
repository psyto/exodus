# EXODUS Protocol

Compliant, yield-bearing digital dollar vault accessible from Japan's regulated JPY stablecoin rails.

EXODUS bridges Japan's emerging JPY stablecoin ecosystem with USD-denominated yield opportunities. Users deposit JPY stablecoins (Token-2022 with transfer hooks for compliance), which are converted to USDC and allocated to a T-Bill yield vault — all while enforcing KYC/AML via Accredit and tier-gated deposit limits via Sovereign Identity.

## Architecture

```
User (JPY Stablecoin)
  -> Accredit Transfer Hook (KYC/AML verification)
  -> Sovereign Identity (tier-gated deposit limits)
  -> exodus-core: deposit_jpy() [holds JPY in vault]
  -> Keeper: execute_conversion() [JPY -> USDC via oracle rate]
  -> exodus-core: allocate to YieldSource
  -> exodus-tbill-vault: deposit USDC -> earn T-Bill yield
  -> User: withdraw shares -> USDC or JPY
```

## Repository Structure

```
exodus/
├── crates/
│   └── exodus-types/          # Shared Rust types (enums, tier limits)
├── programs/
│   ├── exodus-core/           # Core protocol (deposits, conversions, yield, admin)
│   └── exodus-tbill-vault/    # Mock T-Bill vault (NAV-based share accounting)
├── packages/
│   ├── types/                 # TypeScript type definitions (@exodus/types)
│   └── sdk/                   # Client SDK, instruction builders, keeper bots (@exodus/sdk)
├── app/                       # Next.js dashboard (bilingual JP/EN)
└── tests/                     # Anchor integration tests
```

## Programs

### exodus-core

The main protocol program handling:

- **deposit_jpy** — Accept JPY stablecoin deposits with KYC verification (Accredit WhitelistEntry) and tier-gated limits (Sovereign Identity). Creates a `PendingDeposit` with 24h expiry.
- **execute_conversion** — Keeper-triggered instruction that reads oracle price, converts JPY to USDC, deducts fees, checks slippage, and allocates to the yield source.
- **deposit_usdc** — Direct USDC deposit path (skips conversion).
- **withdraw** — Burn shares, receive USDC back.
- **claim_yield** — Withdraw accrued yield with performance fee deduction.
- **update_nav** — Keeper crank to sync NAV from the T-Bill vault.
- **Admin instructions** — Initialize protocol, register yield sources, update config, pause/resume.

### exodus-tbill-vault

A mock T-Bill yield vault with swappable interface for real protocols:

- NAV-based share accounting (`nav_per_share` scaled 1e6)
- Time-weighted yield accrual based on configurable APY
- Deposit USDC -> mint shares, withdraw shares -> burn and return USDC

## Dashboard

Full-featured Next.js 15 dashboard with bilingual support (Japanese/English):

| Page | Description |
|------|-------------|
| **Portfolio** | Total value, yield earned, APY, position details, FX P&L |
| **Deposit** | JPY/USDC currency toggle, conversion preview, slippage settings, tier limits |
| **Withdraw** | Share slider, USDC/JPY output toggle, yield claim |
| **Yield** | Pie charts (by source, realized vs unrealized), APY history, projection calculator |
| **History** | Conversion table with filters, CSV export, Solana Explorer links |
| **Admin** | Protocol stats, yield source management, fee config, pause/resume |

## SDK

The `@exodus/sdk` package provides:

- **ExodusClient** — High-level client for all read and write operations
- **PDA helpers** — Derivation functions for all program accounts
- **Instruction builders** — Low-level transaction instruction constructors
- **Keeper bots** — `ConversionBot` (polls pending deposits) and `NavUpdater` (cranks yield accrual)
- **Utilities** — Tier limit checks, yield math (share calculations, NAV accrual, projections)

## Compliance

EXODUS integrates with two external programs for regulatory compliance:

- **Accredit** — KYC/AML verification via WhitelistEntry PDA read. Validates active status, jurisdiction (blocks USA), and expiry.
- **Sovereign Identity** — Tier-based deposit limits. Tiers map to monthly caps:
  - Bronze: 500,000 JPY / 3,500 USDC
  - Silver: 5,000,000 JPY / 35,000 USDC
  - Gold: 50,000,000 JPY / 350,000 USDC
  - Diamond: Unlimited

## Development

### Prerequisites

- Rust 1.75+
- Solana CLI 2.1+
- Anchor 0.32.1
- Node.js 18+
- pnpm 9+

### Setup

```bash
# Install dependencies
pnpm install

# Build Rust programs
anchor build

# Run integration tests
anchor test

# Start the dashboard
pnpm dev
```

### Project Commands

```bash
pnpm build        # Build all packages
pnpm test         # Run Anchor tests
pnpm dev          # Start Next.js dev server
pnpm lint         # Lint all packages
```

## Key Design Decisions

- **Token-2022 for JPY, SPL Token for USDC** — JPY stablecoin uses Token-2022 with transfer hooks for compliance enforcement. USDC uses standard SPL Token.
- **Two-step deposit flow** — `deposit_jpy` creates a pending deposit; `execute_conversion` (keeper) performs the actual conversion. This separates user intent from execution and enables off-chain JPY->USDC sourcing.
- **Read-only compliance checks** — Rather than full CPI to Accredit/Sovereign, the program deserializes their PDA accounts directly. The transfer hook fires automatically on Token-2022 transfers.
- **Swappable yield sources** — The `YieldSource` abstraction allows registering multiple yield strategies. Phase 1 uses a mock T-Bill vault; real protocols can be added without changing core logic.
- **Oracle pattern** — Uses a simplified PriceFeed PDA (Meridian pattern) with 300-second staleness check. Designed for easy migration to Pyth or Switchboard.

## License

All rights reserved.
