import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { scan, score } from '../src/scanner.js';
import { renderSarif, renderJson, grade } from '../src/report.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (e) {
    console.error(`  \x1b[31m✗\x1b[0m ${name}`);
    console.error(`    ${e.message}`);
    process.exitCode = 1;
  }
}

const bad = scan(path.join(root, 'examples/bad-skill'));
bad.score = score(bad.findings);
const good = scan(path.join(root, 'examples/good-skill'));
good.score = score(good.findings);
const ids = new Set(bad.findings.map(f => f.ruleId));

test('bad-skill 检出破坏性删除命令 SL001', () => assert.ok(ids.has('SL001')));
test('bad-skill 检出管道执行 SL002', () => assert.ok(ids.has('SL002')));
test('bad-skill 检出凭据文件访问 SL003', () => assert.ok(ids.has('SL003')));
test('bad-skill 检出提示词注入 SL004', () => assert.ok(ids.has('SL004')));
test('bad-skill 检出隐瞒行为要求 SL005', () => assert.ok(ids.has('SL005')));
test('bad-skill 检出持久化写入 SL008', () => assert.ok(ids.has('SL008')));
test('bad-skill 检出提权 SL009', () => assert.ok(ids.has('SL009')));
test('bad-skill 检出凭据外传组合 SL017', () => assert.ok(ids.has('SL017')));
test('bad-skill 提示缺少许可证 SL019', () => assert.ok(ids.has('SL019')));
test('bad-skill 含 critical 时评分被压到 39 以下', () => assert.ok(bad.score <= 39, `实际 ${bad.score}`));
test('bad-skill 评级为 F', () => assert.strictEqual(grade(bad.score), 'F'));
test('bad-skill 命中至少 10 条', () => assert.ok(bad.findings.length >= 10, `实际 ${bad.findings.length}`));

test('good-skill 零告警', () => assert.strictEqual(good.findings.length, 0, JSON.stringify(good.findings.map(f => f.ruleId))));
test('good-skill 评分 100', () => assert.strictEqual(good.score, 100));

test('所有 finding 含行号与修复建议', () => {
  for (const f of bad.findings) {
    assert.ok(typeof f.line === 'number');
    assert.ok(f.fix && f.fix.length > 4);
    assert.ok(f.why && f.why.length > 4);
  }
});

test('SARIF 结构合法', () => {
  const sarif = JSON.parse(renderSarif(bad));
  assert.strictEqual(sarif.version, '2.1.0');
  assert.ok(sarif.runs[0].results.length > 0);
  assert.ok(sarif.runs[0].tool.driver.rules.length > 0);
});

test('JSON 报告含分数与摘要', () => {
  const j = JSON.parse(renderJson(bad));
  assert.strictEqual(typeof j.score, 'number');
  assert.ok(j.summary.critical > 0);
});

test('自定义规则可通过配置注入', () => {
  const r = scan(path.join(root, 'examples/good-skill'), {
    customRules: [{
      id: 'TEAM001', title: '禁止访问内部域名', severity: 'high', category: 'custom',
      pattern: /pdf/gi, why: '测试用', fix: '测试用',
    }],
  });
  assert.ok(r.findings.some(f => f.ruleId === 'TEAM001'));
});

test('--ignore 生效', () => {
  const r = scan(path.join(root, 'examples/bad-skill'), { ignore: ['SL001', 'SL002', 'SL003', 'SL004', 'SL005', 'SL008', 'SL009', 'SL013', 'SL014', 'SL017', 'SL019'] });
  assert.strictEqual(r.findings.length, 0, JSON.stringify(r.findings.map(f => f.ruleId)));
});

test('CLI 大体积 JSON 管道输出完整可解析（不被 process.exit 截断）', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-lint-'));
  try {
    fs.writeFileSync(path.join(dir, 'SKILL.md'), '---\nname: big-scan\n---\n');
    fs.writeFileSync(path.join(dir, 'run.sh'), Array.from({ length: 220 }, (_, i) => `sudo cp a${i} /tmp/a${i}`).join('\n'));
    const out = execFileSync(process.execPath, [path.join(root, 'bin/skill-lint.js'), dir, '--json', '--fail-on', 'none'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const j = JSON.parse(out);
    assert.ok(j.findings.length >= 220, `实际 ${j.findings.length}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

console.log(`\n  ${passed} 项通过\n`);
