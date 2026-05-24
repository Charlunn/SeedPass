# Release Notes

## v0.1.0

Initial open-source Rust core release under the MIT license.

Included:

- Pure Rust deterministic password derivation core.
- PBKDF2-HMAC-SHA256 algorithm version `passworder-core:v1`.
- Generated or user-provided mnemonic/text base secret support.
- Per-service password derivation with optional account and context fields.
- Default 20-character policy with lowercase, uppercase, digit, and symbol
  requirements.
- Configurable password policy for legacy site restrictions.
- Mnemonic-like base secret generation.
- Stable specification and test vector.
- `rlib`, `staticlib`, and `cdylib` crate outputs for downstream bindings.
