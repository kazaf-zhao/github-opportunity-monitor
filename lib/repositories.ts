export type Signal =
  | 'BREAKOUT'
  | 'ACCELERATING'
  | 'NEW & HOT'
  | 'HIGH CONVERSION'
  | 'EARLY SIGNAL';

export type VelocitySource = '1h' | '6h' | '24h' | null;
export type RepositoryCategory =
  | 'AI'
  | 'Agents'
  | 'MCP'
  | 'Developer Tools'
  | 'Data'
  | 'Infrastructure'
  | 'Security'
  | 'Productivity'
  | 'Finance'
  | 'Crypto/Web3'
  | 'Trading'
  | 'Science'
  | 'Robotics'
  | 'Media'
  | 'Other';
export type DiscoverySource =
  | 'global_new'
  | 'global_active'
  | 'ai_agent'
  | 'mcp'
  | 'developer_tools'
  | 'data_infrastructure'
  | 'security'
  | 'productivity'
  | 'finance'
  | 'crypto_web3'
  | 'trading'
  | 'science'
  | 'robotics'
  | 'media'
  | 'other_theme';
export type RecallSource =
  | 'recent_created'
  | 'recent_active'
  | 'small_repo'
  | 'early_stage'
  | 'star_spike'
  | 'high_acceleration'
  | 'high_relative_growth';

export type OpportunityType =
  | 'Hosted SaaS'
  | 'API Wrapper'
  | 'UI Wrapper'
  | 'Integration'
  | 'Vertical SaaS'
  | 'Developer Tool'
  | 'Data Service'
  | 'Automation Service'
  | 'Plugin'
  | 'Enterprise Version'
  | 'Consulting'
  | 'No Clear Opportunity';

export type CommercialDifficulty = 'Easy' | 'Medium' | 'Hard';

export type CommercialIdea = {
  type: OpportunityType;
  product: string;
  customer: string;
  reason: string;
  pricing: string;
};

export type CommercialEvidence = {
  issues_analyzed: number;
  feature_requests: number;
  deployment_problems: number;
  integration_requests: number;
  hosted_requests: number;
  api_requests: number;
  ui_requests: number;
  bugs: number;
  documentation_problems: number;
  readme_signals: Record<string, number>;
  issue_examples: Partial<Record<string, string[]>>;
};

export type CommercialAnalysis = {
  repository_id: string;
  analyzed_at: string;
  issue_window_start: string;
  demand_score: number;
  commercial_score: number;
  indie_score: number;
  competition_gap: number;
  money_score: number;
  opportunity_types: OpportunityType[];
  monetization_ideas: CommercialIdea[];
  why_now: string;
  user_pain: string;
  what_to_build: string;
  who_pays: string;
  monetization: string;
  difficulty: CommercialDifficulty;
  estimated_mvp: string;
  evidence: CommercialEvidence;
};

export type RepositoryOpportunity = {
  id: string;
  github_id: number;
  owner: string;
  name: string;
  full_name: string;
  description: string | null;
  description_zh?: string | null;
  github_url: string;
  stars: number;
  forks: number;
  open_issues: number;
  primary_language: string | null;
  topics: string[];
  category: RepositoryCategory;
  discovery_sources: DiscoverySource[];
  created_at: string;
  pushed_at: string | null;
  updated_at: string;
  last_snapshot_at: string | null;
  repository_age_days: number;
  stars_1h: number | null;
  stars_6h: number | null;
  stars_24h: number | null;
  stars_7d: number | null;
  stars_30d: number | null;
  relative_growth_24h: number | null;
  velocity: number | null;
  velocity_source: VelocitySource;
  acceleration: number | null;
  opportunity_score: number;
  signals: Signal[];
  recall_sources: RecallSource[];
  spark: number[];
  spark_timestamps: string[];
  commercial: CommercialAnalysis | null;
};

export type CommercialOpportunity = {
  repository: RepositoryOpportunity;
  analysis: CommercialAnalysis;
};

export type CommercialApiResponse = {
  data: CommercialOpportunity[];
  meta: {
    analyzed_count: number;
    updated_at: string;
  };
};

export type RepositoryApiResponse = {
  data: RepositoryOpportunity[];
  meta: {
    repository_count: number;
    snapshot_count: number;
    last_snapshot_at: string | null;
    data_status: 'LIVE' | 'RECENT' | 'STALE' | 'WAITING';
    updated_at: string;
    recall_stats?: {
      source_counts: Record<RecallSource, number>;
      candidate_count: number;
      deduplicated_count: number;
      category_pool_counts?: Partial<Record<RepositoryCategory, number>>;
      top50_category_counts?: Partial<Record<RepositoryCategory, number>>;
      category_bias?: Array<{
        category: RepositoryCategory;
        pool_share: number;
        top50_share: number;
        ratio: number;
      }>;
    };
  };
};

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
