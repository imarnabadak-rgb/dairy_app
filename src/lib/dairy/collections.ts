/**
 * The collections stored in the `dairy_records` table. Keeping this list in
 * one place lets the API validate URLs and lets the client iterate safely.
 */
export const DAIRY_COLLECTIONS = [
  'cattle',
  'milk_logs',
  'customers',
  'supply_logs',
  'invoices',
  'vaccines',
  'tanks',
  'feeds',
  'expenses',
] as const;

export type DairyCollection = (typeof DAIRY_COLLECTIONS)[number];

/**
 * Collections whose JSON payload contains a `date` field. The API uses this
 * to translate `?from=&to=` into a Postgres JSON path filter.
 */
export const COLLECTION_DATE_FIELD: Partial<Record<DairyCollection, string>> = {
  milk_logs: 'date',
  supply_logs: 'date',
  expenses: 'date',
};

export type DairyRecord = { id: string } & Record<string, unknown>;

export function isDairyCollection(value: string): value is DairyCollection {
  return (DAIRY_COLLECTIONS as readonly string[]).includes(value);
}

/** Newest-first for date-based collections; stable order otherwise. */
export function sortDairyRecords(
  collection: DairyCollection,
  records: DairyRecord[]
): DairyRecord[] {
  const dateField = COLLECTION_DATE_FIELD[collection];
  if (!dateField) return records;

  return [...records].sort((a, b) =>
    String(b[dateField] ?? '').localeCompare(String(a[dateField] ?? ''))
  );
}
