# Chrome/Edge Extension Version

This folder documents the planned browser-extension frontend for Passworder
Core. The extension is not the core implementation; it is a wrapper around the
Rust core compiled to WebAssembly or exposed through another binding layer.

## Target UX

1. User opens a login page, for example `https://github.com/login`.
2. User clicks the extension icon or presses a shortcut.
3. Extension detects the current site identity, normally `github.com`.
4. If locked, user enters the local unlock password/PIN.
5. Extension decrypts the stored base mnemonic into background memory only.
6. Extension derives the site password from `base_secret + site + account`.
7. Content script fills the password input on the current page.
8. After the unlock timeout, the in-memory mnemonic is cleared.

## Architecture

```text
Chrome/Edge Manifest V3 extension
├─ popup UI
│  ├─ setup mnemonic
│  ├─ unlock vault
│  ├─ choose account/policy
│  └─ trigger fill
├─ background service worker
│  ├─ owns decrypted mnemonic while unlocked
│  ├─ enforces unlock timeout
│  ├─ calls Rust/WASM password core
│  └─ sends generated password to active tab on user action
├─ content script
│  ├─ finds password inputs
│  └─ fills password field
├─ storage.local
│  ├─ encrypted mnemonic vault
│  ├─ KDF parameters
│  ├─ per-site account labels
│  └─ per-site password policy overrides
└─ wasm package
   └─ compiled Passworder Core
```

## Vault Encryption

The mnemonic must never be stored in plaintext.

Recommended first version:

- KDF: PBKDF2-HMAC-SHA256.
- Iterations: `600000`.
- Salt: random 16 bytes.
- Cipher: AES-256-GCM.
- Nonce: random 12 bytes per encryption.
- Storage: `chrome.storage.local`.

Stored vault record:

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

Default session policy:

- Unlock duration: 15 minutes.
- Options: 5, 15, 30, or 60 minutes.
- Manual lock button required.
- Browser restart, extension reload, or service worker reset means locked.
- Decrypted mnemonic remains only in background memory.
- Content scripts never receive the mnemonic.

## Site Identity

The extension should derive from a stable site identity, not the full URL.

Default behavior:

- `https://github.com/login` -> `github.com`
- `https://accounts.google.com/...` -> `google.com` only if the user confirms
  this mapping.
- Subdomain handling must be visible and editable.

The extension should show the detected site before filling so users can catch
phishing or unexpected subdomains.

## Fill Policy

Autofill should require user action:

- Click extension button.
- Choose account if multiple exist.
- Press "Fill password" or use an explicit keyboard shortcut.

Avoid silent page-load autofill. It increases phishing risk and exposes
generated passwords to hostile pages.

## Per-Site Overrides

Most sites can use the default core policy:

- 20 characters.
- Lowercase, uppercase, digit, and symbol required.

Some sites need overrides:

- Disable symbols.
- Use a shorter maximum length.
- Use a site-specific account label.

Policy overrides are not secrets, but they affect deterministic output. They
must be stored per site so the same password can be reproduced later.

## Minimal Milestone

The first extension milestone should include:

- Manifest V3 Chrome/Edge scaffold.
- Rust core compiled to WASM.
- Popup setup/unlock flow.
- Encrypted mnemonic vault in `chrome.storage.local`.
- Current-tab site detection.
- Password generation and fill of the first visible password field.
- Manual lock and timeout lock.
