# Build and Load / 构建与加载

## Build Rust WASM / 构建 Rust WASM

Run from the repository root:

在仓库根目录执行：

```powershell
rustup target add wasm32-unknown-unknown --toolchain stable-x86_64-pc-windows-gnu
cargo install wasm-bindgen-cli --version 0.2.105
cargo +stable-x86_64-pc-windows-gnu build --release --target wasm32-unknown-unknown --no-default-features --features wasm
wasm-bindgen target/wasm32-unknown-unknown/release/passworder_core.wasm --target web --out-dir extensions/chrome-edge/pkg --out-name passworder_core
```

On non-Windows systems, you can usually omit `+stable-x86_64-pc-windows-gnu` if the default stable toolchain is available.

在非 Windows 系统上，如果默认 stable 工具链可用，通常可以省略 `+stable-x86_64-pc-windows-gnu`。

## Load in Edge or Chrome / 在 Edge 或 Chrome 中加载

1. Open `edge://extensions` or `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. For development, choose `extensions/chrome-edge`.
5. For a release build, choose `releases/passworder-chrome-edge-v0.4.0`.

1. 打开 `edge://extensions` 或 `chrome://extensions`。
2. 开启“开发人员模式”。
3. 点击“加载解压缩”。
4. 开发时选择 `extensions/chrome-edge`。
5. 使用发布版时选择 `releases/passworder-chrome-edge-v0.4.0`。

Edge / Chrome cannot load the `.zip` directly as an unpacked extension. The zip is for distribution; the browser needs the extracted folder.

Edge / Chrome 的“加载解压缩”不能直接选择 `.zip`。zip 用于分发，浏览器需要选择解压后的文件夹。

## Package Release / 打包发布版

```powershell
.\scripts\package-extension.ps1 -Version 0.4.0
```

Outputs:

生成：

- `releases/passworder-chrome-edge-v0.4.0.zip`
- `releases/passworder-chrome-edge-v0.4.0/`

## First Use / 首次使用

1. Open any HTTPS login page.
2. Click the SeedPass extension icon.
3. Enter or paste a strong seed phrase. It can be generated words, an existing mnemonic, or a private sentence in any language.
4. Set a 6-digit local PIN.
5. Save and unlock.
6. Focus a password input on the page.
7. Choose a saved record or add a new one.

1. 打开任意 HTTPS 登录页。
2. 点击 SeedPass 插件图标。
3. 输入或粘贴一个足够强的基密码。它可以是生成的词组、已有助记词，或任意语言的私密句子。
4. 设置 6 位本地 PIN。
5. 保存并解锁。
6. 点击页面里的密码框。
7. 选择已有记录，或添加新记录。

## System PIN Boundary / 系统 PIN 边界

Ordinary Chrome / Edge extensions cannot directly call Windows PIN, Windows Hello, macOS Touch ID, or Linux desktop password prompts. SeedPass v0.4 uses an extension-local 6-digit PIN.

普通 Chrome / Edge 插件不能直接调用 Windows PIN、Windows Hello、macOS Touch ID 或 Linux 桌面密码框。SeedPass v0.4 使用插件内的本地 6 位 PIN。

Future system authentication would require Native Messaging or a redesigned WebAuthn / Passkey flow.

未来如果要接入系统级认证，需要 Native Messaging 本机助手，或重新设计 WebAuthn / Passkey 解锁流程。
