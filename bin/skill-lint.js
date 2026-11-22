#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scan, score } from '../src/scanner.js';
import { loadConfig } from '../src/config.js';
import { renderTerminal, renderJson, renderSarif } from '../src/report.js';

const VERSION = '1.0.0';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = safePkg();

function safePkg() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  } catch { return {}; }
}

function parseArgs(argv) {
  const opts = {
    target: '.', json: false, sarif: false, quiet: false, color: true,
    failOn: null, ignore: [], rules: false, help: false, version: false,
  };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json' || a === '-j') opts.json = true;
    else if (a === '--sarif') opts.sarif = true;
    else if (a === '--quiet' || a === '-q') opts.quiet = true;
    else if (a === '--no-color') opts.color = false;
    else if (a === '--rules') opts.rules = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--version' || a === '-v') opts.version = true;
    else if (a === '--fail-on') opts.failOn = argv[++i];
    else if (a.startsWith('--fail-on=')) opts.failOn = a.split('=')[1];
    else if (a === '--ignore') opts.ignore.push(argv[++i]);
    else if (a.startsWith('--ignore=')) opts.ignore.push(a.split('=')[1]);
    else if (a.startsWith('--ignore=') === false && a.startsWith('-')) {
      // 未知参数忽略
    } else rest.push(a);
  }
  if (rest.length) opts.target = rest[0];
  return opts;
}

function help() {
  return `
  skill-lint ${VERSION}  ·  扫描 AI Agent 技能的安全风险

  用法
    skill-lint [目录] [选项]

  选项
    --json              输出 JSON（CI / 二次处理）
    --sarif             输出 SARIF（GitHub Code Scanning）
    --fail-on <级别>    达到该级别即返回非零退出码
                        可选：critical | high | medium | low | none
    --ignore <规则ID>   忽略指定规则，可重复
    --no-color          关闭颜色
    --rules             列出全部规则
    -h, --help          显示帮助
    -v, --version       显示版本

  示例
    skill-lint .                         扫描当前目录
    skill-lint ./my-skill --fail-on high 高危即失败
    skill-lint . --json > report.json    输出机器可读报告

  配置
    在项目根目录放置 .skill-lint.json：
    {
      "ignore": ["SL019"],
      "failOn": "high",
      "customRules": [
        { "id": "TEAM001", "title": "禁止访问内部域名",
          "severity": "high", "pattern": "internal\\\\.corp" }
      ]
    }
`;
}

async function main() {
  // 兼容 GitHub Action：Action 的 inputs 以 INPUT_* 环境变量传入
  const cliArgs = process.argv.slice(2);
  const hasPathArg = cliArgs.some(a => !a.startsWith('-'));
  const envArgs = [];
  if (!hasPathArg && process.env.INPUT_PATH) envArgs.push(process.env.INPUT_PATH);
  if (process.env.INPUT_FAIL_ON) envArgs.push('--fail-on', process.env.INPUT_FAIL_ON);
  if (process.env.INPUT_ARGS) envArgs.push(...process.env.INPUT_ARGS.split(/\s+/).filter(Boolean));

  const opts = parseArgs([...envArgs, ...cliArgs]);

  if (opts.version) { console.log(VERSION); return; }
  if (opts.help) { console.log(help()); return; }

  if (opts.rules) {
    const { RULES, STRUCT_RULES } = await import('../src/rules.js');
    const all = [...RULES, ...STRUCT_RULES];
    console.log('');
    for (const r of all) {
      console.log(`  ${r.id}  ${r.severity.padEnd(8)}  ${r.title}`);
      console.log(`        ${r.why}`);
    }
    console.log(`\n  共 ${all.length} 项检查（${RULES.length} 条正则 + 1 条组合 + ${STRUCT_RULES.length - 1} 条结构）\n`);
    return;
  }

  const target = path.resolve(opts.target);
  if (!fs.existsSync(target)) {
    console.error(`\n  找不到路径：${target}\n`);
    process.exit(2);
  }

  let config;
  try {
    config = loadConfig(target);
  } catch (e) {
    console.error(`\n  ${e.message}\n`);
    process.exit(2);
  }

  const ignore = [...config.ignore, ...opts.ignore];
  const result = scan(target, { ignore, customRules: config.customRules });
  result.score = score(result.findings);

  if (opts.sarif) {
    console.log(renderSarif(result, { version: VERSION }));
  } else if (opts.json) {
    console.log(renderJson(result, { version: VERSION }));
  } else if (!opts.quiet) {
    console.log(renderTerminal(result, { version: VERSION, color: opts.color }));
  }

  // Action 场景：额外落盘 SARIF
  const sarifOut = process.env.INPUT_SARIF_FILE;
  if (sarifOut) {
    fs.writeFileSync(sarifOut, renderSarif(result, { version: VERSION }), 'utf8');
    if (!opts.quiet && !opts.json && !opts.sarif) {
      console.log(`  SARIF 已写入 ${sarifOut}\n`);
    }
  }

  const failOn = opts.failOn || config.failOn || 'high';
  if (failOn === 'none') return;
  const rank = { low: 1, medium: 2, high: 3, critical: 4 };
  const threshold = rank[failOn] || 3;
  const hit = result.findings.some(f => (rank[f.severity] || 0) >= threshold);
  if (hit) process.exit(1);
}

main().catch(e => {
  console.error(e);
  process.exit(2);
});
