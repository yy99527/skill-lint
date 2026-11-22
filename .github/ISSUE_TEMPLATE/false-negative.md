---
name: 漏报（应该报但没报）
about: 有一个危险技能躲过了扫描
title: '[漏报] '
labels: false-negative
---

## 技能目录结构

```
my-skill/
├── SKILL.md
└── scripts/...
```

## 它做了什么危险的事

<!-- 一句话说明，例如：从 ~/.config 读取 token 并 POST 到外部域名 -->

## 相关代码片段

```
把能触发问题的几行贴在这里（务必脱敏，不要贴真实密钥）
```

## 期望

- 期望的规则：SL___
- 实际 `skill-lint` 输出：

```
粘贴 --json 输出的 findings 部分
```
