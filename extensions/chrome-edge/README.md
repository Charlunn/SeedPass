# SeedPass Chrome / Edge Extension

SeedPass 的 Edge / Chrome 插件前端。插件本身不重新实现密码算法，而是调用 Rust 核心编译出的 WebAssembly。

This is the Edge / Chrome extension frontend for SeedPass. The extension does not implement a second password algorithm; it calls the Rust core compiled to WebAssembly.

## What It Does / 它能做什么

- Detects the current website domain, such as `github.com`.
- Shows a fill suggestion when a password input is focused.
- Saves website-bound password records for quick reuse.
- Generates passwords offline from the encrypted seed phrase and the selected record.
- Supports bilingual UI: Auto / 中文 / English.
- Uses a 6-digit local PIN to unlock the encrypted seed phrase for a short session.
- 自动识别当前网站域名，例如 `github.com`。
- 密码框获得焦点时，在页面内显示填充建议。
- 保存与网站绑定的密码记录，方便下次选择。
- 使用加密保存的基密码和所选记录离线生成密码。
- 支持中英双语界面：自动 / 中文 / English。
- 使用本地 6 位 PIN 短时间解锁加密基密码。

## User Flow / 使用流程

1. Open a login page.
2. Click the password input.
3. SeedPass shows saved records for the current website.
4. If SeedPass is unlocked, click one record to fill.
5. If SeedPass is locked, enter the 6-digit PIN; after the sixth digit it unlocks and fills.

1. 打开登录页。
2. 点击密码输入框。
3. SeedPass 显示当前网站已保存的记录。
4. 如果已解锁，点击记录即可填充。
5. 如果未解锁，输入 6 位 PIN；输满后自动解锁并填充。

## Record Model / 记录规则

Each saved record has:

- Website: detected domain, always saved and used for matching.
- Account label: optional text for display and search.
- Note: optional reminder.
- Generation mode: website or account label.
- Password policy: length and character groups.

每条记录包含：

- 网站名：插件检测到的域名，始终保存，用于进入网站时匹配。
- 账号标识：可选文字，用于显示和搜索。
- 备注：可选提醒。
- 生成方式：按网站生成，或按账号标识生成。
- 密码规则：位数和字符类型。

Default behavior:

- If no account label is entered, the website is also shown as the label.
- If an account label is entered but mode stays "Generate by website", the label is only a remark and does not affect the password.
- Only when mode is changed to "Generate by account label" does the account label affect the generated password.
- The website is still bound to the record even in account-label mode, so SeedPass can show it on the right site.

默认行为：

- 不填写账号标识时，网站名本身就是这条记录的标识。
- 填写了账号标识但仍选择“按网站生成”时，账号标识只作为备注，不影响密码。
- 只有明确改为“按账号标识生成”时，账号标识才会影响生成结果。
- 即使选择按账号标识生成，网站名也仍然绑定在记录上，用来在对应网站显示。

## Architecture / 架构

```text
Chrome / Edge Manifest V3 extension
├─ popup
│  ├─ setup and unlock
│  ├─ current website records
│  ├─ all records with fuzzy search
│  └─ per-record editing
├─ background service worker
│  ├─ encrypted seed vault
│  ├─ short unlock session
│  ├─ record storage
│  └─ Rust/WASM password generation
├─ content script
│  ├─ password input detection
│  ├─ inline suggestion UI
│  └─ user-triggered fill
└─ pkg
   └─ passworder_core WebAssembly output
```

## Storage / 本地存储

Stored in `chrome.storage.local`:

- Encrypted seed vault: `seedpass:vault`.
- Saved records: `seedpass:records`.
- Language preference: `seedpass:language`.

保存到 `chrome.storage.local`：

- 加密基密码保险库：`seedpass:vault`。
- 已保存记录：`seedpass:records`。
- 语言偏好：`seedpass:language`。

Legacy keys from earlier Passworder versions are read where possible for migration compatibility.

旧版 Passworder 的存储键会尽量读取，以便兼容迁移。

## Build / 构建

See [BUILD.md](./BUILD.md).
