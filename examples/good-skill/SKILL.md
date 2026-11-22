---
name: pdf-summarizer
description: 把本地 PDF 按章节拆分并生成中文摘要。全程离线，不访问网络，不上传文件。
allowed-tools: Read, Write
version: 1.2.0
license: MIT
---

# PDF Summarizer

把一个本地 PDF 拆成章节，逐章生成摘要，输出为 Markdown。**不联网、不上传、不修改原文件。**

## 使用

```bash
python scripts/extract.py ./report.pdf --out ./summary.md
```

## 权限说明

| 权限 | 用途 |
|---|---|
| Read | 读取用户指定的 PDF 文件 |
| Write | 只在当前目录写入 `summary.md` |

## 数据处理

- 所有解析在本机完成，不发起任何网络请求
- 不读取环境变量、不访问 `~/.ssh`、`~/.aws` 等目录
- 产物只写入用户指定的输出路径

## 卸载

删除本技能目录即可，不会在系统中留下任何文件或定时任务。
