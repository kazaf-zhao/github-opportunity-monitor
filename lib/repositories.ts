export type Signal =
  | 'BREAKOUT'
  | 'ACCELERATING'
  | 'NEW & HOT'
  | 'HIGH CONVERSION'
  | 'EARLY SIGNAL';

export type VelocitySource = '1h' | '6h' | '24h' | null;

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
  created_at: string;
  pushed_at: string | null;
  updated_at: string;
  last_snapshot_at: string | null;
  repository_age_days: number;
  stars_1h: number | null;
  stars_24h: number | null;
  stars_7d: number | null;
  stars_30d: number | null;
  velocity: number | null;
  velocity_source: VelocitySource;
  acceleration: number | null;
  opportunity_score: number;
  signals: Signal[];
  spark: number[];
  spark_timestamps: string[];
};

export type RepositoryApiResponse = {
  data: RepositoryOpportunity[];
  meta: {
    repository_count: number;
    snapshot_count: number;
    last_snapshot_at: string | null;
    data_status: 'LIVE' | 'RECENT' | 'STALE' | 'WAITING';
    updated_at: string;
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
