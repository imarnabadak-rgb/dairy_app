import type {
  BreedType,
  Cattle,
  CowStatus,
  Customer,
  CustomerType,
  ExpenseCategory,
  FarmExpense,
  Invoice,
  MilkLog,
  MilkSale,
  MilkingSession,
  VaccineRecord,
} from '../types/dairy';
import type { DairyCollection } from './dairy/collections';
import { addDays, formatDateRange, todayISO } from './date';
import { calculateSnf } from './milk-quality';

export interface CsvImportCounts {
  cattle: number;
  milkLogs: number;
  customers: number;
  sales: number;
  expenses: number;
  vaccines: number;
  invoices: number;
  updatedSales: number;
  skipped: number;
}

export interface CsvImportPreview {
  fileName: string;
  counts: CsvImportCounts;
  sections: string[];
  warnings: string[];
  errors: string[];
  range?: { from: string; to: string };
}

export interface CsvImportRecord {
  collection: DairyCollection;
  id: string;
  [key: string]: unknown;
}

export interface CsvImportPlan extends CsvImportPreview {
  dairyRecords: CsvImportRecord[];
  salesToSave: MilkSale[];
  newSalesCount: number;
  hasSalesChanges: boolean;
}

export interface CsvImportResult {
  fileName: string;
  inserted: number;
  skipped: number;
  counts: CsvImportCounts;
  warnings: string[];
  errors: string[];
}

export interface CsvImportExisting {
  cattle: Cattle[];
  milkLogs: MilkLog[];
  customers: Customer[];
  sales: MilkSale[];
  expenses: FarmExpense[];
  vaccines: VaccineRecord[];
  invoices: Invoice[];
}

interface CsvRow {
  values: string[];
  line: number;
}

interface CsvSection {
  name: string;
  headers: string[];
  rows: CsvRow[];
}

interface BuildState {
  fileName: string;
  sections: Map<string, CsvSection>;
  warnings: string[];
  errors: string[];
  skipped: number;
  usedIds: Record<string, Set<string>>;
  cattleByTag: Map<string, Cattle>;
  customerByName: Map<string, Customer>;
  newCattle: Cattle[];
  newMilkLogs: MilkLog[];
  newCustomers: Customer[];
  newSales: MilkSale[];
  newExpenses: FarmExpense[];
  newVaccines: VaccineRecord[];
  newInvoices: Invoice[];
  milkLogKeys: Set<string>;
  saleKeys: Set<string>;
  expenseKeys: Set<string>;
  vaccineKeys: Set<string>;
  invoiceKeys: Set<string>;
  cowMilkStats: Map<string, { liters: number; entries: number }>;
  existingSaleIds: Set<string>;
}

const SECTION_ALIASES: Record<string, string> = {
  MILK: 'MILK',
  'MILK PRODUCTION': 'MILK',
  'MILK LOGS': 'MILK',
  COWS: 'COWS',
  CATTLE: 'COWS',
  'COW HERD': 'COWS',
  HEALTH: 'HEALTH',
  'HEALTH RECORDS': 'HEALTH',
  SALES: 'SALES',
  'MILK SALES': 'SALES',
  EXPENSES: 'EXPENSES',
  'FARM EXPENSES': 'EXPENSES',
  'PAYMENTS RECEIVED': 'PAYMENTS RECEIVED',
  PAYMENTS: 'PAYMENTS RECEIVED',
  BUYERS: 'BUYERS',
  CUSTOMERS: 'BUYERS',
  'PER COW MILK REPORT': 'PER-COW MILK REPORT',
  'BUYER PAYMENTS': 'BUYER PAYMENTS',
  SUMMARY: 'SUMMARY',
};

const SUPPORTED_SECTIONS = [
  'COWS',
  'BUYERS',
  'MILK',
  'SALES',
  'EXPENSES',
  'HEALTH',
  'PAYMENTS RECEIVED',
];

function normalizeKey(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Treats CW-0002 and CW-002 as the same animal while still keeping unrelated
 * letters and words distinct. This prevents a near-duplicate cow when the old
 * CSV uses a different zero-padding style from the app's existing records.
 */
function cowTagKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => (/^\d+$/.test(part) ? String(Number(part)) : part))
    .join('-');
}

/** Vaccine records may store "CW-0001 (Cow name)" in cattleTag. */
function vaccineTagKey(value: string): string {
  return cowTagKey(value.split(' (')[0]);
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 70) || 'record'
  );
}

function uniqueId(prefix: string, base: string, used: Set<string>): string {
  const root = `${prefix}_${slugify(base)}`.slice(0, 110);
  let id = root;
  let index = 2;
  while (used.has(id)) {
    id = `${root}_${index}`;
    index += 1;
  }
  used.add(id);
  return id;
}

function parseCsvRows(text: string): CsvRow[] {
  const source = text.replace(/^\uFEFF/, '');
  const rows: CsvRow[] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let rowStartLine = 1;

  const pushRow = () => {
    row.push(field);
    rows.push({ values: row, line: rowStartLine });
    row = [];
    field = '';
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (inQuotes) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        if (character === '\n') line += 1;
        field += character;
      }
      continue;
    }

    if (character === '"') {
      inQuotes = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      pushRow();
      line += 1;
      rowStartLine = line;
    } else if (character === '\r') {
      if (source[index + 1] !== '\n') {
        pushRow();
        line += 1;
        rowStartLine = line;
      }
    } else {
      field += character;
    }
  }

  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows;
}

function parseSections(text: string): Map<string, CsvSection> {
  const sections = new Map<string, CsvSection>();
  let current: CsvSection | null = null;
  let expectingHeader = false;

  for (const row of parseCsvRows(text)) {
    const values = row.values.map((value) => value.trim());
    const nonEmpty = values.filter(Boolean);
    if (nonEmpty.length === 0) continue;

    const sectionName =
      nonEmpty.length === 1
        ? SECTION_ALIASES[normalizeKey(nonEmpty[0])]
        : undefined;

    if (sectionName) {
      const existing = sections.get(sectionName);
      current = existing ?? { name: sectionName, headers: [], rows: [] };
      if (!existing) sections.set(sectionName, current);
      expectingHeader = current.headers.length === 0;
      continue;
    }

    if (!current) continue;

    if (expectingHeader) {
      current.headers = values;
      expectingHeader = false;
      continue;
    }

    current.rows.push(row);
  }

  return sections;
}

function findHeader(headers: string[], aliases: string[]): number {
  const normalized = headers.map(normalizeKey);

  for (const alias of aliases) {
    const target = normalizeKey(alias);
    const exact = normalized.findIndex((header) => header === target);
    if (exact >= 0) return exact;
  }

  for (const alias of aliases) {
    const target = normalizeKey(alias);
    const partial = normalized.findIndex((header) => header.includes(target));
    if (partial >= 0) return partial;
  }

  return -1;
}

function cell(row: CsvRow, index: number): string {
  return index >= 0 ? (row.values[index] ?? '').trim() : '';
}

function parseNumber(value: string): number | undefined {
  const cleaned = value
    .replace(/[₹,\s]/g, '')
    .replace(/rs\.?/gi, '')
    .trim();
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function normalizeDate(value: string): string | undefined {
  const text = value.trim();
  if (!text) return undefined;

  const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const dayFirst = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dayFirst) {
    const year =
      dayFirst[3].length === 2 ? 2000 + Number(dayFirst[3]) : Number(dayFirst[3]);
    return validDate(year, Number(dayFirst[2]), Number(dayFirst[1]));
  }

  return undefined;
}

function validDate(year: number, month: number, day: number): string | undefined {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function normalizeSession(value: string): MilkingSession | undefined {
  const key = normalizeKey(value);
  if (key.includes('MORN')) return 'Morning';
  if (key.includes('EVEN')) return 'Evening';
  return undefined;
}

function mapBreed(value: string): BreedType {
  const key = value.toLowerCase();
  if (key.includes('holstein')) return 'Holstein Friesian';
  if (key.includes('jersey')) return 'Jersey';
  if (key.includes('gir')) return 'Gir';
  if (key.includes('sahiwal')) return 'Sahiwal';
  if (key.includes('brown')) return 'Brown Swiss';
  return 'Crossbreed';
}

function mapCowStatus(value: string): CowStatus {
  const key = value.toLowerCase();
  if (key.includes('lactat') || key.includes('milk')) return 'Lactating';
  if (key.includes('preg')) return 'Pregnant';
  if (key.includes('dry')) return 'Dry';
  if (key.includes('heifer')) return 'Heifer';
  if (key.includes('calf')) return 'Calf';
  if (key.includes('quar')) return 'Quarantine';
  return 'Lactating';
}

function mapCustomerType(name: string): CustomerType {
  const key = name.toLowerCase();
  if (key.includes('local') || key.includes('home')) return 'Household';
  if (
    key.includes('co-op') ||
    key.includes('coop') ||
    key.includes('dairy')
  ) {
    return 'Dairy Co-op';
  }
  if (
    key.includes('food') ||
    key.includes('product') ||
    key.includes('ltd') ||
    key.includes('limited') ||
    key.includes('company')
  ) {
    return 'Commercial / Cafe';
  }
  return 'Retail Store';
}

function mapExpenseCategory(value: string): ExpenseCategory {
  const key = value.toLowerCase();
  if (
    (key.includes('cow') || key.includes('buffalo') || key.includes('animal')) &&
    key.includes('purchase')
  ) {
    return 'Cow & Buffalo Purchase';
  }
  if (key.includes('feed') || key.includes('fodder') || key.includes('silage')) {
    return 'Feed & Fodder';
  }
  if (
    key.includes('medicine') ||
    key.includes('veterinary') ||
    key.includes('vaccine') ||
    key.includes('doctor') ||
    key.includes('treatment')
  ) {
    return 'Veterinary & Vaccines';
  }
  if (
    key.includes('labor') ||
    key.includes('labour') ||
    key.includes('salary') ||
    key.includes('staff') ||
    key.includes('wage')
  ) {
    return 'Labor & Milking Staff';
  }
  if (
    key.includes('fuel') ||
    key.includes('equipment') ||
    key.includes('machine') ||
    key.includes('repair')
  ) {
    return 'Fuel & Equipment';
  }
  if (
    key.includes('electric') ||
    key.includes('cold') ||
    key.includes('storage') ||
    key.includes('chiller')
  ) {
    return 'Electricity & Cold Storage';
  }
  return 'Farm Misc & Supplies';
}

function saleBelongsToCustomer(sale: MilkSale, customer: Customer): boolean {
  if (sale.buyerId) return sale.buyerId === customer.id;
  const buyer = normalizeText(sale.buyerName ?? sale.centerName ?? '');
  return Boolean(buyer) && buyer === normalizeText(customer.name);
}

function saleContentKey(sale: Pick<MilkSale, 'date' | 'buyerName' | 'centerName' | 'quantityLiters' | 'ratePerLiter'>): string {
  const buyer = normalizeText(sale.buyerName ?? sale.centerName ?? '');
  return [
    sale.date,
    buyer,
    Number(sale.quantityLiters).toFixed(2),
    Number(sale.ratePerLiter).toFixed(2),
  ].join('|');
}

function makeState(
  fileName: string,
  sections: Map<string, CsvSection>,
  existing: CsvImportExisting
): BuildState {
  return {
    fileName,
    sections,
    warnings: [],
    errors: [],
    skipped: 0,
    usedIds: {
      cattle: new Set(existing.cattle.map((cow) => cow.id)),
      milkLogs: new Set(existing.milkLogs.map((log) => log.id)),
      customers: new Set(existing.customers.map((customer) => customer.id)),
      sales: new Set(existing.sales.map((sale) => sale.id)),
      expenses: new Set(existing.expenses.map((expense) => expense.id)),
      vaccines: new Set(existing.vaccines.map((vaccine) => vaccine.id)),
      invoices: new Set(existing.invoices.map((invoice) => invoice.id)),
    },
    cattleByTag: new Map(
      existing.cattle.map((cow) => [cowTagKey(cow.tagNumber), cow])
    ),
    customerByName: new Map(
      existing.customers.map((customer) => [
        normalizeText(customer.name),
        customer,
      ])
    ),
    newCattle: [],
    newMilkLogs: [],
    newCustomers: [],
    newSales: [],
    newExpenses: [],
    newVaccines: [],
    newInvoices: [],
    milkLogKeys: new Set(
      existing.milkLogs.map((log) =>
        [
          log.date,
          log.session.toLowerCase(),
          cowTagKey(log.cowTag),
        ].join('|')
      )
    ),
    saleKeys: new Set(existing.sales.map(saleContentKey)),
    expenseKeys: new Set(
      existing.expenses.map((expense) =>
        [
          expense.date,
          expense.title.trim().toLowerCase(),
          Number(expense.amount).toFixed(2),
        ].join('|')
      )
    ),
    vaccineKeys: new Set(
      existing.vaccines.map((vaccine) =>
        [
          vaccine.administeredDate,
          vaccineTagKey(vaccine.cattleTag),
          vaccine.vaccineName.trim().toLowerCase(),
        ].join('|')
      )
    ),
    invoiceKeys: new Set(
      existing.invoices
        .filter((invoice) => invoice.billingFrom && invoice.billingTo)
        .map((invoice) =>
          [invoice.customerId, invoice.billingFrom, invoice.billingTo].join('|')
        )
    ),
    cowMilkStats: new Map(),
    existingSaleIds: new Set(existing.sales.map((sale) => sale.id)),
  };
}

function warn(state: BuildState, message: string): void {
  if (state.warnings.length < 20) {
    state.warnings.push(message);
  } else if (state.warnings.length === 20) {
    state.warnings.push('Additional warnings were omitted.');
  }
}

function ensureCow(state: BuildState, tag: string): Cattle {
  const key = cowTagKey(tag);
  const existing = state.cattleByTag.get(key);
  if (existing) return existing;

  const cow: Cattle = {
    id: uniqueId('imp_cow', tag, state.usedIds.cattle),
    tagNumber: tag,
    name: tag,
    breed: 'Crossbreed',
    status: 'Lactating',
    healthCondition: 'Healthy',
    dob: '',
    lactationCycle: 1,
    avgDailyYield: 0,
    weightKg: 0,
    feedRation: {
      silageKg: 0,
      concentrateKg: 0,
      greenFodderKg: 0,
      mineralsG: 0,
    },
    notes: `Imported from ${state.fileName}`,
  };

  state.newCattle.push(cow);
  state.cattleByTag.set(key, cow);
  warn(
    state,
    `Milk or health data references ${tag}, which is not in the COWS section; added a placeholder cow.`
  );
  return cow;
}

function ensureCustomer(
  state: BuildState,
  name: string,
  phone = ''
): Customer {
  const key = normalizeText(name);
  const existing = state.customerByName.get(key);
  if (existing) return existing;

  const customer: Customer = {
    id: uniqueId('imp_cust', name, state.usedIds.customers),
    name: name.trim(),
    phone: phone.trim(),
    customerType: mapCustomerType(name),
    address: '',
    route: 'Imported CSV',
    dailyQuotaLiters: 0,
    milkType: 'Whole Cow Milk',
    unitPrice: 43,
    milkBaseRate: 43,
    balanceDue: 0,
    preferredSession: 'Both',
    status: 'Active',
  };

  state.newCustomers.push(customer);
  state.customerByName.set(key, customer);
  return customer;
}

function parseCattle(state: BuildState): void {
  const section = state.sections.get('COWS');
  if (!section || section.rows.length === 0) return;

  const tagIndex = findHeader(section.headers, ['Tag No.', 'Tag', 'Cow Tag']);
  const nameIndex = findHeader(section.headers, ['Name', 'Cow Name']);
  const breedIndex = findHeader(section.headers, ['Breed']);
  const statusIndex = findHeader(section.headers, ['Status']);

  if (tagIndex < 0) {
    warn(state, 'COWS section is missing a Tag No. column; cattle rows were skipped.');
    state.skipped += section.rows.length;
    return;
  }

  for (const row of section.rows) {
    const tag = cell(row, tagIndex);
    if (!tag) {
      warn(state, `COWS line ${row.line}: missing tag number; row skipped.`);
      state.skipped += 1;
      continue;
    }

    const key = cowTagKey(tag);
    if (state.cattleByTag.has(key)) {
      state.skipped += 1;
      continue;
    }

    const name = cell(row, nameIndex) || tag;
    const cow: Cattle = {
      id: uniqueId('imp_cow', tag, state.usedIds.cattle),
      tagNumber: tag,
      name,
      breed: mapBreed(cell(row, breedIndex)),
      status: mapCowStatus(cell(row, statusIndex)),
      healthCondition: 'Healthy',
      dob: '',
      lactationCycle: 1,
      avgDailyYield: 0,
      weightKg: 0,
      feedRation: {
        silageKg: 0,
        concentrateKg: 0,
        greenFodderKg: 0,
        mineralsG: 0,
      },
      notes: `Imported from ${state.fileName}`,
    };

    state.newCattle.push(cow);
    state.cattleByTag.set(key, cow);
  }
}

function parseCustomers(state: BuildState): void {
  const section = state.sections.get('BUYERS');
  if (!section || section.rows.length === 0) return;

  const nameIndex = findHeader(section.headers, ['Buyer name', 'Customer name', 'Name']);
  const phoneIndex = findHeader(section.headers, ['Phone', 'Phone (optional)']);

  if (nameIndex < 0) {
    warn(state, 'BUYERS section is missing a Buyer name column; buyer rows were skipped.');
    state.skipped += section.rows.length;
    return;
  }

  for (const row of section.rows) {
    const name = cell(row, nameIndex);
    if (!name) {
      warn(state, `BUYERS line ${row.line}: missing buyer name; row skipped.`);
      state.skipped += 1;
      continue;
    }

    const key = normalizeText(name);
    if (state.customerByName.has(key)) {
      state.skipped += 1;
      continue;
    }

    ensureCustomer(state, name, cell(row, phoneIndex));
  }
}

function parseMilkLogs(state: BuildState): void {
  const section = state.sections.get('MILK');
  if (!section || section.rows.length === 0) return;

  const dateIndex = findHeader(section.headers, ['Date']);
  const sessionIndex = findHeader(section.headers, ['Session']);
  const cowIndex = findHeader(section.headers, ['Cow', 'Cow Tag', 'Tag']);
  const litersIndex = findHeader(section.headers, ['Litres', 'Liters', 'Quantity']);
  const clrIndex = findHeader(section.headers, ['CLR']);
  const fatIndex = findHeader(section.headers, ['Fat %', 'Fat']);
  const snfIndex = findHeader(section.headers, ['SNF']);

  if (dateIndex < 0 || cowIndex < 0 || litersIndex < 0) {
    warn(
      state,
      'MILK section is missing Date, Cow, or Litres; milk rows were skipped.'
    );
    state.skipped += section.rows.length;
    return;
  }

  for (const row of section.rows) {
    const date = normalizeDate(cell(row, dateIndex));
    const session = normalizeSession(cell(row, sessionIndex));
    const cowTag = cell(row, cowIndex);
    const liters = parseNumber(cell(row, litersIndex));

    if (!date) {
      warn(state, `MILK line ${row.line}: invalid or missing date; row skipped.`);
      state.skipped += 1;
      continue;
    }
    if (!session) {
      warn(state, `MILK line ${row.line}: invalid session; row skipped.`);
      state.skipped += 1;
      continue;
    }
    if (!cowTag) {
      warn(state, `MILK line ${row.line}: missing cow tag; row skipped.`);
      state.skipped += 1;
      continue;
    }
    if (liters === undefined || liters <= 0) {
      warn(state, `MILK line ${row.line}: litres must be greater than zero; row skipped.`);
      state.skipped += 1;
      continue;
    }

    const key = [date, session.toLowerCase(), cowTagKey(cowTag)].join('|');
    if (state.milkLogKeys.has(key)) {
      state.skipped += 1;
      continue;
    }

    const cow = ensureCow(state, cowTag);
    const storedCowTag = cow.tagNumber;
    const fat = parseNumber(cell(row, fatIndex)) ?? 0;
    const clr = parseNumber(cell(row, clrIndex));
    const savedSnf = parseNumber(cell(row, snfIndex));
    const snf =
      savedSnf !== undefined && savedSnf > 0
        ? savedSnf
        : clr !== undefined && clr > 0 && fat > 0
        ? calculateSnf(clr, fat)
        : 0;
    const qualityStatus =
      fat >= 4 && snf >= 8.5 ? 'Optimal' : 'Standard';

    const log: MilkLog = {
      id: uniqueId(
        'imp_milk',
        `${date}_${session}_${cowTag}`,
        state.usedIds.milkLogs
      ),
      date,
      session,
      cowId: cow.id,
      cowTag: storedCowTag,
      liters: round2(liters),
      fatPercentage: round2(fat),
      clr,
      snfPercentage: round2(snf),
      qualityStatus,
      isWithheld: false,
      milkerName: 'Imported',
      notes: `Imported from ${state.fileName}`,
    };

    state.newMilkLogs.push(log);
    state.milkLogKeys.add(key);

    const stats = state.cowMilkStats.get(cowTagKey(storedCowTag)) ?? {
      liters: 0,
      entries: 0,
    };
    stats.liters += liters;
    stats.entries += 1;
    state.cowMilkStats.set(cowTagKey(storedCowTag), stats);
  }
}

function updateCowYields(state: BuildState): void {
  for (const cow of state.newCattle) {
    const stats = state.cowMilkStats.get(cowTagKey(cow.tagNumber));
    if (stats && stats.entries > 0) {
      cow.avgDailyYield = round2(stats.liters / stats.entries);
    }
  }
}

function parseSales(state: BuildState): void {
  const section = state.sections.get('SALES');
  if (!section || section.rows.length === 0) return;

  const dateIndex = findHeader(section.headers, ['Date']);
  const buyerIndex = findHeader(section.headers, ['Buyer', 'Customer']);
  const litersIndex = findHeader(section.headers, ['Litres', 'Liters', 'Quantity']);
  const baseRateIndex = findHeader(section.headers, ['Base rate']);
  const clrIndex = findHeader(section.headers, ['CLR']);
  const fatIndex = findHeader(section.headers, ['Fat %', 'Fat']);
  const snfIndex = findHeader(section.headers, ['SNF']);
  const rateIndex = findHeader(section.headers, ['Rate per litre', 'Rate/L']);
  const receivedIndex = findHeader(section.headers, ['Received at sale']);

  if (dateIndex < 0 || buyerIndex < 0 || litersIndex < 0 || rateIndex < 0) {
    warn(
      state,
      'SALES section is missing Date, Buyer, Litres, or Rate per litre; sales rows were skipped.'
    );
    state.skipped += section.rows.length;
    return;
  }

  for (const row of section.rows) {
    const date = normalizeDate(cell(row, dateIndex));
    const buyerName = cell(row, buyerIndex);
    const quantityLiters = parseNumber(cell(row, litersIndex));
    const ratePerLiter = parseNumber(cell(row, rateIndex));

    if (!date) {
      warn(state, `SALES line ${row.line}: invalid or missing date; row skipped.`);
      state.skipped += 1;
      continue;
    }
    if (!buyerName) {
      warn(state, `SALES line ${row.line}: missing buyer; row skipped.`);
      state.skipped += 1;
      continue;
    }
    if (quantityLiters === undefined || quantityLiters <= 0) {
      warn(state, `SALES line ${row.line}: litres must be greater than zero; row skipped.`);
      state.skipped += 1;
      continue;
    }
    if (ratePerLiter === undefined || ratePerLiter < 0) {
      warn(state, `SALES line ${row.line}: invalid rate per litre; row skipped.`);
      state.skipped += 1;
      continue;
    }

    const customer = ensureCustomer(state, buyerName);
    const key = saleContentKey({
      date,
      buyerName,
      quantityLiters,
      ratePerLiter,
    });

    if (state.saleKeys.has(key)) {
      state.skipped += 1;
      continue;
    }

    const received = parseNumber(cell(row, receivedIndex)) ?? 0;
    const sale: MilkSale = {
      id: uniqueId(
        'imp_sale',
        `${date}_${buyerName}_${row.line}`,
        state.usedIds.sales
      ),
      date,
      buyerId: customer.id,
      buyerName: customer.name,
      session: 'Combined',
      quantityLiters: round2(quantityLiters),
      clr: parseNumber(cell(row, clrIndex)),
      fatPercentage: parseNumber(cell(row, fatIndex)),
      snfPercentage: parseNumber(cell(row, snfIndex)),
      baseRate: parseNumber(cell(row, baseRateIndex)),
      ratePerLiter: round2(ratePerLiter),
      totalAmount: round2(quantityLiters * ratePerLiter),
      paymentStatus: received > 0 ? 'Paid' : 'Pending',
      notes: `Imported from ${state.fileName}`,
    };

    state.newSales.push(sale);
    state.saleKeys.add(key);
  }
}

function updateCustomerPricing(state: BuildState, allSales: MilkSale[]): void {
  for (const customer of state.newCustomers) {
    const sales = allSales.filter((sale) => saleBelongsToCustomer(sale, customer));
    if (sales.length === 0) continue;

    let liters = 0;
    let amount = 0;
    let baseRate: number | undefined;

    for (const sale of sales) {
      liters += Number(sale.quantityLiters) || 0;
      amount += Number(sale.totalAmount) || 0;
      if (baseRate === undefined && sale.baseRate && sale.baseRate > 0) {
        baseRate = sale.baseRate;
      }
    }

    if (liters > 0) {
      customer.unitPrice = round2(amount / liters);
    }
    if (baseRate !== undefined) {
      customer.milkBaseRate = baseRate;
    }
  }
}

function parseExpenses(state: BuildState): void {
  const section = state.sections.get('EXPENSES');
  if (!section || section.rows.length === 0) return;

  const dateIndex = findHeader(section.headers, ['Date']);
  const categoryIndex = findHeader(section.headers, ['Category']);
  const descriptionIndex = findHeader(section.headers, ['Description', 'Title', 'Expense']);
  const amountIndex = findHeader(section.headers, ['Amount']);

  if (dateIndex < 0 || amountIndex < 0) {
    warn(
      state,
      'EXPENSES section is missing Date or Amount; expense rows were skipped.'
    );
    state.skipped += section.rows.length;
    return;
  }

  for (const row of section.rows) {
    const date = normalizeDate(cell(row, dateIndex));
    const category = cell(row, categoryIndex);
    const description = cell(row, descriptionIndex);
    const amount = parseNumber(cell(row, amountIndex));

    if (!date) {
      warn(state, `EXPENSES line ${row.line}: invalid or missing date; row skipped.`);
      state.skipped += 1;
      continue;
    }
    if (amount === undefined || amount <= 0) {
      warn(state, `EXPENSES line ${row.line}: amount must be greater than zero; row skipped.`);
      state.skipped += 1;
      continue;
    }
    if (!description && !category) {
      warn(state, `EXPENSES line ${row.line}: missing description; row skipped.`);
      state.skipped += 1;
      continue;
    }

    const title = description || category;
    const key = [date, title.trim().toLowerCase(), amount.toFixed(2)].join('|');
    if (state.expenseKeys.has(key)) {
      state.skipped += 1;
      continue;
    }

    const expense: FarmExpense = {
      id: uniqueId(
        'imp_exp',
        `${date}_${title}_${row.line}`,
        state.usedIds.expenses
      ),
      date,
      title,
      category: mapExpenseCategory(category),
      amount: round2(amount),
      vendor: '',
      paymentMethod: 'Cash',
      notes: `Imported from ${state.fileName}`,
    };

    state.newExpenses.push(expense);
    state.expenseKeys.add(key);
  }
}

function parseVaccines(state: BuildState): void {
  const section = state.sections.get('HEALTH');
  if (!section || section.rows.length === 0) return;

  const dateIndex = findHeader(section.headers, ['Date']);
  const cowIndex = findHeader(section.headers, ['Cow', 'Cow Tag', 'Tag']);
  const typeIndex = findHeader(section.headers, ['Type', 'Vaccine', 'Health Type']);
  const notesIndex = findHeader(section.headers, ['Notes']);
  const costIndex = findHeader(section.headers, ['Cost']);
  const nextDueIndex = findHeader(section.headers, ['Next due date', 'Next Due']);

  if (dateIndex < 0 || typeIndex < 0) {
    warn(
      state,
      'HEALTH section is missing Date or Type; health rows were skipped.'
    );
    state.skipped += section.rows.length;
    return;
  }

  const today = todayISO();

  for (const row of section.rows) {
    const date = normalizeDate(cell(row, dateIndex));
    const cowTag = cell(row, cowIndex);
    const type = cell(row, typeIndex);
    const notes = cell(row, notesIndex);
    const cost = parseNumber(cell(row, costIndex));
    const nextDue = normalizeDate(cell(row, nextDueIndex)) ?? date;

    if (!date) {
      warn(state, `HEALTH line ${row.line}: invalid or missing date; row skipped.`);
      state.skipped += 1;
      continue;
    }
    if (!type) {
      warn(state, `HEALTH line ${row.line}: missing type; row skipped.`);
      state.skipped += 1;
      continue;
    }

    const key = [date, vaccineTagKey(cowTag), type.toLowerCase()].join('|');
    if (state.vaccineKeys.has(key)) {
      state.skipped += 1;
      continue;
    }

    const isHerdWide = normalizeKey(cowTag).includes('HERD');
    const cow = cowTag && !isHerdWide ? ensureCow(state, cowTag) : undefined;
    const storedCattleTag = cow?.tagNumber ?? (cowTag || 'HERD-ALL');
    const noteParts = [notes, cost && cost > 0 ? `Cost: ₹${cost}` : ''].filter(
      Boolean
    );

    const vaccine: VaccineRecord = {
      id: uniqueId(
        'imp_vac',
        `${date}_${cowTag}_${type}_${row.line}`,
        state.usedIds.vaccines
      ),
      vaccineName: type,
      targetType: isHerdWide ? 'Herd-Wide' : 'Individual',
      cattleId: cow?.id,
      cattleTag: storedCattleTag,
      administeredDate: date,
      nextDueDate: nextDue ?? date,
      veterinarian: '',
      batchLot: '',
      dosageMl: 0,
      status: nextDue && nextDue > today ? 'Scheduled' : 'Completed',
      requiresMilkWithdrawal: false,
      withdrawalDays: 0,
      notes: noteParts.length > 0 ? noteParts.join(' | ') : undefined,
    };

    state.newVaccines.push(vaccine);
    state.vaccineKeys.add(key);
  }
}

interface PaymentGroup {
  buyer: string;
  from: string;
  to: string;
  amount: number;
  latestReceived: string;
  notes: string[];
}

function parsePayments(
  state: BuildState,
  allSales: MilkSale[]
): number {
  const section = state.sections.get('PAYMENTS RECEIVED');
  if (!section || section.rows.length === 0) return 0;

  const receivedIndex = findHeader(section.headers, ['Received on', 'Date']);
  const buyerIndex = findHeader(section.headers, ['Buyer', 'Customer']);
  const fromIndex = findHeader(section.headers, ['Period from', 'From']);
  const toIndex = findHeader(section.headers, ['Period to', 'To']);
  const amountIndex = findHeader(section.headers, ['Amount received', 'Amount']);
  const noteIndex = findHeader(section.headers, ['Note', 'Notes']);

  if (
    receivedIndex < 0 ||
    buyerIndex < 0 ||
    fromIndex < 0 ||
    toIndex < 0 ||
    amountIndex < 0
  ) {
    warn(
      state,
      'PAYMENTS RECEIVED section is missing required columns; payments were skipped.'
    );
    state.skipped += section.rows.length;
    return 0;
  }

  const groups = new Map<string, PaymentGroup>();

  for (const row of section.rows) {
    const receivedOn = normalizeDate(cell(row, receivedIndex));
    const buyer = cell(row, buyerIndex);
    const from = normalizeDate(cell(row, fromIndex));
    const to = normalizeDate(cell(row, toIndex));
    const amount = parseNumber(cell(row, amountIndex));

    if (!receivedOn || !buyer || !from || !to || amount === undefined || amount <= 0) {
      warn(
        state,
        `PAYMENTS RECEIVED line ${row.line}: invalid date, buyer, period, or amount; row skipped.`
      );
      state.skipped += 1;
      continue;
    }
    if (from > to) {
      warn(
        state,
        `PAYMENTS RECEIVED line ${row.line}: period start is after period end; row skipped.`
      );
      state.skipped += 1;
      continue;
    }

    const key = [normalizeText(buyer), from, to].join('|');
    const group = groups.get(key) ?? {
      buyer,
      from,
      to,
      amount: 0,
      latestReceived: receivedOn,
      notes: [],
    };

    group.amount += amount;
    if (receivedOn > group.latestReceived) group.latestReceived = receivedOn;
    const note = cell(row, noteIndex);
    if (note) group.notes.push(note);
    groups.set(key, group);
  }

  const existingPaidSaleIds = new Set<string>();

  for (const group of groups.values()) {
    const customer = ensureCustomer(state, group.buyer);
    const matchingSales = allSales.filter(
      (sale) =>
        saleBelongsToCustomer(sale, customer) &&
        sale.date >= group.from &&
        sale.date <= group.to
    );

    if (matchingSales.length === 0) {
      warn(
        state,
        `Payment from ${group.buyer} for ${group.from} to ${group.to} has no matching sales; payment skipped.`
      );
      state.skipped += 1;
      continue;
    }

    const totalAmount = round2(
      matchingSales.reduce(
        (total, sale) => total + (Number(sale.totalAmount) || 0),
        0
      )
    );
    const totalLiters = round2(
      matchingSales.reduce(
        (total, sale) => total + (Number(sale.quantityLiters) || 0),
        0
      )
    );

    if (totalAmount <= 0) {
      warn(
        state,
        `Payment from ${group.buyer} for ${group.from} to ${group.to} matches sales with zero value; payment skipped.`
      );
      state.skipped += 1;
      continue;
    }

    const invoiceKey = [customer.id, group.from, group.to].join('|');
    if (state.invoiceKeys.has(invoiceKey)) {
      warn(
        state,
        `An invoice already exists for ${customer.name} (${group.from} to ${group.to}); payment skipped.`
      );
      state.skipped += 1;
      continue;
    }

    const fullyPaid = group.amount >= totalAmount - 0.05;
    const paidAmount = fullyPaid
      ? totalAmount
      : round2(Math.min(group.amount, totalAmount));
    const status: Invoice['status'] = fullyPaid
      ? 'Paid'
      : paidAmount > 0
      ? 'Partially Paid'
      : 'Pending';

    const invoice: Invoice = {
      id: uniqueId(
        'imp_inv',
        `${customer.name}_${group.from}_${group.to}`,
        state.usedIds.invoices
      ),
      customerId: customer.id,
      customerName: customer.name,
      billingMonth: formatDateRange(group.from, group.to),
      billingFrom: group.from,
      billingTo: group.to,
      saleIds: matchingSales.map((sale) => sale.id),
      totalLiters,
      ratePerLiter: totalLiters > 0 ? round2(totalAmount / totalLiters) : 0,
      totalAmount,
      paidAmount,
      status,
      issueDate: group.latestReceived,
      dueDate: addDays(group.to, 30),
    };

    state.newInvoices.push(invoice);
    state.invoiceKeys.add(invoiceKey);

    if (status === 'Paid') {
      for (const sale of matchingSales) {
        if (sale.paymentStatus !== 'Paid') {
          sale.paymentStatus = 'Paid';
          if (state.existingSaleIds.has(sale.id)) {
            existingPaidSaleIds.add(sale.id);
          }
        }
      }
    }
  }

  return existingPaidSaleIds.size;
}

function updateCustomerBalances(state: BuildState, allSales: MilkSale[]): void {
  for (const customer of state.newCustomers) {
    const pending = allSales
      .filter(
        (sale) =>
          saleBelongsToCustomer(sale, customer) &&
          sale.paymentStatus !== 'Paid'
      )
      .reduce((total, sale) => total + (Number(sale.totalAmount) || 0), 0);
    customer.balanceDue = round2(pending);
  }
}

function emptyPlan(fileName: string, message: string): CsvImportPlan {
  return {
    fileName,
    counts: {
      cattle: 0,
      milkLogs: 0,
      customers: 0,
      sales: 0,
      expenses: 0,
      vaccines: 0,
      invoices: 0,
      updatedSales: 0,
      skipped: 0,
    },
    sections: [],
    warnings: [],
    errors: [message],
    dairyRecords: [],
    salesToSave: [],
    newSalesCount: 0,
    hasSalesChanges: false,
  };
}

export function buildCsvImportPlan(
  csvText: string,
  existing: CsvImportExisting,
  fileName = 'farm-data.csv'
): CsvImportPlan {
  const sections = parseSections(csvText);
  const supported = SUPPORTED_SECTIONS.filter((name) => sections.has(name));

  if (supported.length === 0) {
    return emptyPlan(
      fileName,
      'No supported sections found. Use a Dairy Farm Report CSV with MILK, COWS, HEALTH, SALES, EXPENSES, PAYMENTS RECEIVED, or BUYERS sections.'
    );
  }

  const state = makeState(fileName, sections, existing);

  parseCattle(state);
  parseCustomers(state);
  parseMilkLogs(state);
  updateCowYields(state);
  parseSales(state);

  const allSales = [
    ...existing.sales.map((sale) => ({ ...sale })),
    ...state.newSales,
  ];

  updateCustomerPricing(state, allSales);
  const existingSalesMarkedPaid = parsePayments(state, allSales);
  updateCustomerBalances(state, allSales);
  parseExpenses(state);
  parseVaccines(state);

  const dairyRecords: CsvImportRecord[] = [
    ...state.newCattle.map((cow) => ({
      collection: 'cattle' as const,
      ...cow,
    })),
    ...state.newCustomers.map((customer) => ({
      collection: 'customers' as const,
      ...customer,
    })),
    ...state.newMilkLogs.map((log) => ({
      collection: 'milk_logs' as const,
      ...log,
    })),
    ...state.newExpenses.map((expense) => ({
      collection: 'expenses' as const,
      ...expense,
    })),
    ...state.newVaccines.map((vaccine) => ({
      collection: 'vaccines' as const,
      ...vaccine,
    })),
    ...state.newInvoices.map((invoice) => ({
      collection: 'invoices' as const,
      ...invoice,
    })),
  ];

  const hasSalesChanges =
    state.newSales.length > 0 || existingSalesMarkedPaid > 0;
  const salesToSave = hasSalesChanges ? allSales : [];

  const dates = [...state.newMilkLogs.map((log) => log.date), ...state.newSales.map((sale) => sale.date)]
    .filter(Boolean)
    .sort();

  return {
    fileName,
    counts: {
      cattle: state.newCattle.length,
      milkLogs: state.newMilkLogs.length,
      customers: state.newCustomers.length,
      sales: state.newSales.length,
      expenses: state.newExpenses.length,
      vaccines: state.newVaccines.length,
      invoices: state.newInvoices.length,
      updatedSales: existingSalesMarkedPaid,
      skipped: state.skipped,
    },
    sections: [...sections.keys()],
    warnings: state.warnings,
    errors: state.errors,
    range:
      dates.length > 0
        ? { from: dates[0], to: dates[dates.length - 1] }
        : undefined,
    dairyRecords,
    salesToSave,
    newSalesCount: state.newSales.length,
    hasSalesChanges,
  };
}

export function toCsvImportPreview(plan: CsvImportPlan): CsvImportPreview {
  return {
    fileName: plan.fileName,
    counts: plan.counts,
    sections: plan.sections,
    warnings: plan.warnings,
    errors: plan.errors,
    range: plan.range,
  };
}
