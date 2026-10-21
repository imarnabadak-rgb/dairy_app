-- Run this in the Supabase SQL Editor.
-- Table used by src/lib/supabase.ts

create table if not exists public.dairy_records (
  collection text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);

alter table public.dairy_records enable row level security;

drop policy if exists "dairy_records_select" on public.dairy_records;
drop policy if exists "dairy_records_insert" on public.dairy_records;
drop policy if exists "dairy_records_update" on public.dairy_records;
drop policy if exists "dairy_records_delete" on public.dairy_records;

create policy "dairy_records_select"
  on public.dairy_records for select
  to anon, authenticated
  using (true);

create policy "dairy_records_insert"
  on public.dairy_records for insert
  to anon, authenticated
  with check (true);

create policy "dairy_records_update"
  on public.dairy_records for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "dairy_records_delete"
  on public.dairy_records for delete
  to anon, authenticated
  using (true);

grant select, insert, update, delete on public.dairy_records to anon, authenticated;
