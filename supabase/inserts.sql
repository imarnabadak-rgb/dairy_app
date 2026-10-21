-- ---------------------------------------------------------------------------
-- DairyFlow manual INSERT examples.
-- Optional: run individual statements in the Supabase SQL Editor.
-- The running app inserts through POST /api/dairy and POST /api/dairy/:collection.
-- ---------------------------------------------------------------------------

-- Form INSERT examples
--
-- The running app uses parameterized INSERTs through
--   POST /api/dairy/:collection
--   POST /api/dairy              (related rows across collections)
-- which execute the equivalent of:
--
--   insert into public.dairy_records (collection, id, data, updated_at)
--   values ($1, $2, $3::jsonb, $4);
--
-- The examples below are for the Supabase SQL Editor / manual data entry.
-- `data` holds the record fields; `id` is kept as a separate column.
-- ---------------------------------------------------------------------------

-- Milk Yield: Fast Herd Batch Entry / Log Single Cow
insert into public.dairy_records (collection, id, data)
values (
  'milk_logs',
  'ml_example_001',
  jsonb_build_object(
    'date', '2026-10-21',
    'session', 'Morning',
    'cowId', 'c2',
    'cowTag', 'DF-102',
    'liters', 20,
    'fatPercentage', 4.2,
    'snfPercentage', 8.8,
    'qualityStatus', 'Optimal',
    'isWithheld', false,
    'milkerName', 'Arnab'
  )
);

-- Cattle herd
insert into public.dairy_records (collection, id, data)
values (
  'cattle',
  'c_example_001',
  jsonb_build_object(
    'tagNumber', 'DF-110',
    'name', 'Lakshmi',
    'breed', 'Holstein Friesian',
    'status', 'Lactating',
    'healthCondition', 'Healthy',
    'dob', '2022-03-15',
    'lactationCycle', 2,
    'avgDailyYield', 22,
    'weightKg', 520,
    'feedRation', jsonb_build_object(
      'silageKg', 12,
      'concentrateKg', 5,
      'greenFodderKg', 8,
      'mineralsG', 100
    )
  )
);

-- Customer
insert into public.dairy_records (collection, id, data)
values (
  'customers',
  'cust_example_001',
  jsonb_build_object(
    'name', 'Green Leaf Cafe',
    'phone', '+1-555-0100',
    'customerType', 'Commercial / Cafe',
    'address', '12 Market Street',
    'route', 'Route A',
    'dailyQuotaLiters', 15,
    'milkType', 'Whole Cow Milk',
    'unitPrice', 1.2,
    'balanceDue', 0,
    'preferredSession', 'Morning',
    'status', 'Active'
  )
);

-- Daily delivery / supply log
insert into public.dairy_records (collection, id, data)
values (
  'supply_logs',
  'del_example_001',
  jsonb_build_object(
    'date', '2026-10-21',
    'customerId', 'cust_example_001',
    'customerName', 'Green Leaf Cafe',
    'customerType', 'Commercial / Cafe',
    'route', 'Route A',
    'quantityLiters', 15,
    'unitPrice', 1.2,
    'totalAmount', 18,
    'deliveryStatus', 'Pending',
    'paymentStatus', 'Added to Ledger',
    'bottlesReturned', 0
  )
);

-- Invoice
insert into public.dairy_records (collection, id, data)
values (
  'invoices',
  'INV-EXAMPLE-001',
  jsonb_build_object(
    'customerId', 'cust_example_001',
    'customerName', 'Green Leaf Cafe',
    'billingMonth', 'October 2026',
    'totalLiters', 450,
    'ratePerLiter', 1.2,
    'totalAmount', 540,
    'paidAmount', 0,
    'status', 'Pending',
    'issueDate', '2026-10-21',
    'dueDate', '2026-11-20'
  )
);

-- Vaccine / health record
insert into public.dairy_records (collection, id, data)
values (
  'vaccines',
  'vac_example_001',
  jsonb_build_object(
    'vaccineName', 'FMD Booster',
    'targetType', 'Individual',
    'cattleId', 'c2',
    'cattleTag', 'DF-102',
    'administeredDate', '2026-10-21',
    'nextDueDate', '2027-04-21',
    'veterinarian', 'Dr. Rao',
    'batchLot', 'FMD-2026-A',
    'dosageMl', 2,
    'status', 'Completed',
    'requiresMilkWithdrawal', true,
    'withdrawalDays', 3
  )
);

-- Bulk tank
insert into public.dairy_records (collection, id, data)
values (
  'tanks',
  'tank_example_001',
  jsonb_build_object(
    'name', 'Tank A',
    'capacityLiters', 1000,
    'currentLiters', 320,
    'tempCelsius', 3.8,
    'milkType', 'Whole Cow Milk',
    'lastSanitized', '2026-10-21',
    'status', 'Chilling'
  )
);

-- Feed inventory
insert into public.dairy_records (collection, id, data)
values (
  'feeds',
  'feed_example_001',
  jsonb_build_object(
    'name', 'Maize Silage',
    'category', 'Forage / Silage',
    'stockKg', 1800,
    'dailyBurnKg', 120,
    'minThresholdKg', 400,
    'costPerKg', 0.18,
    'supplier', 'Green Valley Feeds'
  )
);

-- Farm expense
insert into public.dairy_records (collection, id, data)
values (
  'expenses',
  'exp_example_001',
  jsonb_build_object(
    'date', '2026-10-21',
    'title', 'Diesel for generator',
    'category', 'Fuel & Equipment',
    'amount', 85.5,
    'vendor', 'City Fuel Station',
    'paymentMethod', 'Card / UPI',
    'receiptNumber', 'RCPT-1042'
  )
);

-- Related rows in one statement (customer + first delivery).
-- The API does this through POST /api/dairy.
insert into public.dairy_records (collection, id, data)
values
  (
    'customers',
    'cust_example_002',
    jsonb_build_object(
      'name', 'Hilltop Grocery',
      'phone', '+1-555-0111',
      'customerType', 'Retail Store',
      'address', '88 Hill Road',
      'route', 'Route B',
      'dailyQuotaLiters', 10,
      'milkType', 'A2 Desi Milk',
      'unitPrice', 1.5,
      'balanceDue', 0,
      'preferredSession', 'Evening',
      'status', 'Active'
    )
  ),
  (
    'supply_logs',
    'del_example_002',
    jsonb_build_object(
      'date', '2026-10-21',
      'customerId', 'cust_example_002',
      'customerName', 'Hilltop Grocery',
      'customerType', 'Retail Store',
      'route', 'Route B',
      'quantityLiters', 10,
      'unitPrice', 1.5,
      'totalAmount', 15,
      'deliveryStatus', 'Pending',
      'paymentStatus', 'Added to Ledger',
      'bottlesReturned', 0
    )
  );

-- Re-runnable version (manual seed / import): upsert by (collection, id).
-- insert into public.dairy_records (collection, id, data, updated_at)
-- values ('milk_logs', 'ml_example', '{"date":"2026-10-21","liters":20}'::jsonb, now())
-- on conflict (collection, id)
-- do update set data = excluded.data, updated_at = excluded.updated_at;
