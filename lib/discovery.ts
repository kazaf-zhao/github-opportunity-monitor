import type { GitHubRepository } from './github';
import type { DiscoverySource, RepositoryCategory } from './repositories';

const DAY = 86_400_000;

export type DiscoveryTier = 'global' | 'A' | 'B' | 'C' | 'D';

export type DiscoveryPlan = {
  query: string;
  sort: 'stars' | 'updated';
  source: DiscoverySource;
  tier: DiscoveryTier;
  pages: number;
};

type TopicPlan = {
  keyword: string;
  source: DiscoverySource;
};

const A_GROUPS: TopicPlan[][] = [
  [
    { keyword: 'AI Agent', source: 'ai_agent' },
    { keyword: 'Agentic AI', source: 'ai_agent' },
    { keyword: 'Coding Agent', source: 'ai_agent' },
    { keyword: 'MCP', source: 'mcp' },
    { keyword: 'Model Context Protocol', source: 'mcp' },
  ],
  [
    { keyword: 'Computer Use', source: 'ai_agent' },
    { keyword: 'Browser Agent', source: 'ai_agent' },
    { keyword: 'Developer Tools', source: 'developer_tools' },
    { keyword: 'AI Infrastructure', source: 'data_infrastructure' },
  ],
  [
    { keyword: 'Inference', source: 'data_infrastructure' },
    { keyword: 'RAG', source: 'ai_agent' },
    { keyword: 'Automation', source: 'productivity' },
    { keyword: 'Self Hosted', source: 'developer_tools' },
  ],
];

const B_GROUPS: TopicPlan[][] = [
  [
    { keyword: 'LLM', source: 'ai_agent' },
    { keyword: 'Database', source: 'data_infrastructure' },
    { keyword: 'Data Engineering', source: 'data_infrastructure' },
  ],
  [
    { keyword: 'Observability', source: 'data_infrastructure' },
    { keyword: 'Security', source: 'security' },
    { keyword: 'Productivity', source: 'productivity' },
  ],
  [
    { keyword: 'Search', source: 'developer_tools' },
    { keyword: 'CLI', source: 'developer_tools' },
    { keyword: 'API', source: 'developer_tools' },
    { keyword: 'SDK', source: 'developer_tools' },
  ],
  [
    { keyword: 'Robotics', source: 'robotics' },
    { keyword: 'Computer Vision', source: 'ai_agent' },
    { keyword: 'Workflow', source: 'productivity' },
  ],
];

const C_GROUPS: TopicPlan[][] = [
  [
    { keyword: 'FinTech', source: 'finance' },
    { keyword: 'Payments', source: 'finance' },
    { keyword: 'Healthcare AI', source: 'science' },
  ],
  [
    { keyword: 'Scientific Computing', source: 'science' },
    { keyword: 'Education', source: 'other_theme' },
    { keyword: 'Video', source: 'media' },
    { keyword: 'Audio', source: 'media' },
  ],
  [
    { keyword: 'Browser Extension', source: 'developer_tools' },
    { keyword: 'Cloud', source: 'data_infrastructure' },
    { keyword: 'Kubernetes', source: 'data_infrastructure' },
  ],
  [
    { keyword: 'Stablecoin', source: 'crypto_web3' },
    { keyword: 'Blockchain', source: 'crypto_web3' },
    { keyword: 'Web3', source: 'crypto_web3' },
  ],
];

const D_GROUPS: TopicPlan[][] = [
  [
    { keyword: 'Crypto', source: 'crypto_web3' },
    { keyword: 'Trading', source: 'trading' },
  ],
  [
    { keyword: 'Trading Bot', source: 'trading' },
    { keyword: 'Crypto Trading', source: 'trading' },
  ],
  [
    { keyword: 'AI Trading', source: 'trading' },
    { keyword: 'Quant Trading', source: 'trading' },
  ],
  [
    { keyword: 'Copy Trading', source: 'trading' },
    { keyword: 'Memecoin', source: 'crypto_web3' },
  ],
  [
    { keyword: 'Hyperliquid', source: 'trading' },
    { keyword: 'Polymarket', source: 'trading' },
  ],
];

function dateBefore(now: number, days: number) {
  return new Date(now - days * DAY).toISOString().slice(0, 10);
}

function globalPlans(now: number): DiscoveryPlan[] {
  const queries = [
    {
      query: `created:>${dateBefore(now, 1)} stars:>10 archived:false`,
      source: 'global_new' as const,
    },
    {
      query: `created:>${dateBefore(now, 3)} stars:>20 archived:false`,
      source: 'global_new' as const,
    },
    {
      query: `created:>${dateBefore(now, 7)} stars:>50 archived:false`,
      source: 'global_new' as const,
    },
    {
      query: `created:>${dateBefore(now, 30)} stars:>100 archived:false`,
      source: 'global_new' as const,
    },
    {
      query: `pushed:>${dateBefore(now, 1)} stars:>50 archived:false`,
      source: 'global_active' as const,
    },
    {
      query: `pushed:>${dateBefore(now, 7)} stars:>100 archived:false`,
      source: 'global_active' as const,
    },
  ];
  return queries.flatMap(({ query, source }) =>
    (['stars', 'updated'] as const).map((sort) => ({
      query,
      sort,
      source,
      tier: 'global' as const,
      pages: 1,
    })),
  );
}

function topicPlans(
  group: TopicPlan[],
  tier: Exclude<DiscoveryTier, 'global'>,
  now: number,
) {
  const date = dateBefore(now, tier === 'A' ? 90 : 180);
  return group.map(
    ({ keyword, source }): DiscoveryPlan => ({
      query: `"${keyword}" pushed:>${date} stars:>10 archived:false`,
      sort: tier === 'A' ? 'updated' : 'stars',
      source,
      tier,
      pages: 1,
    }),
  );
}

/** Global discovery always runs. Topic tiers rotate at deliberately lower rates. */
export function buildDiscoveryPlans(now = Date.now()): DiscoveryPlan[] {
  const hour = Math.floor(now / 3_600_000);
  const plans = [
    ...globalPlans(now),
    ...topicPlans(A_GROUPS[hour % A_GROUPS.length], 'A', now),
  ];
  if (hour % 2 === 0)
    plans.push(
      ...topicPlans(B_GROUPS[Math.floor(hour / 2) % B_GROUPS.length], 'B', now),
    );
  if (hour % 3 === 0)
    plans.push(
      ...topicPlans(C_GROUPS[Math.floor(hour / 3) % C_GROUPS.length], 'C', now),
    );
  if (hour % 6 === 0) {
    // Only one high-noise query per six-hour run. This keeps tier D below 10%
    // of the topic-search request budget even on its active hour.
    const group = D_GROUPS[Math.floor(hour / 6) % D_GROUPS.length];
    const member = group[Math.floor(hour / 6 / D_GROUPS.length) % group.length];
    plans.push(...topicPlans([member], 'D', now));
  }
  return plans;
}

const CATEGORY_RULES: Array<{
  category: RepositoryCategory;
  terms: RegExp;
}> = [
  {
    category: 'MCP',
    terms: /\b(mcp|model context protocol)\b/i,
  },
  {
    category: 'Trading',
    terms:
      /\b(trading|trader|trade bot|copytrade|copy trading|quant trading|polymarket|hyperliquid|prediction market|memecoin)\b/i,
  },
  {
    category: 'Crypto/Web3',
    terms:
      /\b(crypto|blockchain|web3|stablecoin|defi|ethereum|solana|bitcoin|wallet|smart contract)\b/i,
  },
  {
    category: 'Agents',
    terms:
      /\b(agent|agents|agentic|multi-agent|computer use|browser agent|coding agent)\b/i,
  },
  {
    category: 'Security',
    terms:
      /\b(security|cybersecurity|vulnerability|vulnerabilities|pentest|malware|auth|authentication|secrets?)\b/i,
  },
  {
    category: 'Robotics',
    terms: /\b(robot|robotics|ros|drone|autonomous vehicle)\b/i,
  },
  {
    category: 'Science',
    terms:
      /\b(scientific|science|biology|chemistry|physics|healthcare|medical|genomics|research computing)\b/i,
  },
  {
    category: 'Media',
    terms: /\b(video|audio|voice|music|image generation|streaming|media)\b/i,
  },
  {
    category: 'Data',
    terms:
      /\b(database|data engineering|analytics|etl|warehouse|vector database|search engine|data pipeline)\b/i,
  },
  {
    category: 'Infrastructure',
    terms:
      /\b(infrastructure|kubernetes|cloud|observability|monitoring|distributed system|container|devops|deployment|serverless)\b/i,
  },
  {
    category: 'Developer Tools',
    terms:
      /\b(developer tool|devtool|cli|sdk|api|ide|compiler|debugger|framework|library|self-hosted|self hosted)\b/i,
  },
  {
    category: 'Productivity',
    terms:
      /\b(productivity|workflow|automation|note-taking|calendar|task management|knowledge base)\b/i,
  },
  {
    category: 'Finance',
    terms: /\b(fintech|payment|payments|banking|finance|financial|invoice)\b/i,
  },
  {
    category: 'AI',
    terms:
      /\b(ai|artificial intelligence|llm|inference|rag|machine learning|deep learning|computer vision|openai|claude)\b/i,
  },
];

export function classifyRepository(
  repository: Pick<GitHubRepository, 'name' | 'description' | 'topics'>,
): RepositoryCategory {
  const text = [
    repository.name,
    repository.description ?? '',
    ...(repository.topics ?? []),
  ]
    .join(' ')
    .replace(/[-_./]+/g, ' ');
  return (
    CATEGORY_RULES.find(({ terms }) => terms.test(text))?.category ?? 'Other'
  );
}
