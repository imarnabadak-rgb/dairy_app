import { NextResponse } from 'next/server';
import {
  getMissingDatabaseEnv,
  getSupabaseServerClient,
  isDatabaseConfigured,
} from '@/lib/supabase/server';
import type { MilkSale, MilkSaleSession } from '@/types/dairy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MILK_SALES_TABLE = 'milk_sales';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RECORDS_PER_SAVE = 5000;
const SESSIONS: MilkSaleSession[] = ['Morning', 'Evening', 'Combined'];
const PAYMENT_STATUSES: MilkSale['paymentStatus'][] = ['Paid', 'Pending'];

interface MilkSaleRow {
  id: string;
  sale_date: string;
  buyer_id: string | null;
  buyer_name: string;
  session: string;
  quantity_liters: number | string;
  clr: number | string | null;
  fat_percentage: number | string | null;
  snf_percentage: number | string | null;
  base_rate: number | string | null;
  rate_per_liter: number | string;
  total_amount: number | string;
  payment_status: string;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

class SalesValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SalesValidationError';
  }
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

function optionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function rowToMilkSale(row: MilkSaleRow): MilkSale {
  return {
    id: row.id,
    date: row.sale_date,
    buyerId: row.buyer_id ?? undefined,
    buyerName: row.buyer_name,
    session: row.session as MilkSaleSession,
    quantityLiters: Number(row.quantity_liters),
    clr: row.clr == null ? undefined : Number(row.clr),
    fatPercentage:
      row.fat_percentage == null ? undefined : Number(row.fat_percentage),
    snfPercentage:
      row.snf_percentage == null ? undefined : Number(row.snf_percentage),
    baseRate: row.base_rate == null ? undefined : Number(row.base_rate),
    ratePerLiter: Number(row.rate_per_liter),
    totalAmount: Number(row.total_amount),
    paymentStatus: row.payment_status as MilkSale['paymentStatus'],
    notes: row.notes ?? undefined,
  };
}

function recordToRow(raw: unknown): MilkSaleRow {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new SalesValidationError('Every sale must be an object with an `id`.');
  }

  const record = raw as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  if (!id) {
    throw new SalesValidationError('Every sale must have a non-empty string `id`.');
  }

  const date = typeof record.date === 'string' ? record.date.trim() : '';
  if (!DATE_PATTERN.test(date)) {
    throw new SalesValidationError(`Sale ${id}: \`date\` must use YYYY-MM-DD.`);
  }

  const buyerName =
    typeof record.buyerName === 'string'
      ? record.buyerName.trim()
      : typeof record.centerName === 'string'
      ? record.centerName.trim()
      : '';
  if (!buyerName) {
    throw new SalesValidationError(`Sale ${id}: \`buyerName\` is required.`);
  }

  const session = typeof record.session === 'string' ? record.session : '';
  if (!SESSIONS.includes(session as MilkSaleSession)) {
    throw new SalesValidationError(`Sale ${id}: invalid \`session\`.`);
  }

  const quantityLiters = Number(record.quantityLiters);
  if (!Number.isFinite(quantityLiters) || quantityLiters <= 0) {
    throw new SalesValidationError(`Sale ${id}: \`quantityLiters\` must be greater than zero.`);
  }

  const ratePerLiter = Number(record.ratePerLiter);
  if (!Number.isFinite(ratePerLiter) || ratePerLiter < 0) {
    throw new SalesValidationError(`Sale ${id}: \`ratePerLiter\` must be zero or greater.`);
  }

  // The database stores a value that always equals litres × rate/L. Recompute
  // it here instead of trusting a client-supplied total.
  const totalAmount = Number((quantityLiters * ratePerLiter).toFixed(2));

  const paymentStatus =
    typeof record.paymentStatus === 'string' ? record.paymentStatus : '';
  if (!PAYMENT_STATUSES.includes(paymentStatus as MilkSale['paymentStatus'])) {
    throw new SalesValidationError(`Sale ${id}: invalid \`paymentStatus\`.`);
  }

  const buyerId =
    typeof record.buyerId === 'string' && record.buyerId.trim()
      ? record.buyerId.trim()
      : null;
  const notes =
    typeof record.notes === 'string' && record.notes.trim()
      ? record.notes.trim()
      : null;
  const baseRate = optionalNumber(record.baseRate);

  return {
    id,
    sale_date: date,
    buyer_id: buyerId,
    buyer_name: buyerName,
    session,
    quantity_liters: quantityLiters,
    clr: optionalNumber(record.clr),
    fat_percentage: optionalNumber(record.fatPercentage),
    snf_percentage: optionalNumber(record.snfPercentage),
    base_rate: baseRate != null && baseRate > 0 ? baseRate : null,
    rate_per_liter: ratePerLiter,
    total_amount: totalAmount,
    payment_status: paymentStatus,
    notes,
    updated_at: new Date().toISOString(),
  };
}

function recordsFromBody(body: unknown): unknown[] | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const payload = body as { records?: unknown; record?: unknown };
  if (Array.isArray(payload.records)) return payload.records;
  if (payload.record !== undefined) return [payload.record];
  return null;
}

/** GET /api/sales — load all sales from the dedicated table. */
export async function GET() {
  if (!isDatabaseConfigured()) return notConfiguredResponse();

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from(MILK_SALES_TABLE)
      .select('*')
      .order('sale_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const sales = ((data ?? []) as MilkSaleRow[]).map(rowToMilkSale);
    return NextResponse.json({
      success: true,
      count: sales.length,
      data: sales,
    });
  } catch (error) {
    console.error('[api/sales] GET failed', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Could not load milk sales.',
      },
      { status: 500 }
    );
  }
}

/** POST /api/sales — insert one or more sales. */
export async function POST(request: Request) {
  if (!isDatabaseConfigured()) return notConfiguredResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Request body must be valid JSON.' },
      { status: 400 }
    );
  }

  const rawRecords = recordsFromBody(body);
  if (!rawRecords || rawRecords.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Body must contain a non-empty `records` array.' },
      { status: 400 }
    );
  }

  let rows: MilkSaleRow[];
  try {
    rows = rawRecords.map(recordToRow);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Invalid sale record.',
      },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from(MILK_SALES_TABLE).insert(rows);

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'A sale with that id already exists.' },
          { status: 409 }
        );
      }
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      inserted: rows.length,
      ids: rows.map((row) => row.id),
      insertedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[api/sales] POST failed', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Could not insert milk sale.',
      },
      { status: 500 }
    );
  }
}

/** PUT /api/sales — replace the sales table and remove missing rows. */
export async function PUT(request: Request) {
  if (!isDatabaseConfigured()) return notConfiguredResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Request body must be valid JSON.' },
      { status: 400 }
    );
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json(
      { success: false, error: 'Body must contain a `records` array.' },
      { status: 400 }
    );
  }

  const rawRecords = (body as { records?: unknown }).records;
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

  let rows: MilkSaleRow[];
  try {
    rows = rawRecords.map(recordToRow);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Invalid sale record.',
      },
      { status: 400 }
    );
  }

  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) {
      return NextResponse.json(
        { success: false, error: `Duplicate sale id: ${row.id}.` },
        { status: 400 }
      );
    }
    seen.add(row.id);
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data: existing, error: existingError } = await supabase
      .from(MILK_SALES_TABLE)
      .select('id');

    if (existingError) throw new Error(existingError.message);

    const nextIds = new Set(rows.map((row) => row.id));
    const deleteIds = ((existing ?? []) as { id: string }[])
      .map((row) => row.id)
      .filter((id) => !nextIds.has(id));

    if (rows.length > 0) {
      const { error } = await supabase
        .from(MILK_SALES_TABLE)
        .upsert(rows, { onConflict: 'id' });
      if (error) throw new Error(error.message);
    }

    if (deleteIds.length > 0) {
      const { error } = await supabase
        .from(MILK_SALES_TABLE)
        .delete()
        .in('id', deleteIds);
      if (error) throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      saved: rows.length,
      deleted: deleteIds.length,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[api/sales] PUT failed', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Could not save milk sales.',
      },
      { status: 500 }
    );
  }
}
