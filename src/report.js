import path from 'node:path';

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', yellow: '\x1b[33m', blue: '\x1b[34m',
  magenta: '\x1b[35m', cyan: '\x1b[36m', gray: '\x1b[90m',
  green: '\x1b[32m',
};

const SEV_LABEL = { critical: 'CRITICAL', high: 'HIGH', medium: 'MEDIUM', low: 'LOW' };
const SEV_COLOR_KEY = { critical: 'red', high: 'magenta', medium: 'yellow', low: 'blue' };

function colorize(enabled) {
  if (enabled) return C;
  const noop = new Proxy({}, { get: () => '' });
  return noop;
}

export function grade(s) {
  if (s >= 90) return 'A';
  if (s >= 75) return 'B';
  if (s >= 60) return 'C';
  if (s >= 40) return 'D';
  return 'F';
}

export function renderTerminal(result, opts = {}) {
  const c = colorize(opts.color !== false);
  const { findings, files } = result;
  const out = [];
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) counts[f.severity] = (counts[f.severity] || 0) + 1;
  const sc = result.score;
  const g = grade(sc);

  out.push('');
  out.push(`  ${c.bold}skill-lint${c.reset} ${c.gray}v${opts.version || '1.0.0'}${c.reset}  ${c.gray}·${c.reset}  ${displayRoot(result.root)}`);
  const scanned = files.filter(f => f.text).length;
  out.push(`  ${c.gray}共 ${files.length} 个文件 · 扫描 ${scanned} 个文本文件${c.reset}`);
  out.push('');

  if (findings.length === 0) {
    out.push(`  ${c.green}${c.bold}✓ 未发现问题${c.reset}  ${c.gray}评分 ${sc}/100 (${g})${c.reset}`);
    out.push('');
    return out.join('\n');
  }

  let lastFile = null;
  for (const f of findings) {
    if (f.file !== lastFile) {
      const label = f.file === '.' ? '项目根目录' : f.file;
      out.push(`  ${c.bold}${label}${c.reset}`);
      lastFile = f.file;
    }
    const sev = c[SEV_COLOR_KEY[f.severity]] || '';
    out.push(`    ${sev}${SEV_LABEL[f.severity].padEnd(8)}${c.reset} ${c.gray}${f.ruleId}${c.reset}  ${c.bold}${f.title}${c.reset}  ${c.gray}:${f.line}${c.reset}`);
    if (f.snippet) out.push(`      ${c.dim}${truncate(f.snippet, 110)}${c.reset}`);
    out.push(`      ${c.gray}↳ ${wrap(f.why, 96, 8)}${c.reset}`);
    out.push(`      ${c.green}✓ ${wrap(f.fix, 96, 8)}${c.reset}`);
    out.push('');
  }

  const bar = buildBar(sc, c);
  out.push(`  ${c.bold}评分${c.reset}  ${bar}  ${c.bold}${sc}${c.reset}${c.gray}/100${c.reset}  ${c.bold}${g}${c.reset}`);
  out.push(`  ${c.gray}${counts.critical} critical · ${counts.high} high · ${counts.medium} medium · ${counts.low} low${c.reset}`);
  out.push('');
  return out.join('\n');
}

function displayRoot(root) {
  const rel = path.relative(process.cwd(), root);
  return !rel || rel.startsWith('..') ? root : rel;
}

function buildBar(sc, c) {
  const total = 20;
  const filled = Math.round((sc / 100) * total);
  const ch = sc >= 90 ? c.green : sc >= 60 ? c.yellow : c.red;
  return `${ch}${'█'.repeat(filled)}${c.gray}${'─'.repeat(total - filled)}${c.reset}`;
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function wrap(s, width, indent) {
  const words = String(s).split('');
  const lines = [];
  let cur = '';
  for (const ch of words) {
    if (cur.length >= width) { lines.push(cur); cur = ''; }
    cur += ch;
  }
  if (cur) lines.push(cur);
  return lines.join('\n' + ' '.repeat(indent));
}

export function renderJson(result, opts = {}) {
  return JSON.stringify({
    tool: 'skill-lint',
    version: opts.version || '1.0.0',
    target: result.root,
    score: result.score,
    grade: grade(result.score),
    summary: result.findings.reduce((acc, f) => {
      acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    }, {}),
    findings: result.findings.map(f => ({
      ruleId: f.ruleId,
      title: f.title,
      severity: f.severity,
      category: f.category,
      file: f.file,
      line: f.line,
      snippet: f.snippet,
      why: f.why,
      fix: f.fix,
    })),
  }, null, 2);
}

export function renderSarif(result, opts = {}) {
  const level = { critical: 'error', high: 'error', medium: 'warning', low: 'note' };
  const rules = new Map();
  for (const f of result.findings) {
    if (!rules.has(f.ruleId)) {
      rules.set(f.ruleId, {
        id: f.ruleId,
        name: f.title,
        shortDescription: { text: f.title },
        fullDescription: { text: f.why },
        help: { text: f.fix },
        properties: { severity: f.severity, category: f.category },
      });
    }
  }
  return JSON.stringify({
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'skill-lint',
          version: opts.version || '1.0.0',
          informationUri: 'https://github.com/yy99527/skill-lint',
          rules: [...rules.values()],
        },
      },
      results: result.findings.map(f => ({
        ruleId: f.ruleId,
        level: level[f.severity] || 'warning',
        message: { text: `${f.title}：${f.why} 修复建议：${f.fix}` },
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: f.file },
            region: { startLine: Math.max(1, f.line), startColumn: 1 },
          },
        }],
      })),
    }],
  }, null, 2);
}
