use crate::yield_source::YieldSourceType;

/// Tier 0 = Unverified (no access)
/// Tier 1 = Bronze (basic KYC)
/// Tier 2 = Silver (enhanced KYC)
/// Tier 3 = Gold (accredited investor)
/// Tier 4 = Diamond (institutional)

/// Monthly JPY deposit limit by Sovereign tier.
/// Returns amount in JPY minor units (1 JPY = 1_000_000 minor units for Token-2022 6 decimals).
pub fn monthly_jpy_limit(tier: u8) -> u64 {
    match tier {
        0 => 0,
        1 => 500_000_000_000,       // ¥500,000
        2 => 5_000_000_000_000,      // ¥5,000,000
        3 => 50_000_000_000_000,     // ¥50,000,000
        4 => u64::MAX,               // Unlimited
        _ => 0,
    }
}

/// Monthly USDC deposit limit by Sovereign tier.
/// Returns amount in USDC minor units (1 USDC = 1_000_000 minor units for 6 decimals).
pub fn monthly_usdc_limit(tier: u8) -> u64 {
    match tier {
        0 => 0,
        1 => 3_500_000_000,         // $3,500
        2 => 35_000_000_000,        // $35,000
        3 => 350_000_000_000,       // $350,000
        4 => u64::MAX,              // Unlimited
        _ => 0,
    }
}

/// Returns which yield source types a given tier can access.
pub fn allowed_yield_sources(tier: u8) -> Vec<YieldSourceType> {
    match tier {
        0 => vec![],
        1 => vec![YieldSourceType::TBill],
        2 => vec![YieldSourceType::TBill, YieldSourceType::Lending],
        3 => vec![
            YieldSourceType::TBill,
            YieldSourceType::Lending,
            YieldSourceType::Staking,
        ],
        4 => vec![
            YieldSourceType::TBill,
            YieldSourceType::Lending,
            YieldSourceType::Staking,
            YieldSourceType::Synthetic,
        ],
        _ => vec![],
    }
}

/// Tier display name in English.
pub fn tier_name_en(tier: u8) -> &'static str {
    match tier {
        0 => "Unverified",
        1 => "Bronze",
        2 => "Silver",
        3 => "Gold",
        4 => "Diamond",
        _ => "Unknown",
    }
}

/// Tier display name in Japanese.
pub fn tier_name_ja(tier: u8) -> &'static str {
    match tier {
        0 => "未認証",
        1 => "ブロンズ",
        2 => "シルバー",
        3 => "ゴールド",
        4 => "ダイヤモンド",
        _ => "不明",
    }
}
