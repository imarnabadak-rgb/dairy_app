'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useDairy } from '../context/DairyContext';
import {
  buildDashboardReportCsv,
  downloadCsvFile,
} from '../lib/dashboard-report';
import {
  addMonthsISO,
  endOfMonthISO,
  formatDateRange,
  formatMonthDay,
  formatWeekdayMonthDay,
  lastNDates,
  parseISODate,
  startOfMonthISO,
  todayISO,
} from '../lib/date';
import { 
  Milk, 
  IndianRupee, 
  HeartPulse, 
  ArrowUpRight, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Plus,
  Thermometer,
  ShieldCheck,
  ChevronRight,
  Receipt,
  TrendingUp,
  Wallet,
  CalendarDays,
  Download,
  Upload
} from 'lucide-react';

interface DashboardViewProps {
  onNavigateTab: (tab: string) => void;
  onOpenMilkModal: () => void;
  onOpenCattleModal: () => void;
  onOpenExpenseModal?: () => void;
  onOpenDataManagement?: () => void;
}

type DashboardPeriod = 'this-month' | 'last-month' | '3m' | '6m' | '1y' | 'max';

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  'this-month': 'This month',
  'last-month': 'Last month',
  '3m': 'Last 3 months',
  '6m': 'Last 6 months',
  '1y': 'Last 1 year',
  max: 'All time',
};

function getDashboardPeriodRange(
  period: DashboardPeriod,
  anchor: string,
  availableDates: string[]
): { from: string; to: string } {
  const anchorDate = parseISODate(anchor);
  const anchorISO = Number.isNaN(anchorDate.getTime())
    ? todayISO()
    : anchorDate.toISOString().slice(0, 10);

  if (period === 'max') {
    const dates = availableDates.filter(Boolean).sort();
    const earliest = dates[0];
    const latest = dates[dates.length - 1];
    const monthStart = startOfMonthISO(anchorISO);

    return {
      from: earliest && earliest < monthStart ? earliest : monthStart,
      to: latest && latest > anchorISO ? latest : anchorISO,
    };
  }

  if (period === 'this-month') {
    return {
      from: startOfMonthISO(anchorISO),
      to: anchorISO,
    };
  }

  if (period === 'last-month') {
    const lastMonth = addMonthsISO(anchorISO, -1);
    return {
      from: startOfMonthISO(lastMonth),
      to: endOfMonthISO(lastMonth),
    };
  }

  const monthsBack = period === '3m' ? 2 : period === '6m' ? 5 : 11;
  return {
    from: startOfMonthISO(addMonthsISO(anchorISO, -monthsBack)),
    to: anchorISO,
  };
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateTab,
  onOpenMilkModal,
  onOpenCattleModal,
  onOpenDataManagement,
}) => {
  const { 
    selectedDate, 
    cattle, 
    milkLogs, 
    tanks, 
    supplyLogs, 
    invoices, 
    vaccines, 
    expenses,
    sales,
    customers,
    feeds,
    toggleDeliveryStatus,
    currencySymbol 
  } = useDairy();

  const [period, setPeriod] = useState<DashboardPeriod>('this-month');
  const [chartMode, setChartMode] = useState<'yield' | 'quality'>('quality');

  const periodAnchor = selectedDate || todayISO();
  // The dashboard no longer surfaces the two legacy demo silos. Other tanks
  // added to the farm data still appear in the Bulk Milk Silos card.
  const dashboardTanks = tanks.filter(
    (tank) => tank.id !== 'tank-1' && tank.id !== 'tank-2'
  );
  const availableDates = [
    ...milkLogs.map((m) => m.date),
    ...supplyLogs.map((s) => s.date),
    ...expenses.map((e) => e.date),
    ...invoices.map((inv) => inv.issueDate),
  ].filter(Boolean);
  const periodRange = getDashboardPeriodRange(period, periodAnchor, availableDates);
  const periodLabel = PERIOD_LABELS[period];
  const periodRangeLabel = formatDateRange(periodRange.from, periodRange.to);
  const isLongRange =
    period === '3m' || period === '6m' || period === '1y' || period === 'max';
  const isInPeriod = (date: string | undefined) =>
    date !== undefined && date >= periodRange.from && date <= periodRange.to;

  // Period production aggregates
  const periodMilkLogs = milkLogs.filter((m) => isInPeriod(m.date));
  const morningYield = periodMilkLogs
    .filter((m) => m.session === 'Morning')
    .reduce((acc, curr) => acc + curr.liters, 0);
  const eveningYield = periodMilkLogs
    .filter((m) => m.session === 'Evening')
    .reduce((acc, curr) => acc + curr.liters, 0);
  const totalMilkInPeriod = morningYield + eveningYield;
  const milkProductionDays = new Set(periodMilkLogs.map((m) => m.date)).size;
  const avgMilkPerDay = milkProductionDays > 0 ? totalMilkInPeriod / milkProductionDays : 0;
  const avgFat = periodMilkLogs.length > 0
    ? periodMilkLogs.reduce((acc, m) => acc + m.fatPercentage, 0) / periodMilkLogs.length
    : 0;
  const avgSnf = periodMilkLogs.length > 0
    ? periodMilkLogs.reduce((acc, m) => acc + m.snfPercentage, 0) / periodMilkLogs.length
    : 0;
  const clrLogs = periodMilkLogs.filter((m) => typeof m.clr === 'number');
  const avgClr = clrLogs.length > 0
    ? (clrLogs.reduce((acc, m) => acc + (m.clr as number), 0) / clrLogs.length).toFixed(1)
    : '—';

  // Segregated withholding milk (contaminated by antibiotic therapy)
  const withheldMilkInPeriod = periodMilkLogs
    .filter((m) => m.isWithheld)
    .reduce((acc, curr) => acc + curr.liters, 0);
  const usableMilkInPeriod = totalMilkInPeriod - withheldMilkInPeriod;

  // Period milk sales
  const periodMilkSales = sales.filter((s) => isInPeriod(s.date));
  const totalMilkSoldLiters = periodMilkSales.reduce((acc, s) => acc + s.quantityLiters, 0);
  const totalMilkSalesValue = periodMilkSales.reduce((acc, s) => acc + s.totalAmount, 0);
  const paidMilkSalesValue = periodMilkSales
    .filter((s) => s.paymentStatus === 'Paid')
    .reduce((acc, s) => acc + s.totalAmount, 0);

  // Period deliveries and route progress
  const periodSupplyLogs = supplyLogs.filter((s) => isInPeriod(s.date));
  const totalDeliveryTargetLiters = periodSupplyLogs.reduce((acc, curr) => acc + curr.quantityLiters, 0);

  // Financial aggregates: revenue vs expenses for the selected dashboard period
  const periodDeliveryRevenue = periodSupplyLogs.reduce((acc, curr) => acc + curr.totalAmount, 0);
  const periodCollected = periodSupplyLogs
    .filter((s) => s.paymentStatus === 'Paid')
    .reduce((acc, curr) => acc + curr.totalAmount, 0);
  const periodInvoices = invoices.filter((inv) => isInPeriod(inv.issueDate));
  const periodInvoicedRevenue = periodInvoices.reduce((acc, curr) => acc + curr.totalAmount, 0);

  const periodExpenses = expenses.filter((e) => isInPeriod(e.date));
  const periodTotalExpenses = periodExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  const totalFeedStockKg = feeds.reduce((acc, feed) => acc + feed.stockKg, 0);

  // Operating net profit for the selected period
  const netOperatingProfit = periodInvoicedRevenue - periodTotalExpenses;
  const profitMargin = periodInvoicedRevenue > 0
    ? Math.round((netOperatingProfit / periodInvoicedRevenue) * 100)
    : 0;

  // The route sheet stays anchored to the operational date in the top bar.
  const todaySupply = supplyLogs.filter((s) => s.date === selectedDate);
  const deliveredTodayCount = todaySupply.filter(
    (s) => s.deliveryStatus === 'Delivered'
  ).length;
  const todayRouteLiters = todaySupply.reduce(
    (acc, s) => acc + s.quantityLiters,
    0
  );
  const todayRouteValue = todaySupply.reduce(
    (acc, s) => acc + s.totalAmount,
    0
  );

  // Cattle counts
  const lactatingCattle = cattle.filter((c) => c.status === 'Lactating');
  const topLactatingCattle = [...lactatingCattle]
    .sort((a, b) => b.avgDailyYield - a.avgDailyYield)
    .slice(0, 5);
  const totalLactatingYield = lactatingCattle.reduce(
    (acc, c) => acc + c.avgDailyYield,
    0
  );
  const avgLactatingYield =
    lactatingCattle.length > 0 ? totalLactatingYield / lactatingCattle.length : 0;
  const lactatingCount = lactatingCattle.length;
  const pregnantCount = cattle.filter((c) => c.status === 'Pregnant').length;
  const dryCount = cattle.filter((c) => c.status === 'Dry').length;
  const otherCount = cattle.length - lactatingCount - pregnantCount - dryCount;
  const withdrawalCount = cattle.filter((c) => c.healthCondition === 'Withdrawal').length;

  // Upcoming critical vaccines in the next 14 days
  const upcomingVaccines = vaccines
    .filter((v) => v.status === 'Scheduled')
    .sort((a, b) => parseISODate(a.nextDueDate).getTime() - parseISODate(b.nextDueDate).getTime());
  const scheduledVaccineCount = upcomingVaccines.length;
  const completedVaccineCount = vaccines.filter(
    (v) => v.status === 'Completed'
  ).length;

  // Rolling 7-day production trend for the chart
  const last7Days = lastNDates(periodAnchor, 7);

  const dailyTrendData = last7Days.map((dateStr) => {
    const logs = milkLogs.filter((m) => m.date === dateStr);
    const am = logs.filter((m) => m.session === 'Morning').reduce((a, b) => a + b.liters, 0);
    const pm = logs.filter((m) => m.session === 'Evening').reduce((a, b) => a + b.liters, 0);
    const qualityLogs = logs.filter(
      (m) => !m.isWithheld && m.qualityStatus !== 'Discarded'
    );
    const fat = qualityLogs.length > 0
      ? qualityLogs.reduce((acc, m) => acc + m.fatPercentage, 0) / qualityLogs.length
      : null;
    const snf = qualityLogs.length > 0
      ? qualityLogs.reduce((acc, m) => acc + m.snfPercentage, 0) / qualityLogs.length
      : null;
    const dayLabel = formatWeekdayMonthDay(dateStr);
    return {
      date: dateStr,
      label: dayLabel,
      morning: am,
      evening: pm,
      total: am + pm,
      fat,
      snf,
    };
  });

  const maxTrendYield = Math.max(...dailyTrendData.map((d) => d.total), 120);
  const maxQuality = Math.max(
    10,
    ...dailyTrendData.map((d) => Math.max(d.fat ?? 0, d.snf ?? 0))
  );

  const chartQualityLogs = milkLogs.filter(
    (m) =>
      last7Days.includes(m.date) &&
      !m.isWithheld &&
      m.qualityStatus !== 'Discarded'
  );
  const chartAvgFat = chartQualityLogs.length > 0
    ? chartQualityLogs.reduce((acc, m) => acc + m.fatPercentage, 0) / chartQualityLogs.length
    : 0;
  const chartAvgSnf = chartQualityLogs.length > 0
    ? chartQualityLogs.reduce((acc, m) => acc + m.snfPercentage, 0) / chartQualityLogs.length
    : 0;
  const hasChartData =
    chartMode === 'quality'
      ? dailyTrendData.some((d) => d.fat !== null || d.snf !== null)
      : dailyTrendData.some((d) => d.total > 0);

  const handleDownloadReport = () => {
    const csv = buildDashboardReportCsv({
      generatedAt: new Date().toISOString(),
      periodLabel,
      periodRangeLabel,
      periodFrom: periodRange.from,
      periodTo: periodRange.to,
      operationalDate: selectedDate,
      currencySymbol,
      periodMilkLogs,
      periodSales: periodMilkSales,
      periodSupplyLogs,
      periodInvoices,
      periodExpenses,
      customers,
      cattle,
      vaccines,
      tanks: dashboardTanks,
      feeds,
      summary: {
        totalMilk: totalMilkInPeriod,
        avgMilkPerDay,
        productionDays: milkProductionDays,
        avgFat,
        avgSnf,
        avgClr,
        withheldMilk: withheldMilkInPeriod,
        usableMilk: usableMilkInPeriod,
        milkSold: totalMilkSoldLiters,
        salesValue: totalMilkSalesValue,
        paidSalesValue: paidMilkSalesValue,
        salesCount: periodMilkSales.length,
        deliveryRevenue: periodDeliveryRevenue,
        collected: periodCollected,
        invoicedRevenue: periodInvoicedRevenue,
        totalExpenses: periodTotalExpenses,
        netProfit: netOperatingProfit,
        profitMargin,
        lactatingCount,
        pregnantCount,
        dryCount,
        otherCount,
        withdrawalCount,
        customerCount: customers.length,
        invoiceCount: periodInvoices.length,
        expenseCount: periodExpenses.length,
        supplyCount: periodSupplyLogs.length,
        scheduledVaccines: scheduledVaccineCount,
        completedVaccines: completedVaccineCount,
        feedStockKg: totalFeedStockKg,
      },
    });

    downloadCsvFile(
      `dairyflow_dashboard_report_${periodRange.from}_to_${periodRange.to}.csv`,
      csv
    );
  };

  return (
    <div className="space-y-6">
      {/* Farm Hero Welcome Banner with scenic pasture photo, emerald green base & white accents (NO BLACK!) */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-emerald-800 via-emerald-700 to-green-700 text-white border border-emerald-900/10 shadow-sm">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/dairy_hero_farm_1790960485209.jpg"
            alt="Verdant Meadow Dairy Pasture"
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-35 brightness-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/85 via-emerald-900/70 to-emerald-800/40" />
        </div>

        <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 bg-emerald-600/90 text-white px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2.5 shadow-xs border border-emerald-400/30">
              <span className="w-2 h-2 rounded-full bg-emerald-200 animate-pulse" />
              <span>Verdant Dairy Management · Executive Pulse</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
              Dairy Farm & Revenue Operations
            </h1>
            <p className="text-sm text-emerald-100 leading-relaxed">
              Monitoring <span className="font-bold text-white">{cattle.length} cattle herd</span>, 
              cold milk storage tanks, daily route dispatches, expenses & customer ledger balances.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenMilkModal}
              className="px-4 py-2.5 text-xs font-bold rounded-lg bg-white hover:bg-emerald-50 text-emerald-900 shadow-xs transition-colors flex items-center gap-2 cursor-pointer border border-white"
            >
              <Plus className="w-4 h-4 text-emerald-700" />
              <span>Log Milking Yield</span>
            </button>
            <button
              onClick={() => onNavigateTab('expenses')}
              className="px-4 py-2.5 text-xs font-bold rounded-lg bg-emerald-900/40 hover:bg-emerald-900/60 text-white transition-colors flex items-center gap-2 cursor-pointer shadow-xs border border-emerald-400/20 backdrop-blur-xs"
            >
              <Receipt className="w-4 h-4 text-emerald-300" />
              <span>Record Farm Expense</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard Period Filter */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-xs p-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
            <CalendarDays className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-neutral-900">Dashboard period</p>
            <p className="text-[11px] text-neutral-500">
              {periodLabel} · {periodRangeLabel}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
            <button
              type="button"
              onClick={() => setPeriod('this-month')}
              aria-pressed={period === 'this-month'}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                period === 'this-month'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-white'
              }`}
            >
              This month
            </button>
            <button
              type="button"
              onClick={() => setPeriod('last-month')}
              aria-pressed={period === 'last-month'}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                period === 'last-month'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-white'
              }`}
            >
              Last month
            </button>
          </div>

          <select
            value={isLongRange ? period : ''}
            onChange={(e) => {
              if (e.target.value) {
                setPeriod(e.target.value as DashboardPeriod);
              }
            }}
            aria-label="Longer dashboard period"
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-neutral-200 bg-white text-neutral-700 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
          >
            <option value="" disabled>Longer range…</option>
            <option value="3m">Last 3 months</option>
            <option value="6m">Last 6 months</option>
            <option value="1y">Last 1 year</option>
            <option value="max">All time (max)</option>
          </select>

          {onOpenDataManagement && (
            <button
              type="button"
              onClick={onOpenDataManagement}
              title="Import old farm data from a CSV file"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50 transition-colors cursor-pointer shadow-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              Import CSV
            </button>
          )}

          <button
            type="button"
            onClick={handleDownloadReport}
            title="Download a CSV report for the selected dashboard period"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Download Report
          </button>
        </div>
      </div>

      {/* Financial P&L Section: Total Revenue, Total Expenses, Net Profit */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900 flex flex-wrap items-center gap-2">
                Financial Pulse & Farm Margins
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                  {periodLabel}
                </span>
              </h2>
              <p className="text-xs text-neutral-500">Gross revenue vs feed, veterinary, labor & operational expenses</p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('expenses')}
            className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
          >
            <span>Manage All Expenses</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Revenue */}
          <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200">
            <div className="flex items-center justify-between text-xs text-emerald-800 font-semibold mb-1">
              <span>Total Revenue Invoiced</span>
              <IndianRupee className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-emerald-700 text-sm font-bold">{currencySymbol}</span>
              <span className="text-2xl font-extrabold text-neutral-900 tabular-nums">
                {periodInvoicedRevenue.toFixed(2)}
              </span>
            </div>
            <div className="text-[11px] text-neutral-600 mt-2 flex justify-between">
              <span>Period deliveries: <strong className="text-neutral-900 tabular-nums">{currencySymbol}{periodDeliveryRevenue.toFixed(2)}</strong></span>
            </div>
          </div>

          {/* Expenses */}
          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200">
            <div className="flex items-center justify-between text-xs text-neutral-600 font-semibold mb-1">
              <span>Total Farm Expenses</span>
              <Receipt className="w-4 h-4 text-neutral-500" />
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-neutral-400 text-sm font-bold">{currencySymbol}</span>
              <span className="text-2xl font-extrabold text-neutral-900 tabular-nums">
                {periodTotalExpenses.toFixed(2)}
              </span>
            </div>
            <div className="text-[11px] text-neutral-600 mt-2 flex justify-between">
              <span>{periodExpenses.length} vouchers logged</span>
              <span className="text-neutral-400">{periodLabel}</span>
            </div>
          </div>

          {/* Net Margin */}
          <div className="p-4 rounded-xl bg-white border border-neutral-200 shadow-xs">
            <div className="flex items-center justify-between text-xs text-neutral-600 font-semibold mb-1">
              <span>Net Operating Profit</span>
              <Wallet className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-emerald-600 text-sm font-bold">{currencySymbol}</span>
              <span className={`text-2xl font-extrabold tabular-nums ${netOperatingProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                {netOperatingProfit.toFixed(2)}
              </span>
            </div>
            <div className="text-[11px] text-neutral-600 mt-2 flex justify-between">
              <span>Profit Margin: <strong className="text-emerald-800 tabular-nums">{profitMargin}%</strong></span>
              <span className={`text-xs font-semibold ${netOperatingProfit >= 0 ? 'text-emerald-800' : 'text-rose-600'}`}>
                {netOperatingProfit >= 0 ? 'Healthy Margin' : 'Operating Loss'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Milk Production */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-medium mb-2">
            <span>Milk Production</span>
            <Milk className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-bold text-neutral-900 tabular-nums">
              {totalMilkInPeriod.toFixed(1)}
            </span>
            <span className="text-xs font-medium text-neutral-500">Liters</span>
          </div>
          <div className="text-[11px] text-neutral-500">
            Avg <strong className="text-emerald-800 tabular-nums">{avgMilkPerDay.toFixed(1)}</strong> L/day
            <span className="text-neutral-300"> · </span>
            {milkProductionDays} production {milkProductionDays === 1 ? 'day' : 'days'}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-neutral-500">
            <span>
              Fat <strong className="text-neutral-800 tabular-nums">{avgFat.toFixed(2)}%</strong>
            </span>
            <span className="text-neutral-300">·</span>
            <span>
              SNF <strong className="text-neutral-800 tabular-nums">{avgSnf.toFixed(2)}%</strong>
            </span>
            <span className="text-neutral-300">·</span>
            <span>
              CLR <strong className="text-neutral-800 tabular-nums">{avgClr}</strong>
            </span>
          </div>
          {withheldMilkInPeriod > 0 && (
            <div className="mt-2 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200 font-medium">
              ⚠️ {withheldMilkInPeriod.toFixed(1)}L withheld (antibiotic care)
            </div>
          )}
        </div>

        {/* Card 2: Milk Sales */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-medium mb-2">
            <span>Milk Sales</span>
            <Receipt className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-1">
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-400 block">
                Milk Sold
              </span>
              <div className="flex flex-wrap items-baseline gap-1 mt-0.5">
                <span className="text-xl font-bold text-neutral-900 tabular-nums">
                  {totalMilkSoldLiters.toFixed(1)}
                </span>
                <span className="text-[11px] font-medium text-neutral-500">L</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-400 block">
                Sales Value
              </span>
              <div className="flex flex-wrap items-baseline gap-0.5 mt-0.5">
                <span className="text-sm font-semibold text-emerald-700">{currencySymbol}</span>
                <span className="text-xl font-bold text-emerald-800 tabular-nums">
                  {totalMilkSalesValue.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          <div className="text-xs text-neutral-500 flex items-center justify-between gap-2">
            <span>{periodMilkSales.length} {periodMilkSales.length === 1 ? 'sale' : 'sales'}</span>
            <span>
              Paid: <strong className="text-emerald-800 tabular-nums">{currencySymbol}{paidMilkSalesValue.toFixed(2)}</strong>
            </span>
          </div>
        </div>

        {/* Card 3: Period Revenue */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-medium mb-2">
            <span>Delivery Revenue</span>
            <IndianRupee className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-neutral-500 text-base font-medium">{currencySymbol}</span>
            <span className="text-2xl font-bold text-neutral-900 tabular-nums">
              {periodDeliveryRevenue.toFixed(2)}
            </span>
          </div>
          <div className="text-xs text-neutral-500 flex items-center justify-between">
            <span>Collected: <strong className="text-emerald-800 tabular-nums">{currencySymbol}{periodCollected.toFixed(2)}</strong></span>
            <span>Ledger: <strong className="text-neutral-700 tabular-nums">{currencySymbol}{(periodDeliveryRevenue - periodCollected).toFixed(2)}</strong></span>
          </div>
        </div>

        {/* Card 4: Herd Health & Lactation */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-medium mb-2">
            <span>Herd Vitality Status</span>
            <HeartPulse className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-bold text-neutral-900 tabular-nums">
              {lactatingCount}
            </span>
            <span className="text-xs font-medium text-neutral-500">
              milking / {cattle.length} total
            </span>
          </div>
          <div className="text-xs text-neutral-500 flex items-center gap-1.5 flex-wrap">
            <span>{pregnantCount} Pregnant</span>
            <span>·</span>
            <span>{dryCount} Dry</span>
            <span>·</span>
            <span>{otherCount} Calves</span>
          </div>
          {withdrawalCount > 0 ? (
            <div className="mt-2 text-xs text-amber-800 font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>{withdrawalCount} cow in antibiotic withdrawal</span>
            </div>
          ) : (
            <div className="mt-2 text-xs text-emerald-800 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Zero antibiotic restrictions</span>
            </div>
          )}
        </div>
      </div>

      {/* 7-Day Production Trend */}
      <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-semibold text-neutral-900">
                  {chartMode === 'quality' ? '7-Day Milk Quality Trend' : '7-Day Milk Production Trend'}
                </h2>
                <p className="text-xs text-neutral-500">
                  {chartMode === 'quality'
                    ? `Rolling 7 days to ${formatMonthDay(periodAnchor)} · Daily average butterfat & SNF`
                    : `Rolling 7 days to ${formatMonthDay(periodAnchor)} · Morning (AM) vs Evening (PM) yield`}
                </p>
              </div>
              <div className="flex flex-col items-start sm:items-end gap-2 text-xs">
                <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
                  <button
                    type="button"
                    onClick={() => setChartMode('yield')}
                    aria-pressed={chartMode === 'yield'}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                      chartMode === 'yield'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-neutral-600 hover:text-neutral-900 hover:bg-white'
                    }`}
                  >
                    Yield
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMode('quality')}
                    aria-pressed={chartMode === 'quality'}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                      chartMode === 'quality'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-neutral-600 hover:text-neutral-900 hover:bg-white'
                    }`}
                  >
                    Quality
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  {chartMode === 'quality' ? (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-xs bg-amber-500" />
                        <span className="text-neutral-600">Fat %</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-xs bg-sky-500" />
                        <span className="text-neutral-600">SNF %</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-xs bg-emerald-700" />
                        <span className="text-neutral-600">Morning (AM)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-xs bg-emerald-400" />
                        <span className="text-neutral-600">Evening (PM)</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Trend Bar Chart */}
            <div
              className={`${hasChartData ? 'h-64' : 'h-48'} w-full max-w-5xl mx-auto pt-4 pb-2 border-b border-neutral-100 ${
                hasChartData
                  ? 'flex items-end justify-between gap-2 sm:gap-4'
                  : 'flex flex-col items-center justify-center text-center'
              }`}
            >
              {hasChartData && dailyTrendData.map((d) => {
                const totalHeight = Math.max(12, (d.total / maxTrendYield) * 180);
                const morningPct = d.total > 0 ? (d.morning / d.total) * 100 : 50;
                const eveningPct = 100 - morningPct;
                const fatHeight = d.fat !== null ? Math.max(4, (d.fat / maxQuality) * 180) : 0;
                const snfHeight = d.snf !== null ? Math.max(4, (d.snf / maxQuality) * 180) : 0;
                const isSelected = d.date === selectedDate;

                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-16 z-20 bg-emerald-950 text-white text-xs py-1 px-2.5 rounded-lg pointer-events-none whitespace-nowrap shadow-md border border-emerald-400">
                      <div className="text-[10px] text-emerald-300 mb-0.5">{formatMonthDay(d.date)}</div>
                      {chartMode === 'quality' ? (
                        <>
                          <div className="font-bold">
                            Fat: {d.fat !== null ? `${d.fat.toFixed(2)}%` : '—'}
                          </div>
                          <div className="text-[10px] text-emerald-200">
                            SNF: {d.snf !== null ? `${d.snf.toFixed(2)}%` : '—'} · Yield: {d.total.toFixed(1)}L
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="font-bold">Total: {d.total.toFixed(1)} L</div>
                          <div className="text-[10px] text-emerald-200">AM: {d.morning.toFixed(1)}L · PM: {d.evening.toFixed(1)}L</div>
                        </>
                      )}
                    </div>

                    {chartMode === 'quality' ? (
                      <>
                        <div className="text-[9px] sm:text-[10px] font-semibold text-neutral-600 tabular-nums mb-1 whitespace-nowrap">
                          {d.fat !== null && d.snf !== null
                            ? `${d.fat.toFixed(1)} / ${d.snf.toFixed(1)}`
                            : '—'}
                        </div>

                        <div className="flex items-end justify-center gap-1" style={{ height: '180px' }}>
                          <div
                            style={{ height: `${fatHeight}px` }}
                            className={`w-3 sm:w-4 rounded-t-sm bg-amber-500 hover:bg-amber-600 transition-colors ${
                              isSelected ? 'ring-2 ring-emerald-600 ring-offset-1' : ''
                            }`}
                          />
                          <div
                            style={{ height: `${snfHeight}px` }}
                            className={`w-3 sm:w-4 rounded-t-sm bg-sky-500 hover:bg-sky-600 transition-colors ${
                              isSelected ? 'ring-2 ring-emerald-600 ring-offset-1' : ''
                            }`}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-[11px] font-semibold text-neutral-700 tabular-nums mb-1">
                          {d.total > 0 ? `${Math.round(d.total)}L` : '—'}
                        </div>

                        <div
                          style={{ height: `${totalHeight}px` }}
                          className={`w-full max-w-[48px] rounded-t-md overflow-hidden flex flex-col-reverse transition-all ${
                            isSelected ? 'ring-2 ring-emerald-600 ring-offset-2' : ''
                          }`}
                        >
                          <div
                            style={{ height: `${morningPct}%` }}
                            className="bg-emerald-700 w-full hover:bg-emerald-800 transition-colors"
                          />
                          <div
                            style={{ height: `${eveningPct}%` }}
                            className="bg-emerald-400 w-full hover:bg-emerald-300 transition-colors"
                          />
                        </div>
                      </>
                    )}

                    <div className={`mt-2 text-xs font-medium ${isSelected ? 'text-emerald-900 font-bold' : 'text-neutral-500'}`}>
                      {d.label.split(',')[0]}
                    </div>
                  </div>
                );
              })}

              {!hasChartData && (
                <div className="px-4">
                  <Milk className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-neutral-700">
                    No {chartMode === 'quality' ? 'quality' : 'production'} records in this 7-day window
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    Log milking yield to populate this trend.
                  </p>
                  <button
                    onClick={onOpenMilkModal}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Log milking yield
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 flex flex-wrap items-center justify-between text-xs text-neutral-600 gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {chartMode === 'quality' ? (
                <>
                  <span>
                    7-day avg fat:{' '}
                    <strong className="text-neutral-900 tabular-nums">
                      {chartQualityLogs.length > 0 ? `${chartAvgFat.toFixed(2)}%` : '—'}
                    </strong>
                  </span>
                  <span>·</span>
                  <span>
                    7-day avg SNF:{' '}
                    <strong className="text-neutral-900 tabular-nums">
                      {chartQualityLogs.length > 0 ? `${chartAvgSnf.toFixed(2)}%` : '—'}
                    </strong>
                  </span>
                  <span>·</span>
                  <span>{chartQualityLogs.length} quality tests</span>
                </>
              ) : (
                <>
                  <span>Usable yield in period: <strong className="text-neutral-900 tabular-nums">{usableMilkInPeriod.toFixed(1)} L</strong></span>
                  <span>·</span>
                  <span>Committed to delivery in period: <strong className="text-neutral-900 tabular-nums">{totalDeliveryTargetLiters.toFixed(1)} L</strong></span>
                </>
              )}
            </div>
            <button
              onClick={() => onNavigateTab('production')}
              className="font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
            >
              <span>{chartMode === 'quality' ? 'View full quality logs' : 'View full yield logs'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      {/* Vaccine Watchlist */}
      <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs">
        {dashboardTanks.length > 0 && (
          <div className="mb-4 pb-4 border-b border-neutral-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-neutral-900">Bulk Milk Silos</h2>
              <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Live Chilling</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {dashboardTanks.map((tank) => {
                const fillPct = Math.min(100, Math.round((tank.currentLiters / tank.capacityLiters) * 100));
                const isTempSafe = tank.tempCelsius <= 4.0;

                return (
                  <div key={tank.id} className="p-3 rounded-lg border border-neutral-200 bg-neutral-50">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-neutral-800">{tank.name}</span>
                      <span className={`text-xs font-bold flex items-center gap-1 tabular-nums ${isTempSafe ? 'text-emerald-700' : 'text-amber-700'}`}>
                        <Thermometer className="w-3 h-3" />
                        {tank.tempCelsius.toFixed(1)}°C
                      </span>
                    </div>

                    <div className="w-full bg-neutral-200 rounded-full h-2 mb-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-2 rounded-full transition-all"
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-neutral-500">
                      <span>{tank.milkType}</span>
                      <span className="tabular-nums font-semibold text-neutral-700">
                        {tank.currentLiters} / {tank.capacityLiters} L ({fillPct}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Vaccine Watchlist</h2>
            <p className="text-[11px] text-neutral-500">
              {scheduledVaccineCount} scheduled · {completedVaccineCount} completed
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-neutral-500 tabular-nums">
              {completedVaccineCount} / {vaccines.length} records completed
            </span>
            <button
              onClick={() => onNavigateTab('health')}
              className="text-xs text-emerald-800 font-bold hover:underline cursor-pointer whitespace-nowrap"
            >
              Schedule &rarr;
            </button>
          </div>
        </div>

        {upcomingVaccines.length > 0 ? (
          <div className="flex flex-col sm:flex-row gap-2">
            {upcomingVaccines.slice(0, 3).map((v) => (
              <div key={v.id} className="flex-1 min-w-0 text-xs p-3 bg-neutral-50 rounded-lg text-neutral-700 flex items-start justify-between gap-3 border border-neutral-200">
                <div className="min-w-0">
                  <p className="font-semibold text-neutral-900 truncate">{v.vaccineName}</p>
                  <p className="text-[11px] text-neutral-500 truncate">Target: {v.cattleTag}</p>
                </div>
                <span className="text-[11px] font-bold text-neutral-700 tabular-nums whitespace-nowrap">
                  Due {formatMonthDay(v.nextDueDate)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-neutral-500 italic">All routine herd vaccinations up to date.</p>
        )}
      </div>

      {/* Operations Grid: Delivery Route & Herd Stars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Delivery Route Sheet */}
        <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-neutral-900">Delivery Route Sheet</h2>
              <p className="text-xs text-neutral-500">Customer deliveries scheduled for {selectedDate}</p>
            </div>
            <span className="text-[11px] font-semibold text-neutral-500 bg-neutral-50 border border-neutral-200 px-2 py-0.5 rounded">
              {todaySupply.length} stops
            </span>
          </div>

          <div className="divide-y divide-neutral-100 overflow-hidden">
            {todaySupply.slice(0, 5).map((log) => {
              const isDelivered = log.deliveryStatus === 'Delivered';
              return (
                <div key={log.id} className="py-3 flex items-center justify-between gap-3 hover:bg-neutral-50 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleDeliveryStatus(log.id, isDelivered ? 'Pending' : 'Delivered')}
                      className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                        isDelivered
                          ? 'bg-emerald-600 text-white'
                          : 'border border-neutral-300 text-transparent hover:border-emerald-500'
                      }`}
                      title={isDelivered ? 'Click to mark pending' : 'Click to mark delivered'}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <div>
                      <h4 className="text-xs font-semibold text-neutral-900">{log.customerName}</h4>
                      <p className="text-[11px] text-neutral-500">
                        {log.route} · <span className="tabular-nums font-semibold text-neutral-700">{log.quantityLiters}L</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold text-neutral-900 tabular-nums">
                      {currencySymbol}{log.totalAmount.toFixed(2)}
                    </div>
                    <div className="text-[11px] text-neutral-500 flex items-center justify-end gap-1">
                      {isDelivered ? (
                        <span className="text-emerald-700 font-semibold">Delivered at {log.deliveredAt || '07:00 AM'}</span>
                      ) : (
                        <span className="text-amber-700 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" /> In Transit
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {todaySupply.length === 0 && (
            <div className="py-8 text-center text-xs text-neutral-500">
              No delivery stops scheduled for this date.
            </div>
          )}

          <div className="mt-auto pt-3 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-500">
            <span>
              <strong className="text-neutral-900 tabular-nums">{deliveredTodayCount}</strong> of{' '}
              <strong className="text-neutral-900 tabular-nums">{todaySupply.length}</strong> stops delivered
              {todaySupply.length > 5 ? ' · Showing 5' : ''}
            </span>
            <span className="tabular-nums">
              {todayRouteLiters.toFixed(1)} L ·{' '}
              <strong className="text-neutral-800">
                {currencySymbol}{todayRouteValue.toFixed(2)}
              </strong>
            </span>
          </div>
        </div>

        {/* Herd Milking Stars */}
        <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-semibold text-neutral-900">Herd Milking Stars</h2>
              <p className="text-xs text-neutral-500">Top milk yield producers in lactating cycle</p>
            </div>
            <button
              onClick={() => onNavigateTab('cattle')}
              className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <span>All {cattle.length}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-neutral-100">
            {topLactatingCattle.map((cow) => {
              const isUnderWithdrawal = cow.healthCondition === 'Withdrawal';
              return (
                <div key={cow.id} className="py-2.5 flex items-center justify-between gap-3 px-2 rounded-lg hover:bg-neutral-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-center text-xs font-bold text-neutral-800">
                      {cow.tagNumber.replace('DF-', '')}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-neutral-900">{cow.name}</span>
                        <span className="text-[11px] text-neutral-500">· {cow.breed}</span>
                        {isUnderWithdrawal && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold">
                            WITHDRAWAL
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500">
                        Lactation #{cow.lactationCycle} · Weight: {cow.weightKg}kg
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-emerald-800 tabular-nums">
                      {cow.avgDailyYield.toFixed(1)} L/day
                    </span>
                    <p className="text-[10px] text-neutral-400">Avg Output</p>
                  </div>
                </div>
              );
            })}
            {topLactatingCattle.length === 0 && (
              <div className="py-6 text-center text-xs text-neutral-500">
                No lactating cows recorded yet.
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between gap-2 text-[11px] text-neutral-500">
            <span>Herd average</span>
            <span className="font-semibold text-emerald-800 tabular-nums">
              {avgLactatingYield.toFixed(1)} L/day · {totalLactatingYield.toFixed(1)} L total
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
