-- ---------------------------------------------------------------------------
-- Dedicated milk-sales table.
--
-- Sales are no longer stored as JSON rows in public.dairy_records. The app
-- reads and writes this table through /api/sales.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run.
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
-- ON CONFLICT (id) and Supabase upserts require a single-column unique index.
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

-- Backfill sales that were previously stored in dairy_records. Rows that do
-- not match the new constraints are skipped rather than failing the migration.
insert into public.milk_sales (
  id,
  sale_date,
  buyer_id,
  buyer_name,
  session,
  quantity_liters,
  clr,
  fat_percentage,
  snf_percentage,
  base_rate,
  rate_per_liter,
  total_amount,
  payment_status,
  notes,
  created_at,
  updated_at
)
select
  d.id,
  (d.data->>'date')::date,
  nullif(d.data->>'buyerId', ''),
  coalesce(
    nullif(d.data->>'buyerName', ''),
    nullif(d.data->>'centerName', ''),
    'Unknown buyer'
  ),
  case
    when d.data->>'session' in ('Morning', 'Evening', 'Combined')
      then d.data->>'session'
    else 'Combined'
  end,
  (d.data->>'quantityLiters')::numeric,
  case
    when d.data->>'clr' ~ '^[0-9]+(\.[0-9]+)?$'
      then (d.data->>'clr')::numeric
  end,
  case
    when d.data->>'fatPercentage' ~ '^[0-9]+(\.[0-9]+)?$'
      then (d.data->>'fatPercentage')::numeric
  end,
  case
    when d.data->>'snfPercentage' ~ '^[0-9]+(\.[0-9]+)?$'
      then (d.data->>'snfPercentage')::numeric
  end,
  case
    when d.data->>'baseRate' ~ '^[0-9]+(\.[0-9]+)?$'
      and (d.data->>'baseRate')::numeric > 0
      then (d.data->>'baseRate')::numeric
  end,
  (d.data->>'ratePerLiter')::numeric,
  round(
    (d.data->>'quantityLiters')::numeric
      * (d.data->>'ratePerLiter')::numeric,
    2
  ),
  case
    when d.data->>'paymentStatus' = 'Paid' then 'Paid'
    else 'Pending'
  end,
  nullif(d.data->>'notes', ''),
  d.updated_at,
  d.updated_at
from public.dairy_records d
where d.collection = 'sales'
  and d.data->>'date' ~ '^\d{4}-\d{2}-\d{2}$'
  and d.data->>'quantityLiters' ~ '^[0-9]+(\.[0-9]+)?$'
  and (d.data->>'quantityLiters')::numeric > 0
  and d.data->>'ratePerLiter' ~ '^[0-9]+(\.[0-9]+)?$'
on conflict (id) do nothing;

-- The old JSON sales rows are intentionally left in place as a backup. After
-- verifying the new table, they can be removed with:
--   delete from public.dairy_records where collection = 'sales';
