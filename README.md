# skill-lint

**给你的 AI 技能做一次安全体检。** 一条命令扫出「偷偷 `rm -rf`」「把 API Key 发到别人服务器」「在注释里写忽略指令」这类技能。

[![test](https://github.com/yy99527/skill-lint/actions/workflows/test.yml/badge.svg)](https://github.com/yy99527/skill-lint/actions/workflows/test.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D18-blue)](https://nodejs.org)
[![零依赖](https://img.shields.io/badge/dependencies-0-brightgreen)](#)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![forks](https://img.shields.io/github/forks/yy99527/skill-lint?style=social)](https://github.com/yy99527/skill-lint/forks)

```bash
git clone https://github.com/yy99527/skill-lint
cd skill-lint && npm link
skill-lint ./my-skill
```

<img src="docs/demo.png" alt="skill-lint 扫描一个技能目录的输出" width="780">

*↑ 扫描一个被投毒的技能：4 个 critical、评分 0 分。*

---

## 为什么需要它

一个 skill 就是一段会被 Agent **自动执行**的代码和提示词。你装一个别人写的技能，等于把 shell、文件系统、你的环境变量一起交出去。

真实存在的三类问题，静态检查能抓住 90%：

| 问题 | 长什么样 | 后果 |
|---|---|---|
| **静默窃密** | 读 `~/.ssh/id_rsa` / `GITHUB_TOKEN`，再 POST 到某个域名 | 密钥与代码仓库失守 |
| **破坏性命令** | `rm -rf $HOME`、`curl ... \| bash` | 数据不可恢复 |
| **提示词投毒** | `<!-- ignore previous instructions -->`、零宽字符 | Agent 绕过宿主的安全约束 |

现在的技能市场有上万个 skill，**没有任何一个工具在装之前告诉你它想干什么**。这就是 skill-lint 要补的位。

想 3 分钟看懂一个投毒技能长什么样，读 [实弹演示](docs/poisoned-skill-walkthrough.md)；想看真实公开技能的扫描结果，看 [安全分榜单](docs/leaderboard.md)。

---

## 30 秒开始

**本地扫一个技能目录：**

```bash
git clone https://github.com/yy99527/skill-lint
cd skill-lint && npm link      # 零依赖，不会安装任何包
skill-lint ./path/to/skill     # 也可以直接 node bin/skill-lint.js ./path/to/skill
```

**接进 CI（推荐，也是 fork 的主要理由）：**

```yaml
# .github/workflows/skill-lint.yml
name: skill-lint
on: [push, pull_request]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: yy99527/skill-lint@main
        with:
          path: .
          fail-on: high
```

有 high 及以上问题就直接让 CI 失败，PR 合不进来。

**输出 SARIF，进 GitHub Code Scanning：**

```bash
skill-lint . --sarif > skill-lint.sarif
# 再用 github/codeql-action/upload-sarif 上传，问题会直接标在 PR 的代码行上
```

---

## 规则

20 项检查（16 条正则规则 + 1 条组合规则 + 3 条结构检查），覆盖 7 个类别。完整说明见 [docs/rules.md](docs/rules.md)。

| 类别 | 规则 | 关注点 |
|---|---|---|
| 破坏性 | SL001 SL002 | `rm -rf` 根目录、`curl \| bash` |
| 凭据 | SL003 SL016 SL017 | 读取私钥/云凭据、密钥外发链路 |
| 提示词 | SL004 SL005 SL006 SL014 | 注入、隐瞒行为、绕过安全策略 |
| 混淆 | SL007 SL015 | base64 后执行、零宽字符 |
| 持久化 | SL008 | crontab / LaunchAgents / 注册表自启 |
| 权限 | SL009 SL010 SL013 | sudo、越界写入、`Bash(*)` |
| 供应链 | SL011 SL012 | 直装远端依赖、静默遥测 |

**评分**：满分 100，按 `critical 30 / high 15 / medium 6 / low 2` 扣分；出现任意 critical 直接封顶 39 分（F）。

| 分数 | 等级 | 建议 |
|---|---|---|
| 90–100 | A | 可以放心装 |
| 75–89 | B | 可装，注意文档里未声明的行为 |
| 60–74 | C | 装之前逐条读一遍 |
| 40–59 | D | 建议先改再用 |
| 0–39 | F | 不要装 |

---

## Fork 它，改成你自己的规则

这可能是你 fork 这个仓库最实际的理由：**每个团队都有一批"我们这里绝对不许出现"的模式**——内部域名、特定云厂商、公司密钥前缀、某个被禁用的库。

在仓库根目录放一个 `.skill-lint.json`：

```json
{
  "ignore": ["SL019"],
  "failOn": "high",
  "customRules": [
    {
      "id": "ACME001",
      "title": "禁止访问内部系统",
      "severity": "critical",
      "pattern": "(internal\\.acme\\.com|10\\.0\\.\\d+\\.\\d+)",
      "why": "技能不应访问内网地址。",
      "fix": "改为通过网关访问，并在文档中说明。"
    },
    {
      "id": "ACME002",
      "title": "禁止使用公司密钥前缀",
      "severity": "high",
      "pattern": "acme_(live|prod)_[a-z0-9]{16}"
    }
  ]
}
```

自定义规则走同一套引擎，支持 `severity`、行号定位、SARIF 输出，不需要改一行源码。

**加一条内置规则**（欢迎 PR）：

1. 在 `src/rules.js` 的 `RULES` 数组里追加一条，填 `id / title / severity / category / pattern / why / fix`
2. 在 `examples/bad-skill/` 里加一个能触发它的样本
3. 在 `test/test.js` 里加一条断言
4. `npm test` 全绿即可提 PR

---

## 支持哪些技能格式

不绑定任何平台，只要目录里有 `SKILL.md`、脚本或提示词文件就能扫：

- Claude Code / Codex / Cursor / DSH 的 `skills/` 目录
- 任何 Markdown 写的提示词包
- 任何带 `install.sh` / `setup.py` 的技能包

扫描时会读 frontmatter（`name` / `description` / `allowed-tools`），并检查"文档没提到的可执行脚本"这类隐蔽问题。

---

## 常用参数

```
skill-lint [目录] [选项]

  --json              输出 JSON
  --sarif             输出 SARIF
  --fail-on <级别>    critical | high | medium | low | none
  --ignore <规则ID>   忽略规则，可重复
  --rules             列出全部规则
  --no-color          关闭颜色
```

退出码：`0` 通过、`1` 达到阈值、`2` 用法错误。

---

## Roadmap

- [x] 20 项检查（16 正则 + 1 组合 + 3 结构）
- [x] CLI / JSON / SARIF / GitHub Action
- [x] `.skill-lint.json` 自定义规则
- [x] **skills 安全分榜单**（registry + 每周自动重扫，热启动 8 个真实技能）→ [榜单](docs/leaderboard.md)
- [ ] 自动发现 GitHub 热门 skills 并批量纳入榜单
- [ ] 发布到 npm（`skill-lint` 包名已被他人占用，需改用 scope 或新名）
- [ ] 规则市场：社区贡献的规则包，`extends: ["@skill-lint/rules-web3"]`
- [ ] VS Code 插件：打开 `SKILL.md` 实时标红
- [ ] LLM 二审：正则抓不到的自然语言越权意图

榜单和规则市场都在做，欢迎 watch / fork 跟进。

---

## 参与

- 发现漏报：提 Issue，附上最小复现的技能目录
- 想加规则：直接 PR，`npm test` 通过即可
- 想让自己的技能上榜：在 README 里加 `skill-lint` badge，或提交到 `registry/`

```bash
git clone https://github.com/yy99527/skill-lint
cd skill-lint
npm test          # 20 项断言，无需安装依赖
npm run demo      # 看一份"有毒"技能的完整报告
```

## License

MIT

---

<details>
<summary><b>English</b></summary>

**skill-lint** — a static security linter for AI agent skills. Finds destructive shell commands, credential exfiltration chains, prompt-injection and hidden instructions, persistence hooks, and over-broad tool permissions.

```bash
npx skill-lint ./my-skill          # scan
npx skill-lint . --sarif > out.sarif   # for GitHub Code Scanning
```

Zero dependencies, Node ≥ 18. Extend with `.skill-lint.json` custom rules. 20 checks (16 regex + 1 combo + 3 structural), scored 0–100.

</details>
