export type Signal =
  | 'BREAKOUT'
  | 'ACCELERATING'
  | 'NEW & HOT'
  | 'HIGH CONVERSION'
  | 'EARLY SIGNAL';
export type Repo = {
  name: string;
  owner: string;
  description: string;
  descriptionZh: string;
  category: string;
  language: string;
  stars: number;
  stars24h: number;
  stars7d: number;
  stars30d: number;
  forks: number;
  issues: number;
  age: number;
  score: number;
  velocity: number;
  signals: Signal[];
  topics: string[];
  created: string;
  pushed: string;
  spark: number[];
};
export const repositories: Repo[] = [
  {
    name: 'stagehand',
    owner: 'browserbase',
    description: 'AI browser automation framework built for production agents.',
    descriptionZh: '面向生产环境 AI 智能体的浏览器自动化框架。',
    category: 'Agents',
    language: 'TypeScript',
    stars: 12842,
    stars24h: 624,
    stars7d: 2410,
    stars30d: 7096,
    forks: 812,
    issues: 84,
    age: 118,
    score: 94,
    velocity: 26,
    signals: ['BREAKOUT', 'ACCELERATING'],
    topics: ['browser', 'ai-agents', 'automation'],
    created: 'May 14, 2026',
    pushed: '8 min ago',
    spark: [8, 12, 11, 18, 22, 21, 28, 34, 42, 39, 51, 62],
  },
  {
    name: 'open-computer-use',
    owner: 'helios-labs',
    description: 'Composable computer-use agents that run locally.',
    descriptionZh: '可在本地运行、支持自由组合的计算机操作智能体。',
    category: 'AI',
    language: 'Python',
    stars: 1847,
    stars24h: 391,
    stars7d: 1182,
    stars30d: 1721,
    forks: 274,
    issues: 31,
    age: 19,
    score: 91,
    velocity: 16.3,
    signals: ['NEW & HOT', 'EARLY SIGNAL'],
    topics: ['computer-use', 'local-ai', 'agents'],
    created: 'Aug 24, 2026',
    pushed: '22 min ago',
    spark: [2, 3, 4, 6, 9, 14, 16, 21, 27, 35, 47, 58],
  },
  {
    name: 'mcp-router',
    owner: 'tensorhq',
    description: 'Fast, observable gateway for production MCP servers.',
    descriptionZh: '为生产级 MCP 服务打造的高性能、可观测网关。',
    category: 'MCP',
    language: 'Rust',
    stars: 3219,
    stars24h: 286,
    stars7d: 1054,
    stars30d: 2638,
    forks: 492,
    issues: 18,
    age: 63,
    score: 87,
    velocity: 11.9,
    signals: ['ACCELERATING', 'HIGH CONVERSION'],
    topics: ['mcp', 'gateway', 'observability'],
    created: 'Jul 11, 2026',
    pushed: '1 hr ago',
    spark: [5, 8, 12, 10, 14, 18, 24, 22, 31, 38, 42, 49],
  },
  {
    name: 'signalbase',
    owner: 'market-labs',
    description: 'Open source prediction market data and execution stack.',
    descriptionZh: '开源预测市场数据与交易执行基础设施。',
    category: 'Trading',
    language: 'Go',
    stars: 976,
    stars24h: 174,
    stars7d: 688,
    stars30d: 910,
    forks: 181,
    issues: 23,
    age: 27,
    score: 84,
    velocity: 7.3,
    signals: ['NEW & HOT', 'EARLY SIGNAL'],
    topics: ['prediction-markets', 'trading', 'data'],
    created: 'Aug 16, 2026',
    pushed: '3 hr ago',
    spark: [1, 4, 3, 7, 12, 15, 19, 23, 29, 32, 41, 45],
  },
  {
    name: 'ragstream',
    owner: 'northstar-ai',
    description: 'Streaming RAG pipeline with sub-100ms retrieval.',
    descriptionZh: '检索延迟低于 100 毫秒的流式 RAG 数据管线。',
    category: 'Data',
    language: 'Python',
    stars: 7481,
    stars24h: 151,
    stars7d: 821,
    stars30d: 2204,
    forks: 1022,
    issues: 67,
    age: 203,
    score: 78,
    velocity: 6.3,
    signals: ['HIGH CONVERSION'],
    topics: ['rag', 'vector-db', 'streaming'],
    created: 'Feb 21, 2026',
    pushed: '47 min ago',
    spark: [18, 16, 21, 19, 24, 28, 27, 33, 31, 39, 42, 44],
  },
  {
    name: 'vaultkit',
    owner: 'stableworks',
    description:
      'Stablecoin orchestration primitives for application developers.',
    descriptionZh: '面向应用开发者的稳定币编排组件与开发工具。',
    category: 'Crypto',
    language: 'TypeScript',
    stars: 1422,
    stars24h: 128,
    stars7d: 504,
    stars30d: 1160,
    forks: 203,
    issues: 14,
    age: 46,
    score: 76,
    velocity: 5.3,
    signals: ['EARLY SIGNAL'],
    topics: ['stablecoin', 'payments', 'sdk'],
    created: 'Jul 28, 2026',
    pushed: '2 hr ago',
    spark: [4, 7, 5, 11, 13, 17, 21, 19, 25, 29, 35, 39],
  },
  {
    name: 'shipyard',
    owner: 'formless',
    description: 'Self-hosted preview environments from a single config.',
    descriptionZh: '通过单一配置创建可自托管的预览环境。',
    category: 'Infrastructure',
    language: 'Go',
    stars: 5294,
    stars24h: 97,
    stars7d: 446,
    stars30d: 1390,
    forks: 386,
    issues: 42,
    age: 154,
    score: 70,
    velocity: 4,
    signals: ['ACCELERATING'],
    topics: ['devtools', 'preview', 'kubernetes'],
    created: 'Apr 11, 2026',
    pushed: '5 hr ago',
    spark: [12, 15, 14, 16, 18, 22, 20, 23, 26, 28, 33, 36],
  },
];
export const signalStyles: Record<Signal, string> = {
  BREAKOUT: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300',
  ACCELERATING: 'border-violet-400/30 bg-violet-400/10 text-violet-300',
  'NEW & HOT': 'border-orange-400/30 bg-orange-400/10 text-orange-300',
  'HIGH CONVERSION': 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  'EARLY SIGNAL': 'border-sky-400/30 bg-sky-400/10 text-sky-300',
};
export const signalZh: Record<Signal, string> = {
  BREAKOUT: '爆发',
  ACCELERATING: '加速中',
  'NEW & HOT': '新晋热门',
  'HIGH CONVERSION': '高转化',
  'EARLY SIGNAL': '早期信号',
};
