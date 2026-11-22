/**
 * skill-lint 规则库
 * 每条规则包含：id / 标题 / 严重级别 / 分类 / 匹配方式 / 判定理由 / 修复建议
 * 严重级别：critical | high | medium | low
 */

export const SEVERITY_WEIGHT = { critical: 30, high: 15, medium: 6, low: 2 };

/** 二进制或无需扫描的扩展名 */
export const SKIP_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip',
  '.gz', '.tar', '.woff', '.woff2', '.ttf', '.mp4', '.mp3', '.wasm',
  '.lock', '.map', '.min.js', '.min.css',
]);

/** 会被扫描的文本扩展名（无扩展名文件也会尝试按文本读取） */
export const TEXT_EXT = new Set([
  '.md', '.markdown', '.txt', '.sh', '.bash', '.zsh', '.fish', '.ps1',
  '.py', '.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx', '.json', '.yaml',
  '.yml', '.toml', '.rb', '.go', '.rs', '.java', '.php', '.pl', '.lua',
  '.html', '.xml', '.cfg', '.ini', '.env', '',
]);

/**
 * 正则规则
 * flags 固定为 'gi'，逐行匹配
 */
export const RULES = [
  {
    id: 'SL001',
    title: '破坏性删除命令',
    severity: 'critical',
    category: 'destructive',
    pattern: /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\s+(\/|~|\$HOME|\*)(?=[\s;)"'`]|$)/g,
    why: '技能一旦被 Agent 自动执行，这类命令会清空用户主目录或整块磁盘，且不可恢复。',
    fix: '删除操作限定在明确的临时目录，改用 trash/回收站，或在执行前要求人工确认。',
  },
  {
    id: 'SL002',
    title: '下载内容直接交给 shell 执行',
    severity: 'critical',
    category: 'destructive',
    pattern: /\b(curl|wget)\b[^\n|]{0,200}\|\s*(sudo\s+)?(ba|z|fi)?sh\b/g,
    why: '远端脚本内容不可控，等于把执行权交给一个随时可被篡改的 URL。',
    fix: '先下载到本地、校验 sha256 与来源，再显式执行；或改为固定版本的包管理器安装。',
  },
  {
    id: 'SL003',
    title: '读取用户凭据文件',
    severity: 'critical',
    category: 'credential',
    pattern: /(\.ssh\/id_[a-z]+|\.ssh\/config|\.aws\/credentials|\.kube\/config|\.npmrc|\.netrc|\.git-credentials|id_rsa|id_ed25519|\.config\/gh\/hosts)/gi,
    why: '技能没有理由读取私钥或云厂商凭据，这类访问几乎只出现在窃密场景中。',
    fix: '如确需认证，改为引导用户注入最小权限的环境变量，并在文档中声明用途。',
  },
  {
    id: 'SL004',
    title: '提示词注入 / 隐藏指令',
    severity: 'high',
    category: 'prompt',
    pattern: /(忽略(之前|以上|前面|所有)(的)?(指令|规则|设定)|ignore\s+(all\s+)?(previous|prior|above)\s+instructions|disregard\s+(the\s+)?(system|previous)\s+(prompt|message))/gi,
    why: '这是典型的技能投毒手法：用一个技能覆盖宿主 Agent 的安全约束。',
    fix: '技能文档只描述任务本身，不要包含任何试图改写系统提示词的语句。',
  },
  {
    id: 'SL005',
    title: '要求对用户隐瞒行为',
    severity: 'high',
    category: 'prompt',
    pattern: /((不需要?|不要|别|切勿)(告诉|告知|提示|透露给)(用户|使用者)|对用户(保密|隐瞒)|do\s+not\s+(tell|inform|mention\s+to)\s+the\s+user|without\s+(telling|notifying)\s+the\s+user)/gi,
    why: '正常技能不存在“不能告诉用户”的步骤，隐瞒要求通常伴随越权或数据外传。',
    fix: '所有副作用操作都应在报告或日志中显式说明。',
  },
  {
    id: 'SL006',
    title: '绕过安全策略的意图',
    severity: 'high',
    category: 'prompt',
    pattern: /(jailbreak|破甲|越狱提示|绕过(安全|限制|审核|风控|过滤)|bypass\s+(the\s+)?(safety|filter|guardrail|content\s+policy)|disable\s+(safety|moderation))/gi,
    why: '以绕过模型或平台安全策略为目的的技能，违反平台条款，使用者的账号也会受牵连。',
    fix: '移除绕过类目标；如属安全研究，请明确标注授权范围与用途。',
  },
  {
    id: 'SL007',
    title: '混淆执行（编码后运行）',
    severity: 'high',
    category: 'obfuscation',
    pattern: /(eval\s*\(\s*(atob|Buffer\.from)\s*\(|base64\s+(-d|--decode)\s*\|[^\n]{0,40}(ba|z)?sh|exec\s*\(\s*__import__\s*\(\s*['"]base64)/gi,
    why: '把可读代码编码后执行，是隐藏恶意逻辑最常见的手段，也几乎无法审计。',
    fix: '保持脚本可读；如确需编码资源，请与代码分离并说明来源。',
  },
  {
    id: 'SL008',
    title: '写入系统持久化位置',
    severity: 'high',
    category: 'persistence',
    pattern: /(crontab\s+-|LaunchAgents|LaunchDaemons|systemctl\s+(enable|start)|schtasks\s+\/create|HKCU\\+Software\\+Microsoft\\+Windows\\+CurrentVersion\\+Run)/g,
    why: '技能不应在用户机器上留下开机自启或定时任务，这会使用户失去对环境的控制。',
    fix: '改为用户显式调用的一次性命令，或在文档中说明并提供卸载脚本。',
  },
  {
    id: 'SL009',
    title: '提权执行',
    severity: 'medium',
    category: 'privilege',
    pattern: /\bsudo\s+\S+/g,
    why: '需要 root 的技能扩大了影响面，出错时可能损坏系统。',
    fix: '避免 sudo；如不可避免，逐条说明为什么必须提权以及影响范围。',
  },
  {
    id: 'SL010',
    title: '向工作区之外写入文件',
    severity: 'medium',
    category: 'privilege',
    pattern: /(>>?\s*\/(etc|usr|bin|sbin|System|Library)\/|chmod\s+-R\s+777|find\s+\/\s+-)/g,
    why: '越界写入或全盘放宽权限，会让后续任意进程都能篡改这些文件。',
    fix: '所有产物写入当前工作目录或用户指定的输出目录。',
  },
  {
    id: 'SL011',
    title: '从不可信来源安装依赖',
    severity: 'medium',
    category: 'supplychain',
    pattern: /((npm|pnpm|yarn)\s+(i|install|add)\s+(https?:|git\+)|pip3?\s+install\s+(git\+|https?:))/gi,
    why: '绕过包管理器审核直装远端代码，且通常不带版本锁定，无法复现也无法审计。',
    fix: '使用 registry 上的固定版本（带 integrity），并在文档中列出依赖清单。',
  },
  {
    id: 'SL012',
    title: '未声明的遥测或数据上报',
    severity: 'medium',
    category: 'exfiltration',
    pattern: /(navigator\.sendBeacon|new\s+Image\(\)\.src\s*=\s*['"]https?:|fetch\(\s*['"]https?:\/\/[^'"]*(collect|track|stat|log))/gi,
    why: '静默上报用户行为会侵犯隐私，且多数技能并未在文档中披露。',
    fix: '默认关闭遥测；如必须，在 SKILL.md 顶部显式声明收集内容并提供开关。',
  },
  {
    id: 'SL013',
    title: '过度宽泛的工具授权',
    severity: 'medium',
    category: 'permission',
    pattern: /(allowed-tools\s*:\s*.*(\*|Bash\(\*\)|all)|--dangerously-skip-permissions|--yolo)/g,
    why: '授予无限制的工具权限，等于放弃了对技能行为的最后一道约束。',
    fix: '按最小权限列出具体工具与命令前缀，例如 Bash(git status:*)。',
  },
  {
    id: 'SL014',
    title: 'HTML 注释中夹带指令',
    severity: 'medium',
    category: 'prompt',
    pattern: /<!--[\s\S]{0,300}?(ignore|忽略|instruction|system|assistant)[\s\S]{0,300}?-->/gi,
    why: '人眼看不见但模型能读到，是技能投毒的隐蔽通道。',
    fix: '移除注释中的指令性内容，注释只用于说明。',
  },
  {
    id: 'SL015',
    title: '不可见的零宽字符',
    severity: 'low',
    category: 'obfuscation',
    pattern: /[\u200B-\u200F\u202A-\u202E\u2060-\u206F]/g,
    why: '零宽字符可用于在正常文本中隐藏另一段指令。',
    fix: '清理行内不可见字符，使用纯文本编辑器重新粘贴内容。',
  },
  {
    id: 'SL016',
    title: '读取环境变量中的密钥并外发',
    severity: 'critical',
    category: 'exfiltration',
    pattern: /(process\.env\.(GITHUB_TOKEN|OPENAI_API_KEY|ANTHROPIC_API_KEY|AWS_SECRET_ACCESS_KEY)|printenv\s*\|\s*(curl|nc)\b)/g,
    why: '密钥一旦被技能带出，会直接导致账号与账单失守。',
    fix: '仅在内存中使用密钥，禁止打印、写入文件或发送到任何网络端点。',
  },
];

/**
 * 组合规则与结构检查的展示元数据（--rules 输出用，不参与正则扫描）
 * SL017 的实际判定逻辑在 detectExfiltration，SL018–SL020 在 scanner 的 structuralChecks
 */
export const STRUCT_RULES = [
  {
    id: 'SL017',
    title: '凭据读取与外部请求同时出现（疑似外传）',
    severity: 'critical',
    category: 'exfiltration',
    why: '同一文件中既读取凭据、又对外发起请求，两条无害的代码组合起来就是窃密链路。',
    fix: '拆分职责：绝不把凭据变量传入任何网络调用；如需上报状态，只发送非敏感摘要。',
  },
  {
    id: 'SL018',
    title: '缺少 SKILL.md 入口文件',
    severity: 'low',
    category: 'structure',
    why: '没有 SKILL.md 的技能无法被宿主识别与展示，也无法说明自身权限范围。',
    fix: '添加 SKILL.md，包含 name / description / allowed-tools 三个必填字段。',
  },
  {
    id: 'SL019',
    title: '缺少开源许可证',
    severity: 'low',
    category: 'structure',
    why: '没有许可证意味着默认保留所有权利，他人无法合法使用或二次分发。',
    fix: '添加 MIT 或 Apache-2.0 许可证文件。',
  },
  {
    id: 'SL020',
    title: '存在未被文档声明的可执行脚本',
    severity: 'medium',
    category: 'structure',
    why: '文档没有提到这个脚本，使用者不知道它会被执行、做什么、需要什么权限。',
    fix: '在 SKILL.md 中说明该脚本的用途与调用方式，或将其删除。',
  },
];

/**
 * 组合规则：需要同时满足「读到凭据」+「对外发起请求」才判定
 * 用于降低单条正则的误报
 */
export function detectExfiltration(files) {
  const findings = [];
  const CRED = /(process\.env\.[A-Z_]*(KEY|TOKEN|SECRET)|os\.environ(\.get)?\s*[\[(]\s*['"]?[A-Z_]*(KEY|TOKEN|SECRET)|\.ssh\/id_|\.aws\/credentials|\.env\b)/;
  const NET = /(curl\s+(-X\s+POST\s+)?https?:|fetch\(\s*['"]https?:|requests\.post\(|axios\.post\(|nc\s+-)/;

  for (const f of files) {
    if (!f.text) continue;
    const lines = f.text.split('\n');
    let credLine = -1;
    let netLine = -1;
    lines.forEach((l, i) => {
      if (credLine < 0 && CRED.test(l)) credLine = i;
      if (netLine < 0 && NET.test(l)) netLine = i;
    });
    if (credLine >= 0 && netLine >= 0) {
      findings.push({
        ruleId: 'SL017',
        title: '凭据读取与外部请求同时出现（疑似外传）',
        severity: 'critical',
        category: 'exfiltration',
        file: f.rel,
        line: netLine + 1,
        snippet: lines[netLine].trim().slice(0, 160),
        why: `同一文件中第 ${credLine + 1} 行读取了凭据，第 ${netLine + 1} 行向外发起请求。两条无害的代码组合起来就是窃密链路。`,
        fix: '拆分职责：绝不把凭据变量传入任何网络调用；如需上报状态，只发送非敏感摘要。',
      });
    }
  }
  return findings;
}
