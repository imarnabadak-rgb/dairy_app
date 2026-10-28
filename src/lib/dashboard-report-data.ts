import type {
  Cattle,
  FarmExpense,
  Invoice,
  MilkLog,
  MilkSale,
} from '../types/dairy';
import type { DashboardReportInput } from './dashboard-report';

export interface CowProductionModel {
  cowTag: string;
  cowName: string;
  cowId: string;
  breed: string;
  days: number;
  logs: number;
  liters: number;
  avgLitersPerDay: number;
  fat: number | null;
  snf: number | null;
  clr: number | null;
  withheld: number;
}

export interface ProductionDayModel {
  date: string;
  liters: number;
  morning: number;
  evening: number;
  cows: number;
  logs: number;
  fat: number | null;
  snf: number | null;
  clr: number | null;
  withheld: number;
  usable: number;
}

export interface BuyerSalesModel {
  buyerName: string;
  buyerId: string;
  salesCount: number;
  liters: number;
  avgRate: number;
  amount: number;
  paid: number;
  pending: number;
  firstDate: string;
  lastDate: string;
}

export interface PaidInvoiceModel {
  invoice: Invoice;
  totalAmount: number;
  paidAmount: number;
  balance: number;
}

export interface ExpenseDayModel {
  date: string;
  count: number;
  amount: number;
  categories: string[];
}

export interface ExpenseCategoryModel {
  category: string;
  amount: number;
  share: number;
}

export interface DailyActivityModel {
  date: string;
  milk: number;
  fat: number | null;
  snf: number | null;
  sold: number;
  sales: number;
  expenses: number;
}

export interface DashboardReportData {
  sortedMilkLogs: MilkLog[];
  sortedSales: MilkSale[];
  sortedInvoices: Invoice[];
  sortedExpenses: FarmExpense[];
  cows: CowProductionModel[];
  productionDays: ProductionDayModel[];
  buyers: BuyerSalesModel[];
  paidInvoices: PaidInvoiceModel[];
  paidInvoicesTotal: number;
  expenseDays: ExpenseDayModel[];
  expenseCategories: ExpenseCategoryModel[];
  dailyActivity: DailyActivityModel[];
  pendingSalesValue: number;
}

function average(values: number[]): number | null {
  const valid = values.filter((value) => Number.isFinite(value));
  return valid.length > 0
    ? valid.reduce((sum, value) => sum + value, 0) / valid.length
    : null;
}

function uniqueKey(cow: Cattle | undefined, log: MilkLog): string {
  return log.cowId || log.cowTag || cow?.id || 'unknown';
}

export function buildDashboardReportData(
  input: DashboardReportInput
): DashboardReportData {
  const pendingSalesValue = Math.max(
    0,
    input.summary.salesValue - input.summary.paidSalesValue
  );

  const sortedMilkLogs = [...input.periodMilkLogs].sort((a, b) => {
    const dateOrder = a.date.localeCompare(b.date);
    return dateOrder !== 0 ? dateOrder : a.session.localeCompare(b.session);
  });
  const sortedSales = [...input.periodSales].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const sortedInvoices = [...input.periodInvoices].sort((a, b) =>
    a.issueDate.localeCompare(b.issueDate)
  );
  const sortedExpenses = [...input.periodExpenses].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const cowMap = new Map<
    string,
    {
      cowTag: string;
      cowName: string;
      cowId: string;
      breed: string;
      dates: Set<string>;
      logs: number;
      liters: number;
      withheld: number;
      fat: number[];
      snf: number[];
      clr: number[];
    }
  >();

  for (const log of sortedMilkLogs) {
    const cow = input.cattle.find(
      (entry) => entry.id === log.cowId || entry.tagNumber === log.cowTag
    );
    const key = uniqueKey(cow, log);
    const record = cowMap.get(key) ?? {
      cowTag: log.cowTag || cow?.tagNumber || '',
      cowName: cow?.name || log.cowTag || 'Unknown cow',
      cowId: log.cowId || cow?.id || '',
      breed: cow?.breed || '',
      dates: new Set<string>(),
      logs: 0,
      liters: 0,
      withheld: 0,
      fat: [],
      snf: [],
      clr: [],
    };

    record.dates.add(log.date);
    record.logs += 1;
    record.liters += Number(log.liters) || 0;
    if (log.isWithheld) record.withheld += Number(log.liters) || 0;
    if (Number.isFinite(Number(log.fatPercentage))) {
      record.fat.push(Number(log.fatPercentage));
    }
    if (Number.isFinite(Number(log.snfPercentage))) {
      record.snf.push(Number(log.snfPercentage));
    }
    if (log.clr != null && Number.isFinite(Number(log.clr))) {
      record.clr.push(Number(log.clr));
    }
    cowMap.set(key, record);
  }

  const cows: CowProductionModel[] = Array.from(cowMap.values())
    .sort((a, b) => b.liters - a.liters)
    .map((record) => ({
      cowTag: record.cowTag,
      cowName: record.cowName,
      cowId: record.cowId,
      breed: record.breed,
      days: record.dates.size,
      logs: record.logs,
      liters: record.liters,
      avgLitersPerDay: record.dates.size > 0 ? record.liters / record.dates.size : 0,
      fat: average(record.fat),
      snf: average(record.snf),
      clr: average(record.clr),
      withheld: record.withheld,
    }));

  const productionMap = new Map<
    string,
    {
      liters: number;
      morning: number;
      evening: number;
      cows: Set<string>;
      logs: number;
      withheld: number;
      fat: number[];
      snf: number[];
      clr: number[];
    }
  >();

  for (const log of sortedMilkLogs) {
    const record = productionMap.get(log.date) ?? {
      liters: 0,
      morning: 0,
      evening: 0,
      cows: new Set<string>(),
      logs: 0,
      withheld: 0,
      fat: [],
      snf: [],
      clr: [],
    };
    const liters = Number(log.liters) || 0;

    record.liters += liters;
    if (log.session === 'Morning') {
      record.morning += liters;
    } else {
      record.evening += liters;
    }
    record.cows.add(log.cowId || log.cowTag);
    record.logs += 1;
    if (log.isWithheld) record.withheld += liters;
    if (Number.isFinite(Number(log.fatPercentage))) {
      record.fat.push(Number(log.fatPercentage));
    }
    if (Number.isFinite(Number(log.snfPercentage))) {
      record.snf.push(Number(log.snfPercentage));
    }
    if (log.clr != null && Number.isFinite(Number(log.clr))) {
      record.clr.push(Number(log.clr));
    }
    productionMap.set(log.date, record);
  }

  const productionDays: ProductionDayModel[] = Array.from(
    productionMap.entries()
  )
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, record]) => ({
      date,
      liters: record.liters,
      morning: record.morning,
      evening: record.evening,
      cows: record.cows.size,
      logs: record.logs,
      fat: average(record.fat),
      snf: average(record.snf),
      clr: average(record.clr),
      withheld: record.withheld,
      usable: record.liters - record.withheld,
    }));

  const buyerMap = new Map<
    string,
    {
      buyerName: string;
      buyerId: string;
      salesCount: number;
      liters: number;
      amount: number;
      paid: number;
      firstDate: string;
      lastDate: string;
    }
  >();

  for (const sale of sortedSales) {
    const buyerName = sale.buyerName || sale.centerName || 'Unknown buyer';
    const key = sale.buyerId || buyerName.trim().toLowerCase();
    const record = buyerMap.get(key) ?? {
      buyerName,
      buyerId: sale.buyerId ?? '',
      salesCount: 0,
      liters: 0,
      amount: 0,
      paid: 0,
      firstDate: sale.date,
      lastDate: sale.date,
    };
    const amount = Number(sale.totalAmount) || 0;

    record.salesCount += 1;
    record.liters += Number(sale.quantityLiters) || 0;
    record.amount += amount;
    if (sale.paymentStatus === 'Paid') record.paid += amount;
    if (sale.date < record.firstDate) record.firstDate = sale.date;
    if (sale.date > record.lastDate) record.lastDate = sale.date;
    buyerMap.set(key, record);
  }

  const buyers: BuyerSalesModel[] = Array.from(buyerMap.values())
    .sort((a, b) => b.amount - a.amount)
    .map((record) => ({
      buyerName: record.buyerName,
      buyerId: record.buyerId,
      salesCount: record.salesCount,
      liters: record.liters,
      avgRate: record.liters > 0 ? record.amount / record.liters : 0,
      amount: record.amount,
      paid: record.paid,
      pending: record.amount - record.paid,
      firstDate: record.firstDate,
      lastDate: record.lastDate,
    }));

  const paidInvoices: PaidInvoiceModel[] = sortedInvoices
    .filter((invoice) => Number(invoice.paidAmount) > 0)
    .map((invoice) => {
      const totalAmount = Number(invoice.totalAmount) || 0;
      const paidAmount = Number(invoice.paidAmount) || 0;
      return {
        invoice,
        totalAmount,
        paidAmount,
        balance: Math.max(0, totalAmount - paidAmount),
      };
    });
  const paidInvoicesTotal = paidInvoices.reduce(
    (sum, invoice) => sum + invoice.paidAmount,
    0
  );

  const expenseDayMap = new Map<
    string,
    { amount: number; count: number; categories: Set<string> }
  >();

  for (const expense of sortedExpenses) {
    const record = expenseDayMap.get(expense.date) ?? {
      amount: 0,
      count: 0,
      categories: new Set<string>(),
    };
    record.amount += Number(expense.amount) || 0;
    record.count += 1;
    record.categories.add(expense.category);
    expenseDayMap.set(expense.date, record);
  }

  const expenseDays: ExpenseDayModel[] = Array.from(expenseDayMap.entries())
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, record]) => ({
      date,
      count: record.count,
      amount: record.amount,
      categories: Array.from(record.categories),
    }));

  const categoryMap = new Map<string, number>();
  for (const expense of sortedExpenses) {
    const category = expense.category || 'Other';
    categoryMap.set(
      category,
      (categoryMap.get(category) ?? 0) + (Number(expense.amount) || 0)
    );
  }
  const expenseTotal = Array.from(categoryMap.values()).reduce(
    (sum, amount) => sum + amount,
    0
  );
  const expenseCategories: ExpenseCategoryModel[] = Array.from(
    categoryMap.entries()
  )
    .sort(([, amountA], [, amountB]) => amountB - amountA)
    .map(([category, amount]) => ({
      category,
      amount,
      share: expenseTotal > 0 ? (amount / expenseTotal) * 100 : 0,
    }));

  const activityDates = Array.from(
    new Set([
      ...productionDays.map((day) => day.date),
      ...sortedSales.map((sale) => sale.date),
      ...expenseDays.map((day) => day.date),
    ])
  ).sort();
  const salesByDate = new Map<string, { sold: number; sales: number }>();
  for (const sale of sortedSales) {
    const record = salesByDate.get(sale.date) ?? { sold: 0, sales: 0 };
    record.sold += Number(sale.quantityLiters) || 0;
    record.sales += Number(sale.totalAmount) || 0;
    salesByDate.set(sale.date, record);
  }
  const expenseByDate = new Map(
    expenseDays.map((day) => [day.date, day.amount] as const)
  );
  const productionByDate = new Map(
    productionDays.map((day) => [day.date, day] as const)
  );

  const dailyActivity: DailyActivityModel[] = activityDates.map((date) => {
    const production = productionByDate.get(date);
    const sales = salesByDate.get(date);
    return {
      date,
      milk: production?.liters ?? 0,
      fat: production?.fat ?? null,
      snf: production?.snf ?? null,
      sold: sales?.sold ?? 0,
      sales: sales?.sales ?? 0,
      expenses: expenseByDate.get(date) ?? 0,
    };
  });

  return {
    sortedMilkLogs,
    sortedSales,
    sortedInvoices,
    sortedExpenses,
    cows,
    productionDays,
    buyers,
    paidInvoices,
    paidInvoicesTotal,
    expenseDays,
    expenseCategories,
    dailyActivity,
    pendingSalesValue,
  };
}
