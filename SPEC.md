# Passworder Core 规范

## 算法版本

```text
passworder-core:v1:PBKDF2-HMAC-SHA256
```

版本字符串是公开兼容性合同。只要规范化方式、盐编码、KDF 参数或密码编码
发生不兼容变化，就必须升级算法版本。

## 运行时要求

实现同算法只需要这些基础能力：

- UTF-8 文本编码。
- Unicode `NFKC` 字符串规范化。
- 生成助记词时需要安全随机数。
- PBKDF2-HMAC-SHA-256。

不需要联网、服务器账号、数据库或云同步。

## 输入

- `base_secret`: 用户根秘密，也就是基密码。可以是生成的助记词、用户输入的
  助记词、一句可记忆的话，或任何语言的任意文本。
- `service`: 网站或应用标识。
- `account`: 可选账号标识，用于区分同一网站的多个账号。
- `context`: 可选命名空间，例如 `work` 或 `personal`。
- `iterations`: PBKDF2 迭代次数。默认 `210000`，最低 `10000`。
- `policy`: 输出密码长度和字符类型策略。

生成式助记词默认使用内置 64 词表生成 24 个词。用户也可以不用词表，直接使用
一句足够长、私密、可记忆的中文、英文或其他语言句子。句子会和其他
`base_secret` 一样进入同一套规范化和派生流程。

## 文本规范化

所有文本输入先执行 Unicode `NFKC` 规范化，然后去掉首尾空白，并把内部连续
空白折叠成一个 ASCII 空格。`service` 和 `account` 在此之后转成小写。

规范化后的 `base_secret` 和 `service` 不能为空。

## 盐编码

PBKDF2 salt 是 UTF-8 编码后的长度前缀序列：

```text
<len>:passworder-core|<len>:v1|<len>:<service>|<len>:<account>|<len>:<context>
```

`len` 表示规范化后字段的 UTF-8 字节数。长度前缀用于避免字段里包含分隔符时
产生碰撞。

测试向量中的规范化 salt 文本：

```text
15:passworder-core|2:v1|11:example.com|5:alice|0:
```

## 密钥派生

- KDF: PBKDF2
- PRF: HMAC-SHA-256
- 派生字节数: 64

## 密码编码

默认输出长度：`20`。

默认策略启用小写字母、大写字母、数字和符号。编码器会先从每个启用字符池中
选出至少一个字符，再用所有启用字符池填满剩余长度，最后用派生字节做确定性
洗牌。因此默认输出能满足绝大多数网站的“大写 + 小写 + 数字 + 符号 + 最小
长度”要求。

默认字符池：

- 小写: `abcdefghijkmnopqrstuvwxyz`
- 大写: `ABCDEFGHJKLMNPQRSTUVWXYZ`
- 数字: `23456789`
- 符号: `!@#$%^&*_-+=?`

默认排除了易混淆字符，例如 `0`、`1`、`I`、`l`、`O`。

兼容建议：

- 大多数网站直接使用默认 20 位策略。
- 老旧网站拒绝标点时关闭 `symbols`。
- 只有网站有最大长度限制时才降低 `length`。最低允许长度是 8。
- 策略变化会改变派生结果，因此前端需要按站点保存策略覆盖。

## 测试向量

输入：

```json
{
  "base_secret": "correct horse battery staple",
  "service": "Example.com",
  "account": "Alice",
  "iterations": 10000
}
```

期望密码：

```text
&iaQ9PM-+%K9cEu+Tpjf
```

中文句子基密码也必须作为普通 `base_secret` 支持。例如：

```text
我在春天的河边记住一把不会联网的钥匙。
```

同一句话、同一网站、同一账号和同一策略必须稳定生成同一密码；不同句子必须
生成不同密码。

## Rust API

参考 Rust crate 导出：

- `derive_password(options)`
- `generate_mnemonic(words)`
- `generate_mnemonic_from_entropy(words, entropy)`
- `normalize_input(value)`
- `DerivePasswordOptions`
- `DerivePasswordResult`
- `PasswordPolicy`
- `PassworderError`
- `ALGORITHM`

前端应把生成密码视为敏感数据，除非用户明确要求，否则不要记录日志、上报
分析、写入崩溃报告或长期存储。
