import fs from 'node:fs';
import path from 'node:path';

const CONFIG_NAMES = ['.skill-lint.json', 'skill-lint.config.json'];

export const DEFAULT_CONFIG = {
  ignore: [],
  failOn: 'high',       // critical | high | medium | low | none
  customRules: [],
};

export function loadConfig(root) {
  for (const name of CONFIG_NAMES) {
    const p = path.join(root, name);
    if (fs.existsSync(p)) {
      try {
        const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
        return normalize({ ...raw, __path: p });
      } catch (e) {
        throw new Error(`配置文件解析失败：${p}\n${e.message}`);
      }
    }
  }
  return { ...DEFAULT_CONFIG, __path: null };
}

function normalize(cfg) {
  const out = { ...DEFAULT_CONFIG, ...cfg };
  if (!Array.isArray(out.ignore)) out.ignore = [];
  if (!Array.isArray(out.customRules)) out.customRules = [];
  out.customRules = out.customRules
    .filter(r => r && r.id && r.pattern)
    .map(r => ({
      id: String(r.id),
      title: r.title || r.id,
      severity: ['critical', 'high', 'medium', 'low'].includes(r.severity) ? r.severity : 'medium',
      category: r.category || 'custom',
      pattern: typeof r.pattern === 'string' ? new RegExp(r.pattern, r.flags || 'gi') : r.pattern,
      why: r.why || '命中自定义规则。',
      fix: r.fix || '按团队规范处理。',
    }));
  return out;
}
