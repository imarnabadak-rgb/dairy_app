import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client.
 *
 * The browser talks to `/api/dairy` and `/api/sales` instead of Supabase
 * directly, so a service role key (if present) never reaches the client. If
 * only the publishable / anon key is available, RLS policies still apply.
 *
 * `SUPABASE_URL` falls back to the old `NEXT_PUBLIC_*` name so an existing
 * `.env.local` keeps working.
 */
const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  '';

export const DAIRY_RECORDS_TABLE = 'dairy_records';

export function isDatabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

export function getMissingDatabaseEnv(): string[] {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!SUPABASE_KEY) {
    missing.push('SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)');
  }
  return missing;
}

let client: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient {
  if (!isDatabaseConfigured()) {
    throw new Error(
      `Supabase is not configured. Missing: ${getMissingDatabaseEnv().join(', ')}.`
    );
  }

  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return client;
}
