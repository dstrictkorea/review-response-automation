-- ARTE Review Desk — Initial Schema
-- Run this in your Supabase SQL editor or via Supabase CLI

create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name_ko text not null,
  name_en text,
  default_language text not null default 'ko',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists channels (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  collection_mode text not null default 'manual',
  publish_mode text not null default 'manual_copy',
  is_active boolean not null default true
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  branch_code text not null,
  channel_code text not null,
  source_review_id text,
  review_url text,
  reviewer_name text,
  rating numeric(2,1),
  review_text text,
  review_language text,
  review_created_at timestamptz,
  status text not null default 'new'
    check (status in ('new','ai_done','approved','manual_published','no_reply','escalated','failed')),
  risk_level text check (risk_level in ('low','medium','high','critical')),
  categories text[],
  risk_reasons text[],
  sentiment text check (sentiment in ('positive','neutral','mixed','negative')),
  internal_note_ko text,
  normalized_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_code, channel_code, normalized_hash)
);

create table if not exists reply_drafts (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references reviews(id) on delete cascade,
  draft_short text,
  draft_standard text,
  draft_careful text,
  selected_draft_type text,
  selected_reply text,
  human_edited_reply text,
  forbidden_check jsonb,
  prompt_version text,
  model_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb not null,
  description text,
  updated_by text,
  updated_at timestamptz not null default now()
);

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references reviews(id) on delete set null,
  actor_name text,
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_reviews_branch on reviews(branch_code);
create index if not exists idx_reviews_channel on reviews(channel_code);
create index if not exists idx_reviews_status on reviews(status);
create index if not exists idx_reviews_risk on reviews(risk_level);
create index if not exists idx_reviews_created on reviews(created_at desc);
create index if not exists idx_reply_drafts_review on reply_drafts(review_id);
create index if not exists idx_activity_logs_review on activity_logs(review_id);
create index if not exists idx_activity_logs_created on activity_logs(created_at desc);

-- Enable Row Level Security
alter table branches enable row level security;
alter table channels enable row level security;
alter table reviews enable row level security;
alter table reply_drafts enable row level security;
alter table app_settings enable row level security;
alter table activity_logs enable row level security;

-- RLS Policies: authenticated users only
create policy "authenticated_read_branches" on branches for select to authenticated using (true);
create policy "authenticated_write_branches" on branches for all to authenticated using (true);

create policy "authenticated_read_channels" on channels for select to authenticated using (true);
create policy "authenticated_write_channels" on channels for all to authenticated using (true);

create policy "authenticated_read_reviews" on reviews for select to authenticated using (true);
create policy "authenticated_write_reviews" on reviews for all to authenticated using (true);

create policy "authenticated_read_drafts" on reply_drafts for select to authenticated using (true);
create policy "authenticated_write_drafts" on reply_drafts for all to authenticated using (true);

create policy "authenticated_read_settings" on app_settings for select to authenticated using (true);
create policy "authenticated_write_settings" on app_settings for all to authenticated using (true);

create policy "authenticated_read_logs" on activity_logs for select to authenticated using (true);
create policy "authenticated_write_logs" on activity_logs for insert to authenticated with check (true);
