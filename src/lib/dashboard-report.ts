import type {
  Cattle,
  Customer,
  DailySupplyLog,
  FarmExpense,
  FeedInventory,
  Invoice,
  MilkLog,
  MilkSale,
  StorageTank,
  VaccineRecord,
} from '../types/dairy';

export interface DashboardReportSummary {
  totalMilk: number;
  avgMilkPerDay: number;
  productionDays: number;
  avgFat: number;
  avgSnf: number;
  avgClr: string;
  withheldMilk: number;
  usableMilk: number;
  milkSold: number;
  salesValue: number;
  paidSalesValue: number;
  salesCount: number;
  deliveryRevenue: number;
  collected: number;
  invoicedRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  lactatingCount: number;
  pregnantCount: number;
  dryCount: number;
  otherCount: number;
  withdrawalCount: number;
  customerCount: number;
  invoiceCount: number;
  expenseCount: number;
  supplyCount: number;
  scheduledVaccines: number;
  completedVaccines: number;
  feedStockKg: number;
}

export interface DashboardReportInput {
  generatedAt: string;
  periodLabel: string;
  periodRangeLabel: string;
  periodFrom: string;
  periodTo: string;
  operationalDate: string;
  currencySymbol: string;
  periodMilkLogs: MilkLog[];
  periodSales: MilkSale[];
  periodSupplyLogs: DailySupplyLog[];
  periodInvoices: Invoice[];
  periodExpenses: FarmExpense[];
  customers: Customer[];
  cattle: Cattle[];
  vaccines: VaccineRecord[];
  tanks: StorageTank[];
  feeds: FeedInventory[];
  summary: DashboardReportSummary;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(',');
}

function number(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '';
}

function yesNo(value: boolean): string {
  return value ? 'Yes' : 'No';
}

function tankFillPercent(current: number, capacity: number): string {
  return capacity > 0 ? `${Math.round((current / capacity) * 100)}%` : '0%';
}

export function buildDashboardReportCsv(input: DashboardReportInput): string {
  const lines: string[] = [];

  const addSection = (title: string, headers: string[], rows: unknown[][]): void => {
    if (lines.length > 0) lines.push('');
    lines.push(csvRow([title]));
    if (headers.length > 0) lines.push(csvRow(headers));
    rows.forEach((record) => lines.push(csvRow(record)));
  };

  const pendingSalesValue = Math.max(
    0,
    input.summary.salesValue - input.summary.paidSalesValue
  );

  addSection('DairyFlow Dashboard Report', ['Metric', 'Value'], [
    ['Generated at', input.generatedAt],
    ['Dashboard period', input.periodLabel],
    ['Date range', input.periodRangeLabel],
    ['From', input.periodFrom],
    ['To', input.periodTo],
    ['Operational date', input.operationalDate],
    ['Currency', input.currencySymbol],
    ['Operational records', 'Filtered to the selected dashboard period'],
    ['Master records', 'Customers, cattle, vaccines, feed and tanks included in full'],
  ]);

  addSection('Dashboard Summary', ['Metric', 'Value'], [
    ['Milk produced (L)', number(input.summary.totalMilk)],
    ['Average milk per day (L/day)', number(input.summary.avgMilkPerDay)],
    ['Production days', input.summary.productionDays],
    ['Average fat %', number(input.summary.avgFat)],
    ['Average SNF %', number(input.summary.avgSnf)],
    ['Average CLR', input.summary.avgClr],
    ['Withheld milk (L)', number(input.summary.withheldMilk)],
    ['Usable milk (L)', number(input.summary.usableMilk)],
    ['Milk sold (L)', number(input.summary.milkSold)],
    ['Sales count', input.summary.salesCount],
    ['Sales value', number(input.summary.salesValue)],
    ['Paid sales value', number(input.summary.paidSalesValue)],
    ['Pending sales value', number(pendingSalesValue)],
    ['Delivery revenue', number(input.summary.deliveryRevenue)],
    ['Collected delivery payments', number(input.summary.collected)],
    ['Invoiced revenue', number(input.summary.invoicedRevenue)],
    ['Total farm expenses', number(input.summary.totalExpenses)],
    ['Net operating profit', number(input.summary.netProfit)],
    ['Profit margin %', number(input.summary.profitMargin, 0)],
    ['Lactating cows', input.summary.lactatingCount],
    ['Pregnant cows', input.summary.pregnantCount],
    ['Dry cows', input.summary.dryCount],
    ['Other cattle', input.summary.otherCount],
    ['Cows in withdrawal', input.summary.withdrawalCount],
    ['Customers', input.summary.customerCount],
    ['Invoices', input.summary.invoiceCount],
    ['Expenses', input.summary.expenseCount],
    ['Delivery stops', input.summary.supplyCount],
    ['Scheduled vaccines', input.summary.scheduledVaccines],
    ['Completed vaccines', input.summary.completedVaccines],
    ['Feed stock (kg)', number(input.summary.feedStockKg)],
  ]);

  addSection(
    'Milk Production Logs',
    ['Date', 'Session', 'Cow Tag', 'Cow ID', 'Liters', 'Fat %', 'SNF %', 'CLR', 'Quality', 'Withheld', 'Milker', 'Notes'],
    input.periodMilkLogs.map((log) => [
      log.date,
      log.session,
      log.cowTag,
      log.cowId,
      number(log.liters),
      number(log.fatPercentage),
      number(log.snfPercentage),
      log.clr ?? '',
      log.qualityStatus,
      yesNo(log.isWithheld),
      log.milkerName,
      log.notes ?? '',
    ])
  );

  addSection(
    'Milk Sales',
    ['Date', 'Buyer', 'Buyer ID', 'Session', 'Quantity (L)', 'CLR', 'Fat %', 'SNF %', 'Base Rate', 'Rate/L', 'Total Amount', 'Payment Status', 'Notes'],
    input.periodSales.map((sale) => [
      sale.date,
      sale.buyerName,
      sale.buyerId ?? '',
      sale.session,
      number(sale.quantityLiters),
      sale.clr ?? '',
      sale.fatPercentage !== undefined ? number(sale.fatPercentage) : '',
      sale.snfPercentage !== undefined ? number(sale.snfPercentage) : '',
      sale.baseRate !== undefined ? number(sale.baseRate) : '',
      number(sale.ratePerLiter),
      number(sale.totalAmount),
      sale.paymentStatus,
      sale.notes ?? '',
    ])
  );

  addSection(
    'Delivery Route Logs',
    ['Date', 'Customer', 'Customer ID', 'Customer Type', 'Route', 'Quantity (L)', 'Unit Price', 'Total Amount', 'Delivery Status', 'Payment Status', 'Delivered At', 'Bottles Returned', 'Notes'],
    input.periodSupplyLogs.map((log) => [
      log.date,
      log.customerName,
      log.customerId,
      log.customerType,
      log.route,
      number(log.quantityLiters),
      number(log.unitPrice),
      number(log.totalAmount),
      log.deliveryStatus,
      log.paymentStatus,
      log.deliveredAt ?? '',
      log.bottlesReturned,
      log.notes ?? '',
    ])
  );

  addSection(
    'Invoices',
    ['Invoice ID', 'Customer', 'Customer ID', 'Billing Period', 'Billing From', 'Billing To', 'Total Liters', 'Rate/L', 'Total Amount', 'Paid Amount', 'Status', 'Issue Date', 'Due Date', 'Sale IDs'],
    input.periodInvoices.map((invoice) => [
      invoice.id,
      invoice.customerName,
      invoice.customerId,
      invoice.billingMonth,
      invoice.billingFrom ?? '',
      invoice.billingTo ?? '',
      number(invoice.totalLiters),
      number(invoice.ratePerLiter),
      number(invoice.totalAmount),
      number(invoice.paidAmount),
      invoice.status,
      invoice.issueDate,
      invoice.dueDate,
      invoice.saleIds?.join(' | ') ?? '',
    ])
  );

  addSection(
    'Customers',
    ['Name', 'Customer ID', 'Type', 'Phone', 'Email', 'Route', 'Address', 'Daily Quota (L)', 'Milk Type', 'Unit Price', 'Milk Base Rate', 'Balance Due', 'Preferred Session', 'Status'],
    input.customers.map((customer) => [
      customer.name,
      customer.id,
      customer.customerType,
      customer.phone,
      customer.email ?? '',
      customer.route,
      customer.address,
      number(customer.dailyQuotaLiters),
      customer.milkType,
      number(customer.unitPrice),
      customer.milkBaseRate !== undefined ? number(customer.milkBaseRate) : '',
      number(customer.balanceDue),
      customer.preferredSession,
      customer.status,
    ])
  );

  addSection(
    'Cattle Herd',
    ['Tag', 'Name', 'Cattle ID', 'Breed', 'Status', 'Health', 'DOB', 'Lactation Cycle', 'Last Calving', 'Expected Calving', 'Avg Daily Yield (L)', 'Weight (kg)', 'Silage (kg)', 'Concentrate (kg)', 'Green Fodder (kg)', 'Minerals (g)', 'Withdrawal End', 'Notes'],
    input.cattle.map((cow) => [
      cow.tagNumber,
      cow.name,
      cow.id,
      cow.breed,
      cow.status,
      cow.healthCondition,
      cow.dob,
      cow.lactationCycle,
      cow.lastCalvingDate ?? '',
      cow.expectedCalvingDate ?? '',
      number(cow.avgDailyYield),
      cow.weightKg,
      number(cow.feedRation.silageKg),
      number(cow.feedRation.concentrateKg),
      number(cow.feedRation.greenFodderKg),
      cow.feedRation.mineralsG,
      cow.withdrawalEndDate ?? '',
      cow.notes ?? '',
    ])
  );

  addSection(
    'Vaccines',
    ['Vaccine', 'Target Type', 'Cattle Tag', 'Cattle ID', 'Administered Date', 'Next Due Date', 'Veterinarian', 'Batch/Lot', 'Dosage (ml)', 'Status', 'Requires Withdrawal', 'Withdrawal Days', 'Notes'],
    input.vaccines.map((vaccine) => [
      vaccine.vaccineName,
      vaccine.targetType,
      vaccine.cattleTag,
      vaccine.cattleId ?? '',
      vaccine.administeredDate,
      vaccine.nextDueDate,
      vaccine.veterinarian,
      vaccine.batchLot,
      vaccine.dosageMl,
      vaccine.status,
      yesNo(vaccine.requiresMilkWithdrawal),
      vaccine.withdrawalDays,
      vaccine.notes ?? '',
    ])
  );

  addSection(
    'Expenses',
    ['Date', 'Title', 'Category', 'Amount', 'Vendor', 'Payment Method', 'Receipt Number', 'Notes'],
    input.periodExpenses.map((expense) => [
      expense.date,
      expense.title,
      expense.category,
      number(expense.amount),
      expense.vendor,
      expense.paymentMethod,
      expense.receiptNumber ?? '',
      expense.notes ?? '',
    ])
  );

  addSection(
    'Feed Inventory',
    ['Feed Name', 'Category', 'Stock (kg)', 'Daily Burn (kg)', 'Minimum Threshold (kg)', 'Cost/kg', 'Supplier'],
    input.feeds.map((feed) => [
      feed.name,
      feed.category,
      number(feed.stockKg),
      number(feed.dailyBurnKg),
      number(feed.minThresholdKg),
      number(feed.costPerKg),
      feed.supplier,
    ])
  );

  addSection(
    'Storage Tanks',
    ['Tank Name', 'Capacity (L)', 'Current Milk (L)', 'Fill %', 'Temperature (°C)', 'Milk Type', 'Last Sanitized', 'Status'],
    input.tanks.map((tank) => [
      tank.name,
      tank.capacityLiters,
      tank.currentLiters,
      tankFillPercent(tank.currentLiters, tank.capacityLiters),
      number(tank.tempCelsius, 1),
      tank.milkType,
      tank.lastSanitized,
      tank.status,
    ])
  );

  return lines.join('\r\n');
}

export function downloadCsvFile(filename: string, csv: string): void {
  const blob = new Blob([`\uFEFF${csv}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
