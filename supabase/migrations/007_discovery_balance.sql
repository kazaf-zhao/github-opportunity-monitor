alter table repositories
  add column if not exists discovery_sources text[] not null default '{}',
  add column if not exists category text not null default 'Other';

create index if not exists idx_repositories_category
  on repositories(category);
create index if not exists idx_repositories_discovery_sources
  on repositories using gin(discovery_sources);

alter table collector_runs
  add column if not exists discovery_source_counts jsonb not null default '{}'::jsonb,
  add column if not exists query_tier_counts jsonb not null default '{}'::jsonb;

alter table candidate_recall_status
  add column if not exists category_pool_counts jsonb not null default '{}'::jsonb,
  add column if not exists top50_category_counts jsonb not null default '{}'::jsonb,
  add column if not exists category_bias jsonb not null default '[]'::jsonb;

comment on column repositories.discovery_sources is
  'Merged global and topic discovery channels that have observed this repository';
comment on column repositories.category is
  'Rule-based internal category derived from repository name, description and topics';

-- Backfill the existing production corpus so category controls and the bias
-- monitor become useful immediately, before each repository is rediscovered.
update repositories
set category = case
  when lower(concat_ws(' ', name, description, array_to_string(topics, ' ')))
    ~ '(mcp|model context protocol)' then 'MCP'
  when lower(concat_ws(' ', name, description, array_to_string(topics, ' ')))
    ~ '(trading|trader|trade bot|copytrade|copy trading|quant trading|polymarket|hyperliquid|prediction market|memecoin)' then 'Trading'
  when lower(concat_ws(' ', name, description, array_to_string(topics, ' ')))
    ~ '(crypto|blockchain|web3|stablecoin|defi|ethereum|solana|bitcoin|wallet|smart contract)' then 'Crypto/Web3'
  when lower(concat_ws(' ', name, description, array_to_string(topics, ' ')))
    ~ '(agent|agentic|multi-agent|computer use|browser agent|coding agent)' then 'Agents'
  when lower(concat_ws(' ', name, description, array_to_string(topics, ' ')))
    ~ '(security|cybersecurity|vulnerability|pentest|malware|authentication)' then 'Security'
  when lower(concat_ws(' ', name, description, array_to_string(topics, ' ')))
    ~ '(robot|robotics|\mros\M|drone|autonomous vehicle)' then 'Robotics'
  when lower(concat_ws(' ', name, description, array_to_string(topics, ' ')))
    ~ '(scientific|science|biology|chemistry|physics|healthcare|medical|genomics)' then 'Science'
  when lower(concat_ws(' ', name, description, array_to_string(topics, ' ')))
    ~ '(video|audio|voice|music|image generation|streaming|media)' then 'Media'
  when lower(concat_ws(' ', name, description, array_to_string(topics, ' ')))
    ~ '(database|data engineering|analytics|\metl\M|warehouse|vector database|search engine|data pipeline)' then 'Data'
  when lower(concat_ws(' ', name, description, array_to_string(topics, ' ')))
    ~ '(infrastructure|kubernetes|cloud|observability|monitoring|distributed system|container|devops|deployment|serverless)' then 'Infrastructure'
  when lower(concat_ws(' ', name, description, array_to_string(topics, ' ')))
    ~ '(developer tool|devtool|\mcli\M|\msdk\M|\mapi\M|\mide\M|compiler|debugger|framework|library|self-hosted|self hosted)' then 'Developer Tools'
  when lower(concat_ws(' ', name, description, array_to_string(topics, ' ')))
    ~ '(productivity|workflow|automation|note-taking|calendar|task management|knowledge base)' then 'Productivity'
  when lower(concat_ws(' ', name, description, array_to_string(topics, ' ')))
    ~ '(fintech|payment|banking|finance|financial|invoice)' then 'Finance'
  when lower(concat_ws(' ', name, description, array_to_string(topics, ' ')))
    ~ '(^|[^a-z])(ai|llm|rag)([^a-z]|$)|artificial intelligence|inference|machine learning|deep learning|computer vision|openai|claude' then 'AI'
  else 'Other'
end;
