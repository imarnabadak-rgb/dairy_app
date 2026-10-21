import { isDairyCollection, type DairyCollection } from './collections';

export const MAX_RECORDS_PER_INSERT = 5000;

export interface InsertRow {
  collection: DairyCollection;
  id: string;
  data: Record<string, unknown>;
  updated_at: string;
}

export class InsertValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsertValidationError';
  }
}

/**
 * Validates form records and turns them into `dairy_records` INSERT rows.
 *
 * When `defaultCollection` is supplied (e.g. POST /api/dairy/milk_logs), the
 * record does not need its own `collection`. Otherwise each record must include
 * a valid `collection` so related rows can be inserted together.
 */
export function buildInsertRows(
  rawRecords: unknown,
  defaultCollection?: DairyCollection
): InsertRow[] {
  if (!Array.isArray(rawRecords)) {
    throw new InsertValidationError('Body must contain a `records` array.');
  }
  if (rawRecords.length === 0) {
    throw new InsertValidationError('`records` must contain at least one record.');
  }
  if (rawRecords.length > MAX_RECORDS_PER_INSERT) {
    throw new InsertValidationError(
      `A single insert cannot contain more than ${MAX_RECORDS_PER_INSERT} records.`
    );
  }

  const updatedAt = new Date().toISOString();
  const seen = new Set<string>();
  const rows: InsertRow[] = [];

  for (const rawRecord of rawRecords) {
    if (!rawRecord || typeof rawRecord !== 'object' || Array.isArray(rawRecord)) {
      throw new InsertValidationError('Every record must be an object with an `id`.');
    }

    const { id, collection: recordCollection, ...data } = rawRecord as Record<
      string,
      unknown
    >;

    if (typeof id !== 'string' || id.trim() === '') {
      throw new InsertValidationError('Every record must have a non-empty string `id`.');
    }

    const collection = defaultCollection ?? recordCollection;
    if (typeof collection !== 'string' || !isDairyCollection(collection)) {
      throw new InsertValidationError(
        defaultCollection
          ? `Unknown collection: ${String(recordCollection)}.`
          : 'Every record must include a valid `collection`.'
      );
    }

    const key = `${collection}:${id}`;
    if (seen.has(key)) {
      throw new InsertValidationError(`Duplicate record: ${collection}/${id}.`);
    }
    seen.add(key);

    rows.push({ collection, id, data, updated_at: updatedAt });
  }

  return rows;
}
