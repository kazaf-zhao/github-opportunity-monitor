/* oxlint-disable typescript/no-explicit-any */
import { githubRequest, getLastGitHubRateLimit } from './github';
import { getRepositoryOpportunities } from './repository-data';
import type {
  CommercialAnalysis,
  CommercialDifficulty,
  CommercialEvidence,
  CommercialIdea,
  CommercialOpportunity,
  OpportunityType,
  RepositoryCategory,
  RepositoryOpportunity,
} from './repositories';
import { supabaseCount, supabaseRequest } from './supabase';

const DAY = 86_400_000;
const ANALYSIS_TTL = 6 * 3_600_000;

type GitHubIssue = {
  title: string;
  created_at: string;
  pull_request?: unknown;
};

type StoredAnalysis = CommercialAnalysis & {
  error_message?: string | null;
};

const ISSUE_PATTERNS = {
  feature_requests:
    /\b(feature|feature request|enhancement|request|proposal|would be nice|please add|support for)\b/i,
  deployment_problems:
    /\b(deploy|deployment|install|installation|setup|docker|self[ -]?host|configuration|environment variable|env var)\b/i,
  integration_requests:
    /\b(integrat|plugin|connector|slack|discord|telegram|notion|chrome|vscode|visual studio code)\b/i,
  hosted_requests: /\b(hosted|hosting|cloud|managed|saas|one[ -]?click)\b/i,
  api_requests: /\b(api|sdk|webhook|endpoint|rest|graphql)\b/i,
  ui_requests:
    /\b(ui|gui|dashboard|web interface|frontend|desktop app|user interface)\b/i,
  bugs: /\b(bug|broken|error|fails?|failure|crash|regression|not working)\b/i,
  documentation_problems:
    /\b(documentation|docs|readme|example|tutorial|guide|unclear)\b/i,
} as const;

const README_PATTERNS = {
  hosted: /\b(hosted|hosting|cloud|managed)\b/gi,
  deployment: /\b(deploy|deployment|self[ -]?host(?:ed)?|docker)\b/gi,
  setup: /\b(install(?:ation)?|setup|configure|configuration)\b/gi,
  api: /\b(api|sdk|webhook|endpoint|rest api|graphql)\b/gi,
  integration:
    /\b(integrat(?:e|ion)|plugin|connector|slack|discord|telegram|notion|chrome|vscode)\b/gi,
  complexity:
    /\b(docker|environment variable|env var|database|api key|command line|cli|configuration)\b/gi,
  cli_library_backend: /\b(cli|command line|library|sdk|backend|server|api)\b/gi,
  ui_present:
    /\b(gui|dashboard|web ui|web interface|desktop app|frontend|react|vue|svelte|screenshot)\b/gi,
} as const;

const clamp = (value: number) => Math.max(0, Math.min(100, value));
const saturate = (value: number, scale: number) =>
  100 * (1 - Math.exp(-Math.max(0, value) / scale));

async function recordCommercialRun(
  status: 'running' | 'success' | 'partial' | 'failed',
  details: Record<string, unknown>,
  id?: string,
) {
  try {
    if (id) {
      await supabaseRequest(`collector_runs?id=eq.${id}`, 'PATCH', {
        status,
        completed_at: status === 'running' ? null : new Date().toISOString(),
        ...details,
      });
      return id;
    }
    const rows = await supabaseRequest<Array<{ id: string }>>(
      'collector_runs',
      'POST',
      { job: 'commercial', status, started_at: new Date().toISOString() },
    );
    return rows[0]?.id;
  } catch (error) {
    console.warn('commercial_run_log_failed', error);
    return id;
  }
}

function matches(text: string, pattern: RegExp) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return [...text.matchAll(new RegExp(pattern.source, flags))].length;
}

function classifyIssues(issues: GitHubIssue[]) {
  const counts = {
    feature_requests: 0,
    deployment_problems: 0,
    integration_requests: 0,
    hosted_requests: 0,
    api_requests: 0,
    ui_requests: 0,
    bugs: 0,
    documentation_problems: 0,
  };
  const examples: Partial<Record<string, string[]>> = {};
  for (const issue of issues) {
    for (const [kind, pattern] of Object.entries(ISSUE_PATTERNS)) {
      if (!pattern.test(issue.title)) continue;
      counts[kind as keyof typeof counts]++;
      const bucket = examples[kind] ?? [];
      if (bucket.length < 3) bucket.push(issue.title.slice(0, 180));
      examples[kind] = bucket;
    }
  }
  return { counts, examples };
}

function readmeSignals(readme: string) {
  return Object.fromEntries(
    Object.entries(README_PATTERNS).map(([key, pattern]) => [
      key,
      Math.min(matches(readme, pattern), 30),
    ]),
  );
}

function audience(category: RepositoryCategory) {
  const audiences: Record<RepositoryCategory, string> = {
    AI: '需要快速采用 AI 能力的产品团队与中小企业',
    Agents: '没有专职 AI 基础设施团队的运营、销售与自动化团队',
    MCP: '希望把内部工具接入 AI 助手的开发团队',
    'Developer Tools': '独立开发者、小型研发团队与技术负责人',
    Data: '需要自动化数据处理的分析团队与运营团队',
    Infrastructure: '缺少专职 DevOps/SRE 的小型技术团队',
    Security: '需要降低安全运维门槛的开发团队与中小企业',
    Productivity: '希望减少重复工作的个人用户与小团队',
    Finance: '需要合规工作流和数据自动化的金融业务团队',
    'Crypto/Web3': '有明确链上运营或开发需求的团队',
    Trading: '有可验证工作流需求的研究者与专业交易团队',
    Science: '缺少工程资源的研究团队与实验室',
    Robotics: '需要快速原型和设备集成的机器人团队',
    Media: '内容团队、创作者与小型工作室',
    Other: '正在采用该开源工具但缺少工程资源的个人与小团队',
  };
  return audiences[category];
}

function buildIdea(
  type: OpportunityType,
  repo: RepositoryOpportunity,
): CommercialIdea {
  const customer = audience(repo.category);
  const ideas: Record<OpportunityType, Omit<CommercialIdea, 'type'>> = {
    'Hosted SaaS': {
      product: `提供 ${repo.name} 的一键托管、升级、备份与运行监控`,
      customer,
      reason: '真实 Issue/README 出现部署、自托管或 Cloud/Managed 需求',
      pricing: '示例：$9–49/月，按实例或用量分档',
    },
    'API Wrapper': {
      product: `把 ${repo.name} 的核心能力封装成稳定 API、密钥管理和用量面板`,
      customer: '不想维护底层开源运行环境的应用开发者与产品团队',
      reason: '存在 API、SDK、Webhook 或 Endpoint 需求信号',
      pricing: '示例：免费额度 + 按调用量，或 $19–99/月',
    },
    'UI Wrapper': {
      product: `为 ${repo.name} 构建可视化 Web/桌面工作台和预设流程`,
      customer: '需要该能力但不会使用 CLI、Library 或复杂配置的非技术用户',
      reason: '项目偏 CLI/Library/Backend，且 GUI/UI 信号不足或有人请求 UI',
      pricing: '示例：$12–39/月，个人版与团队版分层',
    },
    Integration: {
      product: `为 ${repo.name} 提供主流工作流连接器、同步与审计日志`,
      customer,
      reason: '近期 Issue 出现 Integration、Plugin、Slack、Discord、Notion 等请求',
      pricing: '示例：$10–30/连接器/月，团队套餐另计',
    },
    'Vertical SaaS': {
      product: `把 ${repo.name} 封装为面向单一行业的完整任务流、模板和权限系统`,
      customer,
      reason: '底层能力已有增长，垂直用户更愿意为结果而非技术组件付费',
      pricing: '示例：$29–199/月，按席位或业务量收费',
    },
    'Developer Tool': {
      product: `围绕 ${repo.name} 提供团队协作、调试、可观测性和商业支持`,
      customer: '在生产环境采用该项目的开发团队',
      reason: '开发者采用与功能请求形成可付费的效率/可靠性缺口',
      pricing: '示例：$15–49/开发者/月',
    },
    'Data Service': {
      product: `把 ${repo.name} 的数据能力做成持续更新、清洗和导出的托管服务`,
      customer: '需要可靠数据结果但不想维护数据管道的业务团队',
      reason: '数据处理能力可从开源组件升级为持续交付的结果服务',
      pricing: '示例：$49–299/月，按数据量或刷新频率',
    },
    'Automation Service': {
      product: `基于 ${repo.name} 提供预配置自动化流程、定时运行和失败恢复`,
      customer,
      reason: '复杂安装与重复操作意味着用户可能为“直接完成任务”付费',
      pricing: '示例：$19–99/月，按运行次数或工作流数量',
    },
    Plugin: {
      product: `为 ${repo.name} 构建高需求平台插件并提供持续兼容维护`,
      customer: '使用现有 SaaS/IDE/协作平台并需要接入该能力的团队',
      reason: 'Plugin/Connector/平台集成需求已经在 Issue 中出现',
      pricing: '示例：$5–20/月，或团队一次性许可',
    },
    'Enterprise Version': {
      product: `提供 ${repo.name} 的 SSO、权限、审计、SLA 与私有部署版本`,
      customer: '准备在生产环境规模化使用该项目的企业团队',
      reason: '开源核心可用，但企业落地需要治理、可靠性与支持',
      pricing: '示例：年度订阅；需与客户验证后报价',
    },
    Consulting: {
      product: `提供 ${repo.name} 的部署、迁移、集成和定制实施服务`,
      customer: '有明确项目预算但缺少内部实施能力的团队',
      reason: '安装与集成复杂度可以形成短周期服务收入',
      pricing: '示例：按项目或顾问日收费',
    },
    'No Clear Opportunity': {
      product: '先访谈 Issue 参与者并验证一个重复、紧迫、愿意付费的问题',
      customer: '尚未验证',
      reason: '当前真实需求证据不足，不建议仅凭 Star 增长立即开发',
      pricing: '暂不定价，先完成需求验证',
    },
  };
  return { type, ...ideas[type] };
}

function inferTypes(input: {
  repo: RepositoryOpportunity;
  evidence: CommercialEvidence;
  missingUi: boolean;
  complexity: number;
}) {
  const { repo, evidence, missingUi, complexity } = input;
  const types: OpportunityType[] = [];
  const c = evidence;
  if (c.hosted_requests > 0 || c.deployment_problems >= 2 || complexity >= 4)
    types.push('Hosted SaaS');
  if (c.api_requests > 0 || evidence.readme_signals.api >= 3)
    types.push('API Wrapper');
  if (c.ui_requests > 0 || missingUi) types.push('UI Wrapper');
  if (c.integration_requests > 0) types.push('Integration');
  if (c.integration_requests >= 2) types.push('Plugin');
  if (repo.category === 'Data') types.push('Data Service');
  if (repo.category === 'Agents' || repo.category === 'Productivity')
    types.push('Automation Service');
  if (repo.category === 'Developer Tools' || repo.category === 'MCP')
    types.push('Developer Tool');
  if (c.feature_requests >= 3 && repo.open_issues >= 10)
    types.push('Enterprise Version');
  if (complexity >= 5) types.push('Consulting');
  if (!types.length && c.feature_requests >= 2) types.push('Vertical SaaS');
  if (!types.length) types.push('No Clear Opportunity');
  return [...new Set(types)].slice(0, 3);
}

export function analyzeCommercialOpportunity(
  repo: RepositoryOpportunity,
  readme: string,
  issues: GitHubIssue[],
  analyzedAt = new Date(),
): CommercialAnalysis {
  const { counts, examples } = classifyIssues(issues);
  const signals = readmeSignals(readme);
  const evidence: CommercialEvidence = {
    issues_analyzed: issues.length,
    ...counts,
    readme_signals: signals,
    issue_examples: examples,
  };
  const demandWeight =
    counts.feature_requests * 3 +
    counts.deployment_problems * 7 +
    counts.integration_requests * 7 +
    counts.hosted_requests * 9 +
    counts.api_requests * 8 +
    counts.ui_requests * 7 +
    counts.documentation_problems * 2;
  const demandScore = Math.round(saturate(demandWeight, 32));
  const missingUi =
    signals.cli_library_backend >= 2 &&
    signals.ui_present === 0 &&
    !['Media', 'Productivity'].includes(repo.category);
  const complexity = Math.min(
    10,
    signals.complexity + Math.min(counts.deployment_problems, 5),
  );
  const hostedStrength = Math.min(
    100,
    counts.hosted_requests * 30 +
      counts.deployment_problems * 10 +
      signals.hosted * 5,
  );
  const apiStrength = Math.min(100, counts.api_requests * 35 + signals.api * 4);
  const uiStrength = Math.min(
    100,
    counts.ui_requests * 40 + (missingUi ? 55 : 0),
  );
  const integrationStrength = Math.min(
    100,
    counts.integration_requests * 30 + signals.integration * 4,
  );
  const simplificationStrength = Math.min(100, complexity * 12);
  let commercialScore = Math.round(
    0.17 * demandScore +
      0.2 * hostedStrength +
      0.16 * apiStrength +
      0.16 * uiStrength +
      0.16 * integrationStrength +
      0.15 * simplificationStrength,
  );
  const realDemandSignals =
    counts.hosted_requests +
    counts.deployment_problems +
    counts.integration_requests +
    counts.api_requests +
    counts.ui_requests;
  if (
    (repo.category === 'Crypto/Web3' || repo.category === 'Trading') &&
    realDemandSignals < 2
  )
    commercialScore = Math.min(commercialScore, 45);

  const regulated = repo.category === 'Finance' || repo.category === 'Trading';
  const capitalHeavy = repo.category === 'Robotics';
  const difficulty: CommercialDifficulty =
    regulated || capitalHeavy || complexity >= 7
      ? 'Hard'
      : complexity >= 3 || hostedStrength >= 60
        ? 'Medium'
        : 'Easy';
  let indieScore =
    82 +
    (missingUi ? 8 : 0) +
    (apiStrength >= 30 ? 5 : 0) -
    complexity * 4 -
    (regulated ? 22 : 0) -
    (capitalHeavy ? 28 : 0) -
    (repo.category === 'Infrastructure' ? 8 : 0);
  indieScore = Math.round(clamp(indieScore));
  const competitionGap = Math.round(
    clamp(
      20 +
        (missingUi ? 25 : 0) +
        (signals.hosted === 0 && counts.hosted_requests > 0 ? 25 : 0) +
        (counts.integration_requests > 0 ? 15 : 0) +
        (counts.api_requests > 0 ? 15 : 0),
    ),
  );
  const types = inferTypes({ repo, evidence, missingUi, complexity });
  const ideas = types.map((type) => buildIdea(type, repo)).slice(0, 3);
  let moneyScore = Math.round(
    0.3 * demandScore +
      0.25 * commercialScore +
      0.2 * repo.opportunity_score +
      0.15 * indieScore +
      0.1 * competitionGap,
  );
  if (
    (repo.category === 'Crypto/Web3' || repo.category === 'Trading') &&
    realDemandSignals < 2
  )
    moneyScore = Math.min(moneyScore, 50);
  moneyScore = Math.round(clamp(moneyScore));
  const primary = ideas[0];
  const growthEvidence =
    repo.stars_24h !== null
      ? `过去24小时真实增加 ${repo.stars_24h} Star`
      : `GitHub Momentum 为 ${repo.opportunity_score}/100，历史增长仍在采集`;
  const issueEvidence = issues.length
    ? `最近30天分析了 ${issues.length} 个 Issue，其中功能/部署/集成/API/UI 需求共 ${realDemandSignals + counts.feature_requests} 个`
    : '最近30天没有可用的非 PR Issue，需求强度仍需访谈验证';
  return {
    repository_id: repo.id,
    analyzed_at: analyzedAt.toISOString(),
    issue_window_start: new Date(analyzedAt.getTime() - 30 * DAY).toISOString(),
    demand_score: demandScore,
    commercial_score: commercialScore,
    indie_score: indieScore,
    competition_gap: competitionGap,
    money_score: moneyScore,
    opportunity_types: types,
    monetization_ideas: ideas,
    why_now: `${growthEvidence}；${issueEvidence}。`,
    user_pain: primary.reason,
    what_to_build: primary.product,
    who_pays: primary.customer,
    monetization: primary.pricing,
    difficulty,
    estimated_mvp:
      difficulty === 'Easy'
        ? '3–7天'
        : difficulty === 'Medium'
          ? '1–3周'
          : '3–6周以上',
    evidence,
  };
}

async function fetchReadme(repo: RepositoryOpportunity) {
  try {
    const data = await githubRequest<{ content?: string; encoding?: string }>(
      `/repos/${repo.owner}/${repo.name}/readme`,
      {},
      ANALYSIS_TTL,
    );
    if (!data.content) return '';
    return Buffer.from(
      data.content.replace(/\n/g, ''),
      data.encoding === 'base64' ? 'base64' : 'utf8',
    )
      .toString('utf8')
      .slice(0, 200_000);
  } catch {
    return '';
  }
}

async function fetchIssues(repo: RepositoryOpportunity, since: Date) {
  try {
    const result = await githubRequest<GitHubIssue[]>(
      `/repos/${repo.owner}/${repo.name}/issues?state=all&sort=created&direction=desc&per_page=100&since=${encodeURIComponent(since.toISOString())}`,
      {},
      ANALYSIS_TTL,
    );
    return result.filter((issue) => !issue.pull_request);
  } catch {
    return [];
  }
}

async function analyzeAndStore(repo: RepositoryOpportunity) {
  const now = new Date();
  const [readme, issues] = await Promise.all([
    fetchReadme(repo),
    fetchIssues(repo, new Date(now.getTime() - 30 * DAY)),
  ]);
  const analysis = analyzeCommercialOpportunity(repo, readme, issues, now);
  await supabaseRequest(
    'commercial_analyses?on_conflict=repository_id',
    'POST',
    analysis,
    'resolution=merge-duplicates,return=representation',
  );
  return analysis;
}

export async function collectCommercialAnalyses(limit = 24) {
  const runId = await recordCommercialRun('running', {});
  const boundedLimit = Math.min(Math.max(limit, 1), 50);
  try {
    const response = await getRepositoryOpportunities({
      limit: 150,
      includeSpark: false,
      includeCommercial: false,
      applyCategoryLimit: false,
    });
    const ids = response.data.map((repo) => repo.id);
    const existing = ids.length
      ? await supabaseRequest<
          Array<{ repository_id: string; analyzed_at: string }>
        >(
          `commercial_analyses?select=repository_id,analyzed_at&repository_id=in.(${ids.join(',')})`,
        )
      : [];
    const analyzedAt = new Map(
      existing.map((row) => [row.repository_id, Date.parse(row.analyzed_at)]),
    );
    const queue = response.data
      .filter(
        (repo) =>
          Date.now() - (analyzedAt.get(repo.id) ?? 0) >= ANALYSIS_TTL,
      )
      .slice(0, boundedLimit);
    let analyzed = 0;
    const errors: string[] = [];
    for (let start = 0; start < queue.length; start += 4) {
      const batch = await Promise.allSettled(
        queue.slice(start, start + 4).map(analyzeAndStore),
      );
      for (const result of batch) {
        if (result.status === 'fulfilled') analyzed++;
        else errors.push(String(result.reason));
      }
    }
    await recordCommercialRun(
      errors.length ? 'partial' : 'success',
      {
        processed_count: analyzed,
        request_count: queue.length * 2,
        error_message: errors.length ? errors.slice(-5).join('\n') : null,
        rate_limit_remaining: getLastGitHubRateLimit().remaining,
        rate_limit_reset: getLastGitHubRateLimit().reset,
      },
      runId,
    );
    return {
      queued: queue.length,
      analyzed,
      failed: errors.length,
      errors: errors.slice(-5),
      rate_limit: getLastGitHubRateLimit(),
    };
  } catch (error) {
    await recordCommercialRun(
      'failed',
      { error_message: String(error) },
      runId,
    );
    throw error;
  }
}

export async function getCommercialOpportunities(limit = 100) {
  const boundedLimit = Math.min(Math.max(limit, 1), 200);
  const momentum = await getRepositoryOpportunities({
    limit: 500,
    includeSpark: false,
    includeCommercial: true,
    applyCategoryLimit: false,
  });
  const data: CommercialOpportunity[] = momentum.data
    .filter(
      (repository): repository is RepositoryOpportunity & {
        commercial: CommercialAnalysis;
      } => repository.commercial !== null,
    )
    .map((repository) => ({
      repository,
      analysis: repository.commercial,
    }))
    .sort((a, b) => b.analysis.money_score - a.analysis.money_score)
    .slice(0, boundedLimit);
  return {
    data,
    meta: {
      analyzed_count: await supabaseCount('commercial_analyses'),
      updated_at: new Date().toISOString(),
    },
  };
}

export async function getStoredCommercialAnalysis(repositoryId: string) {
  const rows = await supabaseRequest<StoredAnalysis[]>(
    `commercial_analyses?select=repository_id,analyzed_at,issue_window_start,demand_score,commercial_score,indie_score,competition_gap,money_score,opportunity_types,monetization_ideas,why_now,user_pain,what_to_build,who_pays,monetization,difficulty,estimated_mvp,evidence&repository_id=eq.${repositoryId}&limit=1`,
  );
  return rows[0] ?? null;
}
