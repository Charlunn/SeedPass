# SeedPass Core Specification / SeedPass 核心规范

The Rust crate is named `passworder-core` for compatibility. The product name is SeedPass.

为了兼容已有代码，Rust crate 名称仍为 `passworder-core`；产品名称是 SeedPass。

## Algorithm Version / 算法版本

```text
passworder-core:v1:PBKDF2-HMAC-SHA256
```

This version string is the compatibility contract. If normalization, salt encoding, KDF parameters, or password encoding changes incompatibly, the algorithm version must change.

这个版本字符串是兼容性合同。只要文本规范化、盐编码、KDF 参数或密码编码发生不兼容变化，就必须升级算法版本。

## Runtime Requirements / 运行时要求

- UTF-8 text encoding.
- Unicode `NFKC` normalization.
- Secure random bytes for generated seed phrases.
- PBKDF2-HMAC-SHA256.
- No network, server account, database, or cloud sync.
- UTF-8 文本编码。
- Unicode `NFKC` 规范化。
- 生成助记词时需要安全随机数。
- PBKDF2-HMAC-SHA256。
- 不需要联网、服务器账号、数据库或云同步。

## Inputs / 输入

- `base_secret`: the user's root secret. It can be generated words, an existing mnemonic, a private sentence, or text in any language.
- `service`: the website or app name. In the extension default mode, this is the detected website domain.
- `account`: optional secondary name. In the extension, this is used only when the user explicitly selects "Generate by account label".
- `context`: optional namespace for advanced callers.
- `iterations`: PBKDF2 iteration count. Default `210000`, minimum `10000`.
- `policy`: output length and character groups.
- `base_secret`：用户根秘密。可以是生成词组、已有助记词、私密句子，或任意语言文本。
- `service`：网站或应用名称。插件默认模式下，这就是自动检测到的网站域名。
- `account`：可选第二名称。插件中只有用户明确选择“按账号标识生成”时才会使用它。
- `context`：高级调用方可选命名空间。
- `iterations`：PBKDF2 迭代次数。默认 `210000`，最低 `10000`。
- `policy`：输出位数和字符类型。

## Extension Mapping / 插件映射

SeedPass extension records are website-bound:

- Mode `domain`: call the core with `service = siteIdentity`, no account value. Account label is only a note.
- Mode `account`: call the core with `service = accountLabel`, no account value. Website still binds the record in the UI.

SeedPass 插件记录始终与网站绑定：

- `domain` 模式：调用核心时使用 `service = siteIdentity`，不传账号值。账号标识只是备注。
- `account` 模式：调用核心时使用 `service = accountLabel`，不传账号值。网站名仍用于界面匹配这条记录。

This keeps the default user model simple: for most sites, the password is reproduced from the seed phrase and website name.

这样可以让默认用户模型保持简单：绝大多数网站只需要基密码和网站名即可复现密码。

## Text Normalization / 文本规范化

Every text input is normalized with Unicode `NFKC`, trimmed, and internal whitespace is collapsed to one ASCII space. `service` and `account` are then lowercased.

所有文本输入先执行 Unicode `NFKC` 规范化，再去掉首尾空白，并把内部连续空白折叠成一个 ASCII 空格。随后 `service` 和 `account` 转为小写。

Normalized `base_secret` and `service` must not be empty.

规范化后的 `base_secret` 和 `service` 不能为空。

## Salt Encoding / 盐编码

The PBKDF2 salt is a UTF-8 length-prefixed sequence:

PBKDF2 salt 是 UTF-8 编码后的长度前缀序列：

```text
<len>:passworder-core|<len>:v1|<len>:<service>|<len>:<account>|<len>:<context>
```

`len` is the UTF-8 byte length after normalization. Length prefixes prevent collisions when fields contain separator characters.

`len` 表示规范化后字段的 UTF-8 字节数。长度前缀用于避免字段里包含分隔符时产生碰撞。

Example normalized salt:

规范化 salt 示例：

```text
15:passworder-core|2:v1|11:example.com|5:alice|0:
```

## Key Derivation / 密钥派生

- KDF: PBKDF2.
- PRF: HMAC-SHA256.
- Derived bytes: 64.
- KDF：PBKDF2。
- PRF：HMAC-SHA256。
- 派生字节数：64。

## Password Encoding / 密码编码

Default output length is `20`.

默认输出长度为 `20`。

The default policy enables lowercase letters, uppercase letters, digits, and symbols. The encoder first guarantees at least one character from each enabled group, then fills the remaining length from all enabled groups, then deterministically shuffles the result with derived bytes.

默认策略启用小写字母、大写字母、数字和符号。编码器会先保证每个启用字符组至少出现一个字符，再从所有启用字符组中填满剩余长度，最后用派生字节做确定性洗牌。

This default satisfies most modern password rules requiring uppercase, lowercase, digits, symbols, and a minimum length.

这个默认策略可以满足绝大多数现代网站对大小写、数字、符号和最小长度的要求。

## Generated Seed Phrases / 生成式基密码

The core can generate mnemonic-like seed phrases from an internal 64-word list. Users may also provide their own text instead of using the generated list.

核心可以用内置 64 词表生成类似助记词的基密码。用户也可以不用词表，直接输入自己的私密文本。

Generated phrases require the `random` feature.

生成词组需要启用 `random` feature。

## Compatibility Rule / 兼容规则

Implementations in other languages must match normalization, salt encoding, KDF parameters, and password encoding exactly to reproduce the same passwords.

其他语言实现必须完全匹配文本规范化、盐编码、KDF 参数和密码编码，才能复现同一个密码。
