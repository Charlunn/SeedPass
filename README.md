# SeedPass

一个基密码，离线复现所有网站密码。  
One seed phrase, offline passwords for every site.

SeedPass is an offline deterministic password manager. You keep one strong seed phrase locally; SeedPass combines it with the current website name and generates a strong site password without cloud sync, accounts, or a password database.

SeedPass 是一个离线确定性密码管理器。你只需要保存一个足够强的基密码/助记词，SeedPass 会把它和当前网站名组合，离线生成该网站的强密码。不需要云同步，不需要注册账号，也不保存每个网站的真实密码。

## Why / 为什么

- No cloud vault: there is no server-side password database to leak.
- Same input, same password: enter the same seed phrase and website name on another device to recover the same password.
- Rust core: the password algorithm is implemented in Rust and reused by the browser extension through WebAssembly.
- Website-first: by default, passwords are generated from the detected domain, not from a user note.
- User control: for special cases, a saved record can choose to generate by a custom account label instead of the domain.
- 无云端保险库：没有服务器密码库可泄露。
- 可复现：在另一台设备输入同一个基密码和网站名，即可得到同一个密码。
- Rust 核心：密码算法由 Rust 实现，浏览器插件通过 WebAssembly 调用同一套核心。
- 默认按网站生成：默认使用插件检测到的网站域名生成密码，账号备注不影响密码。
- 可手动切换：少数特殊场景下，可把某条记录改为“按账号标识生成”。

## Chrome / Edge Extension

Current extension release: `chrome-edge-v0.4.0`.

当前插件版本：`chrome-edge-v0.4.0`。

- Edge and Chrome Manifest V3 extension.
- Inline fill suggestion appears when a password box is focused.
- If unlocked, click a saved record to fill immediately.
- If locked, enter the local 6-digit PIN; SeedPass unlocks and fills after the sixth digit.
- Bilingual UI, with Auto / 中文 / English language switch. Auto follows the browser language.
- Saved password records with fuzzy search and per-record management.
- Each record is bound to a website domain, while generation mode can be either website-based or account-label-based.
- 支持 Edge / Chrome 的 Manifest V3 插件。
- 焦点进入密码框时，页面内出现填充建议。
- 已解锁时，点击已保存记录即可填充。
- 未解锁时，输入本地 6 位 PIN，输满后自动解锁并填充。
- 中英双语界面，可选择自动 / 中文 / English；自动模式跟随浏览器语言。
- 密码记录列表支持模糊搜索和单条管理。
- 每条记录都绑定网站域名；默认按网站生成，也可单独改为按账号标识生成。

## Password Records / 密码记录

SeedPass v0.4 separates "how you find a password" from "what generates the password".

SeedPass v0.4 把“怎么找到这条密码”和“什么参与生成密码”分开。

- Website: always saved, always used to show matching records on that site.
- Account label: a human note such as `main`, `work`, or an email address.
- Mode: `Generate by website` or `Generate by account label`.
- Default mode: website. In this mode, account label is only a note and does not change the password.
- 网站名：始终保存，用来在进入对应网站时显示匹配记录。
- 账号标识：给人看的备注，例如 `main`、`work` 或邮箱。
- 生成方式：按网站生成，或按账号标识生成。
- 默认方式：按网站生成。此时账号标识只是备注，不影响密码。

If you create a record on `github.com` and keep the default mode, recovering it on another device requires the same seed phrase and `github.com`. If you explicitly choose account-label mode, recovering it requires the same seed phrase and the same account label.

如果你在 `github.com` 创建记录并保持默认模式，换设备时只需要同一个基密码和 `github.com`。如果你明确选择“按账号标识生成”，换设备时需要同一个基密码和同一个账号标识。

## Default Password Policy / 默认密码规则

The default generated password is designed to satisfy most modern website rules:

- 20 characters.
- Includes lowercase letters.
- Includes uppercase letters.
- Includes digits.
- Includes symbols.
- 默认 20 位。
- 包含小写字母。
- 包含大写字母。
- 包含数字。
- 包含符号。

For old or strict websites, each saved record can override length and character groups. These settings affect the generated result, so keep them consistent when reproducing the same password elsewhere.

少数老旧或限制很奇怪的网站，可以在单条记录里调整位数和字符类型。这些设置会影响最终密码，因此换设备复现时也要保持一致。

## Quick Start / 快速开始

Load the unpacked release in Edge or Chrome:

1. Open `edge://extensions` or `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Choose `releases/passworder-chrome-edge-v0.4.0`.
5. Open a login page, focus the password box, and use the SeedPass suggestion.

在 Edge 或 Chrome 中加载解压版：

1. 打开 `edge://extensions` 或 `chrome://extensions`。
2. 开启“开发人员模式”。
3. 点击“加载解压缩”。
4. 选择 `releases/passworder-chrome-edge-v0.4.0`。
5. 打开登录页，点击密码框，使用 SeedPass 填充建议。

Build from source:

```powershell
cargo +stable-x86_64-pc-windows-gnu test
cargo +stable-x86_64-pc-windows-gnu build --release --target wasm32-unknown-unknown --no-default-features --features wasm
wasm-bindgen target/wasm32-unknown-unknown/release/passworder_core.wasm --target web --out-dir extensions/chrome-edge/pkg --out-name passworder_core
.\scripts\package-extension.ps1 -Version 0.4.0
```

## Rust Core / Rust 核心

The crate name is still `passworder-core` for compatibility. The product name is SeedPass.

为了兼容已有代码，Rust crate 仍叫 `passworder-core`；产品名称是 SeedPass。

```rust
use passworder_core::{derive_password, DerivePasswordOptions};

let result = derive_password(
    &DerivePasswordOptions::new("my private seed phrase", "github.com"),
)?;

println!("{}", result.password);
# Ok::<(), passworder_core::PassworderError>(())
```

Generate a seed phrase:

```rust
use passworder_core::generate_mnemonic;

let phrase = generate_mnemonic(24)?;
# Ok::<(), passworder_core::PassworderError>(())
```

## Security Model / 安全模型

- The seed phrase is encrypted in `chrome.storage.local` with AES-GCM.
- The unlock PIN is local to the extension. It is not a website password.
- When unlocked, the plaintext seed phrase only lives in the extension background service worker memory.
- The content script never receives the seed phrase.
- Generated passwords are sent to the page only after user action.
- Ordinary browser extensions cannot directly call Windows Hello, Windows PIN, macOS Touch ID, or Linux desktop password prompts. Native system authentication would require a Native Messaging helper or a redesigned WebAuthn/Passkey flow.
- 基密码使用 AES-GCM 加密保存到 `chrome.storage.local`。
- 解锁 PIN 只用于本地插件解锁，不是网站密码。
- 解锁后，明文基密码只短时间存在于插件 background service worker 内存中。
- content script 永远拿不到基密码。
- 只有用户主动点击后，生成密码才会发送到页面。
- 普通浏览器插件不能直接调用 Windows Hello、Windows PIN、macOS Touch ID 或 Linux 桌面密码框。若要接入系统级认证，需要 Native Messaging 本机助手或重新设计 WebAuthn/Passkey 解锁流程。

## Roadmap / 路线图

- Better import/export for saved website settings.
- Native app wrappers that reuse the same Rust core.
- Optional Native Messaging helper for platform authentication.
- More test vectors for cross-language implementations.
- 更完善的网站设置导入/导出。
- 使用同一 Rust 核心封装桌面/移动端应用。
- 可选 Native Messaging 本机助手，用于系统级认证。
- 更多跨语言实现测试向量。

## License / 许可证

MIT
