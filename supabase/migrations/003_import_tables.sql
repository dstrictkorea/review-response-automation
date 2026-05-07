-- review_import_batches: one record per CSV upload
create table review_import_batches (
  id uuid primary key default gen_random_uuid(),
  branch_code text not null references branches(code),
  channel_code text not null references channels(code),
  import_format text not null,
  original_filename text,
  total_rows int not null default 0,
  valid_rows int not null default 0,
  duplicate_rows int not null default 0,
  error_rows int not null default 0,
  imported_rows int not null default 0,
  created_by text,
  created_at timestamptz not null default now()
);

alter table review_import_batches enable row level security;
create policy "authenticated_all" on review_import_batches
  for all to authenticated using (true) with check (true);

-- review_import_rows: one record per CSV row
create table review_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references review_import_batches(id) on delete cascade,
  row_index int not null,
  source_payload jsonb,
  mapped_payload jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'imported', 'duplicate', 'error')),
  error_message text,
  review_id uuid references reviews(id),
  created_at timestamptz not null default now()
);

alter table review_import_rows enable row level security;
create policy "authenticated_all" on review_import_rows
  for all to authenticated using (true) with check (true);

create index on review_import_rows (batch_id);

-- Add import tracking columns to reviews
alter table reviews
  add column if not exists source_import_batch_id uuid references review_import_batches(id),
  add column if not exists source_import_row_id uuid references review_import_rows(id),
  add column if not exists import_hash text;

create index on reviews (source_import_batch_id);
create index on reviews (import_hash);
