# Release Notes / 发布说明

## chrome-edge-v0.4.0

SeedPass rebrand and website-first record management.

SeedPass 品牌版本，加入以网站为核心的记录管理。

- Extension name changed to SeedPass.
- Popup and inline fill UI are bilingual, with Auto / 中文 / English language selection.
- Default language follows the browser language.
- Password input focus now shows matching saved records for the current website.
- Saved records can be searched and managed from the popup.
- Each record is bound to a website domain.
- Default generation mode is "Generate by website"; account label is only a note in this mode.
- Optional "Generate by account label" mode is available for special cases.
- Locked inline fill uses the local 6-digit PIN, then fills immediately after unlock.
- Documentation rewritten in Chinese and English for GitHub visitors.
- 插件名称改为 SeedPass。
- popup 和页面内填充界面支持中英双语，可选择自动 / 中文 / English。
- 默认语言跟随浏览器语言。
- 密码框聚焦时显示当前网站匹配的已保存记录。
- popup 中新增密码记录列表，可模糊搜索和管理。
- 每条记录都绑定网站域名。
- 默认按网站生成；在该模式下账号标识只是备注，不影响密码。
- 特殊场景可单独选择按账号标识生成。
- 锁定状态下可在页面内输入本地 6 位 PIN，解锁后立即填充。
- 面向 GitHub 访客重写中英双语文档。

## chrome-edge-v0.3.0

Inline fill suggestion and 6-digit PIN unlock.

页面内填充建议和 6 位 PIN 解锁。

- Shows a fill suggestion when a password input receives focus.
- If unlocked, click the suggestion to generate and fill the current website password.
- If locked, enter the 6-digit PIN in the inline panel; it unlocks and fills automatically.
- Popup setup and unlock were changed to 6 PIN boxes.
- New vault marker: `version: 2`, `unlock: six-digit-pin`.
- Documentation clarified that ordinary browser extensions cannot directly call system PIN / Windows Hello / Touch ID without Native Messaging or a redesigned WebAuthn flow.
- 密码输入框获得焦点时显示页面内填充建议。
- 已解锁时点击建议即可生成并填充当前网站密码。
- 未解锁时在页面内输入 6 位 PIN，输满后自动解锁并填充。
- popup 创建和解锁流程改为 6 个 PIN 输入框。
- 新保险库标记为 `version: 2`、`unlock: six-digit-pin`。
- 文档说明普通浏览器插件不能直接调用系统 PIN / Windows Hello / Touch ID，除非增加 Native Messaging 或重新设计 WebAuthn 流程。

## v0.2.0

Chinese native extension and seed phrase wording update.

中文原生插件与基密码语义更新。

- Chrome / Edge extension UI changed to Chinese wording.
- Seed phrase supports generated words, existing mnemonics, or private text in any language.
- Rust core added Chinese sentence seed tests.
- Docs changed to Chinese.
- Rebuilt Chrome / Edge WASM package and release assets.
- Chrome / Edge 插件界面改为中文文案。
- 基密码支持生成式词组、已有助记词，或任意语言私密文本。
- Rust 核心增加中文句子基密码测试。
- 文档改为中文。
- 重建 Chrome / Edge WASM 包和发布产物。

## v0.1.0

Initial MIT open-source Rust core release.

初始 MIT 开源 Rust 核心发布。

- Pure Rust deterministic password derivation core.
- PBKDF2-HMAC-SHA256 algorithm version `passworder-core:v1`.
- Supports generated seed phrase or user-provided text as the root secret.
- Supports website-based password generation and optional account/context fields.
- Default 20-character policy with lowercase, uppercase, digits, and symbols.
- Stable specification and test vectors.
- Outputs `rlib`, `staticlib`, and `cdylib`.
- 纯 Rust 确定性密码派生核心。
- PBKDF2-HMAC-SHA256 算法版本 `passworder-core:v1`。
- 支持生成式基密码或用户输入文本作为根秘密。
- 支持按网站生成密码，并提供可选账号和上下文字段。
- 默认 20 位密码，包含小写、大写、数字和符号。
- 提供稳定规范和测试向量。
- 输出 `rlib`、`staticlib` 和 `cdylib`。
