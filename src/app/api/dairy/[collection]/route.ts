import { NextResponse } from 'next/server';
import {
  COLLECTION_DATE_FIELD,
  isDairyCollection,
  sortDairyRecords,
  type DairyRecord,
} from '@/lib/dairy/collections';
import {
  buildInsertRows,
  InsertValidationError,
  type InsertRow,
} from '@/lib/dairy/insert';
import {
  DAIRY_RECORDS_TABLE,
  getMissingDatabaseEnv,
  getSupabaseServerClient,
  isDatabaseConfigured,
} from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RECORDS_PER_SAVE = 5000;

interface StoredRow {
  id: string;
  data: Record<string, unknown> | null;
}

function notConfiguredResponse() {
  return NextResponse.json(
    {
      success: false,
      configured: false,
      error: 'Database is not configured.',
      message: `Missing Supabase environment variables: ${getMissingDatabaseEnv().join(', ')}.`,
    },
    { status: 503 }
  );
}

/**
 * GET /api/dairy/:collection?from=2026-10-01&to=2026-10-10&limit=100
 *
 * Date filters are translated to PostgREST JSON-path filters, e.g.
 * `data->>date=gte.2026-10-01`. Only collections with a `date` field support
 * them (see COLLECTION_DATE_FIELD).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ collection: string }> }
) {
  const { collection } = await params;

  if (!isDairyCollection(collection)) {
    return NextResponse.json(
      { success: false, error: `Unknown collection: ${collection}.` },
      { status: 404 }
    );
  }

  if (!isDatabaseConfigured()) {
    return notConfiguredResponse();
  }

  const url = new URL(request.url);
  const from = url.searchParams.get('from') ?? undefined;
  const to = url.searchParams.get('to') ?? undefined;
  const dateField = COLLECTION_DATE_FIELD[collection];

  if (from && !DATE_PATTERN.test(from)) {
    return NextResponse.json(
      { success: false, error: '`from` must use YYYY-MM-DD.' },
      { status: 400 }
    );
  }
  if (to && !DATE_PATTERN.test(to)) {
    return NextResponse.json(
      { success: false, error: '`to` must use YYYY-MM-DD.' },
      { status: 400 }
    );
  }
  if (from && to && from > to) {
    return NextResponse.json(
      { success: false, error: '`from` cannot be after `to`.' },
      { status: 400 }
    );
  }
  if ((from || to) && !dateField) {
    return NextResponse.json(
      {
        success: false,
        error: `Collection "${collection}" does not support date filtering.`,
      },
      { status: 400 }
    );
  }

  let limit: number | undefined;
  const limitParam = url.searchParams.get('limit');
  if (limitParam) {
    const parsed = Number(limitParam);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
      return NextResponse.json(
        { success: false, error: '`limit` must be an integer between 1 and 1000.' },
        { status: 400 }
      );
    }
    limit = parsed;
  }

  let offset: number | undefined;
  const offsetParam = url.searchParams.get('offset');
  if (offsetParam) {
    const parsed = Number(offsetParam);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return NextResponse.json(
        { success: false, error: '`offset` must be a non-negative integer.' },
        { status: 400 }
      );
    }
    offset = parsed;
  }

  try {
    const supabase = getSupabaseServerClient();
    let query = supabase
      .from(DAIRY_RECORDS_TABLE)
      .select('id,data')
      .eq('collection', collection);

    if (dateField) {
      if (from) query = query.gte(`data->>${dateField}`, from);
      if (to) query = query.lte(`data->>${dateField}`, to);
    }

    if (offset !== undefined || limit !== undefined) {
      const start = offset ?? 0;
      const end = limit ? start + limit - 1 : start + 999;
      query = query.range(start, end);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const records = ((data ?? []) as StoredRow[]).map((row) => ({
      ...(row.data ?? {}),
      id: row.id,
    }));
    const sorted = sortDairyRecords(collection, records);

    return NextResponse.json({
      success: true,
      collection,
      count: sorted.length,
      data: sorted,
    });
  } catch (error) {
    console.error(`[api/dairy/${collection}] GET failed`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : `Could not load ${collection}.`,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dairy/:collection
 * Body: { "records": [{ "id": "ml_...", ...fields }] }
 *
 * Inserts new form records with a real INSERT (not an upsert). The client also
 * keeps the debounced collection sync as a retry/safety net.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ collection: string }> }
) {
  const { collection } = await params;

  if (!isDairyCollection(collection)) {
    return NextResponse.json(
      { success: false, error: `Unknown collection: ${collection}.` },
      { status: 404 }
    );
  }

  if (!isDatabaseConfigured()) {
    return notConfiguredResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Request body must be valid JSON.' },
      { status: 400 }
    );
  }

  const payload =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as { records?: unknown; record?: unknown })
      : {};
  const rawRecords =
    payload.records ?? (payload.record !== undefined ? [payload.record] : undefined);

  let rows: InsertRow[];
  try {
    rows = buildInsertRows(rawRecords, collection);
  } catch (error) {
    if (error instanceof InsertValidationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    throw error;
  }

  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from(DAIRY_RECORDS_TABLE).insert(rows);

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'A record with that id already exists.' },
          { status: 409 }
        );
      }
      throw new Error(error.message);
    }

    if (process.env.NODE_ENV !== 'production') {
      console.info(
        `[api/dairy/${collection}] inserted ${rows.length} row(s): ${rows
          .map((row) => row.id)
          .join(', ')}`
      );
    }

    return NextResponse.json({
      success: true,
      collection,
      inserted: rows.length,
      ids: rows.map((row) => row.id),
      insertedAt: rows[0]?.updated_at ?? new Date().toISOString(),
    });
  } catch (error) {
    console.error(`[api/dairy/${collection}] POST failed`, error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : `Could not insert ${collection}.`,
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/dairy/:collection
 * Body: { "records": [{ "id": "c1", ...fields }] }
 *
 * Replaces the collection by upserting the supplied rows and deleting rows
 * that are no longer present. The app uses this to mirror local edits.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ collection: string }> }
) {
  const { collection } = await params;

  if (!isDairyCollection(collection)) {
    return NextResponse.json(
      { success: false, error: `Unknown collection: ${collection}.` },
      { status: 404 }
    );
  }

  if (!isDatabaseConfigured()) {
    return notConfiguredResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Request body must be valid JSON.' },
      { status: 400 }
    );
  }

  const rawRecords =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as { records?: unknown }).records
      : undefined;

  if (!Array.isArray(rawRecords)) {
    return NextResponse.json(
      { success: false, error: 'Body must contain a `records` array.' },
      { status: 400 }
    );
  }

  if (rawRecords.length > MAX_RECORDS_PER_SAVE) {
    return NextResponse.json(
      {
        success: false,
        error: `A single save cannot contain more than ${MAX_RECORDS_PER_SAVE} records.`,
      },
      { status: 400 }
    );
  }

  const updatedAt = new Date().toISOString();
  const seenIds = new Set<string>();
  const rows: {
    collection: string;
    id: string;
    data: Record<string, unknown>;
    updated_at: string;
  }[] = [];

  for (const rawRecord of rawRecords) {
    if (!rawRecord || typeof rawRecord !== 'object' || Array.isArray(rawRecord)) {
      return NextResponse.json(
        { success: false, error: 'Every record must be an object with an `id`.' },
        { status: 400 }
      );
    }

    const { id, ...data } = rawRecord as Record<string, unknown>;
    if (typeof id !== 'string' || id.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Every record must have a non-empty string `id`.' },
        { status: 400 }
      );
    }
    if (seenIds.has(id)) {
      return NextResponse.json(
        { success: false, error: `Duplicate record id: ${id}.` },
        { status: 400 }
      );
    }

    seenIds.add(id);
    rows.push({ collection, id, data, updated_at: updatedAt });
  }

  try {
    const supabase = getSupabaseServerClient();

    if (rows.length > 0) {
      const { error } = await supabase
        .from(DAIRY_RECORDS_TABLE)
        .upsert(rows, { onConflict: 'collection,id' });

      if (error) throw new Error(error.message);
    }

    const { data: existingRows, error: existingError } = await supabase
      .from(DAIRY_RECORDS_TABLE)
      .select('id')
      .eq('collection', collection);

    if (existingError) throw new Error(existingError.message);

    const keepIds = new Set(rows.map((row) => row.id));
    const removedIds = ((existingRows ?? []) as { id: string }[])
      .map((row) => row.id)
      .filter((id) => !keepIds.has(id));

    if (removedIds.length > 0) {
      const { error } = await supabase
        .from(DAIRY_RECORDS_TABLE)
        .delete()
        .eq('collection', collection)
        .in('id', removedIds);

      if (error) throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      collection,
      saved: rows.length,
      deleted: removedIds.length,
      updatedAt,
    });
  } catch (error) {
    console.error(`[api/dairy/${collection}] PUT failed`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : `Could not save ${collection}.`,
      },
      { status: 500 }
    );
  }
}
