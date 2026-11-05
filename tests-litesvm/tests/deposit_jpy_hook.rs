//! deposit_jpy with a Token-2022 JPY mint whose transfer hook is the
//! Accredit program, on real Token-2022 in LiteSVM.
//!
//! Instructions are assembled from raw bytes (Anchor discriminator + Borsh),
//! so this crate shares no code with the programs. Build first:
//!   cargo build-sbf --tools-version v1.53 --manifest-path programs/exodus-core/Cargo.toml
//!   (in ~/src/accredit) cargo build-sbf --manifest-path programs/transfer-hook/Cargo.toml

use litesvm::LiteSVM;
use sha2::{Digest, Sha256};
use solana_account::Account;
use solana_instruction::{AccountMeta, Instruction};
use solana_keypair::Keypair;
use solana_message::Message;
use solana_pubkey::Pubkey;
use solana_signer::Signer;
use solana_transaction::Transaction;
use spl_associated_token_account_interface::{
    address::get_associated_token_address_with_program_id,
    instruction::create_associated_token_account,
};
use spl_token_2022_interface::{
    extension::{transfer_hook, ExtensionType},
    instruction as token_ix,
    state::Mint,
    ID as TOKEN_2022,
};

const EXODUS: Pubkey = Pubkey::from_str_const("A59QJtaFuap54ZBq8GfMDAAW7tWCJ4hHAGrbL8v22ZRU");
const HOOK: Pubkey = Pubkey::from_str_const("5DLH2UrDD5bJFadn1gV1rof6sJ7MzJbVNnUfVMtGJgSL");
const SOVEREIGN: Pubkey = Pubkey::from_str_const("2UAZc1jj4QTSkgrC8U9d4a7EM9AQunxMvW5g7rX7Af9T");
const TOKEN: Pubkey = Pubkey::from_str_const("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const SYSTEM: Pubkey = Pubkey::from_str_const("11111111111111111111111111111111");
const RENT: Pubkey = Pubkey::from_str_const("SysvarRent111111111111111111111111111111111");

// Accredit TransferHookError::RecipientNotWhitelisted is not reached: the
// vault owner's missing entry fails Anchor's AccountNotInitialized (3012).
const ERR_ACCOUNT_NOT_INITIALIZED: u32 = 3012;

fn anchor_disc(name: &str) -> [u8; 8] {
    let h = Sha256::digest(format!("global:{name}").as_bytes());
    h[..8].try_into().unwrap()
}

fn exodus_pda(seeds: &[&[u8]]) -> Pubkey {
    Pubkey::find_program_address(seeds, &EXODUS).0
}

fn hook_pda(seeds: &[&[u8]]) -> Pubkey {
    Pubkey::find_program_address(seeds, &HOOK).0
}

struct Env {
    svm: LiteSVM,
    payer: Keypair,
    jpy_mint: Pubkey,
    config: Pubkey,
    jpy_vault: Pubkey,
    registry: Pubkey,
    meta_list: Pubkey,
}

impl Env {
    fn send(&mut self, ixs: &[Instruction], signers: &[&Keypair]) -> Result<(), String> {
        self.svm.expire_blockhash();
        let mut all: Vec<&Keypair> = vec![&self.payer];
        all.extend_from_slice(signers);
        let msg = Message::new(ixs, Some(&self.payer.pubkey()));
        let tx = Transaction::new(&all, msg, self.svm.latest_blockhash());
        self.svm
            .send_transaction(tx)
            .map(|_| ())
            .map_err(|e| format!("{:?} {:#?}", e.err, e.meta.logs))
    }

    fn whitelist(&self, wallet: &Pubkey) -> Pubkey {
        hook_pda(&[b"whitelist", self.registry.as_ref(), wallet.as_ref()])
    }

    fn blacklist(&self, wallet: &Pubkey) -> Pubkey {
        hook_pda(&[b"blacklist", self.registry.as_ref(), wallet.as_ref()])
    }

    fn user_ata(&self, user: &Pubkey) -> Pubkey {
        get_associated_token_address_with_program_id(user, &self.jpy_mint, &TOKEN_2022)
    }

    fn token_balance(&self, account: &Pubkey) -> u64 {
        let acc = self.svm.get_account(account).unwrap();
        u64::from_le_bytes(acc.data[64..72].try_into().unwrap())
    }

    /// Accredit add_to_whitelist with daily_limit 0 (unlimited).
    fn whitelist_ix(&self, wallet: &Pubkey) -> Instruction {
        let mut data = anchor_disc("add_to_whitelist").to_vec();
        data.extend_from_slice(wallet.as_ref());
        data.push(0); // KycLevel::Basic
        data.push(0); // Jurisdiction::Japan
        data.extend_from_slice(&[7u8; 32]);
        data.extend_from_slice(&0u64.to_le_bytes()); // daily_limit: 0 = unlimited
        data.extend_from_slice(&0i64.to_le_bytes()); // no expiry
        Instruction {
            program_id: HOOK,
            accounts: vec![
                AccountMeta::new(self.payer.pubkey(), true),
                AccountMeta::new(self.registry, false),
                AccountMeta::new(self.whitelist(wallet), false),
                AccountMeta::new_readonly(SYSTEM, false),
            ],
            data,
        }
    }

    /// A KYC'd user (Accredit entry + Sovereign tier 1) holding `jpy` JPY.
    fn new_user(&mut self, jpy: u64) -> Keypair {
        let user = Keypair::new();
        let u = user.pubkey();
        self.svm.airdrop(&u, 10_000_000_000).unwrap();

        // Sovereign identity at ["identity", user]: owner at 8, tier at 220.
        let mut data = vec![0u8; 256];
        data[8..40].copy_from_slice(u.as_ref());
        data[220] = 1;
        let identity = Pubkey::find_program_address(&[b"identity", u.as_ref()], &SOVEREIGN).0;
        let lamports = self.svm.minimum_balance_for_rent_exemption(data.len());
        self.svm
            .set_account(
                identity,
                Account { lamports, data, owner: SOVEREIGN, executable: false, rent_epoch: 0 },
            )
            .unwrap();

        let payer = self.payer.pubkey();
        let ixs = [
            self.whitelist_ix(&u),
            create_associated_token_account(&payer, &u, &self.jpy_mint, &TOKEN_2022),
            token_ix::mint_to(&TOKEN_2022, &self.jpy_mint, &self.user_ata(&u), &payer, &[], jpy)
                .unwrap(),
        ];
        self.send(&ixs, &[]).unwrap();
        user
    }

    /// deposit_jpy for the next nonce. With `with_hook_accounts`, the JPY
    /// mint's hook accounts are passed as remaining accounts.
    fn deposit_ix(&self, user: &Pubkey, amount: u64, nonce: u64, with_hook_accounts: bool) -> Instruction {
        let mut data = anchor_disc("deposit_jpy").to_vec();
        data.extend_from_slice(&amount.to_le_bytes());
        data.extend_from_slice(&0u64.to_le_bytes()); // min_usdc_out
        let user_position = exodus_pda(&[b"user_position", self.config.as_ref(), user.as_ref()]);
        let pending = exodus_pda(&[
            b"pending_deposit",
            self.config.as_ref(),
            user.as_ref(),
            &nonce.to_le_bytes(),
        ]);
        let identity = Pubkey::find_program_address(&[b"identity", user.as_ref()], &SOVEREIGN).0;
        let mut accounts = vec![
            AccountMeta::new(*user, true),
            AccountMeta::new(self.config, false),
            AccountMeta::new_readonly(self.jpy_mint, false),
            AccountMeta::new(self.user_ata(user), false),
            AccountMeta::new(self.jpy_vault, false),
            AccountMeta::new(user_position, false),
            AccountMeta::new(pending, false),
            AccountMeta::new_readonly(self.whitelist(user), false),
            AccountMeta::new_readonly(identity, false),
            AccountMeta::new_readonly(TOKEN_2022, false),
            AccountMeta::new_readonly(SYSTEM, false),
        ];
        if with_hook_accounts {
            // The vault's owner is the protocol config PDA.
            accounts.extend([
                AccountMeta::new_readonly(self.registry, false),
                AccountMeta::new(self.whitelist(user), false),
                AccountMeta::new_readonly(self.whitelist(&self.config), false),
                AccountMeta::new_readonly(self.blacklist(user), false),
                AccountMeta::new_readonly(self.blacklist(&self.config), false),
                AccountMeta::new_readonly(HOOK, false),
                AccountMeta::new_readonly(self.meta_list, false),
            ]);
        }
        Instruction { program_id: EXODUS, accounts, data }
    }
}

/// JPY mint (Token-2022, Accredit hook), USDC mint (SPL Token), Accredit
/// registry + meta list, exodus protocol initialized.
fn setup() -> Env {
    let mut svm = LiteSVM::new();
    let dir = env!("CARGO_MANIFEST_DIR");
    svm.add_program_from_file(EXODUS, format!("{dir}/../target/deploy/exodus_core.so"))
        .expect("build exodus_core.so with cargo build-sbf first");
    let hook_so = std::env::var("ACCREDIT_TRANSFER_HOOK_SO")
        .unwrap_or_else(|_| format!("{dir}/../../accredit/target/deploy/transfer_hook.so"));
    svm.add_program_from_file(HOOK, &hook_so)
        .unwrap_or_else(|e| panic!("load Accredit transfer hook from {hook_so}: {e:?}"));

    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 100_000_000_000).unwrap();
    let payer_pk = payer.pubkey();

    let jpy_kp = Keypair::new();
    let usdc_kp = Keypair::new();
    let jpy_mint = jpy_kp.pubkey();
    let usdc_mint = usdc_kp.pubkey();
    let jpy_space =
        ExtensionType::try_calculate_account_len::<Mint>(&[ExtensionType::TransferHook]).unwrap();
    let jpy_rent = svm.minimum_balance_for_rent_exemption(jpy_space);
    let usdc_rent = svm.minimum_balance_for_rent_exemption(82);

    let config = exodus_pda(&[b"exodus_config"]);
    let mut env = Env {
        svm,
        payer,
        jpy_mint,
        config,
        jpy_vault: exodus_pda(&[b"exodus_jpy_vault"]),
        registry: hook_pda(&[b"kyc_registry", jpy_mint.as_ref()]),
        meta_list: hook_pda(&[b"extra-account-metas", jpy_mint.as_ref()]),
    };

    use solana_system_interface::instruction::create_account;
    env.send(
        &[
            create_account(&payer_pk, &jpy_mint, jpy_rent, jpy_space as u64, &TOKEN_2022),
            transfer_hook::instruction::initialize(&TOKEN_2022, &jpy_mint, Some(payer_pk), Some(HOOK))
                .unwrap(),
            token_ix::initialize_mint2(&TOKEN_2022, &jpy_mint, &payer_pk, None, 6).unwrap(),
            create_account(&payer_pk, &usdc_mint, usdc_rent, 82, &TOKEN),
            token_ix::initialize_mint2(&TOKEN, &usdc_mint, &payer_pk, None, 6).unwrap(),
        ],
        &[&jpy_kp, &usdc_kp],
    )
    .unwrap();

    // Accredit registry (payer is the JPY mint authority) and meta list.
    let mut data = anchor_disc("initialize_registry").to_vec();
    data.extend_from_slice(payer_pk.as_ref()); // admin
    let init_registry = Instruction {
        program_id: HOOK,
        accounts: vec![
            AccountMeta::new(payer_pk, true),
            AccountMeta::new_readonly(jpy_mint, false),
            AccountMeta::new(env.registry, false),
            AccountMeta::new_readonly(HOOK, false), // program_data: None
            AccountMeta::new_readonly(SYSTEM, false),
        ],
        data,
    };
    let init_meta = Instruction {
        program_id: HOOK,
        accounts: vec![
            AccountMeta::new(payer_pk, true),
            AccountMeta::new_readonly(jpy_mint, false),
            AccountMeta::new(env.meta_list, false),
            AccountMeta::new_readonly(SYSTEM, false),
        ],
        data: anchor_disc("initialize_extra_account_meta_list").to_vec(),
    };

    // exodus initialize_protocol
    let mut data = anchor_disc("initialize_protocol").to_vec();
    data.extend_from_slice(Pubkey::new_unique().as_ref()); // oracle
    data.extend_from_slice(HOOK.as_ref()); // kyc_registry (Accredit program)
    data.extend_from_slice(SOVEREIGN.as_ref());
    data.extend_from_slice(&30u16.to_le_bytes());
    data.extend_from_slice(&50u16.to_le_bytes());
    data.extend_from_slice(&1000u16.to_le_bytes());
    data.extend_from_slice(payer_pk.as_ref()); // keeper
    let init_protocol = Instruction {
        program_id: EXODUS,
        accounts: vec![
            AccountMeta::new(payer_pk, true),
            AccountMeta::new(config, false),
            AccountMeta::new_readonly(jpy_mint, false),
            AccountMeta::new_readonly(usdc_mint, false),
            AccountMeta::new(env.jpy_vault, false),
            AccountMeta::new(exodus_pda(&[b"exodus_usdc_vault"]), false),
            AccountMeta::new_readonly(TOKEN, false),
            AccountMeta::new_readonly(TOKEN_2022, false),
            AccountMeta::new_readonly(SYSTEM, false),
            AccountMeta::new_readonly(RENT, false),
        ],
        data,
    };
    env.send(&[init_registry, init_meta, init_protocol], &[]).unwrap();
    env
}

#[test]
fn deposit_forwards_the_hook_accounts() {
    let mut env = setup();
    // The JPY vault's owner (protocol config PDA) needs its own entry.
    let config = env.config;
    let ix = env.whitelist_ix(&config);
    env.send(&[ix], &[]).unwrap();
    let user = env.new_user(10_000_000_000);
    let u = user.pubkey();

    // Without the hook's accounts Token-2022 cannot run the hook.
    let ix = env.deposit_ix(&u, 1_000_000_000, 1, false);
    assert!(env.send(&[ix], &[&user]).is_err());

    let ix = env.deposit_ix(&u, 1_000_000_000, 1, true);
    env.send(&[ix], &[&user]).unwrap();
    let vault = env.jpy_vault;
    assert_eq!(env.token_balance(&vault), 1_000_000_000);
}

#[test]
fn deposit_needs_the_vault_owner_whitelisted() {
    let mut env = setup();
    let user = env.new_user(10_000_000_000);
    let ix = env.deposit_ix(&user.pubkey(), 1_000_000_000, 1, true);
    let err = env.send(&[ix], &[&user]).expect_err("vault owner has no entry");
    assert!(
        err.contains(&format!("Custom({ERR_ACCOUNT_NOT_INITIALIZED})")),
        "{err}"
    );
}
