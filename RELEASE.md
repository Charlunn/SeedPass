# 发布说明

## chrome-edge-v0.4.0

SeedPass 增量版，基于 `chrome-edge-v0.3.0` 的交互继续添加记录管理。

SeedPass incremental release based on the `chrome-edge-v0.3.0` interaction model.

包含：

- 插件名称改为 SeedPass。
- 保留 0.3.0 的 popup 和页面内建议风格。
- 默认按网站生成密码；账号标识和备注不再默认影响密码。
- 单条记录可切换为“仅按账号标识生成”。
- 当前网站支持保存多条记录，并可按账号标识/备注搜索和切换。
- 密码框聚焦时显示当前网站记录；已解锁直接填充，未解锁输入 6 位 PIN 后填充。

Included:

- Extension name changed to SeedPass.
- Keeps the v0.3.0 popup and inline suggestion style.
- Default generation uses the website; account label and note no longer affect the password by default.
- Each record can explicitly switch to "generate by account label only".
- The current site can keep multiple records with simple search and switching.
- Password-field focus shows current-site records; unlocked fills directly, locked fills after 6-digit PIN unlock.

## chrome-edge-v0.3.0

插件交互升级。

包含：

- 当焦点进入网页密码输入框时，页面内显示 Passworder 填充建议。
- 已解锁时，点击建议即可直接生成并填充当前网站密码。
- 未解锁时，建议浮层显示 6 位 PIN 输入框；输满后自动尝试解锁，成功后立即填充。
- popup 的创建和解锁流程改为 6 位数字 PIN 盒输入。
- 新保险库标记为 `version: 2` 和 `unlock: six-digit-pin`。
- 文档明确系统 PIN/系统密码不能由普通浏览器插件直接调用；后续若要接入
  Windows Hello、macOS Touch ID 或 Linux 桌面认证，需要 Native Messaging
  本机助手或 WebAuthn/Passkey 方案。

## v0.2.0

中文原生插件与基密码语义更新。

包含：

- Chrome/Edge 插件界面改为中文原生文案。
- 插件 manifest 名称、描述、快捷键说明、状态提示、错误提示和设置引导改为
  中文。
- 基密码概念明确支持：生成式多词助记词、用户输入的助记词，或中文、英文及
  任意语言的一句话/文本。
- Rust 核心增加中文句子基密码测试，证明句子基密码是核心合同而不是 UI 文案。
- README、SPEC、插件 README、构建说明改为中文说明。
- 重建 Chrome/Edge WASM 包和插件 release 产物。

## v0.1.0

初始 MIT 开源 Rust 核心发布。

包含：

- 纯 Rust 确定性密码派生核心。
- PBKDF2-HMAC-SHA256 算法版本 `passworder-core:v1`。
- 支持生成式助记词或用户输入文本作为基密码。
- 支持按网站派生密码，并提供可选账号和上下文字段。
- 默认 20 位密码策略，包含小写、大写、数字和符号。
- 支持为老旧网站配置密码策略。
- 支持生成助记词式基密码。
- 提供稳定规范和测试向量。
- 输出 `rlib`、`staticlib` 和 `cdylib`，便于后续绑定。
