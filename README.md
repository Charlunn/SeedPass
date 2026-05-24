# Passworder Core

Passworder Core is a pure Rust offline password derivation core. It turns a
base secret, such as a generated mnemonic or any user-provided text, plus a
service/app name into a deterministic password. No network sync is required:
the same inputs and versioned algorithm produce the same password on every
device.

The Rust crate remains the core implementation. iPhone apps, Android apps,
mini programs, browser extensions, CLIs, or desktop frontends can wrap the Rust
crate through native bindings, FFI, or WebAssembly.

An initial Chrome/Edge extension implementation lives in
`extensions/chrome-edge`. It wraps this Rust core through WebAssembly.

## Design Goals

- Pure Rust core: no TypeScript or JavaScript implementation is kept.
- Offline deterministic sync: users reproduce passwords from their base secret
  and service name, without accounts or servers.
- Portable targets: native desktop/server, Raspberry Pi, iOS, Android, and
  WebAssembly-capable runtimes.
- Lightweight package: small API surface, no runtime storage, no networking.
- Stable open specification: algorithm details are documented so bindings or
  other languages can verify against the same vectors.

## Rust Usage

```rust
use passworder_core::{derive_password, DerivePasswordOptions};

let result = derive_password(
    &DerivePasswordOptions::new("correct horse battery staple", "github.com")
        .account("alice@example.com"),
)?;

println!("{}", result.password);
# Ok::<(), passworder_core::PassworderError>(())
```

The default password policy generates a 20-character password and guarantees at
least one lowercase letter, uppercase letter, digit, and symbol. This matches
the common “uppercase + lowercase + number + symbol + minimum length” rule used
by most modern sites.

For stricter or older sites, pass a custom `PasswordPolicy`:

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

Generate a mnemonic-like base secret:

```rust
use passworder_core::generate_mnemonic;

let phrase = generate_mnemonic(24)?;
# Ok::<(), passworder_core::PassworderError>(())
```

## Build And Test

```sh
cargo test
cargo test --no-default-features --lib
cargo run --example derive
```

The `--no-default-features --lib` test verifies the core derivation path
without OS random generation. Use the default features for normal native
applications.

## Portability

Rust can be compiled for native and embedded-like targets, but each platform
still needs its own binding layer:

- iOS: static library plus Swift binding.
- Android: `cdylib` plus JNI or UniFFI.
- Browser/extensions: `wasm32-unknown-unknown` plus a JS/WASM wrapper.
- Raspberry Pi: native Linux ARM build.
- Node/Python/Go/etc.: FFI, WASM, or language-specific binding.

The crate exports `rlib`, `staticlib`, and `cdylib` so downstream projects can
choose the binding strategy.

## Security Notes

The base secret is the root of all derived passwords. Users must keep it
private and backed up. If the base secret is weak, all derived passwords are
weak. Prefer the default generated mnemonic length or another high-entropy
secret.

This library is deterministic by design. Changing the service, account,
context, algorithm version, policy, or iteration count changes the derived
password.
