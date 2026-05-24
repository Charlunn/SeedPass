# Build & Load

[中文](BUILD.md) | English

## Build Rust WASM

Run at the repository root:

```sh
cargo install wasm-bindgen-cli --version 0.2.105
rustup target add wasm32-unknown-unknown
cargo build --release --target wasm32-unknown-unknown --no-default-features --features wasm
wasm-bindgen target/wasm32-unknown-unknown/release/passworder_core.wasm --target web --out-dir extensions/chrome-edge/pkg --out-name passworder_core
```

If you are on Windows and hit toolchain/target issues, you can try the GNU toolchain:

```sh
rustup toolchain install stable-x86_64-pc-windows-gnu
rustup target add wasm32-unknown-unknown --toolchain stable-x86_64-pc-windows-gnu
cargo +stable-x86_64-pc-windows-gnu build --release --target wasm32-unknown-unknown --no-default-features --features wasm
```

## Load in Edge or Chrome

1. Open `edge://extensions` or `chrome://extensions`.
2. Enable “Developer mode”.
3. Click “Load unpacked”.
4. For development, select `extensions/chrome-edge`.
5. For release artifacts, select `releases/passworder-chrome-edge-v<version>`.

Note: “Load unpacked” cannot select a `.zip` directly. The `.zip` is for distribution; you must unzip it and select the extracted directory.

## Package Release Artifacts

Run at the repository root (PowerShell):

```powershell
.\scripts\package-extension.ps1 -Version 0.5.3
```

This produces:

- `releases/passworder-chrome-edge-v0.5.3.zip`
- `releases/passworder-chrome-edge-v0.5.3/`

## First Use

1. Open any HTTPS login page.
2. Click the Passworder/SeedPass extension icon.
3. Paste or generate a base secret. It can be a 24‑word mnemonic or a private sentence in any language.
4. Set the local unlock password / PIN.
5. Click “encrypt, save, and unlock”.
6. Verify the detected website identity.
7. Click “generate & fill”.

The encrypted base secret is stored in `chrome.storage.local`. The plaintext base secret exists only in background service worker memory until timeout, manual lock, extension reload, or browser restart.

## System PIN / System Password

A normal Chrome/Edge extension cannot directly call Windows PIN, Windows Hello, macOS Touch ID, or Linux desktop authentication to decrypt the local vault. The current version uses an in-extension 6‑digit PIN.

To integrate system-level authentication in the future, you need one of:

- Native Messaging helper: the extension calls a local program which invokes system auth.
- WebAuthn/Passkey: use a platform authenticator for key wrapping, which requires redesigning the vault key scheme.
