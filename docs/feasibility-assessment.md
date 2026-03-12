# EXODUS Protocol — Feasibility Assessment

**Date:** 2026-03-12
**Status:** High technical maturity; extremely low business and regulatory feasibility.

## Summary

EXODUS is a Proof of Concept on Solana designed to bridge the gap between Japan's ultra-low interest rates (0.1%) and high US Dollar yields (4.5%) by allowing users to earn T-Bill yields via JPY stablecoins. The on-chain mechanics work — compliance hooks, two-step conversion flow, NAV-based share accounting, yield accrual, and a bilingual dashboard — but real-world operation faces prohibitive non-technical hurdles.

**Conclusion:** The project functions as a "regulatory environment simulator" rather than a "regulatory bypass mechanism." For Japanese residents, the tax burden largely negates the yield advantage, and the cost of license acquisition risks outweighing the potential returns.

---

## Regulatory Barriers

### Financial Instruments and Exchange Act (FIEA)

Managing JPY deposits to distribute investment gains likely constitutes **Type I Financial Instruments Business** or **Investment Management Business** under the FIEA. This requires:

- A license from Japan's FSA
- Strict compliance frameworks
- Net asset requirements often reaching hundreds of millions of yen
- Ongoing reporting obligations

Obtaining such a license is not a checkbox — it is an arduous multi-year process of negotiation with authorities.

### Payment Services Act (Amended)

Under the revised PSA, stablecoin assets must be held in trust. Simply locking assets in a smart contract may not be legally recognized as asset protection. The protocol has no trust-based asset segregation.

---

## Tax Misalignment

Under current Japanese tax law, profits from crypto assets are classified as **miscellaneous income**, subject to progressive taxation up to **55%** (income tax + resident tax). This is overwhelmingly disadvantageous compared to direct T-Bill investment (**20.315% separate taxation**).

| Scenario | Gross Yield | Tax Rate | Net Yield |
|---|---|---|---|
| Direct T-Bill (via broker) | 4.5% | 20.315% | ~3.6% |
| EXODUS (crypto classification) | 4.5% | up to 55% | ~2.0% |
| Japanese savings account | 0.1% | 20.315% | ~0.08% |

The protocol would need regulatory recognition as a securities product to qualify for separate taxation. That requires the FIEA licensing described above.

---

## Infrastructure Gaps

### JPY Stablecoins on Solana

Regulated JPY stablecoins led by Japanese megabanks (e.g., MUFG Progmat) primarily target Ethereum or permissioned chains. There is no widely available regulated JPY stablecoin on Solana today.

The codebase confirms this gap: the test helper (`tests/helpers/setup.ts`) creates a regular SPL mint for JPY rather than a Token-2022 mint with transfer hooks, noting that "Token-2022 with transfer hooks requires more complex setup."

### T-Bill Vault

The vault is purely simulated. `accrue_yield()` computes `nav × apy × elapsed_time` — it holds no real treasury bonds. Connecting to real yield sources (Ondo OUSG, Backed bIB01, Superstate USTB) requires:

- Separate KYC/KYB by those issuers (EXODUS's proprietary KYC is insufficient)
- API or whitelist integration with regulated entities
- Compliance with each issuer's accreditation requirements

### FX Liquidity

The keeper bot (`ConversionBot`) assumes USDC is already available in the vault. Jupiter DEX integration is design-only, not implemented. There is no guarantee of sufficient on-chain liquidity for JPY/USDC pairs at scale (hundreds of millions of yen).

### Oracle

The oracle is a custom simplified PriceFeed PDA with 300-second staleness checks — not integrated with Pyth or Switchboard. The README notes migration is "designed" but not implemented.

---

## Technical Accuracy Notes

The following claims in the README were verified against the codebase:

| README Claim | Actual Status |
|---|---|
| "Accredit transfer hook fires automatically on Token-2022 JPY transfers" | **Incorrect.** The program manually deserializes Accredit PDAs in each deposit instruction. No TransferHook extension is implemented. (Fixed in README as of this assessment.) |
| KYC validation is mock | **Partially incorrect.** The validation logic (active status, expiry, jurisdiction checks) is real Accredit PDA deserialization. The test data is mock, not the validation code. |
| Tiered deposit limits enforced on-chain | **Correct.** `require!` macros in `deposit_jpy.rs` and `deposit_usdc.rs` enforce tier-based monthly limits. |
| Stratum integration is on-chain | **Incorrect.** `@stratum/core` merkle trees and bitfields are SDK-side tools for keeper bots, not on-chain constraints. |
| 16 integration tests pass | **Correct.** 10 exodus-core + 6 tbill-vault tests using anchor-bankrun. |

---

## Blind Spots and Underestimated Risks

### Redemption Friction

If users wish to receive JPY, the reverse conversion (USDC→JPY) incurs slippage and fees. For short-term holdings, these costs may completely offset the yield earned.

### Counterparty Risk

The mock nature of the T-Bill Vault is a significant blind spot. Real yield sources have their own accreditation requirements — EXODUS's KYC alone is insufficient.

### Asset Segregation

Under Japanese regulation, stablecoin-related assets should be held in trust. Smart contract locking alone may not satisfy legal requirements for asset protection.

### Security

The smart contracts have not been audited. Any protocol handling real funds would need at least one professional security audit.

---

## Strategic Recommendations (Prioritized)

### 1. Legal Structuring (Do First)

Pause technical development. Engage a Japanese financial law attorney to determine:
- Whether the protocol can be structured as tokenization of "Trust Beneficiary Rights"
- Whether an offshore entity (e.g., Singapore) is viable for Japanese residents
- What license classification applies under FIEA

### 2. Pivot to Institutional Clients

Target corporations (effective tax rate ~30%) rather than individuals burdened by the 55% rate. Redefine the tool for corporate treasury management.

### 3. Real-Yield Partnerships

Instead of building a proprietary vault, seek formal integration (API/whitelist) with already regulated entities like Ondo Finance or Backed.

### 4. Compliance Stack as Standalone Value

The Accredit + Complr + Stratum integration pattern (on-chain KYC validation + off-chain sanctions screening + batch merkle proofs) is reusable for any regulated Solana protocol. Consider extracting it as a standalone compliance framework.

---

## References

- Payment Services Act (Amended): Definition of stablecoins as electronic payment instruments
- Financial Instruments and Exchange Act: Provisions for Type I Financial Instruments Business and Investment Management Business
- National Tax Agency: Tax treatment regarding crypto assets
- [Stablebonds Analysis](stablebonds-analysis.md): Etherfuse commentary and implications for EXODUS
