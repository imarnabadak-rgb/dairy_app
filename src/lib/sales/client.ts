import type { MilkSale } from '@/types/dairy';

export interface SalesSaveResult {
  saved: number;
  deleted: number;
  updatedAt: string;
}

export interface SalesInsertResult {
  inserted: number;
  ids: string[];
  insertedAt: string;
}

interface ApiErrorBody {
  success?: boolean;
  error?: string;
  message?: string;
  configured?: boolean;
}

interface SalesListResponse extends ApiErrorBody {
  data?: MilkSale[];
  count?: number;
}

interface SalesSaveResponse extends ApiErrorBody {
  saved?: number;
  deleted?: number;
  updatedAt?: string;
}

interface SalesInsertResponse extends ApiErrorBody {
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
  throw new Error(
    body?.error ??
      body?.message ??
      `${fallback} (${response.status})`
  );
}

/** Fetch the dedicated milk-sales table. */
export async function fetchMilkSales(): Promise<MilkSale[]> {
  const response = await fetch('/api/sales', { cache: 'no-store' });
  const body = await readJson<SalesListResponse>(response);

  if (!response.ok || !body?.success) {
    throwApiError(response, body, 'Could not load milk sales');
  }

  return body.data ?? [];
}

/** Replace the sales table with these records. */
export async function saveMilkSales(
  records: MilkSale[]
): Promise<SalesSaveResult> {
  const response = await fetch('/api/sales', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records }),
  });
  const body = await readJson<SalesSaveResponse>(response);

  if (!response.ok || !body?.success) {
    throwApiError(response, body, 'Could not save milk sales');
  }

  return {
    saved: body.saved ?? records.length,
    deleted: body.deleted ?? 0,
    updatedAt: body.updatedAt ?? new Date().toISOString(),
  };
}

/** Insert a new sale immediately; the collection sync is the retry path. */
export async function insertMilkSale(
  record: MilkSale
): Promise<SalesInsertResult> {
  const response = await fetch('/api/sales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records: [record] }),
  });
  const body = await readJson<SalesInsertResponse>(response);

  if (!response.ok || !body?.success) {
    throwApiError(response, body, 'Could not insert milk sale');
  }

  return {
    inserted: body.inserted ?? 1,
    ids: body.ids ?? [record.id],
    insertedAt: body.insertedAt ?? new Date().toISOString(),
  };
}
