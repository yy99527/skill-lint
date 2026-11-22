#!/usr/bin/env node
/**
 * 扫描 registry/skills.json 里登记的技能，生成：
 *   registry/results.json    — 最新一轮结果
 *   registry/history.jsonl   — 追加历史记录
 *   docs/leaderboard.md      — 人类可读榜单
 *
 * 只读取文件内容做静态分析，绝不执行被扫描的技能脚本。
 * 仓库克隆使用 git clone --depth 1，缓存在 .registry-cache/。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { scan, score } from '../src/scanner.js';
import { grade } from '../src/report.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = path.join(root, 'registry', 'skills.json');
const cacheRoot = path.join(root, '.registry-cache');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

fs.mkdirSync(cacheRoot, { recursive: true });

function clone(repo, dir) {
  if (fs.existsSync(path.join(dir, '.git'))) {
    try {
      execFileSync('git', ['-C', dir, 'pull', '--ff-only', '--depth', '1'], {
        stdio: 'pipe', timeout: 60_000,
      });
      return;
    } catch {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  fs.rmSync(dir, { recursive: true, force: true });
  execFileSync('git', ['clone', '--quiet', '--depth', '1', repo, dir], {
    stdio: 'pipe', timeout: 180_000,
  });
}

function countsOf(findings) {
  const c = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) c[f.severity] = (c[f.severity] || 0) + 1;
  return c;
}

const skills = [];
const failures = [];
for (const entry of registry) {
  const { name, repo, path: sub = '.', note = '' } = entry;
  const dir = path.join(cacheRoot, name.replaceAll('/', '__'));
  try {
    clone(repo, dir);
    const target = path.join(dir, sub);
    if (!fs.existsSync(target)) throw new Error(`路径不存在：${sub}`);
    const r = scan(target);
    r.score = score(r.findings);
    const row = {
      name,
      repo,
      path: sub,
      note,
      score: r.score,
      grade: grade(r.score),
      findings: r.findings.length,
      counts: countsOf(r.findings),
      scannedAt: new Date().toISOString(),
    };
    skills.push(row);
    const historyLine = JSON.stringify({
      date: row.scannedAt.slice(0, 10),
      name: row.name,
      repo: row.repo,
      score: row.score,
      grade: row.grade,
      findings: row.findings,
      critical: row.counts.critical,
      high: row.counts.high,
      medium: row.counts.medium,
      low: row.counts.low,
    });
    fs.appendFileSync(path.join(root, 'registry', 'history.jsonl'), historyLine + '\n');
    console.log(`  ${String(row.score).padStart(3)}  ${row.grade}  ${row.findings} 条  ${name}`);
  } catch (e) {
    failures.push({ name, repo, error: String(e.message || e).slice(0, 240) });
    console.error(`  FAIL  ${name}  ${e.message}`);
  }
}

skills.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
const out = {
  generatedAt: new Date().toISOString(),
  total: skills.length,
  skills,
  failures,
};
fs.writeFileSync(path.join(root, 'registry', 'results.json'), JSON.stringify(out, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'docs', 'leaderboard.md'), renderLeaderboard(out));
console.log(`\n  完成：${skills.length} 个成功，${failures.length} 个失败`);

function renderLeaderboard(o) {
  const date = o.generatedAt.slice(0, 10);
  const rows = o.skills.map((s, i) => {
    const c = s.counts;
    const badges = [];
    if (c.critical) badges.push(`🔴 ${c.critical} critical`);
    if (c.high) badges.push(`🟠 ${c.high} high`);
    if (c.medium) badges.push(`🟡 ${c.medium} medium`);
    if (c.low) badges.push(`🔵 ${c.low} low`);
    return `| ${i + 1} | [${s.name}](${s.repo}) | ${s.path} | **${s.score}** | ${s.grade} | ${s.findings} | ${badges.join(' ') || '—'} | ${s.note} |`;
  }).join('\n');

  const failureRows = o.failures.length
    ? o.failures.map(f => `| ${f.name} | ${f.repo} | ${f.error} |`).join('\n')
    : '';

  return `# Skills 安全分榜单

> 由 skill-lint 自动扫描生成，最近一次：${date}（真实结果，未做人工修饰）。
> 分数不是给技能判死刑：F 分不代表它一定是恶意的，只代表它**想动的范围大**——安装前请逐条阅读报告。

| 排名 | 技能 | 扫描路径 | 分数 | 等级 | 告警数 | 分布 | 说明 |
|---|---|---|---|---|---|---|---|
${rows}

## 如何上榜

1. Fork 本仓库，在 \`registry/skills.json\` 里追加一行（按 \`name\` 字母序）：

\`\`\`json
{
  "name": "owner/skill-name",
  "repo": "https://github.com/owner/skill-name",
  "path": ".",
  "note": "一句话说明这个技能做什么"
}
\`\`\`

2. 提 PR，CI 会重扫并更新本榜单。
3. 想自我检测，直接在本地跑：\`node bin/skill-lint.js .\`。

## 计分

满分 100，按 \`critical 30 / high 15 / medium 6 / low 2\` 扣分；出现任意 critical 封顶 39 分。等级：A ≥90，B ≥75，C ≥60，D ≥40，其余 F。规则全文见 [rules.md](rules.md)。

${failureRows ? `## 本轮失败\n\n| 技能 | 仓库 | 错误 |\n|---|---|---|\n${failureRows}\n` : ''}
`;
}
