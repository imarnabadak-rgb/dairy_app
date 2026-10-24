import type { DairyCollection, DairyRecord } from './collections';

export type DataSourceStatus = 'loading' | 'saving' | 'database' | 'error';

export interface AllDairyData {
  data: Partial<Record<DairyCollection, DairyRecord[]>>;
  counts: Record<string, number>;
  fetchedAt: string;
}

export interface SaveResult {
  collection: DairyCollection;
  saved: number;
  deleted: number;
  updatedAt: string;
}

export interface InsertResult {
  inserted: number;
  ids: string[];
  insertedAt: string;
}

export class DatabaseNotConfiguredError extends Error {
  constructor(message = 'Supabase environment variables are missing.') {
    super(message);
    this.name = 'DatabaseNotConfiguredError';
  }
}

interface ApiErrorBody {
  success?: boolean;
  error?: string;
  message?: string;
  configured?: boolean;
}

interface AllDairyResponse extends ApiErrorBody {
  data?: Partial<Record<DairyCollection, DairyRecord[]>>;
  counts?: Record<string, number>;
  fetchedAt?: string;
}

interface CollectionResponse extends ApiErrorBody {
  data?: DairyRecord[];
  count?: number;
}

interface SaveResponse extends ApiErrorBody {
  saved?: number;
  deleted?: number;
  updatedAt?: string;
}

interface InsertResponse extends ApiErrorBody {
  inserted?: number;
  ids?: string[];
  insertedAt?: string;
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function throwApiError(
  response: Response,
  body: ApiErrorBody | null,
  fallback: string
): never {
  if (response.status === 503 && body?.configured === false) {
    throw new DatabaseNotConfiguredError(body.message ?? body.error);
  }

  throw new Error(body?.error ?? body?.message ?? `${fallback} (${response.status})`);
}

/** Fetch every collection in one request. */
export async function fetchAllDairyData(): Promise<AllDairyData> {
  const response = await fetch('/api/dairy', { cache: 'no-store' });
  const body = await readJson<AllDairyResponse>(response);

  if (!response.ok || !body?.success) {
    throwApiError(response, body, 'Could not load farm data');
  }

  return {
    data: body.data ?? {},
    counts: body.counts ?? {},
    fetchedAt: body.fetchedAt ?? new Date().toISOString(),
  };
}

/** Fetch one collection, optionally filtered by a date range. */
export async function fetchDairyCollection(
  collection: DairyCollection,
  options: { from?: string; to?: string; limit?: number; offset?: number } = {}
): Promise<DairyRecord[]> {
  const params = new URLSearchParams();
  if (options.from) params.set('from', options.from);
  if (options.to) params.set('to', options.to);
  if (options.limit) params.set('limit', String(options.limit));
  if (options.offset) params.set('offset', String(options.offset));

  const query = params.toString();
  const response = await fetch(
    `/api/dairy/${encodeURIComponent(collection)}${query ? `?${query}` : ''}`,
    { cache: 'no-store' }
  );
  const body = await readJson<CollectionResponse>(response);

  if (!response.ok || !body?.success) {
    throwApiError(response, body, `Could not load ${collection}`);
  }

  return body.data ?? [];
}

/** Replace a collection: upsert these rows and delete rows no longer present. */
export async function saveDairyCollection<T extends { id: string }>(
  collection: DairyCollection,
  records: T[]
): Promise<SaveResult> {
  const response = await fetch(`/api/dairy/${encodeURIComponent(collection)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records }),
  });
  const body = await readJson<SaveResponse>(response);

  if (!response.ok || !body?.success) {
    throwApiError(response, body, `Could not save ${collection}`);
  }

  return {
    collection,
    saved: body.saved ?? records.length,
    deleted: body.deleted ?? 0,
    updatedAt: body.updatedAt ?? new Date().toISOString(),
  };
}

/**
 * Insert one form record with an explicit database INSERT (not an upsert).
 * Used by the add actions in DairyContext.
 */
export async function insertDairyRecord<T extends { id: string }>(
  collection: DairyCollection,
  record: T
): Promise<InsertResult> {
  const response = await fetch(`/api/dairy/${encodeURIComponent(collection)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records: [record] }),
  });
  const body = await readJson<InsertResponse>(response);

  if (!response.ok || !body?.success) {
    throwApiError(response, body, `Could not insert into ${collection}`);
  }

  return {
    inserted: body.inserted ?? 1,
    ids: body.ids ?? [record.id],
    insertedAt: body.insertedAt ?? new Date().toISOString(),
  };
}

/**
 * Permanently delete one record from a collection. This is an immediate
 * database delete; the debounced collection sync still runs as a safety net.
 */
export async function deleteDairyRecord(
  collection: DairyCollection,
  id: string
): Promise<void> {
  const response = await fetch(
    `/api/dairy/${encodeURIComponent(collection)}?id=${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  );
  const body = await readJson<ApiErrorBody>(response);

  if (!response.ok || !body?.success) {
    throwApiError(response, body, `Could not delete from ${collection}`);
  }
}

/**
 * Insert records across one or more collections in a single INSERT. Used by
 * forms that create related rows (for example a customer + delivery row).
 */
export async function insertDairyRecords<T extends { id: string }>(
  records: Array<T & { collection: DairyCollection }>
): Promise<InsertResult> {
  const response = await fetch('/api/dairy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records }),
  });
  const body = await readJson<InsertResponse>(response);

  if (!response.ok || !body?.success) {
    throwApiError(response, body, 'Could not insert farm records');
  }

  return {
    inserted: body.inserted ?? records.length,
    ids: body.ids ?? records.map((record) => record.id),
    insertedAt: body.insertedAt ?? new Date().toISOString(),
  };
}
