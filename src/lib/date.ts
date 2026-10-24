const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date as YYYY-MM-DD (UTC). */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Parses `YYYY-MM-DD` as UTC midnight so server-rendered HTML and the browser
 * always agree, regardless of the machine timezone.
 */
export function parseISODate(value: string): Date {
  return new Date(DATE_ONLY.test(value) ? `${value}T00:00:00Z` : value);
}

/** e.g. "Oct 20" */
export function formatMonthDay(value: string): string {
  return parseISODate(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** e.g. "Tue, 10/20" */
export function formatWeekdayMonthDay(value: string): string {
  return parseISODate(value).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** e.g. "Oct 1 – Oct 31, 2026" or "Dec 20, 2025 – Jan 5, 2026". */
export function formatDateRange(from: string, to: string): string {
  const fromDate = parseISODate(from);
  const toDate = parseISODate(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return `${from} – ${to}`;
  }

  const fromYear = fromDate.getUTCFullYear();
  const toYear = toDate.getUTCFullYear();
  if (fromYear === toYear) {
    return `${formatMonthDay(from)} – ${formatMonthDay(to)}, ${toYear}`;
  }

  return `${formatMonthDay(from)}, ${fromYear} – ${formatMonthDay(to)}, ${toYear}`;
}

/** Shifts an ISO date by a number of UTC days. */
export function addDays(value: string, days: number): string {
  const date = parseISODate(value);
  if (Number.isNaN(date.getTime())) return value;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Shifts an ISO date to the first day of the month, `months` months away. */
export function addMonthsISO(value: string, months: number): string {
  const date = parseISODate(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
    .toISOString()
    .slice(0, 10);
}

/** First day of the month containing an ISO date. */
export function startOfMonthISO(value: string): string {
  return addMonthsISO(value, 0);
}

/** Last day of the month containing an ISO date. */
export function endOfMonthISO(value: string): string {
  const date = parseISODate(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
}

/** Returns the last `count` ISO dates ending on `endDate` (inclusive). */
export function lastNDates(endDate: string, count: number): string[] {
  const base = parseISODate(endDate);
  if (Number.isNaN(base.getTime())) return [];

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(base);
    date.setUTCDate(base.getUTCDate() - (count - 1 - index));
    return date.toISOString().slice(0, 10);
  });
}
