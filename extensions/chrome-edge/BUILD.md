# Build And Load

## Build Rust WASM

From the repository root:

```sh
rustup target add wasm32-unknown-unknown --toolchain stable-x86_64-pc-windows-gnu
cargo install wasm-bindgen-cli --version 0.2.105
cargo +stable-x86_64-pc-windows-gnu build --release --target wasm32-unknown-unknown --no-default-features --features wasm
wasm-bindgen target/wasm32-unknown-unknown/release/passworder_core.wasm --target web --out-dir extensions/chrome-edge/pkg --out-name passworder_core
```

On non-Windows systems, omit the explicit `+stable-x86_64-pc-windows-gnu` if
your default Rust toolchain works.

## Load In Chrome Or Edge

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable Developer mode.
3. Choose "Load unpacked".
4. Select `extensions/chrome-edge`.

## First Use

1. Open any HTTPS login page.
2. Click the Passworder extension icon.
3. Paste or generate a base mnemonic.
4. Set an unlock password/PIN.
5. Click "Encrypt and unlock".
6. Confirm the detected site identity.
7. Click "Generate and fill".

The encrypted mnemonic is stored in `chrome.storage.local`. The decrypted
mnemonic is kept only in the background service worker memory until timeout,
manual lock, extension reload, or browser restart.
