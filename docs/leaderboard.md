# Skills 安全分榜单

> 由 skill-lint 自动扫描生成，最近一次：2026-11-23（真实结果，未做人工修饰）。
> 分数不是给技能判死刑：F 分不代表它一定是恶意的，只代表它**想动的范围大**——安装前请逐条阅读报告。

| 排名 | 技能 | 扫描路径 | 分数 | 等级 | 告警数 | 分布 | 说明 |
|---|---|---|---|---|---|---|---|
| 1 | [yy99527/skill-lint](https://github.com/yy99527/skill-lint) | examples/good-skill | **100** | A | 0 | — | 本项目自带的满分基准技能 |
| 2 | [heydamir/unslop](https://github.com/heydamir/unslop) | skills/unslop | **98** | A | 1 | 🔵 1 low | 把 AI 味过重的 UI 改成有设计感的界面 |
| 3 | [ognjengt/founder-skills](https://github.com/ognjengt/founder-skills) | skills/cro-optimization | **98** | A | 1 | 🔵 1 low | 创始人技能包：转化率优化 |
| 4 | [tmchow/agent-skills](https://github.com/tmchow/agent-skills) | vhs-terminal-recorder | **98** | A | 1 | 🔵 1 low | 跨平台技能：终端录制（vhs） |
| 5 | [elvarofficial/teardown](https://github.com/elvarofficial/teardown) | . | **58** | D | 7 | 🟡 7 medium | 把任意机器变成可拆解的 3D 模拟器 |
| 6 | [TerminalSkills/skills](https://github.com/TerminalSkills/skills) | skills/context7 | **39** | F | 2 | 🔴 1 critical 🔵 1 low | 开源技能库：context7 文档查询 |
| 7 | [SimoneAvogadro/android-reverse-engineering-skill](https://github.com/SimoneAvogadro/android-reverse-engineering-skill) | plugins/android-reverse-engineering/skills/android-reverse-engineering | **0** | F | 26 | 🟡 25 medium 🔵 1 low | Android 逆向分析辅助技能 |
| 8 | [virgiliojr94/book-to-skill](https://github.com/virgiliojr94/book-to-skill) | . | **0** | F | 172 | 🔴 1 critical 🟠 4 high 🟡 123 medium 🔵 44 low | 把技术书籍 PDF 变成可学习的技能 |

## 如何上榜

1. Fork 本仓库，在 `registry/skills.json` 里追加一行（按 `name` 字母序）：

```json
{
  "name": "owner/skill-name",
  "repo": "https://github.com/owner/skill-name",
  "path": ".",
  "note": "一句话说明这个技能做什么"
}
```

2. 提 PR，CI 会重扫并更新本榜单。
3. 想自我检测，直接在本地跑：`node bin/skill-lint.js .`。

## 计分

满分 100，按 `critical 30 / high 15 / medium 6 / low 2` 扣分；出现任意 critical 封顶 39 分。等级：A ≥90，B ≥75，C ≥60，D ≥40，其余 F。规则全文见 [rules.md](rules.md)。


