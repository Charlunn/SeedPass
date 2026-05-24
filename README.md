# SeedPass / Passworder Core

中文 | [English](README.en.md)

SeedPass 是浏览器插件产品名；`passworder-core` 是保持兼容的 Rust crate 名。

Passworder Core 是一个纯 Rust 的离线确定性密码派生核心：把“基密码”与
网站/应用标识等输入组合，派生出稳定可复现的站点密码。它的目标是：

- 不依赖联网同步、不需要账号系统。
- 不保存每个网站的“真实密码”，只保存必要的派生配置（或完全不保存）。
- 任意设备上只要输入同一个基密码 + 同一个站点身份 + 同一套策略，就能得到同一个站点密码。

Chrome/Edge 插件位于 `extensions/chrome-edge`，通过 WebAssembly 调用同一个 Rust 核心。

## 快速开始

### 使用 SeedPass 插件

- 插件说明：`extensions/chrome-edge/README.md`
- 构建/加载：`extensions/chrome-edge/BUILD.md`

默认行为（插件端）：

- 以“当前网站身份”生成密码；账号标识和备注只用于管理，不影响密码。
- 如确实需要账号标识参与派生，可把单条记录切换为“仅按账号标识生成”。
- 密码框聚焦时显示页面内建议；已解锁可直接填充，未解锁输入 6 位 PIN 后填充。
- 默认密码策略为 20 位，包含小写、大写、数字和符号。

### 在 Rust 中调用

```rust
use passworder_core::{derive_password, DerivePasswordOptions};

let result = derive_password(
    &DerivePasswordOptions::new("我在春天的河边记住一把不会联网的钥匙。", "github.com")
        .account("alice@example.com"),
)?;

println!("{}", result.password);
# Ok::<(), passworder_core::PassworderError>(())
```

生成助记词式基密码：

```rust
use passworder_core::generate_mnemonic;

let phrase = generate_mnemonic(24)?;
# Ok::<(), passworder_core::PassworderError>(())
```

自定义策略以适配老旧网站（例如禁用符号）：

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

## 文档

- 规范（算法版本、规范化、salt 编码、测试向量）：`SPEC.md`（[English](SPEC.en.md)）
- 发布说明（主要为插件版本变更）：`RELEASE.md`（[English](RELEASE.en.md)）

## 基密码建议

基密码是所有站点密码的根，建议使用：

- 插件生成的 24 词助记词，或
- 一句足够长、私密、可记忆的话（中文、英文或任何语言均可）。

不建议使用短 PIN、生日、常见诗句、公开名言等容易被猜到的文本。

## 构建与测试

```sh
cargo test
cargo test --no-default-features --lib
cargo run --example derive
```

`--no-default-features --lib` 用于验证核心派生路径不依赖系统随机数（便于嵌入和确定性验证）。

## 安全边界

- 本项目是确定性派生工具：`基密码 / 站点身份 / 账号标识 / 上下文 / 算法版本 / 迭代次数 / 策略` 任一变化都会改变最终密码。
- 请把生成出的站点密码视为敏感数据：除非用户明确要求，不要记录日志、上报分析或长期存储。
