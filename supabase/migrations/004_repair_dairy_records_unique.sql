-- ---------------------------------------------------------------------------
-- Repair dairy_records for:
--   "there is no unique or exclusion constraint matching the ON CONFLICT"
--
-- The generic /api/dairy/:collection PUT handler uses:
--   upsert(rows, { onConflict: 'collection,id' })
--
-- That requires a unique index/constraint on (collection, id). Older tables
-- created without the primary key need this repair.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run.
-- ---------------------------------------------------------------------------

-- Optional check: this should return zero rows after the cleanup below.
-- select collection, id, count(*)
-- from public.dairy_records
-- group by collection, id
-- having count(*) > 1;

-- Older installs may have duplicate (collection, id) rows because the unique
-- index was missing. Keep the most recently updated row for each pair before
-- creating the index.
with ranked as (
  select
    ctid,
    row_number() over (
      partition by collection, id
      order by updated_at desc, ctid desc
    ) as row_num
  from public.dairy_records
)
delete from public.dairy_records
where ctid in (
  select ctid
  from ranked
  where row_num > 1
);

create unique index if not exists dairy_records_collection_id_uidx
  on public.dairy_records (collection, id);
