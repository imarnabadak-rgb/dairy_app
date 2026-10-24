-- Run this in the Supabase SQL Editor.
-- Tables used by the server-side API.

create table if not exists public.dairy_records (
  collection text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);

-- Older projects may have a restrictive collection CHECK constraint. The
-- generic table and the app-side collection registry support new collections,
-- so keep the database from rejecting them.
alter table public.dairy_records
  drop constraint if exists dairy_records_collection_check;

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

-- ---------------------------------------------------------------------------
-- Dedicated milk-sales table. Sales use /api/sales instead of dairy_records.
-- ---------------------------------------------------------------------------

create table if not exists public.milk_sales (
  id text primary key,
  sale_date date not null,
  buyer_id text,
  buyer_name text not null,
  session text not null
    check (session in ('Morning', 'Evening', 'Combined')),
  quantity_liters numeric(12, 3) not null
    check (quantity_liters > 0),
  clr numeric(8, 3)
    check (clr is null or clr >= 0),
  fat_percentage numeric(6, 3)
    check (fat_percentage is null or fat_percentage >= 0),
  snf_percentage numeric(6, 3)
    check (snf_percentage is null or snf_percentage >= 0),
  base_rate numeric(12, 4)
    check (base_rate is null or base_rate > 0),
  rate_per_liter numeric(12, 4) not null
    check (rate_per_liter >= 0),
  total_amount numeric(14, 2) not null
    check (total_amount >= 0),
  payment_status text not null
    check (payment_status in ('Paid', 'Pending')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Repair an older milk_sales table that was created without a primary key.
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

create index if not exists milk_sales_date_idx
  on public.milk_sales (sale_date desc);

create index if not exists milk_sales_buyer_idx
  on public.milk_sales (buyer_id);

create index if not exists milk_sales_payment_status_idx
  on public.milk_sales (payment_status);

create or replace function public.touch_milk_sales_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists milk_sales_touch_updated_at on public.milk_sales;
create trigger milk_sales_touch_updated_at
  before update on public.milk_sales
  for each row
  execute function public.touch_milk_sales_updated_at();

alter table public.milk_sales enable row level security;

drop policy if exists "milk_sales_select" on public.milk_sales;
drop policy if exists "milk_sales_insert" on public.milk_sales;
drop policy if exists "milk_sales_update" on public.milk_sales;
drop policy if exists "milk_sales_delete" on public.milk_sales;

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

grant select, insert, update, delete on public.milk_sales to anon, authenticated;
