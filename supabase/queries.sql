-- ---------------------------------------------------------------------------
-- DairyFlow read queries, views, and indexes.
-- Run this after supabase/schema.sql. Safe to re-run.
-- ---------------------------------------------------------------------------

-- Indexes -------------------------------------------------------------------
create index if not exists dairy_records_collection_idx
  on public.dairy_records (collection);

-- Speeds up `?from=&to=` filters such as data->>date >= '2026-10-01'.
create index if not exists dairy_records_collection_date_idx
  on public.dairy_records (collection, ((data->>'date')));

create index if not exists dairy_records_updated_at_idx
  on public.dairy_records (updated_at desc);

-- Typed milk-log view -------------------------------------------------------
create or replace view public.dairy_milk_logs
with (security_invoker = true) as
select
  id,
  (data->>'date')::date as date,
  data->>'session' as session,
  data->>'cowId' as cow_id,
  data->>'cowTag' as cow_tag,
  (data->>'liters')::numeric as liters,
  (data->>'fatPercentage')::numeric as fat_percentage,
  (data->>'snfPercentage')::numeric as snf_percentage,
  coalesce((data->>'isWithheld')::boolean, false) as is_withheld,
  data->>'qualityStatus' as quality_status,
  data->>'milkerName' as milker_name,
  data->>'notes' as notes
from public.dairy_records
where collection = 'milk_logs';

-- Daily milk summary --------------------------------------------------------
create or replace view public.dairy_milk_daily
with (security_invoker = true) as
select
  date,
  sum(liters) as total_liters,
  sum(liters) filter (
    where not is_withheld and quality_status <> 'Discarded'
  ) as usable_liters,
  sum(liters) filter (
    where is_withheld or quality_status = 'Discarded'
  ) as discarded_liters,
  round(avg(fat_percentage), 2) as avg_fat,
  round(avg(snf_percentage), 2) as avg_snf,
  count(*) as log_count
from public.dairy_milk_logs
group by date;

-- Outstanding invoices ------------------------------------------------------
create or replace view public.dairy_outstanding_invoices
with (security_invoker = true) as
select
  id,
  data->>'customerName' as customer_name,
  data->>'billingMonth' as billing_month,
  (data->>'totalAmount')::numeric as total_amount,
  (data->>'paidAmount')::numeric as paid_amount,
  (data->>'totalAmount')::numeric - (data->>'paidAmount')::numeric as balance_due,
  (data->>'dueDate')::date as due_date,
  data->>'status' as status
from public.dairy_records
where collection = 'invoices'
  and data->>'status' <> 'Paid';

-- Feed stock ----------------------------------------------------------------
create or replace view public.dairy_feed_status
with (security_invoker = true) as
select
  id,
  data->>'name' as name,
  data->>'category' as category,
  (data->>'stockKg')::numeric as stock_kg,
  (data->>'dailyBurnKg')::numeric as daily_burn_kg,
  (data->>'minThresholdKg')::numeric as min_threshold_kg,
  round(
    (data->>'stockKg')::numeric / nullif((data->>'dailyBurnKg')::numeric, 0),
    1
  ) as days_remaining
from public.dairy_records
where collection = 'feeds';

-- Summary function ----------------------------------------------------------
create or replace function public.get_milk_production_summary(
  p_from date,
  p_to date
)
returns table (
  total_liters numeric,
  usable_liters numeric,
  discarded_liters numeric,
  avg_fat numeric,
  avg_snf numeric,
  log_count bigint
)
language sql
stable
security invoker
as $$
  select
    coalesce(sum(liters), 0) as total_liters,
    coalesce(
      sum(liters) filter (
        where not is_withheld and quality_status <> 'Discarded'
      ),
      0
    ) as usable_liters,
    coalesce(
      sum(liters) filter (
        where is_withheld or quality_status = 'Discarded'
      ),
      0
    ) as discarded_liters,
    round(coalesce(avg(fat_percentage), 0), 2) as avg_fat,
    round(coalesce(avg(snf_percentage), 0), 2) as avg_snf,
    count(*) as log_count
  from public.dairy_milk_logs
  where date between p_from and p_to;
$$;

-- Permissions (needed when the API uses the anon/publishable key) ----------
grant select on
  public.dairy_milk_logs,
  public.dairy_milk_daily,
  public.dairy_outstanding_invoices,
  public.dairy_feed_status
to anon, authenticated;

grant execute on function public.get_milk_production_summary(date, date)
to anon, authenticated;

-- Example queries -----------------------------------------------------------
-- 1. Last 10 days of milk production
-- select * from public.dairy_milk_daily
-- where date >= current_date - interval '9 days'
-- order by date desc;

-- 2. Custom date range
-- select * from public.dairy_milk_daily
-- where date between '2026-10-01' and '2026-10-10'
-- order by date desc;

-- 3. Per-cow yield in a date range
-- select cow_tag, sum(liters) as liters
-- from public.dairy_milk_logs
-- where date between '2026-10-01' and '2026-10-10'
-- group by cow_tag
-- order by liters desc;

-- 4. Morning vs evening production
-- select session, sum(liters) as liters
-- from public.dairy_milk_logs
-- where date >= current_date - interval '9 days'
-- group by session;

-- 5. Outstanding balances
-- select * from public.dairy_outstanding_invoices
-- order by due_date;

-- 6. Feed days remaining
-- select * from public.dairy_feed_status
-- order by days_remaining asc;

-- 7. Expenses by category
-- select data->>'category' as category,
--        sum((data->>'amount')::numeric) as amount
-- from public.dairy_records
-- where collection = 'expenses'
-- group by 1
-- order by amount desc;

-- 8. Server-side summary for a range
-- select * from public.get_milk_production_summary('2026-10-01', '2026-10-10');

-- Form INSERT examples: see supabase/inserts.sql.
