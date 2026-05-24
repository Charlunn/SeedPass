# SeedPass Chrome/Edge Extension

[中文](README.md) | English

SeedPass is an offline deterministic password extension. One strong base secret can reproduce passwords for websites without cloud sync.

This directory contains the Chrome/Edge Manifest V3 frontend for Passworder Core. The extension does not implement a second password algorithm; it calls the Rust core compiled to WebAssembly.

Related docs:

- Build & load: [BUILD.en.md](BUILD.en.md) (Chinese: [BUILD.md](BUILD.md))
- Core algorithm spec: [SPEC.en.md](../../SPEC.en.md) (Chinese: [SPEC.md](../../SPEC.md))

## Feature Overview

- Manifest V3 extension structure (Edge/Chrome).
- Chinese-native popup UI: create vault, unlock, fill, policy adjustments.
- AES‑GCM encrypted base-secret vault stored in `chrome.storage.local`.
- PBKDF2‑HMAC‑SHA256 used for unlock key derivation.
- Short unlock session held in background service worker memory with timeout lock.
- Stable website identity detection for the current tab.
- Per-site account labels and password policy overrides.
- Rust/WASM password derivation.
- Content script auto-fills password fields.
- Inline suggestion on password-field focus; when locked, a 6‑digit PIN is shown and unlock+fill happens automatically after completion.
- Multiple records per site with search and switching.
- Default derivation by website; account label/note are for organization; optional per-record “generate by account label only” mode.

## Typical Flow

1. Open a login page, e.g. `https://github.com/login`.
2. Click the extension icon or use the shortcut.
3. SeedPass detects a stable site identity, usually `github.com`.
4. If the vault is locked, enter the local unlock credential / PIN.
5. SeedPass decrypts the encrypted base secret into background memory.
6. By default, it derives the site password from `base secret + site identity`.
7. The content script fills the password input on the page.
8. After timeout, the plaintext base secret is cleared from memory.

If a record is set to “generate by account label only”, SeedPass uses that record’s account label instead of the website identity for derivation. The record is still managed and displayed under the bound website.

## Base Secret

The base secret can be:

- A generated 24‑word English mnemonic.
- A user-provided traditional mnemonic.
- A long, private, memorable sentence.
- Any text in any language.

The core applies Unicode `NFKC` normalization, trims leading/trailing whitespace, and collapses internal whitespace. Inputs must match exactly across devices to reproduce the same password.

## Architecture

```text
Chrome/Edge Manifest V3 extension
├─ popup UI
│  ├─ create vault
│  ├─ unlock vault
│  ├─ choose account/policy
│  └─ trigger fill
├─ background service worker
│  ├─ holds plaintext base secret during unlock window
│  ├─ enforces timeout lock
│  ├─ calls Rust/WASM core
│  └─ sends derived password to the active tab only after user action
├─ content script
│  ├─ find password inputs
│  └─ fill password
├─ storage.local
│  ├─ encrypted base-secret vault
│  ├─ KDF parameters
│  ├─ per-site account labels
│  └─ per-site policy overrides
└─ pkg
   └─ WASM artifacts of Passworder Core
```

## Vault Encryption

The base secret must not be stored in plaintext.

Current version:

- KDF: PBKDF2‑HMAC‑SHA256
- Iterations: `600000`
- Salt: random 16 bytes
- Cipher: AES‑256‑GCM
- Nonce: random 12 bytes per encryption
- Storage: `chrome.storage.local`

Vault record format:

```json
{
  "version": 1,
  "kdf": "PBKDF2-HMAC-SHA256",
  "iterations": 600000,
  "salt": "base64",
  "cipher": "AES-256-GCM",
  "nonce": "base64",
  "ciphertext": "base64"
}
```

## Unlock Session

Defaults:

- Default unlock duration: 15 minutes.
- Options: 5, 15, 30, 60 minutes.
- Unlock credential: in-extension 6‑digit numeric PIN.
- Manual “lock now” is supported.
- Browser restart, extension reload, or service worker eviction results in locked state.
- Plaintext base secret exists only in background memory.
- The content script never receives the base secret.

## System PIN / System Password Boundary

A normal Chrome/Edge extension cannot directly call Windows PIN, Windows Hello, macOS Touch ID, or Linux desktop authentication to decrypt a local vault. The current version uses an in-extension 6‑digit PIN.

To integrate system auth in the future, you’d need either Native Messaging (a local helper) or a WebAuthn/Passkey-based key-wrapping design. This cannot be achieved with only Manifest V3 scripts.

## Website Identity

SeedPass derives passwords from a stable website identity, not the full URL.

Default examples:

- `https://github.com/login` -> `github.com`
- `https://login.example.co.uk` -> `example.co.uk`

SeedPass displays the detected identity. Verify it before filling to reduce phishing and abnormal subdomain risks.

## Fill Policy

Filling requires explicit user action:

- Click the extension button.
- Select an account label (when multiple records exist).
- Click “generate & fill” or use an explicit shortcut.

SeedPass does not silently fill on page load to avoid “no-notice” phishing triggers.

## Per-site Policy Overrides

The core default fits most sites:

- 20 characters
- lowercase + uppercase + digits + symbols

Some sites may require overrides:

- Disable symbols
- Lower maximum length
- Use a specific account label

Policy overrides are not secrets, but they affect deterministic output and must be saved per site.
