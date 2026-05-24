# 构建与加载

## 构建 Rust WASM

在仓库根目录执行：

```sh
rustup target add wasm32-unknown-unknown --toolchain stable-x86_64-pc-windows-gnu
cargo install wasm-bindgen-cli --version 0.2.105
cargo +stable-x86_64-pc-windows-gnu build --release --target wasm32-unknown-unknown --no-default-features --features wasm
wasm-bindgen target/wasm32-unknown-unknown/release/passworder_core.wasm --target web --out-dir extensions/chrome-edge/pkg --out-name passworder_core
```

如果不是 Windows，且默认 Rust 工具链可用，可以省略显式的
`+stable-x86_64-pc-windows-gnu`。

## 在 Edge 或 Chrome 中加载

1. 打开 `edge://extensions` 或 `chrome://extensions`。
2. 开启“开发人员模式”。
3. 点击“加载解压缩”。
4. 开发时选择 `extensions/chrome-edge`。
5. 使用 release 产物时，选择 `releases/passworder-chrome-edge-v版本号`。

Edge/Chrome 的“加载解压缩”不能直接选择 `.zip` 文件。`.zip` 用于分发，
实际加载时需要先解压，然后选择解压后的文件夹。

## 打包 release 产物

在仓库根目录执行：

```powershell
.\scripts\package-extension.ps1 -Version 0.3.0
```

将生成：

- `releases/passworder-chrome-edge-v0.3.0.zip`
- `releases/passworder-chrome-edge-v0.3.0/`

## 首次使用

1. 打开任意 HTTPS 登录页。
2. 点击 Passworder 插件图标。
3. 粘贴或生成基密码。基密码可以是 24 词助记词，也可以是一句中文、英文或
   任何语言的私密句子。
4. 设置解锁密码 / PIN。
5. 点击“加密保存并解锁”。
6. 确认插件识别到的网站身份。
7. 点击“生成并填充”。

加密后的基密码会保存到 `chrome.storage.local`。解锁后的明文基密码只保留
在 background service worker 内存中，直到超时、手动锁定、插件重载或浏览器
重启。

## 系统 PIN / 系统密码

普通 Chrome/Edge 插件不能直接调用 Windows PIN、Windows Hello、macOS Touch ID
或 Linux 桌面密码来解密插件本地保险库。当前版本使用插件内 6 位数字 PIN。

后续如果要接入系统级认证，需要增加以下方案之一：

- Native Messaging 本机助手：由插件调用本地程序，本地程序再调用系统认证。
- WebAuthn/Passkey：用平台认证器参与解锁流程，但需要重新设计保险库密钥封装。
