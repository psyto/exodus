use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum YieldSourceType {
    TBill,
    Lending,
    Staking,
    Synthetic,
}

impl YieldSourceType {
    pub fn as_str(&self) -> &'static str {
        match self {
            YieldSourceType::TBill => "T-Bill",
            YieldSourceType::Lending => "Lending",
            YieldSourceType::Staking => "Staking",
            YieldSourceType::Synthetic => "Synthetic",
        }
    }
}
