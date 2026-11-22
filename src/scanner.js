import fs from 'node:fs';
import path from 'node:path';
import { RULES, SKIP_EXT, TEXT_EXT, detectExfiltration } from './rules.js';

const MAX_BYTES = 512 * 1024; // 单文件超过 512KB 跳过，避免卡死
const IGNORE_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'vendor', '.venv', '__pycache__']);

/** 递归收集文件 */
export function collectFiles(root) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith('.') && e.name !== '.github') {
        if (e.isDirectory() && IGNORE_DIRS.has(e.name)) continue;
      }
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (IGNORE_DIRS.has(e.name)) continue;
        walk(abs);
      } else if (e.isFile()) {
        const rel = path.relative(root, abs) || e.name;
        const ext = path.extname(e.name).toLowerCase();
        out.push({ abs, rel, ext, size: safeStat(abs) });
      }
    }
  };
  walk(root);
  return out;
}

function safeStat(p) {
  try { return fs.statSync(p).size; } catch { return 0; }
}

function readText(file) {
  if (file.size > MAX_BYTES) return null;
  if (SKIP_EXT.has(file.ext)) return null;
  if (!TEXT_EXT.has(file.ext)) return null;
  try {
    const buf = fs.readFileSync(file.abs);
    if (buf.includes(0)) return null; // 二进制
    return buf.toString('utf8');
  } catch {
    return null;
  }
}

/** 解析 SKILL.md 的简单 frontmatter（不引入 yaml 依赖） */
export function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return { data: {}, body: text, hasFrontmatter: false };
  const data = {};
  let currentKey = null;
  for (const raw of m[1].split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(raw);
    if (kv) {
      currentKey = kv[1];
      const v = kv[2].trim().replace(/^["']|["']$/g, '');
      if (v === '') data[currentKey] = [];
      else if (v.startsWith('[')) data[currentKey] = v.replace(/[\[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean);
      else data[currentKey] = v;
    } else if (currentKey && /^\s*-\s+/.test(raw)) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(raw.replace(/^\s*-\s+/, '').trim());
    }
  }
  return { data, body: text.slice(m[0].length), hasFrontmatter: true };
}

/** 主扫描 */
export function scan(root, options = {}) {
  const ignore = new Set(options.ignore || []);
  const files = collectFiles(root).map(f => ({ ...f, text: readText(f) }));
  const activeRules = [...RULES, ...(options.customRules || [])];

  const findings = [];

  for (const f of files) {
    if (!f.text) continue;
    const lines = f.text.split('\n');
    for (const rule of activeRules) {
      if (ignore.has(rule.id)) continue;
      const re = new RegExp(rule.pattern.source, rule.pattern.flags.includes('g') ? rule.pattern.flags : rule.pattern.flags + 'g');
      let m;
      while ((m = re.exec(f.text)) !== null) {
        if (m.index === re.lastIndex) re.lastIndex++;
        const line = f.text.slice(0, m.index).split('\n').length;
        findings.push({
          ruleId: rule.id,
          title: rule.title,
          severity: rule.severity,
          category: rule.category,
          file: f.rel,
          line,
          snippet: (lines[line - 1] || '').trim().slice(0, 160),
          why: rule.why,
          fix: rule.fix,
        });
        if (!rule.pattern.flags.includes('g')) break;
      }
    }
  }

  // 组合规则
  if (!ignore.has('SL017')) findings.push(...detectExfiltration(files));

  // 结构性检查
  findings.push(...structuralChecks(root, files, ignore));

  // 去重 + 排序
  const seen = new Set();
  const deduped = findings.filter(f => {
    const k = `${f.ruleId}|${f.file}|${f.line}|${f.snippet}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  // 以"文件中最严重的问题"排序，保证同一文件的告警聚在一起
  const fileRank = new Map();
  for (const f of deduped) {
    const prev = fileRank.get(f.file);
    const cur = order[f.severity];
    if (prev === undefined || cur < prev) fileRank.set(f.file, cur);
  }
  deduped.sort((a, b) =>
    (fileRank.get(a.file) - fileRank.get(b.file)) ||
    a.file.localeCompare(b.file) ||
    a.line - b.line
  );

  return { files: files.map(f => ({ rel: f.rel, size: f.size, text: f.text })), findings: deduped, root };
}

function structuralChecks(root, files, ignore) {
  const out = [];
  const names = new Set(files.map(f => f.rel.replace(/\\/g, '/')));

  // 缺少 SKILL.md
  if (!names.has('SKILL.md') && !ignore.has('SL018')) {
    out.push({
      ruleId: 'SL018',
      title: '缺少 SKILL.md 入口文件',
      severity: 'low',
      category: 'structure',
      file: '.',
      line: 0,
      snippet: '',
      why: '没有 SKILL.md 的技能无法被宿主识别与展示，也无法说明自身权限范围。',
      fix: '添加 SKILL.md，包含 name / description / allowed-tools 三个必填字段。',
    });
  }

  // 缺少许可证
  const hasLicense = [...names].some(n => /^(LICENSE|LICENSE\.md|LICENSE\.txt|COPYING)$/i.test(n));
  if (!hasLicense && !ignore.has('SL019')) {
    out.push({
      ruleId: 'SL019',
      title: '缺少开源许可证',
      severity: 'low',
      category: 'structure',
      file: '.',
      line: 0,
      snippet: '',
      why: '没有许可证意味着默认保留所有权利，他人无法合法使用或二次分发。',
      fix: '添加 MIT 或 Apache-2.0 许可证文件。',
    });
  }

  // 脚本未被文档引用
  const skillMd = files.find(f => f.rel.replace(/\\/g, '/') === 'SKILL.md');
  if (skillMd?.text) {
    for (const f of files) {
      const rel = f.rel.replace(/\\/g, '/');
      if (!/\.(sh|bash|zsh|ps1|py)$/i.test(rel)) continue;
      const base = path.basename(rel);
      if (!skillMd.text.includes(base) && !ignore.has('SL020')) {
        out.push({
          ruleId: 'SL020',
          title: '存在未被文档声明的可执行脚本',
          severity: 'medium',
          category: 'structure',
          file: rel,
          line: 1,
          snippet: base,
          why: '文档没有提到这个脚本，使用者不知道它会被执行、做什么、需要什么权限。',
          fix: '在 SKILL.md 中说明该脚本的用途与调用方式，或将其删除。',
        });
      }
    }
  }

  return out;
}

/** 计算评分：0-100 */
export function score(findings) {
  const weights = { critical: 30, high: 15, medium: 6, low: 2 };
  let s = 100;
  for (const f of findings) s -= weights[f.severity] || 0;
  const hasCritical = findings.some(f => f.severity === 'critical');
  if (hasCritical) s = Math.min(s, 39);
  return Math.max(0, Math.round(s));
}
