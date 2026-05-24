# SeedPass / Passworder Core

[中文](README.md) | English

SeedPass is the browser extension product name; `passworder-core` is the Rust crate name kept for compatibility.

Passworder Core is a pure-Rust offline deterministic password derivation core. It combines a strong “base secret” (seed phrase) with your website/app identity (and optional inputs) to produce a stable, reproducible site password. The goals are:

- No cloud sync and no account system required.
- No need to store a per-site “real password” (only minimal derivation settings, or nothing at all).
- On any device, the same base secret + the same site identity + the same policy yields the same password.

The Chrome/Edge extension lives in `extensions/chrome-edge` and calls the same Rust core via WebAssembly.

## Quick Start

### Use the SeedPass extension

- Extension overview: `extensions/chrome-edge/README.md` (Chinese) / `extensions/chrome-edge/README.en.md`
- Build & load: `extensions/chrome-edge/BUILD.md` (Chinese) / `extensions/chrome-edge/BUILD.en.md`

Default extension behavior:

- Passwords are generated from the current website identity; account label and note are only for organization.
- If you really need the account label to participate, a record can switch to “generate by account label only”.
- Focusing a password field shows an inline suggestion; if locked, enter the 6‑digit PIN and SeedPass fills after unlocking.
- Default policy is 20 characters with lowercase, uppercase, digits, and symbols.

### Use it from Rust

```rust
use passworder_core::{derive_password, DerivePasswordOptions};

let result = derive_password(
    &DerivePasswordOptions::new("I keep an offline key by the spring river.", "github.com")
        .account("alice@example.com"),
)?;

println!("{}", result.password);
# Ok::<(), passworder_core::PassworderError>(())
```

Generate a mnemonic base secret:

```rust
use passworder_core::generate_mnemonic;

let phrase = generate_mnemonic(24)?;
# Ok::<(), passworder_core::PassworderError>(())
```

Customize the policy for legacy sites (e.g. disable symbols):

```rust
use passworder_core::{derive_password, DerivePasswordOptions, PasswordPolicy};

let policy = PasswordPolicy {
    length: 16,
    symbols: false,
    ..PasswordPolicy::default()
};

let result = derive_password(
    &DerivePasswordOptions::new("correct horse battery staple", "legacy.example")
        .policy(policy),
)?;
# Ok::<(), passworder_core::PassworderError>(())
```

## Docs

- Spec (algorithm version, normalization, salt encoding, test vectors): [SPEC.en.md](SPEC.en.md) (Chinese: [SPEC.md](SPEC.md))
- Release notes (primarily extension versions): [RELEASE.en.md](RELEASE.en.md) (Chinese: [RELEASE.md](RELEASE.md))

## Base Secret Guidance

Your base secret is the root of every derived password. Recommended:

- A generated 24‑word mnemonic, or
- A long, private, memorable sentence (any language works).

Avoid short PINs, birthdays, common poems/quotes, or anything that can be guessed.

## Build & Test

```sh
cargo test
cargo test --no-default-features --lib
cargo run --example derive
```

`--no-default-features --lib` helps verify the core derivation path does not depend on system RNG.

## Security Boundaries

- This is a deterministic derivation tool: any change in `base secret / site identity / account / context / algorithm version / iterations / policy` changes the output password.
- Treat derived passwords as sensitive: do not log, upload analytics, or store them long-term unless the user explicitly requests it.
