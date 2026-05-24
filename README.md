# Passworder Core

Passworder Core 是一个纯 Rust 离线确定性密码派生核心。它把“基密码”加上
网站/应用名称转换成固定密码。基密码可以是生成的多词助记词，也可以是用户
自己输入的一句话；中文、英文或任何语言文本都可以。

这个项目的核心目标是：不依赖联网同步，不保存每个网站的真实密码。用户只要
在任意设备上输入同一个基密码、同一个网站名和同一套策略，就能得到同一个
站点密码。

Chrome/Edge 插件实现位于 `extensions/chrome-edge`，通过 WebAssembly 调用
同一个 Rust 核心。

## 设计目标

- 纯 Rust 核心：核心算法不依赖 TypeScript 或 JavaScript 实现。
- 离线同步：基密码 + 网站身份即可复现站点密码。
- 多端可封装：桌面、服务器、树莓派、iOS、Android、WASM 前端都可以绑定。
- 轻量：无联网、无账号系统、无数据库。
- 规范稳定：算法、规范化、盐编码和测试向量都有文档。

## 基密码

基密码是所有站点密码的根。

可用形式：

- 生成的 24 词助记词。
- 用户已有的传统助记词。
- 一句足够长、私密、可记忆的话。
- 中文、英文或任何语言文本。

建议使用长句或生成助记词，不建议使用短 PIN、生日、常见诗句、公开名言或
能被别人猜到的文本。

## Rust 用法

```rust
use passworder_core::{derive_password, DerivePasswordOptions};

let result = derive_password(
    &DerivePasswordOptions::new("我在春天的河边记住一把不会联网的钥匙。", "github.com")
        .account("alice@example.com"),
)?;

println!("{}", result.password);
# Ok::<(), passworder_core::PassworderError>(())
```

生成传统多词助记词：

```rust
use passworder_core::generate_mnemonic;

let phrase = generate_mnemonic(24)?;
# Ok::<(), passworder_core::PassworderError>(())
```

默认密码策略生成 20 位密码，并保证至少包含一个小写字母、一个大写字母、
一个数字和一个符号。绝大多数现代网站的“大小写 + 数字 + 符号 + 最小长度”
规则可以直接满足。

如果遇到老旧网站，可以自定义策略：

```rust
use passworder_core::{derive_password, DerivePasswordOptions, PasswordPolicy};

let policy = PasswordPolicy {
    length: 16,
    symbols: false,
    ..PasswordPolicy::default()
};

let result = derive_password(
    &DerivePasswordOptions::new("correct horse battery staple", "legacy.example")
        .policy(policy),
)?;
# Ok::<(), passworder_core::PassworderError>(())
```

## 构建与测试

```sh
cargo test
cargo test --no-default-features --lib
cargo run --example derive
```

`--no-default-features --lib` 用于验证不依赖系统随机数的核心派生路径。

## 插件

Chrome/Edge 插件位于：

```text
extensions/chrome-edge
```

打包 release：

```powershell
.\scripts\package-extension.ps1 -Version 0.2.0
```

Edge/Chrome 加载方式：

1. 打开 `edge://extensions` 或 `chrome://extensions`。
2. 开启“开发人员模式”。
3. 点击“加载解压缩”。
4. 选择 `releases/passworder-chrome-edge-v0.3.0`。

注意：浏览器不能直接通过“加载解压缩”选择 `.zip`，需要选择解压后的目录。

## 安全说明

基密码是所有派生密码的根。请私密保存并备份。如果基密码很弱，所有派生密码
都会变弱。

本项目是确定性派生工具。基密码、网站身份、账号标识、上下文、算法版本、
迭代次数或密码策略发生变化，都会改变最终密码。
