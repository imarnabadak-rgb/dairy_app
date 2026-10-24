# DairyFlow — Farm & Supply Management ERP

A dairy-farm management dashboard for milk production, milk sales to buyers,
herd records, deliveries, customers, invoices, expenses, veterinary schedules,
cold-chain tanks and feed inventory. Built with **Next.js (App Router)**, **React 19**, **Tailwind CSS v4**,
**Supabase** and an optional **Google Gemini** advisor.

## Tech stack

| Layer      | Technology                                       |
| ---------- | ------------------------------------------------ |
| Framework  | Next.js 16 (App Router, React Server Components)  |
| UI         | React 19, Tailwind CSS v4, lucide-react           |
| Database   | Supabase (`dairy_records` + `milk_sales` + RLS policies) |
| Data API   | Next.js Route Handlers (`/api/dairy`, `/api/sales`)       |
| AI         | Google Gemini via `@google/genai` (server route)  |
| Language   | TypeScript                                       |

## What changed from the Vite version

- Vite/Express entrypoints replaced by the Next.js App Router
  (`src/app/layout.tsx`, `src/app/page.tsx`). The original files are preserved in
  `legacy-vite/` for reference and are excluded from the build.
- The `/api/ai/analyze-farm` endpoint is a Next.js Route Handler, so the Gemini
  key stays server-side.
- Farm data is read and written through server-side `/api/dairy` route handlers
  (and `/api/sales` for the dedicated sales table). The browser no longer talks
  to Supabase directly.
- **There is no mock data or `localStorage` data source.** The app starts with
  empty collections and loads everything from Supabase.
- Form submissions use explicit database **INSERT** requests
  (`POST /api/dairy/...`). Other edits and deletes are mirrored through a
  debounced collection replace (`PUT /api/dairy/:collection`). Milk sales use
  the dedicated `milk_sales` table and `/api/sales` endpoints instead.
- Milk logs capture **CLR**; SNF is calculated automatically as
  `CLR ÷ 4 + 0.25 × fat + 0.44`.
- The **Sales** tab records daily milk sold to buyers in the separate
  `milk_sales` table. Buyers are selected from the customers managed in
  **Revenue & Customers**, and the buyer's saved **Milk Base Rate** (default
  `43`) is used as the base rate. Rate per litre is calculated from the base
  rate, fat, and SNF:
  `baseRate × (1.5 × fat + SNF) ÷ 15.25`, equivalent to
  `fat × fatRate + SNF × snfRate`. The form also supports a **manual rate per
  litre** override; total value is always litres × the applied rate per litre.
  Saving a sale deducts the sold quantity from the first bulk tank.
- Images moved to `public/images/` and are served with `next/image`.
- Env vars renamed from `VITE_*` to server-side `SUPABASE_*` names.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your local env file and fill in the values:

   ```bash
   cp .env.example .env.local
   ```

   ```env
   SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
   # Optional, server-only. Bypasses RLS:
   # SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
   GEMINI_API_KEY=            # optional
   # GEMINI_MODEL=gemini-3.8-flash
   ```

   Find the Supabase values in **Project Settings → API**. The old
   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` names still work
   as fallbacks.

3. In the Supabase **SQL Editor**, run:

   - [`supabase/schema.sql`](supabase/schema.sql) — creates `dairy_records`,
     the dedicated `milk_sales` table, and their RLS policies.
   - [`supabase/migrations/002_create_milk_sales.sql`](supabase/migrations/002_create_milk_sales.sql)
     — **existing projects only:** creates `milk_sales`, copies any old JSON
     sales into it, and adds its indexes/policies/trigger.
   - [`supabase/migrations/003_repair_milk_sales.sql`](supabase/migrations/003_repair_milk_sales.sql)
     — **only if needed:** repairs the `id` unique index or RLS policies if
     upserts/inserts fail on `milk_sales`.
   - [`supabase/migrations/004_repair_dairy_records_unique.sql`](supabase/migrations/004_repair_dairy_records_unique.sql)
     — **only if needed:** removes duplicate `(collection, id)` rows and adds the unique index required by
     the generic `/api/dairy/:collection` upsert.
   - [`supabase/migrations/001_allow_sales_collection.sql`](supabase/migrations/001_allow_sales_collection.sql)
     — **legacy only:** removes the old `dairy_records` collection CHECK
     constraint if you still have old sales rows in the generic table.
   - [`supabase/queries.sql`](supabase/queries.sql) — adds indexes, typed views,
     and the summary function.
   - [`supabase/inserts.sql`](supabase/inserts.sql) — optional manual INSERT
     examples for each form collection. The running app inserts through the API,
     so this file is only needed when adding rows by hand.

4. Start the dev server:

   ```bash
   npm run dev
   ```

   The app runs at <http://localhost:3000>.

The app does **not** seed demo data. Add records through the UI (or with SQL)
after the database schema exists. An empty database shows empty screens.

## Database API

| Method | Route                                   | Purpose                                                        |
| ------ | --------------------------------------- | -------------------------------------------------------------- |
| GET    | `/api/dairy`                            | Load every collection in one request.                          |
| GET    | `/api/dairy?collections=cattle,feeds`   | Load selected collections only.                                |
| GET    | `/api/dairy/milk_logs?from=&to=`        | Load date-ranged milk logs (also supports `limit` & `offset`). |
| GET    | `/api/dairy/expenses?from=&to=`         | Date-ranged expenses.                                          |
| POST   | `/api/dairy`                            | Insert related form rows across one or more collections.       |
| POST   | `/api/dairy/:collection`                | Insert one or more rows into one collection.                   |
| PUT    | `/api/dairy/:collection`                | Replace a collection: upsert rows, delete removed rows.        |
| DELETE | `/api/dairy/:collection?id=...`         | Permanently delete one row immediately.                        |
| GET    | `/api/sales`                            | Load every sale from the dedicated `milk_sales` table.         |
| POST   | `/api/sales`                            | Insert one or more sales into `milk_sales`.                    |
| PUT    | `/api/sales`                            | Replace `milk_sales`: upsert rows, delete removed rows.        |

`GET` responses use the shape `{ success, source, fetchedAt, data, counts }`.
The date range is translated into a PostgREST JSON-path query, for example:

```sql
data->>date >= '2026-10-01' and data->>date <= '2026-10-10'
```

### Inserting form data

Single collection:

```json
POST /api/dairy/milk_logs

{
  "records": [
    {
      "id": "ml_1792490065234",
      "date": "2026-10-21",
      "session": "Morning",
      "cowId": "c2",
      "cowTag": "DF-102",
      "liters": 20,
      "fatPercentage": 4.2,
      "clr": 29.4,
      "snfPercentage": 8.84,
      "qualityStatus": "Optimal",
      "isWithheld": false,
      "milkerName": "Arnab"
    }
  ]
}
```

Related rows across collections (one INSERT):

```json
POST /api/dairy

{
  "records": [
    { "collection": "customers", "id": "cust_1", "name": "New Cafe", "...": "..." },
    { "collection": "supply_logs", "id": "del_1", "customerId": "cust_1", "...": "..." }
  ]
}
```

The server executes a parameterized INSERT equivalent to:

```sql
insert into public.dairy_records (collection, id, data, updated_at)
values ($1, $2, $3::jsonb, $4);
```

The implementation is in `src/lib/dairy/insert.ts` and
`src/app/api/dairy/[collection]/route.ts`.

### Replacing / updating a collection

```json
PUT /api/dairy/milk_logs

{
  "records": [
    { "id": "ml_1792490065234", "...": "..." }
  ]
}
```

`PUT` upserts the supplied rows and deletes rows in that collection that are no
longer present. It is used for edits, deletes and the debounced safety-net sync.

Rows for the other modules are stored as
`dairy_records(collection, id, data jsonb, updated_at)`. The server strips `id`
out of `data` and merges it back on reads.

Milk sales are stored as typed rows in `public.milk_sales`. A sale maps to
columns such as `sale_date`, `buyer_id`, `buyer_name`, `quantity_liters`,
`clr`, `fat_percentage`, `snf_percentage`, `base_rate`, `rate_per_liter`,
`total_amount`, `payment_status`, and `notes`.

Manual SQL INSERT examples for every form collection are in
[`supabase/inserts.sql`](supabase/inserts.sql). Useful views and queries are in
[`supabase/queries.sql`](supabase/queries.sql):
`dairy_milk_logs`, `dairy_milk_daily`, `dairy_milk_sales`,
`dairy_outstanding_invoices`, `dairy_feed_status`, and
`get_milk_production_summary(from, to)`.

## How data is persisted

1. The app starts with empty collections — no mock data and no `localStorage`.
2. On mount it calls `GET /api/dairy` and `GET /api/sales`, then replaces every
   collection with what the database returned, including empty collections.
3. Add forms call `POST /api/dairy/...` or `POST /api/sales` for an immediate
   INSERT.
4. Every collection change is also mirrored through `PUT /api/dairy/:collection`
   and `PUT /api/sales` after a 400 ms debounce. Rows removed locally are
   deleted remotely.
5. The database is the only source of truth. If it is empty, the UI is empty. It
   is never re-seeded from demo data.

The badge in the top bar shows the current state:

- **Database** — connected to Supabase; click to refresh from the database.
- **Connecting** — initial load in progress.
- **Saving…** — an INSERT or collection update is in flight.
- **DB error** — the database request failed; hover the badge for the message.

If Supabase env vars are missing or the database is unreachable, the app shows a
**DB error** badge and empty collections. There is no browser-only fallback.

Backups and the destructive **Clear All Farm Data** action live in **Data &
Backup** in the footer, not in the top navigation. Clearing empties every
collection locally and the normal debounced sync removes the corresponding rows
from the database.

> **Security:** the browser never receives the Supabase key. The API routes use
> `SUPABASE_SERVICE_ROLE_KEY` when provided, otherwise the publishable/anon key.
> The policies in `schema.sql` are intentionally public for this single-farm
> setup. For a production multi-tenant deployment, add authentication and scope
> policies by user/farm id.

## AI advisor

`POST /api/ai/analyze-farm` accepts herd, milk, revenue and expense snapshots and
returns structured JSON. Without `GEMINI_API_KEY` it responds with
`{ success: false }` and the UI falls back to its built-in agronomic heuristics.

## Scripts

| Command             | Description                       |
| ------------------- | --------------------------------- |
| `npm run dev`       | Start Next.js in development mode |
| `npm run build`     | Production build                  |
| `npm run start`     | Serve the production build        |
| `npm run typecheck` | Type-check with `tsc --noEmit`    |

## Project structure

```text
src/
  app/
    layout.tsx                    # Root layout, fonts, metadata
    page.tsx                      # Renders the DairyFlow app
    globals.css                   # Tailwind v4 entry + base styles
    api/dairy/route.ts            # GET collections + bulk POST insert
    api/dairy/[collection]/route.ts # GET range, POST insert, PUT replace
    api/sales/route.ts            # GET/POST/PUT dedicated milk sales
    api/ai/analyze-farm/route.ts  # Server-side Gemini endpoint
  components/                     # Dashboard, herd, deliveries, invoices, ...
    DairyApp.tsx                  # Client shell + provider
    TopBar.tsx                    # Nav, date picker, database status
  context/DairyContext.tsx        # Farm state, DB hydration, inserts and sync
  lib/
    dairy/collections.ts          # Generic collection registry + date fields
    dairy/client.ts               # Browser fetch helpers for /api/dairy
    dairy/insert.ts               # INSERT row validation / construction
    sales/client.ts               # Browser fetch helpers for /api/sales
    supabase/server.ts            # Server-only Supabase client
    ai/prompts.ts                 # Gemini prompt construction
  types/dairy.ts                  # Domain types
public/images/                    # Hero + facility photos
supabase/schema.sql               # Tables + RLS setup
supabase/migrations/002_create_milk_sales.sql # Existing-project sales DDL
supabase/queries.sql              # Indexes, views, summary function
supabase/inserts.sql              # Manual INSERT examples per collection
legacy-vite/                      # Original Vite/Express entrypoints (reference)
```

## Deployment

The app is ready for Vercel (or any Node.js host). Add the environment variables
from `.env.example` to the hosting provider, then deploy with the default
Next.js build settings (`npm run build`). Keep `SUPABASE_SERVICE_ROLE_KEY`
server-only; never add it to a `NEXT_PUBLIC_*` variable.
