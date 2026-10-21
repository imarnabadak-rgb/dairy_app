# DairyFlow historical CSV export

These files were generated from the original demo dataset before the app was
moved to a database-only data layer. They are kept for reference only and are
**not** used by the running app. Current data lives in Supabase
(`public.dairy_records`).

| File                  | Rows | Columns | Collection       |
| --------------------- | ---: | ------: | ---------------- |
| `cattle.csv`          |   10 |      21 | Cattle herd      |
| `milk_logs.csv`       |   13 |      12 | Milk production  |
| `customers.csv`       |    8 |      13 | Customers        |
| `supply_logs.csv`     |    8 |      14 | Daily deliveries |
| `invoices.csv`        |    4 |      11 | Invoices         |
| `vaccines.csv`        |    5 |      14 | Vaccine records  |
| `storage_tanks.csv`   |    2 |       8 | Bulk tanks       |
| `feed_inventory.csv`  |    4 |       8 | Feed stock       |
| `expenses.csv`        |    8 |       9 | Farm expenses    |
| `_summary.csv`        |    9 |       4 | Export index     |

## Snapshot

- **62 records** across 9 collections.
- **Herd:** 10 cattle — 7 lactating, 2 pregnant/dry, 1 heifer. One cow
  (`DF-103 Ruby`) is under antibiotic withdrawal; one (`DF-107 Ganga`) is under
  observation.
- **Milk logs:** 85.2 L on 2026-10-02 (morning) + 65.8 L on 2026-10-01
  (evening) = **151.0 L**. 12.5 L was discarded, leaving **138.5 L usable**.
- **Customers:** 8 accounts with a combined quota of **175.5 L/day**.
- **Deliveries:** 8 on 2026-10-02 — 5 delivered, 3 pending — worth **$365.70**.
- **Invoices:** 4 September 2026 invoices — **$9,292.50** billed,
  **$8,717.50** paid, **$575.00** outstanding.
- **Vaccines:** 5 records — 3 completed, 2 scheduled.
- **Tanks:** 775 L stored out of 1,800 L capacity at 3.6–3.8 °C.
- **Feed:** 9,070 kg in stock; 397.2 kg/day combined burn rate.
- **Expenses:** 8 entries totalling **$1,135.50**.

## Relationships

- `milk_logs.cowId` → `cattle.id`
- `supply_logs.customerId` → `customers.id`
- `invoices.customerId` → `customers.id`
- `vaccines.cattleId` → `cattle.id` (empty for herd-wide vaccines)

## Notes

- `cattle.feedRation` is flattened into `feedRation.silageKg`,
  `feedRation.concentrateKg`, `feedRation.greenFodderKg` and
  `feedRation.mineralsG`.
- Missing optional fields export as empty cells.
- Dates use `YYYY-MM-DD`; timestamps such as tank sanitisation keep the source
  format (`YYYY-MM-DD HH:mm`).
- Numbers are exported as-is, so `9.10` becomes `9.1`.
- Milk logs only cover two days (2026-10-01 and 2026-10-02), so the Milk Yield
  tab's 10-day default showed those two days at export time.
- The live Supabase table has since gained additional records (for example a
  2026-10-03 milk log), which are not included in these files.

The mock-data export script and seed script were removed with the demo dataset.
Use the Supabase table editor or SQL editor for current exports.
