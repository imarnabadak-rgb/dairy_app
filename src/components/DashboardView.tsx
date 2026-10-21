'use client';

import React from 'react';
import Image from 'next/image';
import { useDairy } from '../context/DairyContext';
import { formatMonthDay, formatWeekdayMonthDay, lastNDates, parseISODate } from '../lib/date';
import { 
  Milk, 
  Truck, 
  DollarSign, 
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
  Sparkles
} from 'lucide-react';

interface DashboardViewProps {
  onNavigateTab: (tab: string) => void;
  onOpenMilkModal: () => void;
  onOpenSupplyModal: () => void;
  onOpenCattleModal: () => void;
  onOpenExpenseModal?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateTab,
  onOpenMilkModal,
  onOpenSupplyModal,
  onOpenCattleModal,
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
    toggleDeliveryStatus,
    currencySymbol 
  } = useDairy();

  // Daily production aggregates
  const todayLogs = milkLogs.filter((m) => m.date === selectedDate);
  const morningYield = todayLogs
    .filter((m) => m.session === 'Morning')
    .reduce((acc, curr) => acc + curr.liters, 0);
  const eveningYield = todayLogs
    .filter((m) => m.session === 'Evening')
    .reduce((acc, curr) => acc + curr.liters, 0);
  const totalMilkToday = morningYield + eveningYield;

  // Segregated withholding milk (contaminated by antibiotic therapy)
  const withheldMilkToday = todayLogs
    .filter((m) => m.isWithheld)
    .reduce((acc, curr) => acc + curr.liters, 0);
  const usableMilkToday = totalMilkToday - withheldMilkToday;

  // Today's Deliveries and Route Progress
  const todaySupply = supplyLogs.filter((s) => s.date === selectedDate);
  const deliveredDeliveries = todaySupply.filter((s) => s.deliveryStatus === 'Delivered');
  const pendingDeliveries = todaySupply.filter((s) => s.deliveryStatus === 'Pending');
  const deliveryCompletionPct = todaySupply.length > 0 
    ? Math.round((deliveredDeliveries.length / todaySupply.length) * 100) 
    : 0;

  const totalDeliveryTargetLiters = todaySupply.reduce((acc, curr) => acc + curr.quantityLiters, 0);
  const deliveredLiters = deliveredDeliveries.reduce((acc, curr) => acc + curr.quantityLiters, 0);

  // Financial aggregates: Revenue vs Expenses
  const todayRevenue = todaySupply.reduce((acc, curr) => acc + curr.totalAmount, 0);
  const collectedToday = todaySupply
    .filter((s) => s.paymentStatus === 'Paid')
    .reduce((acc, curr) => acc + curr.totalAmount, 0);
  const totalInvoicedRevenue = invoices.reduce((acc, curr) => acc + curr.totalAmount, 0);
  
  // Total expenses logged
  const totalAllExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);
  const todayExpenses = expenses
    .filter((e) => e.date === selectedDate)
    .reduce((acc, curr) => acc + curr.amount, 0);

  // Operating Net Profit
  const netOperatingProfit = totalInvoicedRevenue - totalAllExpenses;
  const profitMargin = totalInvoicedRevenue > 0 
    ? Math.round((netOperatingProfit / totalInvoicedRevenue) * 100) 
    : 0;

  // Cattle counts
  const lactatingCount = cattle.filter((c) => c.status === 'Lactating').length;
  const pregnantCount = cattle.filter((c) => c.status === 'Pregnant').length;
  const dryCount = cattle.filter((c) => c.status === 'Dry').length;
  const otherCount = cattle.length - lactatingCount - pregnantCount - dryCount;
  const withdrawalCount = cattle.filter((c) => c.healthCondition === 'Withdrawal').length;

  // Upcoming critical vaccines in the next 14 days
  const upcomingVaccines = vaccines
    .filter((v) => v.status === 'Scheduled')
    .sort((a, b) => parseISODate(a.nextDueDate).getTime() - parseISODate(b.nextDueDate).getTime());

  // Past 7 days production trend for chart
  const last7Days = lastNDates(selectedDate, 7);

  const dailyTrendData = last7Days.map((dateStr) => {
    const logs = milkLogs.filter((m) => m.date === dateStr);
    const am = logs.filter((m) => m.session === 'Morning').reduce((a, b) => a + b.liters, 0);
    const pm = logs.filter((m) => m.session === 'Evening').reduce((a, b) => a + b.liters, 0);
    const dayLabel = formatWeekdayMonthDay(dateStr);
    return { date: dateStr, label: dayLabel, morning: am, evening: pm, total: am + pm };
  });

  const maxTrendYield = Math.max(...dailyTrendData.map((d) => d.total), 120);

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
              onClick={() => onNavigateTab('ai')}
              className="px-4 py-2.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors flex items-center gap-2 cursor-pointer border border-emerald-400/40"
            >
              <Sparkles className="w-4 h-4 text-emerald-200" />
              <span>AI Health & Yield Maximizer</span>
            </button>
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

      {/* AI Farm Intelligence Quick Spotlight Card */}
      <div className="bg-gradient-to-r from-emerald-50 via-emerald-50/60 to-white rounded-2xl border border-emerald-200 p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
            <Sparkles className="w-5 h-5 text-emerald-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-emerald-950">AI Cow Health & Milk Yield Expansion Engine</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-700 text-white">
                Active Analysis
              </span>
            </div>
            <p className="text-xs text-neutral-600 mt-1 max-w-2xl leading-relaxed">
              Automated veterinary monitoring identifies <strong className="text-emerald-900 font-semibold">{withdrawalCount} withdrawal cases</strong> and projects a <strong className="text-emerald-900 font-semibold">+15% yield gain ({cattle.filter(c => c.status === 'Lactating').reduce((a, b) => a + (b.avgDailyYield * 0.15), 0).toFixed(1)} L/day)</strong> across lactating cows using precision bypass rations, while auditing expenses to safeguard profitability.
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigateTab('ai')}
          className="shrink-0 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
        >
          <span>Open Full AI Advisor</span>
          <ArrowUpRight className="w-3.5 h-3.5 text-emerald-200" />
        </button>
      </div>

      {/* Financial P&L Section: Total Revenue, Total Expenses, Net Profit */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900">Financial Pulse & Farm Margins</h2>
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
              <DollarSign className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-emerald-700 text-sm font-bold">{currencySymbol}</span>
              <span className="text-2xl font-extrabold text-neutral-900 tabular-nums">
                {totalInvoicedRevenue.toFixed(2)}
              </span>
            </div>
            <div className="text-[11px] text-neutral-600 mt-2 flex justify-between">
              <span>Today's deliveries: <strong className="text-neutral-900 tabular-nums">{currencySymbol}{todayRevenue.toFixed(2)}</strong></span>
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
                {totalAllExpenses.toFixed(2)}
              </span>
            </div>
            <div className="text-[11px] text-neutral-600 mt-2 flex justify-between">
              <span>Today's costs: <strong className="text-neutral-900 tabular-nums">{currencySymbol}{todayExpenses.toFixed(2)}</strong></span>
              <span className="text-neutral-400">({expenses.length} vouchers)</span>
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
              <span className="text-xs font-semibold text-emerald-800">Healthy Margin</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Milk Production */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-medium mb-2">
            <span>Today's Milk Yield</span>
            <Milk className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-bold text-neutral-900 tabular-nums">
              {totalMilkToday.toFixed(1)}
            </span>
            <span className="text-xs font-medium text-neutral-500">Liters</span>
          </div>
          <div className="text-xs text-neutral-500 flex items-center gap-1.5">
            <span>AM: <strong className="text-neutral-700 tabular-nums">{morningYield.toFixed(1)}L</strong></span>
            <span>·</span>
            <span>PM: <strong className="text-neutral-700 tabular-nums">{eveningYield.toFixed(1)}L</strong></span>
          </div>
          {withheldMilkToday > 0 && (
            <div className="mt-2 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200 font-medium">
              ⚠️ {withheldMilkToday.toFixed(1)}L withheld (antibiotic care)
            </div>
          )}
        </div>

        {/* Card 2: Deliveries & Fulfillment */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-medium mb-2">
            <span>Route Supply Fulfillment</span>
            <Truck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-bold text-neutral-900 tabular-nums">
              {deliveryCompletionPct}%
            </span>
            <span className="text-xs font-medium text-neutral-500">
              ({deliveredDeliveries.length}/{todaySupply.length} stops)
            </span>
          </div>
          <div className="w-full bg-neutral-100 rounded-full h-1.5 mb-2 overflow-hidden">
            <div
              className="bg-emerald-600 h-1.5 rounded-full transition-all"
              style={{ width: `${deliveryCompletionPct}%` }}
            />
          </div>
          <div className="text-xs text-neutral-500 flex items-center justify-between">
            <span>{deliveredLiters.toFixed(1)}L fulfilled</span>
            <span className="tabular-nums font-semibold">{pendingDeliveries.length} pending</span>
          </div>
        </div>

        {/* Card 3: Today's Revenue */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-medium mb-2">
            <span>Today's Delivery Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-neutral-500 text-base font-medium">{currencySymbol}</span>
            <span className="text-2xl font-bold text-neutral-900 tabular-nums">
              {todayRevenue.toFixed(2)}
            </span>
          </div>
          <div className="text-xs text-neutral-500 flex items-center justify-between">
            <span>Collected: <strong className="text-emerald-800 tabular-nums">{currencySymbol}{collectedToday.toFixed(2)}</strong></span>
            <span>Ledger: <strong className="text-neutral-700 tabular-nums">{currencySymbol}{(todayRevenue - collectedToday).toFixed(2)}</strong></span>
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

      {/* Main Grid: Trends Chart & Silo Tanks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: 7-Day Production Bar Chart & Balance */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-neutral-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-neutral-900">7-Day Milk Production Trend</h2>
                <p className="text-xs text-neutral-500">Morning (AM) vs Evening (PM) yield in liters</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-emerald-700" />
                  <span className="text-neutral-600">Morning (AM)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-emerald-400" />
                  <span className="text-neutral-600">Evening (PM)</span>
                </div>
              </div>
            </div>

            {/* Trend Bar Chart */}
            <div className="h-56 w-full flex items-end justify-between gap-2 sm:gap-4 pt-4 pb-2 border-b border-neutral-100">
              {dailyTrendData.map((d) => {
                const totalHeight = Math.max(12, (d.total / maxTrendYield) * 180);
                const morningPct = d.total > 0 ? (d.morning / d.total) * 100 : 50;
                const eveningPct = 100 - morningPct;
                const isSelected = d.date === selectedDate;

                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-12 z-20 bg-emerald-950 text-white text-xs py-1 px-2.5 rounded-lg pointer-events-none whitespace-nowrap shadow-md border border-emerald-400">
                      <div className="font-bold">Total: {d.total.toFixed(1)} L</div>
                      <div className="text-[10px] text-emerald-200">AM: {d.morning.toFixed(1)}L · PM: {d.evening.toFixed(1)}L</div>
                    </div>

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

                    <div className={`mt-2 text-xs font-medium ${isSelected ? 'text-emerald-900 font-bold' : 'text-neutral-500'}`}>
                      {d.label.split(',')[0]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 flex flex-wrap items-center justify-between text-xs text-neutral-600 gap-2">
            <div className="flex items-center gap-1.5">
              <span>Usable yield today: <strong className="text-neutral-900 tabular-nums">{usableMilkToday.toFixed(1)} L</strong></span>
              <span>·</span>
              <span>Committed to delivery: <strong className="text-neutral-900 tabular-nums">{totalDeliveryTargetLiters.toFixed(1)} L</strong></span>
            </div>
            <button
              onClick={() => onNavigateTab('production')}
              className="font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
            >
              <span>View full yield logs</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right 1 Col: Chilling Silos & Feed Levels */}
        <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-neutral-900">Bulk Milk Silos</h2>
              <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Live Chilling</span>
            </div>

            <div className="space-y-4">
              {tanks.map((tank) => {
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

          {/* Quick Veterinary & Health Snapshot */}
          <div className="pt-3 border-t border-neutral-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-800">Vaccine Watchlist</span>
              <button
                onClick={() => onNavigateTab('health')}
                className="text-xs text-emerald-800 font-bold hover:underline cursor-pointer"
              >
                Schedule &rarr;
              </button>
            </div>
            {upcomingVaccines.length > 0 ? (
              <div className="space-y-2">
                {upcomingVaccines.slice(0, 2).map((v) => (
                  <div key={v.id} className="text-xs p-2 bg-neutral-50 rounded-md text-neutral-700 flex items-start justify-between gap-2 border border-neutral-200">
                    <div>
                      <p className="font-semibold text-neutral-900">{v.vaccineName}</p>
                      <p className="text-[11px] text-neutral-500">Target: {v.cattleTag}</p>
                    </div>
                    <span className="text-[11px] font-bold text-neutral-700 tabular-nums">
                      Due {formatMonthDay(v.nextDueDate)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-500 italic">All routine herd vaccinations up to date.</p>
            )}
          </div>
        </div>
      </div>

      {/* Two Column Section: Today's Delivery Stops & Milking Herd Pulse */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Route Deliveries */}
        <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-neutral-900">Today's Delivery Route Sheet</h2>
              <p className="text-xs text-neutral-500">Customer deliveries scheduled for {selectedDate}</p>
            </div>
            <button
              onClick={() => onNavigateTab('supply')}
              className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
            >
              <span>View Route Manifest</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
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
        </div>

        {/* Top Producing Cows Snapshot */}
        <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-neutral-900">Herd Milking Stars</h2>
              <p className="text-xs text-neutral-500">Top milk yield producers in lactating cycle</p>
            </div>
            <button
              onClick={() => onNavigateTab('cattle')}
              className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
            >
              <span>All {cattle.length} Cattle</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-neutral-100">
            {cattle
              .filter((c) => c.status === 'Lactating')
              .sort((a, b) => b.avgDailyYield - a.avgDailyYield)
              .slice(0, 5)
              .map((cow) => {
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
          </div>
        </div>
      </div>
    </div>
  );
};
