# Passworder Core Spec

[中文](SPEC.md) | English

## Algorithm Version

```text
passworder-core:v1:PBKDF2-HMAC-SHA256
```

The version string is a public compatibility contract. If any incompatible change is made to normalization, salt encoding, KDF parameters, or password encoding, the algorithm version MUST be bumped.

## Runtime Requirements

An implementation only needs the following primitives:

- UTF‑8 text encoding.
- Unicode `NFKC` string normalization.
- Cryptographically secure RNG (only required for mnemonic generation).
- PBKDF2‑HMAC‑SHA‑256.

No network, server accounts, databases, or cloud sync are required.

## Inputs

- `base_secret`: the user’s root secret (base secret). It can be a generated mnemonic, a user‑provided mnemonic, a memorable sentence, or any text in any language.
- `service`: website/app identity.
- `account`: optional account label to distinguish multiple accounts under the same service.
- `context`: optional namespace such as `work` or `personal`.
- `iterations`: PBKDF2 iteration count. Default `210000`, minimum `10000`.
- `policy`: output password length and character-set policy.

The generated mnemonic uses a built-in 64‑word list to produce 24 words by default. Users can also skip the word list and directly use a sufficiently long, private, memorable sentence (Chinese, English, or any language). A sentence is treated as a normal `base_secret` and goes through the same normalization and derivation pipeline.

## Text Normalization

All text inputs are normalized with Unicode `NFKC`, then trimmed, and internal consecutive whitespace is collapsed into a single ASCII space. `service` and `account` are lowercased after this step.

The normalized `base_secret` and `service` MUST NOT be empty.

## Salt Encoding

The PBKDF2 salt is a UTF‑8 encoded length‑prefixed sequence:

```text
<len>:passworder-core|<len>:v1|<len>:<service>|<len>:<account>|<len>:<context>
```

`len` is the UTF‑8 byte length of the normalized field. Length prefixes prevent collisions when a field contains separator characters.

The normalized salt text from the test vector:

```text
15:passworder-core|2:v1|11:example.com|5:alice|0:
```

## Key Derivation

- KDF: PBKDF2
- PRF: HMAC‑SHA‑256
- Derived bytes: 64

## Password Encoding

Default output length: `20`.

The default policy enables lowercase, uppercase, digits, and symbols. The encoder first picks at least one character from every enabled pool, then fills the remaining length from all enabled pools, and finally performs a deterministic shuffle using derived bytes. This typically satisfies modern “uppercase + lowercase + digit + symbol + minimum length” rules.

Default character pools:

- Lowercase: `abcdefghijkmnopqrstuvwxyz`
- Uppercase: `ABCDEFGHJKLMNPQRSTUVWXYZ`
- Digits: `23456789`
- Symbols: `!@#$%^&*_-+=?`

Ambiguous characters such as `0`, `1`, `I`, `l`, and `O` are excluded by default.

Compatibility guidance:

- Use the default 20‑char policy for most sites.
- Disable `symbols` for legacy sites that reject punctuation.
- Only reduce `length` when a site has a strict maximum length. Minimum allowed length is 8.
- Policy changes change the derived password, so frontends should persist per-site overrides.

## Test Vector

Input:

```json
{
  "base_secret": "correct horse battery staple",
  "service": "Example.com",
  "account": "Alice",
  "iterations": 10000
}
```

Expected password:

```text
&iaQ9PM-+%K9cEu+Tpjf
```

Chinese (or any language) sentences MUST be supported as normal `base_secret`, for example:

```text
我在春天的河边记住一把不会联网的钥匙。
```

The same sentence + the same service + the same account + the same policy MUST deterministically produce the same password; different sentences MUST produce different passwords.

## Rust API

See the Rust crate exports:

- `derive_password(options)`
- `generate_mnemonic(words)`
- `generate_mnemonic_from_entropy(words, entropy)`
- `normalize_input(value)`
- `DerivePasswordOptions`
- `DerivePasswordResult`
- `PasswordPolicy`
- `PassworderError`
- `ALGORITHM`

Frontends should treat derived passwords as sensitive data. Unless the user explicitly requests it, do not log them, upload analytics, write them to crash reports, or store them long-term.
