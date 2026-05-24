use hmac::Hmac;
use pbkdf2::pbkdf2;
use sha2::Sha256;
use std::format;
use std::string::{String, ToString};
use std::vec::Vec;
use unicode_normalization::UnicodeNormalization;
#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

const DOMAIN: &str = "passworder-core";
const VERSION: &str = "v1";
const DEFAULT_ITERATIONS: u32 = 210_000;
const DEFAULT_LENGTH: usize = 20;
const DEFAULT_MNEMONIC_WORDS: usize = 24;
const MIN_PASSWORD_LENGTH: usize = 8;
const DERIVED_BYTES: usize = 64;
const LOWER: &[u8] = b"abcdefghijkmnopqrstuvwxyz";
const UPPER: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS: &[u8] = b"23456789";
const SYMBOLS: &[u8] = b"!@#$%^&*_-+=?";
const WORDLIST: [&str; 64] = [
    "anchor", "apricot", "atlas", "bamboo", "beacon", "breeze", "cactus", "canyon", "cedar",
    "cinder", "cobalt", "coral", "cotton", "cricket", "delta", "ember", "falcon", "fennel",
    "forest", "galaxy", "garden", "harbor", "hazel", "helium", "island", "jacket", "juniper",
    "lantern", "lemon", "lizard", "magnet", "marble", "matrix", "meadow", "meteor", "nectar",
    "nickel", "oasis", "olive", "onyx", "orbit", "paddle", "paper", "pepper", "planet", "quartz",
    "rabbit", "raven", "river", "rocket", "saffron", "saturn", "silver", "sparrow", "spiral",
    "summit", "timber", "tundra", "velvet", "violet", "walnut", "willow", "winter", "zephyr",
];

type HmacSha256 = Hmac<Sha256>;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PasswordPolicy {
    pub length: usize,
    pub lowercase: bool,
    pub uppercase: bool,
    pub digits: bool,
    pub symbols: bool,
}

impl Default for PasswordPolicy {
    fn default() -> Self {
        Self {
            length: DEFAULT_LENGTH,
            lowercase: true,
            uppercase: true,
            digits: true,
            symbols: true,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DerivePasswordOptions<'a> {
    pub base_secret: &'a str,
    pub service: &'a str,
    pub account: Option<&'a str>,
    pub context: Option<&'a str>,
    pub iterations: u32,
    pub policy: PasswordPolicy,
}

impl<'a> DerivePasswordOptions<'a> {
    pub fn new(base_secret: &'a str, service: &'a str) -> Self {
        Self {
            base_secret,
            service,
            account: None,
            context: None,
            iterations: DEFAULT_ITERATIONS,
            policy: PasswordPolicy::default(),
        }
    }

    pub fn account(mut self, account: &'a str) -> Self {
        self.account = Some(account);
        self
    }

    pub fn context(mut self, context: &'a str) -> Self {
        self.context = Some(context);
        self
    }

    pub fn iterations(mut self, iterations: u32) -> Self {
        self.iterations = iterations;
        self
    }

    pub fn policy(mut self, policy: PasswordPolicy) -> Self {
        self.policy = policy;
        self
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DerivePasswordResult {
    pub password: String,
    pub algorithm: &'static str,
    pub iterations: u32,
    pub length: usize,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PassworderError {
    EmptyInput,
    InvalidIterations,
    InvalidPasswordLength,
    NoCharacterClass,
    RandomUnavailable,
}

impl core::fmt::Display for PassworderError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            Self::EmptyInput => f.write_str("input must not be empty"),
            Self::InvalidIterations => f.write_str("PBKDF2 iterations must be >= 10000"),
            Self::InvalidPasswordLength => f.write_str("password length must be >= 8"),
            Self::NoCharacterClass => f.write_str("at least one character class must be enabled"),
            Self::RandomUnavailable => f.write_str("secure random generation is unavailable"),
        }
    }
}

impl std::error::Error for PassworderError {}

pub const ALGORITHM: &str = "passworder-core:v1:PBKDF2-HMAC-SHA256";

pub fn default_iterations() -> u32 {
    DEFAULT_ITERATIONS
}

pub fn default_password_length() -> usize {
    DEFAULT_LENGTH
}

pub fn default_mnemonic_words() -> usize {
    DEFAULT_MNEMONIC_WORDS
}

pub fn wordlist_size() -> usize {
    WORDLIST.len()
}

pub fn normalize_input(value: &str) -> Result<String, PassworderError> {
    let normalized = value.nfkc().collect::<String>();
    let collapsed = normalized.split_whitespace().collect::<Vec<_>>().join(" ");
    let trimmed = collapsed.trim();
    if trimmed.is_empty() {
        return Err(PassworderError::EmptyInput);
    }
    Ok(trimmed.to_string())
}

#[cfg(feature = "random")]
pub fn generate_mnemonic(words: usize) -> Result<String, PassworderError> {
    let mut bytes = vec![0_u8; words];
    getrandom::getrandom(&mut bytes).map_err(|_| PassworderError::RandomUnavailable)?;
    generate_mnemonic_from_entropy(words, &bytes)
}

pub fn generate_mnemonic_from_entropy(
    words: usize,
    entropy: &[u8],
) -> Result<String, PassworderError> {
    if !(6..=48).contains(&words) {
        return Err(PassworderError::InvalidPasswordLength);
    }
    if entropy.len() < words {
        return Err(PassworderError::RandomUnavailable);
    }

    let phrase = (0..words)
        .map(|index| WORDLIST[entropy[index] as usize % WORDLIST.len()])
        .collect::<Vec<_>>()
        .join(" ");

    Ok(phrase)
}

pub fn derive_password(
    options: &DerivePasswordOptions<'_>,
) -> Result<DerivePasswordResult, PassworderError> {
    validate_policy(options.policy)?;
    if options.iterations < 10_000 {
        return Err(PassworderError::InvalidIterations);
    }

    let base_secret = normalize_input(options.base_secret)?;
    let service = normalize_input(options.service)?.to_lowercase();
    let account = match options.account {
        Some(account) => normalize_input(account)?.to_lowercase(),
        None => String::new(),
    };
    let context = match options.context {
        Some(context) => normalize_input(context)?,
        None => String::new(),
    };

    let salt = encode_salt(&[DOMAIN, VERSION, &service, &account, &context]);
    let mut key = [0_u8; DERIVED_BYTES];
    pbkdf2::<HmacSha256>(
        base_secret.as_bytes(),
        salt.as_bytes(),
        options.iterations,
        &mut key,
    )
    .expect("HMAC accepts keys of any length");

    Ok(DerivePasswordResult {
        password: build_password(&key, options.policy),
        algorithm: ALGORITHM,
        iterations: options.iterations,
        length: options.policy.length,
    })
}

#[cfg(feature = "wasm")]
#[wasm_bindgen(js_name = derivePassword)]
#[allow(clippy::too_many_arguments)]
pub fn derive_password_wasm(
    base_secret: &str,
    service: &str,
    account: Option<String>,
    context: Option<String>,
    iterations: u32,
    length: usize,
    lowercase: bool,
    uppercase: bool,
    digits: bool,
    symbols: bool,
) -> Result<String, JsValue> {
    let policy = PasswordPolicy {
        length,
        lowercase,
        uppercase,
        digits,
        symbols,
    };

    let mut options = DerivePasswordOptions::new(base_secret, service)
        .iterations(iterations)
        .policy(policy);

    if let Some(account) = account.as_deref() {
        options = options.account(account);
    }
    if let Some(context) = context.as_deref() {
        options = options.context(context);
    }

    derive_password(&options)
        .map(|result| result.password)
        .map_err(|error| JsValue::from_str(&error.to_string()))
}

fn validate_policy(policy: PasswordPolicy) -> Result<(), PassworderError> {
    if policy.length < MIN_PASSWORD_LENGTH {
        return Err(PassworderError::InvalidPasswordLength);
    }
    if !policy.lowercase && !policy.uppercase && !policy.digits && !policy.symbols {
        return Err(PassworderError::NoCharacterClass);
    }
    if policy.length < enabled_class_count(policy) {
        return Err(PassworderError::InvalidPasswordLength);
    }
    Ok(())
}

fn enabled_class_count(policy: PasswordPolicy) -> usize {
    [
        policy.lowercase,
        policy.uppercase,
        policy.digits,
        policy.symbols,
    ]
    .iter()
    .filter(|enabled| **enabled)
    .count()
}

fn encode_salt(parts: &[&str]) -> String {
    parts
        .iter()
        .map(|part| format!("{}:{}", part.as_bytes().len(), part))
        .collect::<Vec<_>>()
        .join("|")
}

fn build_password(bytes: &[u8; DERIVED_BYTES], policy: PasswordPolicy) -> String {
    let mut pools: Vec<&[u8]> = Vec::new();
    if policy.lowercase {
        pools.push(LOWER);
    }
    if policy.uppercase {
        pools.push(UPPER);
    }
    if policy.digits {
        pools.push(DIGITS);
    }
    if policy.symbols {
        pools.push(SYMBOLS);
    }

    let alphabet = pools.concat();
    let mut chars: Vec<u8> = Vec::with_capacity(policy.length);
    let mut offset = 0;

    for pool in pools {
        chars.push(pick(pool, bytes[offset]));
        offset += 1;
    }

    while chars.len() < policy.length {
        chars.push(pick(&alphabet, bytes[offset % bytes.len()]));
        offset += 1;
    }

    stable_shuffle(&mut chars, bytes);
    String::from_utf8(chars).expect("password alphabet is ASCII")
}

fn stable_shuffle(chars: &mut [u8], bytes: &[u8; DERIVED_BYTES]) {
    for i in (1..chars.len()).rev() {
        let j = bytes[(i + chars.len()) % bytes.len()] as usize % (i + 1);
        chars.swap(i, j);
    }
}

fn pick(pool: &[u8], byte: u8) -> u8 {
    pool[byte as usize % pool.len()]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_unicode_and_whitespace() {
        assert_eq!(
            normalize_input("  \u{ff21}  test\tvalue\n").unwrap(),
            "A test value"
        );
    }

    #[test]
    fn generates_mnemonic_from_injected_entropy() {
        let entropy = [0, 1, 2, 3, 4, 5];
        assert_eq!(
            generate_mnemonic_from_entropy(6, &entropy).unwrap(),
            "anchor apricot atlas bamboo beacon breeze"
        );
    }

    #[test]
    fn derives_stable_service_specific_password() {
        let result = derive_password(
            &DerivePasswordOptions::new("correct horse battery staple", "Example.com")
                .account("Alice")
                .iterations(10_000),
        )
        .unwrap();

        assert_eq!(result.algorithm, ALGORITHM);
        assert_eq!(result.iterations, 10_000);
        assert_eq!(result.length, 20);
        assert_eq!(result.password, "&iaQ9PM-+%K9cEu+Tpjf");
    }

    #[test]
    fn derives_from_any_language_sentence_base_secret() {
        let sentence = "我在春天的河边记住一把不会联网的钥匙。";
        let first = derive_password(
            &DerivePasswordOptions::new(sentence, "example.com")
                .account("alice")
                .iterations(10_000),
        )
        .unwrap();
        let second = derive_password(
            &DerivePasswordOptions::new(sentence, "example.com")
                .account("alice")
                .iterations(10_000),
        )
        .unwrap();
        let different_sentence = derive_password(
            &DerivePasswordOptions::new("我在秋天的山上记住另一把钥匙。", "example.com")
                .account("alice")
                .iterations(10_000),
        )
        .unwrap();

        assert_eq!(first.password, second.password);
        assert_ne!(first.password, different_sentence.password);
    }

    #[test]
    fn default_policy_meets_common_site_requirements() {
        let result = derive_password(
            &DerivePasswordOptions::new("correct horse battery staple", "Example.com")
                .account("Alice")
                .iterations(10_000),
        )
        .unwrap();

        assert_eq!(result.password.len(), 20);
        assert!(result.password.bytes().any(|byte| LOWER.contains(&byte)));
        assert!(result.password.bytes().any(|byte| UPPER.contains(&byte)));
        assert!(result.password.bytes().any(|byte| DIGITS.contains(&byte)));
        assert!(result.password.bytes().any(|byte| SYMBOLS.contains(&byte)));
    }

    #[test]
    fn different_service_produces_different_password() {
        let first = derive_password(
            &DerivePasswordOptions::new("correct horse battery staple", "example.com")
                .iterations(10_000),
        )
        .unwrap();
        let second = derive_password(
            &DerivePasswordOptions::new("correct horse battery staple", "other.example")
                .iterations(10_000),
        )
        .unwrap();

        assert_ne!(first.password, second.password);
    }

    #[test]
    fn account_and_context_participate_in_derivation() {
        let first = derive_password(
            &DerivePasswordOptions::new("correct horse battery staple", "example.com")
                .account("alice")
                .context("work")
                .iterations(10_000),
        )
        .unwrap();
        let second = derive_password(
            &DerivePasswordOptions::new("correct horse battery staple", "example.com")
                .account("alice")
                .context("personal")
                .iterations(10_000),
        )
        .unwrap();
        let third = derive_password(
            &DerivePasswordOptions::new("correct horse battery staple", "example.com")
                .account("bob")
                .context("work")
                .iterations(10_000),
        )
        .unwrap();

        assert_ne!(first.password, second.password);
        assert_ne!(first.password, third.password);
    }

    #[test]
    fn length_prefixed_salt_prevents_separator_collisions() {
        let first = derive_password(
            &DerivePasswordOptions::new("secret", "a:b")
                .account("c")
                .iterations(10_000),
        )
        .unwrap();
        let second = derive_password(
            &DerivePasswordOptions::new("secret", "a")
                .account("b:c")
                .iterations(10_000),
        )
        .unwrap();

        assert_ne!(first.password, second.password);
    }

    #[test]
    fn policy_can_disable_symbols() {
        let policy = PasswordPolicy {
            length: 16,
            symbols: false,
            ..PasswordPolicy::default()
        };
        let result = derive_password(
            &DerivePasswordOptions::new("base text", "service")
                .iterations(10_000)
                .policy(policy),
        )
        .unwrap();

        assert_eq!(result.password.len(), 16);
        assert!(result.password.bytes().all(|byte| {
            LOWER.contains(&byte) || UPPER.contains(&byte) || DIGITS.contains(&byte)
        }));
    }

    #[test]
    fn policy_can_match_short_legacy_sites() {
        let policy = PasswordPolicy {
            length: 12,
            symbols: false,
            ..PasswordPolicy::default()
        };
        let result = derive_password(
            &DerivePasswordOptions::new("base text", "legacy-service")
                .iterations(10_000)
                .policy(policy),
        )
        .unwrap();

        assert_eq!(result.password.len(), 12);
        assert!(result.password.bytes().any(|byte| LOWER.contains(&byte)));
        assert!(result.password.bytes().any(|byte| UPPER.contains(&byte)));
        assert!(result.password.bytes().any(|byte| DIGITS.contains(&byte)));
        assert!(!result.password.bytes().any(|byte| SYMBOLS.contains(&byte)));
    }

    #[test]
    fn rejects_weak_or_ambiguous_configuration() {
        assert_eq!(
            derive_password(&DerivePasswordOptions::new("base text", "service").iterations(9_999))
                .unwrap_err(),
            PassworderError::InvalidIterations
        );

        let policy = PasswordPolicy {
            lowercase: false,
            uppercase: false,
            digits: false,
            symbols: false,
            ..PasswordPolicy::default()
        };

        assert_eq!(
            derive_password(
                &DerivePasswordOptions::new("base text", "service")
                    .iterations(10_000)
                    .policy(policy)
            )
            .unwrap_err(),
            PassworderError::NoCharacterClass
        );
    }
}
