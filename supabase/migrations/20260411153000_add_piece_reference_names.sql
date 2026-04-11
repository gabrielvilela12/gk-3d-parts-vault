alter table public.pieces
  add column if not exists reference_names text[] not null default '{}'::text[];
