# Passworder Core Specification

## Algorithm Version

`passworder-core:v1:PBKDF2-HMAC-SHA256`

This version string is part of the public contract. Any incompatible change to
normalization, salt encoding, KDF parameters, or password encoding requires a
new algorithm version.

## Runtime Requirements

Implementations need only these primitives:

- UTF-8 text encoding.
- Unicode `NFKC` string normalization.
- Secure random bytes for mnemonic generation.
- PBKDF2-HMAC-SHA-256.

No network, storage, account system, or server synchronization is required.

## Inputs

- `base_secret`: user root secret. May be a generated mnemonic, user-entered
  mnemonic, or any text.
- `service`: website/app identifier.
- `account`: optional account identifier.
- `context`: optional namespace.
- `iterations`: PBKDF2 iteration count. Default `210000`, minimum `10000`.
- `policy`: output length and enabled character classes.

Generated mnemonic-like base secrets default to 24 words from the built-in
64-word list.

## Normalization

All text inputs are normalized with Unicode `NFKC`, trimmed, and internal
whitespace is collapsed to one ASCII space. `service` and `account` are then
lowercased.

Empty normalized `base_secret` and `service` are invalid.

## Salt

The PBKDF2 salt is a UTF-8 encoded length-prefixed sequence:

```text
<len>:passworder-core|<len>:v1|<len>:<service>|<len>:<account>|<len>:<context>
```

Lengths count UTF-8 bytes after normalization. Length prefixes avoid collisions
when service, account, or context contain separator characters.

For the test vector below, normalized salt text is:

```text
15:passworder-core|2:v1|11:example.com|5:alice|0:
```

## Key Derivation

- KDF: PBKDF2
- PRF: HMAC-SHA-256
- Output bytes: 64

## Password Encoding

Default output length: `20`.

The default policy enables lowercase, uppercase, digits, and symbols. The
encoder guarantees at least one character from every enabled class before
filling the rest of the password, so the default output satisfies common site
rules requiring uppercase, lowercase, number, symbol, and minimum length.

Default character pools:

- Lowercase: `abcdefghijkmnopqrstuvwxyz`
- Uppercase: `ABCDEFGHJKLMNPQRSTUVWXYZ`
- Digits: `23456789`
- Symbols: `!@#$%^&*_-+=?`

Ambiguous characters such as `0`, `1`, `I`, `l`, and `O` are excluded by
default.

The encoder first picks one character from every enabled pool to satisfy the
policy, then fills the remaining length from the concatenated enabled pools.
The resulting array is deterministically shuffled using the derived bytes.

Compatibility guidance:

- Use the default 20-character policy for most sites.
- Disable `symbols` for legacy sites that reject punctuation.
- Reduce `length` only when a site has a maximum password length. The minimum
  accepted length is 8.
- Changing policy changes the derived password, so frontends should store or
  let users remember per-site policy overrides if they are needed.

## Test Vector

Inputs:

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

## API Surface

The reference Rust crate exports:

- `derive_password(options)`
- `generate_mnemonic(words)`
- `generate_mnemonic_from_entropy(words, entropy)`
- `normalize_input(value)`
- `DerivePasswordOptions`
- `DerivePasswordResult`
- `PasswordPolicy`
- `PassworderError`
- `ALGORITHM`

Frontends should treat the returned password as sensitive and avoid logging,
analytics, crash reporting, or persistent storage unless explicitly requested
by the user.
