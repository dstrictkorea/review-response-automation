# Architecture 02. Data Model SQL

```sql
create table branches (
  id uuid primary key default gen_random_uuid(),
  code varchar(10) unique not null,
  name_ko text not null,
  name_en text,
  region text not null,
  default_language varchar(10) not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table channels (
  id uuid primary key default gen_random_uuid(),
  code varchar(50) unique not null,
  name text not null,
  automation_class varchar(10) not null,
  collection_mode text not null,
  publish_mode text not null,
  is_active boolean default true
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id),
  channel_id uuid references channels(id),
  source_review_id text,
  review_url text,
  reviewer_public_name text,
  rating numeric(2,1),
  review_text text,
  review_language varchar(10),
  review_created_at timestamptz,
  collected_at timestamptz default now(),
  source_payload jsonb,
  normalized_hash text not null,
  unique(branch_id, channel_id, normalized_hash)
);

create table ai_analyses (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references reviews(id) on delete cascade,
  prompt_version text not null,
  model_name text not null,
  detected_language varchar(10),
  sentiment text,
  risk_level text,
  categories text[],
  risk_reasons text[],
  language_confidence numeric(4,3),
  publishability_score numeric(4,3),
  internal_note_ko text,
  raw_output jsonb,
  created_at timestamptz default now()
);

create table reply_drafts (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references reviews(id) on delete cascade,
  ai_analysis_id uuid references ai_analyses(id),
  reply_language varchar(10),
  draft_short text,
  draft_standard text,
  draft_careful text,
  selected_draft_type text,
  selected_reply text,
  human_edited_reply text,
  created_at timestamptz default now()
);

create table approval_decisions (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references reviews(id),
  reply_draft_id uuid references reply_drafts(id),
  status text not null,
  approver_user_id uuid,
  approver_name text,
  comment text,
  approved_reply text,
  decided_at timestamptz default now()
);

create table publishing_jobs (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references reviews(id),
  approval_decision_id uuid references approval_decisions(id),
  channel_publish_mode text not null,
  status text not null,
  external_reply_id text,
  error_message text,
  attempted_at timestamptz,
  published_at timestamptz,
  created_at timestamptz default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null,
  actor_id text,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz default now()
);

create table prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_key text not null,
  version text not null,
  content text not null,
  status text not null,
  created_by text,
  created_at timestamptz default now(),
  unique(prompt_key, version)
);
```

## 2. Required Indexes

```sql
create index idx_reviews_branch_channel_created on reviews(branch_id, channel_id, review_created_at desc);
create index idx_ai_risk on ai_analyses(risk_level);
create index idx_approval_status on approval_decisions(status);
create index idx_publishing_status on publishing_jobs(status);
create index idx_audit_entity on audit_logs(entity_type, entity_id);
```
