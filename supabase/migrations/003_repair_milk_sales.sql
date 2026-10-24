-- ---------------------------------------------------------------------------
-- Repair milk_sales for:
--   1. "no unique or exclusion constraint matching the ON CONFLICT"
--   2. "new row violates row-level security policy"
--
-- Run this once in the Supabase SQL Editor after the milk_sales table exists.
-- Safe to re-run.
-- ---------------------------------------------------------------------------

begin;

-- 1. ON CONFLICT (id) needs a single-column unique index/constraint on id.
do $$
begin
  if not exists (
    select 1
    from pg_index i
    join pg_attribute a
      on a.attrelid = i.indrelid
     and a.attnum = i.indkey[0]
    where i.indrelid = 'public.milk_sales'::regclass
      and i.indisunique
      and i.indnatts = 1
      and a.attname = 'id'
  ) then
    create unique index milk_sales_id_uidx
      on public.milk_sales (id);
  end if;
end $$;

-- If the statement above fails because duplicate ids exist, remove the
-- duplicates first, then run this file again:
--
-- delete from public.milk_sales a
-- using public.milk_sales b
-- where a.id = b.id
--   and a.ctid < b.ctid;

-- 2. Allow the server API (anon/publishable key) to read and write sales.
alter table public.milk_sales enable row level security;

-- Remove any old/restrictive policies first, regardless of their names.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'milk_sales'
  loop
    execute format(
      'drop policy if exists %I on public.milk_sales',
      policy_row.policyname
    );
  end loop;
end $$;

create policy "milk_sales_select"
  on public.milk_sales for select
  to anon, authenticated
  using (true);

create policy "milk_sales_insert"
  on public.milk_sales for insert
  to anon, authenticated
  with check (true);

create policy "milk_sales_update"
  on public.milk_sales for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "milk_sales_delete"
  on public.milk_sales for delete
  to anon, authenticated
  using (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.milk_sales
  to anon, authenticated;

commit;
