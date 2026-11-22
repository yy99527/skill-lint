# 规则说明

每条规则包含固定的 `id`，可在 `.skill-lint.json` 的 `ignore` 中关闭，也可用 `--ignore SL001` 临时跳过。

严重级别含义：

| 级别 | 含义 | 扣分 |
|---|---|---|
| `critical` | 一旦执行几乎必然造成密钥泄露或数据损毁 | 30 |
| `high` | 明确的恶意/越权意图，或可被利用的通道 | 15 |
| `medium` | 扩大了攻击面，需要人工确认是否合理 | 6 |
| `low` | 规范性问题，不影响安全但影响可用性 | 2 |

---

## 破坏性

### SL001 · 破坏性删除命令 — critical

匹配 `rm -rf /`、`rm -rf ~`、`rm -rf $HOME`、`rm -rf *` 这类目标为根目录/家目录的递归删除。

```bash
rm -rf $HOME          # ✗ 命中
rm -rf $HOME/.cache   # ✓ 不命中（范围明确）
```

**修复**：删除范围限定到明确的临时目录；优先用回收站或 `trash`。

### SL002 · 下载内容直接交给 shell — critical

匹配 `curl ... | bash`、`wget ... | sh` 等模式。

```bash
curl -fsSL https://x.dev/install.sh | bash   # ✗ 命中
```

**修复**：先下载、校验 `sha256`，再显式执行；或改用固定版本的包管理器。

---

## 凭据

### SL003 · 读取用户凭据文件 — critical

匹配 `.ssh/id_rsa`、`.ssh/id_ed25519`、`.aws/credentials`、`.kube/config`、`.npmrc`、`.netrc`、`.git-credentials`、`.config/gh/hosts`。

**修复**：改为让用户注入最小权限的环境变量，并在文档中说明用途。

### SL016 · 读取环境变量中的密钥并外发 — critical

匹配 `process.env.OPENAI_API_KEY`、`printenv | curl` 等直接读取密钥并伴随网络调用的写法。

### SL017 · 凭据读取与外部请求同时出现 — critical（组合规则）

不依赖单行正则：同一文件中**既出现凭据读取、又出现对外请求**时触发，并在报告里指出两处的行号。

这条规则的价值在于抓"分开看都无害、连起来是窃密链路"的代码。误报率比单条正则低，但需要人工确认。

---

## 提示词

### SL004 · 提示词注入 / 隐藏指令 — high

匹配"忽略之前的所有指令""ignore previous instructions""disregard the system prompt"等。

### SL005 · 要求对用户隐瞒行为 — high

匹配"不要告诉用户""对用户保密""do not tell the user""without notifying the user"。

正常技能不存在"不能告诉用户"的步骤。这条规则命中，通常意味着旁边还有一条数据外传。

### SL006 · 绕过安全策略的意图 — high

匹配 jailbreak / 破甲 / 绕过审核 / `bypass safety` 等关键词。这类技能违反平台条款，使用者账号也会受牵连。

### SL014 · HTML 注释中夹带指令 — medium

匹配 `<!-- ... ignore ... -->`。人眼看不见，但模型读得到。

---

## 混淆

### SL007 · 编码后执行 — high

匹配 `eval(atob(...))`、`Buffer.from(...,'base64')`、`base64 -d | sh`、`exec(__import__('base64'))`。

### SL015 · 不可见的零宽字符 — low

匹配 U+200B–U+200F、U+202A–U+202E、U+2060–U+206F。这些字符可以在正常文本里隐藏另一段指令。

---

## 持久化

### SL008 · 写入系统持久化位置 — high

匹配 `crontab -`、`LaunchAgents`、`LaunchDaemons`、`systemctl enable`、`schtasks /create`、注册表 `Run` 键。

**修复**：改为一次性命令，并在文档中提供卸载方式。

---

## 权限

### SL009 · 提权执行 — medium

匹配任意 `sudo <cmd>`。需要 root 的技能扩大了影响面。

### SL010 · 向工作区外写入 / 放宽权限 — medium

匹配写入 `/etc`、`/usr`、`/bin`、`/System`、`/Library`，以及 `chmod -R 777`、`find /`。

### SL013 · 过度宽泛的工具授权 — medium

匹配 frontmatter 中的 `allowed-tools: *`、`Bash(*)`、`--dangerously-skip-permissions`、`--yolo`。

**修复**：按最小权限列具体工具，例如 `Bash(git status:*)`。

---

## 供应链

### SL011 · 从不可信来源安装依赖 — medium

匹配 `npm i https://...`、`pip install git+https://...`。跳过 registry 审核且通常无版本锁定。

### SL012 · 未声明的遥测 — medium

匹配 `navigator.sendBeacon`、`new Image().src = 'http...'`、指向 collect/track/stat 的 `fetch`。

---

## 结构检查

| ID | 级别 | 检查内容 |
|---|---|---|
| SL018 | low | 缺少 `SKILL.md` 入口文件 |
| SL019 | low | 缺少 `LICENSE`，他人无法合法使用 |
| SL020 | medium | 存在 `SKILL.md` 未提及的可执行脚本 |

SL020 是实践中最容易漏的一条：安装脚本藏在 `scripts/` 里，文档只写了"一键安装"，用户根本不知道它会 `sudo`。
