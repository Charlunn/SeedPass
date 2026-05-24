# Release Notes

[中文](RELEASE.md) | English

## chrome-edge-v0.5.3

Single-screen interaction improvements across pages.

Includes:

- The fill page collapses low-frequency sections (password rules and saved record list) by default.
- Current site, account label, note, generation mode, and primary fill actions stay in the first screen by default.
- Generation mode, button groups, and lock actions are more compact.
- Create / unlock / fill pages are unified around “complete the main action on the first screen”.

## chrome-edge-v0.5.2

Compact layout improvements.

Includes:

- First-use instructions are collapsed by default to reduce create-page height.
- PIN setup and confirmation are shown side-by-side on the create page.
- Primary actions on the fill page use a compact button group.
- Reduced spacing and control heights so common actions fit in a single screen.

## chrome-edge-v0.5.1

First-use experience improvements.

Includes:

- Vault creation clearly distinguishes “I already have one” vs “generate a new one for me”.
- The “generate mnemonic” button is hidden by default to avoid implying it is required.
- Adds a first-use card explaining base secret, PIN, and the save flow.
- On first creation, focus defaults to the base secret input instead of the PIN input.

## chrome-edge-v0.5.0

UI unification release; password generation logic unchanged.

Includes:

- Unified popup colors, radius, spacing, buttons, inputs, PIN boxes, and record list styles.
- Unified visual style for inline fill overlay and popup.
- Better scaling and layout in narrow-width popups.
- More stable rendering for long site names, long notes, and multiple records.
- Keeps the record and generation-mode logic from `chrome-edge-v0.4.0`.

## chrome-edge-v0.4.0

SeedPass incremental release based on the `chrome-edge-v0.3.0` interaction model.

Includes:

- Extension name changed to SeedPass.
- Keeps the v0.3.0 popup and inline suggestion style.
- Default generation uses the website; account label and note do not affect passwords by default.
- Each record can switch to “generate by account label only”.
- Current site can save multiple records with simple search and switching.
- Password-field focus shows current-site records; unlocked fills directly, locked fills after 6-digit PIN unlock.

## chrome-edge-v0.3.0

Extension interaction upgrade.

Includes:

- When focus enters a password field, Passworder shows an inline fill suggestion.
- When unlocked, clicking the suggestion generates and fills immediately.
- When locked, the suggestion shows a 6‑digit PIN box; it attempts unlock on completion and fills on success.
- Popup create/unlock flow uses a 6‑digit numeric PIN box.
- New vault format uses `version: 2` and `unlock: six-digit-pin`.
- Docs clarify that system PIN/system passwords are not directly accessible from a normal extension; integrating Windows Hello / Touch ID / desktop auth would require Native Messaging or a WebAuthn/Passkey design.

## v0.2.0

Chinese-native extension copy and clarified base-secret semantics.

Includes:

- Chrome/Edge extension UI copy is rewritten as Chinese-native text.
- Extension manifest name/description/shortcuts/status/error messages/setup guidance are rewritten in Chinese.
- Base secret explicitly supports: generated mnemonics, user-provided mnemonics, or a single sentence/text in Chinese/English/any language.
- Rust core adds a Chinese-sentence test vector to make sentence base secrets a core contract.
- README, SPEC, extension README, and build instructions are rewritten in Chinese.
- Rebuilt Chrome/Edge WASM package and release artifacts.

## v0.1.0

Initial MIT open-source Rust core release.

Includes:

- Pure-Rust deterministic password derivation core.
- PBKDF2‑HMAC‑SHA256 algorithm version `passworder-core:v1`.
- Supports mnemonic base secrets or user-provided text.
- Supports deriving by website identity with optional account and context fields.
- Default 20‑character policy with lowercase, uppercase, digits, and symbols.
- Supports legacy-site password policies.
- Supports generating mnemonic base secrets.
- Provides stable spec and test vectors.
- Outputs `rlib`, `staticlib`, and `cdylib` for future bindings.
