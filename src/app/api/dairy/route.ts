import { NextResponse } from 'next/server';
import {
  DAIRY_COLLECTIONS,
  dedupeDairyRecords,
  isDairyCollection,
  sortDairyRecords,
  type DairyCollection,
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

interface StoredRow {
  collection: string;
  id: string;
  data: Record<string, unknown> | null;
  updated_at?: string | null;
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
 * GET /api/dairy
 * GET /api/dairy?collections=cattle,milk_logs
 *
 * Reads the requested collections from `dairy_records`. This is the single
 * hydration endpoint used by the app on startup.
 */
export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return notConfiguredResponse();
  }

  try {
    const url = new URL(request.url);
    const requested = url.searchParams.get('collections');

    let collections: DairyCollection[];
    if (requested !== null) {
      const names = requested
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean);

      if (names.length === 0) {
        return NextResponse.json(
          { success: false, error: '`collections` must contain at least one collection name.' },
          { status: 400 }
        );
      }

      const invalid = names.filter((name) => !isDairyCollection(name));
      if (invalid.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Unknown collection(s): ${invalid.join(', ')}.`,
            allowed: DAIRY_COLLECTIONS,
          },
          { status: 400 }
        );
      }

      collections = names as DairyCollection[];
    } else {
      collections = [...DAIRY_COLLECTIONS];
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from(DAIRY_RECORDS_TABLE)
      .select('collection,id,data,updated_at')
      .in('collection', collections);

    if (error) {
      throw new Error(error.message);
    }

    const grouped = {} as Record<DairyCollection, DairyRecord[]>;
    for (const collection of collections) {
      grouped[collection] = [];
    }

    // Sort oldest-first so dedupeDairyRecords keeps the newest duplicate.
    const rows = ((data ?? []) as StoredRow[]).sort((a, b) =>
      String(a.updated_at ?? '').localeCompare(String(b.updated_at ?? ''))
    );

    for (const row of rows) {
      if (!isDairyCollection(row.collection)) continue;
      grouped[row.collection].push({
        ...(row.data ?? {}),
        id: row.id,
      });
    }

    const counts: Record<string, number> = {};
    for (const collection of collections) {
      grouped[collection] = sortDairyRecords(
        collection,
        dedupeDairyRecords(grouped[collection])
      );
      counts[collection] = grouped[collection].length;
    }

    return NextResponse.json({
      success: true,
      source: 'supabase',
      fetchedAt: new Date().toISOString(),
      data: grouped,
      counts,
    });
  } catch (error) {
    console.error('[api/dairy] GET failed', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Could not load farm data.',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dairy
 * Body: { "records": [{ "collection": "customers", "id": "...", ... }, ...] }
 *
 * Inserts related form records (possibly across collections) in one INSERT.
 * Used, for example, when creating a customer plus their first delivery row.
 */
export async function POST(request: Request) {
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

  let rows: InsertRow[];
  try {
    rows = buildInsertRows(rawRecords);
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
          { success: false, error: 'One or more records already exist.' },
          { status: 409 }
        );
      }
      throw new Error(error.message);
    }

    if (process.env.NODE_ENV !== 'production') {
      console.info(
        `[api/dairy] inserted ${rows.length} row(s): ${rows
          .map((row) => `${row.collection}/${row.id}`)
          .join(', ')}`
      );
    }

    return NextResponse.json({
      success: true,
      inserted: rows.length,
      ids: rows.map((row) => row.id),
      insertedAt: rows[0]?.updated_at ?? new Date().toISOString(),
    });
  } catch (error) {
    console.error('[api/dairy] POST failed', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Could not insert farm records.',
      },
      { status: 500 }
    );
  }
}
