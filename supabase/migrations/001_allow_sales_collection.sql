-- Legacy cleanup for the old JSON-based sales collection.
--
-- Some earlier installs added a CHECK constraint that only allowed the
-- original collection names. Sales now live in public.milk_sales (see
-- 002_create_milk_sales.sql). Run this only if you still have old sales rows in
-- dairy_records or want the generic table to accept future collections.
--
-- Run this once in the Supabase SQL Editor for an existing project.

alter table public.dairy_records
  drop constraint if exists dairy_records_collection_check;
