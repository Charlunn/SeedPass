# Chrome/Edge 插件

这个目录是 Passworder Core 的 Chrome/Edge Manifest V3 前端。插件不实现第二套
密码算法，而是调用 Rust 核心编译出的 WebAssembly。

已实现：

- Manifest V3 插件结构。
- 中文原生 popup：创建保险库、解锁、填充、策略调整。
- `chrome.storage.local` 中的 AES-GCM 加密基密码保险库。
- PBKDF2-HMAC-SHA256 解锁密钥派生。
- background 内存中的短期解锁缓存。
- 当前标签页网站身份识别。
- 每站点账号标识和密码策略保存。
- Rust/WASM 密码派生。
- content script 自动填充密码框。
- 密码框聚焦时显示页面内填充建议。
- 未解锁时在页面内显示 6 位 PIN 输入框，输满自动解锁并填充。

## 使用体验

1. 用户打开登录页，例如 `https://github.com/login`。
2. 用户点击插件图标或快捷键。
3. 插件识别当前网站身份，通常是 `github.com`。
4. 如果保险库已锁定，用户输入本地解锁密码 / PIN。
5. 插件把加密保存的基密码解密到 background 内存中。
6. 插件使用 `基密码 + 网站身份 + 账号标识` 派生站点密码。
7. content script 填充当前页面的密码输入框。
8. 解锁超时后，内存中的明文基密码自动清除。

## 基密码

基密码可以是：

- 插件生成的 24 个英文词助记词。
- 用户自己输入的传统助记词。
- 一句足够长、私密、可记忆的话。
- 中文、英文或任何语言文本。

核心会对基密码做 Unicode `NFKC` 规范化、去除首尾空白并折叠内部空白。用户
必须保持输入完全一致，才能在不同设备上得到同一个站点密码。

## 架构

```text
Chrome/Edge Manifest V3 插件
├─ popup UI
│  ├─ 创建保险库
│  ├─ 解锁保险库
│  ├─ 选择账号/策略
│  └─ 触发填充
├─ background service worker
│  ├─ 解锁期间持有明文基密码
│  ├─ 执行超时锁定
│  ├─ 调用 Rust/WASM 核心
│  └─ 仅在用户动作后把生成密码发送到当前标签页
├─ content script
│  ├─ 查找密码输入框
│  └─ 填充密码
├─ storage.local
│  ├─ 加密后的基密码保险库
│  ├─ KDF 参数
│  ├─ 每站点账号标识
│  └─ 每站点密码策略覆盖
└─ pkg
   └─ Passworder Core 的 WASM 产物
```

## 保险库加密

基密码不能明文保存。

当前版本：

- KDF: PBKDF2-HMAC-SHA256。
- 迭代次数: `600000`。
- Salt: 随机 16 字节。
- Cipher: AES-256-GCM。
- Nonce: 每次加密随机 12 字节。
- 存储位置: `chrome.storage.local`。

保险库记录格式：

```json
{
  "version": 1,
  "kdf": "PBKDF2-HMAC-SHA256",
  "iterations": 600000,
  "salt": "base64",
  "cipher": "AES-256-GCM",
  "nonce": "base64",
  "ciphertext": "base64"
}
```

## 解锁会话

默认策略：

- 默认解锁 15 分钟。
- 可选 5、15、30、60 分钟。
- 解锁凭据为插件内 6 位数字 PIN。
- 支持手动“立即锁定”。
- 浏览器重启、插件重载、service worker 被回收后视为锁定。
- 明文基密码只保存在 background 内存。
- content script 永远不接收基密码。

## 系统 PIN / 系统密码边界

普通 Chrome/Edge 插件没有直接调用 Windows PIN、Windows Hello、macOS Touch ID
或 Linux 桌面密码的权限。当前版本实现的是插件内 6 位数字 PIN。

如果后续要使用系统认证，需要新增 Native Messaging 本机助手，或改用
WebAuthn/Passkey 做密钥封装。该能力不能只靠 Manifest V3 前端脚本完成。

## 网站身份

插件使用稳定网站身份派生密码，而不是完整 URL。

默认行为：

- `https://github.com/login` -> `github.com`
- `https://login.example.co.uk` -> `example.co.uk`

插件会显示识别到的网站身份，用户填充前应确认，避免钓鱼或异常子域名。

## 填充策略

填充需要用户动作：

- 点击插件按钮。
- 多账号时选择账号标识。
- 点击“生成并填充”或使用显式快捷键。

不做页面加载时的静默填充，避免钓鱼页面无感触发。

## 每站点策略覆盖

默认核心策略适合绝大多数网站：

- 20 位。
- 包含小写、大写、数字、符号。

少数网站可能需要覆盖：

- 禁用符号。
- 限制最大长度。
- 使用特定账号标识。

策略覆盖不是秘密，但会影响确定性输出，必须按站点保存。
