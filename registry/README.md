# registry

社区技能的安全分榜单数据源。

## 提交你的技能

在 `registry/skills.json` 中追加一行（按 `name` 字母序）：

```json
{
  "name": "owner/skill-name",
  "repo": "https://github.com/owner/skill-name",
  "path": ".",
  "note": "一句话说明这个技能做什么"
}
```

提交 PR 后维护者会手动跑一次 `skill-lint --json`，把评分贴回 PR 评论。（自动回评在 Roadmap 里，尚未实现）

## 计分说明

- 扫描对象：`repo` + `path` 指向的目录
- 评分：0–100，规则见 [docs/rules.md](../docs/rules.md)
- 定期全量重扫与历史记录（`registry/history.jsonl`）为规划中功能，暂未上线

## 榜单的用途

分数不是给技能判死刑，而是让使用者在安装前知道**它想动什么**。一个 F 分的技能如果文档写清楚了在做什么，也可以是好技能——问题在于你事先不知道。
