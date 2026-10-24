'use client';

import React, { useState } from 'react';
import { useDairy } from '../context/DairyContext';
import {
  MilkSale,
  MilkSaleSession,
} from '../types/dairy';
import {
  addMonthsISO,
  endOfMonthISO,
  startOfMonthISO,
  todayISO,
} from '../lib/date';
import { calculateSnf } from '../lib/milk-quality';
import { calculateMilkPricing } from '../lib/milk-pricing';
import {
  Calendar,
  CheckCircle2,
  Clock,
  IndianRupee,
  Edit3,
  Milk,
  Plus,
  Search,
  Trash2,
  Truck,
  X,
} from 'lucide-react';

const DEFAULT_MILK_BASE_RATE = 43;

type SalesRangePreset =
  | 'this-month'
  | 'last-month'
  | '3-months'
  | '6-months'
  | '1-year'
  | 'max';

type RateMode = 'quality' | 'manual';

interface SaleFormData {
  date: string;
  buyerId: string;
  buyerName: string;
  session: MilkSaleSession;
  quantityLiters: number;
  clr: number;
  fatPercentage: number;
  baseRate: number;
  rateMode: RateMode;
  manualRateInput: string;
  paymentStatus: MilkSale['paymentStatus'];
  notes: string;
}

const emptyForm = (date: string): SaleFormData => ({
  date: date || todayISO(),
  buyerId: '',
  buyerName: '',
  session: 'Combined',
  quantityLiters: 100,
  clr: 29.4,
  fatPercentage: 4.2,
  baseRate: DEFAULT_MILK_BASE_RATE,
  rateMode: 'quality',
  manualRateInput: '',
  paymentStatus: 'Pending',
  notes: '',
});

export const SalesView: React.FC = () => {
  const {
    sales,
    customers,
    addMilkSale,
    updateMilkSale,
    deleteMilkSale,
    selectedDate,
    currencySymbol,
  } = useDairy();

  const [rangePreset, setRangePreset] = useState<SalesRangePreset>('this-month');
  const [paymentFilter, setPaymentFilter] = useState<'all' | MilkSale['paymentStatus']>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [formData, setFormData] = useState<SaleFormData>(() => emptyForm(selectedDate));

  const today = todayISO();
  const firstSaleDate = sales.reduce(
    (earliest, sale) => (!earliest || sale.date < earliest ? sale.date : earliest),
    ''
  );
  const lastSaleDate = sales.reduce(
    (latest, sale) => (sale.date > latest ? sale.date : latest),
    ''
  );

  const presetRange =
    rangePreset === 'this-month'
      ? { start: startOfMonthISO(today), end: endOfMonthISO(today) }
      : rangePreset === 'last-month'
      ? {
          start: addMonthsISO(today, -1),
          end: endOfMonthISO(addMonthsISO(today, -1)),
        }
      : rangePreset === '3-months'
      ? { start: addMonthsISO(today, -2), end: endOfMonthISO(today) }
      : rangePreset === '6-months'
      ? { start: addMonthsISO(today, -5), end: endOfMonthISO(today) }
      : rangePreset === '1-year'
      ? { start: addMonthsISO(today, -11), end: endOfMonthISO(today) }
      : {
          start: firstSaleDate || startOfMonthISO(today),
          end: lastSaleDate || endOfMonthISO(today),
        };

  const rangeStart = presetRange.start;
  const rangeEnd = presetRange.end;

  const rangeLabel: Record<SalesRangePreset, string> = {
    'this-month': 'This month',
    'last-month': 'Last month',
    '3-months': '3 months',
    '6-months': '6 months',
    '1-year': '1 year',
    max: 'All time',
  };

  const saleBuyerName = (sale: MilkSale) =>
    sale.buyerName ?? sale.centerName ?? '';

  const filteredSales = sales
    .filter((sale) => {
      const matchesDate = sale.date >= rangeStart && sale.date <= rangeEnd;
      const matchesPayment =
        paymentFilter === 'all' || sale.paymentStatus === paymentFilter;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        saleBuyerName(sale).toLowerCase().includes(query) ||
        (sale.notes ?? '').toLowerCase().includes(query);
      return matchesDate && matchesPayment && matchesSearch;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalLiters = filteredSales.reduce(
    (sum, sale) => sum + Number(sale.quantityLiters),
    0
  );
  const grossSales = filteredSales.reduce(
    (sum, sale) => sum + Number(sale.totalAmount),
    0
  );
  const paidSales = filteredSales
    .filter((sale) => sale.paymentStatus === 'Paid')
    .reduce((sum, sale) => sum + Number(sale.totalAmount), 0);
  const pendingSales = grossSales - paidSales;
  const averageRate = totalLiters > 0 ? grossSales / totalLiters : 0;

  const handleOpenAdd = () => {
    const defaultBuyer =
      customers.find((customer) => customer.status === 'Active') ?? customers[0];
    const nextForm = emptyForm(selectedDate);
    const defaultBaseRate =
      defaultBuyer?.milkBaseRate != null && defaultBuyer.milkBaseRate > 0
        ? defaultBuyer.milkBaseRate
        : nextForm.baseRate;

    setEditingSaleId(null);
    setFormData({
      ...nextForm,
      buyerId: defaultBuyer?.id ?? '',
      buyerName: defaultBuyer?.name ?? '',
      baseRate: defaultBaseRate,
    });
    setIsModalOpen(true);
  };

  const handleBuyerChange = (buyerId: string) => {
    const buyer = customers.find((customer) => customer.id === buyerId);
    setFormData((current) => ({
      ...current,
      buyerId,
      buyerName: buyer?.name ?? '',
      baseRate:
        buyer?.milkBaseRate != null && buyer.milkBaseRate > 0
          ? buyer.milkBaseRate
          : current.baseRate,
    }));
  };

  const handleRateModeChange = (mode: RateMode) => {
    setFormData((current) => {
      if (mode === current.rateMode) return current;

      const qualityRate = calculateMilkPricing(
        Number(current.baseRate),
        Number(current.fatPercentage),
        calculateSnf(Number(current.clr), Number(current.fatPercentage))
      ).ratePerLiter;

      return {
        ...current,
        rateMode: mode,
        // Start manual mode from the current quality-based rate so the user
        // can adjust it rather than starting from zero.
        manualRateInput:
          mode === 'manual'
            ? qualityRate.toFixed(2)
            : current.manualRateInput,
      };
    });
  };

  const handleOpenEdit = (sale: MilkSale) => {
    // Sales saved before CLR was captured can still be edited without silently
    // changing their recorded SNF.
    const inferredClr =
      typeof sale.clr === 'number'
        ? sale.clr
        : sale.snfPercentage != null && sale.fatPercentage != null
        ? 4 *
          (Number(sale.snfPercentage) -
            0.25 * Number(sale.fatPercentage) -
            0.44)
        : 29.4;

    const buyerName = saleBuyerName(sale);
    const linkedBuyer =
      customers.find((customer) => customer.id === sale.buyerId) ??
      customers.find(
        (customer) => customer.name.toLowerCase() === buyerName.toLowerCase()
      );

    const clr = Number.isFinite(inferredClr)
      ? Math.min(40, Math.max(1, Number(inferredClr.toFixed(1))))
      : 29.4;
    const fatPercentage = Number(sale.fatPercentage ?? 4.2);
    const baseRate = Number(
      sale.baseRate != null && sale.baseRate > 0
        ? sale.baseRate
        : linkedBuyer?.milkBaseRate != null &&
          linkedBuyer.milkBaseRate > 0
        ? linkedBuyer.milkBaseRate
        : DEFAULT_MILK_BASE_RATE
    );
    const savedSnf =
      sale.snfPercentage != null
        ? Number(sale.snfPercentage)
        : calculateSnf(clr, fatPercentage);
    const qualityRate = calculateMilkPricing(
      baseRate,
      fatPercentage,
      savedSnf
    ).ratePerLiter;
    const savedRate = Number(sale.ratePerLiter);
    const isManualRate =
      Number.isFinite(savedRate) &&
      savedRate > 0 &&
      Math.abs(savedRate - qualityRate) > 0.005;

    setEditingSaleId(sale.id);
    setFormData({
      date: sale.date,
      buyerId: linkedBuyer?.id ?? '',
      buyerName,
      session: sale.session,
      quantityLiters: Number(sale.quantityLiters),
      clr,
      fatPercentage,
      baseRate,
      rateMode: isManualRate ? 'manual' : 'quality',
      manualRateInput: (isManualRate ? savedRate : qualityRate).toFixed(2),
      paymentStatus: sale.paymentStatus,
      notes: sale.notes ?? '',
    });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const manualRate = Number(formData.manualRateInput);
    if (
      !formData.buyerName.trim() ||
      formData.quantityLiters <= 0 ||
      formData.baseRate <= 0 ||
      (formData.rateMode === 'manual' &&
        (!Number.isFinite(manualRate) || manualRate <= 0))
    ) {
      return;
    }

    const quantityLiters = Number(formData.quantityLiters);
    const baseRate = Number(formData.baseRate);
    const clr = Number(formData.clr);
    const fatPercentage = Number(formData.fatPercentage);
    const snfPercentage = calculateSnf(clr, fatPercentage);
    const qualityRate = calculateMilkPricing(
      baseRate,
      fatPercentage,
      snfPercentage
    ).ratePerLiter;
    const ratePerLiter =
      formData.rateMode === 'manual'
        ? Number(manualRate.toFixed(2))
        : qualityRate;

    if (!Number.isFinite(ratePerLiter) || ratePerLiter <= 0) return;

    const payload = {
      date: formData.date,
      buyerId: formData.buyerId || undefined,
      buyerName: formData.buyerName.trim(),
      session: formData.session,
      quantityLiters,
      clr,
      fatPercentage,
      snfPercentage,
      baseRate,
      ratePerLiter,
      totalAmount: Number((quantityLiters * ratePerLiter).toFixed(2)),
      paymentStatus: formData.paymentStatus,
      notes: formData.notes.trim() || undefined,
    };

    if (editingSaleId) {
      updateMilkSale(editingSaleId, payload);
    } else {
      addMilkSale(payload);
    }

    setIsModalOpen(false);
    setEditingSaleId(null);
  };

  const formSnf = calculateSnf(
    Number(formData.clr),
    Number(formData.fatPercentage)
  );
  const formPricing = calculateMilkPricing(
    Number(formData.baseRate),
    Number(formData.fatPercentage),
    formSnf
  );
  const formManualRate = Number(formData.manualRateInput);
  const formRatePerLiter =
    formData.rateMode === 'manual' && Number.isFinite(formManualRate)
      ? Number(formManualRate.toFixed(2))
      : formPricing.ratePerLiter;
  const formTotal = Number(
    (Number(formData.quantityLiters) * formRatePerLiter).toFixed(2)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
            <span>Milk Sales &amp; Buyers</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
              Daily Sales
            </span>
          </h1>
          <p className="text-xs text-neutral-500">
            Record milk sold to a buyer, and track quantity, quality, rate, and payment.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-colors shadow-xs cursor-pointer border border-emerald-800"
        >
          <Plus className="w-4 h-4 text-emerald-100" />
          <span>+ Record Milk Sale</span>
        </button>
      </div>

      {/* Sales summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-medium mb-1">
            <span>Total Milk Sold</span>
            <Milk className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-neutral-900 tabular-nums">
              {totalLiters.toFixed(1)}
            </span>
            <span className="text-xs text-neutral-500">L</span>
          </div>
          <span className="text-[11px] text-neutral-400 mt-1 block">
            {rangeLabel[rangePreset]} · {filteredSales.length} sales
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-medium mb-1">
            <span>Gross Sales</span>
            <IndianRupee className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-neutral-400 text-base">{currencySymbol}</span>
            <span className="text-2xl font-bold text-neutral-900 tabular-nums">
              {grossSales.toFixed(2)}
            </span>
          </div>
          <span className="text-[11px] text-neutral-400 mt-1 block">
            Avg {currencySymbol}{averageRate.toFixed(2)}/L
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-medium mb-1">
            <span>Payment Received</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-neutral-400 text-base">{currencySymbol}</span>
            <span className="text-2xl font-bold text-emerald-800 tabular-nums">
              {paidSales.toFixed(2)}
            </span>
          </div>
          <span className="text-[11px] text-neutral-400 mt-1 block">
            Marked as paid
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-medium mb-1">
            <span>Outstanding</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-neutral-400 text-base">{currencySymbol}</span>
            <span className={`text-2xl font-bold tabular-nums ${pendingSales > 0 ? 'text-amber-700' : 'text-neutral-400'}`}>
              {pendingSales.toFixed(2)}
            </span>
          </div>
          <span className="text-[11px] text-neutral-400 mt-1 block">
            Awaiting buyer payment
          </span>
        </div>
      </div>

      {/* Date and filter bar */}
      <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-0.5 bg-stone-100 border border-stone-200 rounded-lg p-0.5">
              <button
                type="button"
                aria-pressed={rangePreset === 'this-month'}
                onClick={() => setRangePreset('this-month')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
                  rangePreset === 'this-month'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                This month
              </button>
              <button
                type="button"
                aria-pressed={rangePreset === 'last-month'}
                onClick={() => setRangePreset('last-month')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
                  rangePreset === 'last-month'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Last month
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <label className="text-[11px] text-stone-500">Selected base:</label>
              <select
                value={['3-months', '6-months', '1-year', 'max'].includes(rangePreset) ? rangePreset : ''}
                onChange={(e) => {
                  if (e.target.value) setRangePreset(e.target.value as SalesRangePreset);
                }}
                className="text-[11px] font-semibold bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-700 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
              >
                <option value="" disabled>Choose</option>
                <option value="3-months">3 months</option>
                <option value="6-months">6 months</option>
                <option value="1-year">1 year</option>
                <option value="max">Max</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search buyer or notes..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:outline-hidden focus:border-emerald-600 focus:bg-white"
              />
            </div>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as 'all' | MilkSale['paymentStatus'])}
              className="text-xs bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-neutral-700 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
            >
              <option value="all">All payments</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
          <Calendar className="w-4 h-4 text-neutral-400" />
          <span className="text-xs font-semibold text-neutral-700">
            {rangeLabel[rangePreset]}:
          </span>
          <span className="text-xs font-mono font-semibold text-neutral-900 bg-neutral-50 border border-neutral-200 rounded-md px-2 py-1">
            {rangeStart} → {rangeEnd}
          </span>
          <span className="text-[11px] text-neutral-400">
            {filteredSales.length} {filteredSales.length === 1 ? 'sale' : 'sales'}
          </span>
        </div>
      </div>

      {/* Sales table */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Buyer</th>
                <th className="py-3 px-4">Session</th>
                <th className="py-3 px-4 text-right">Quantity (L)</th>
                <th className="py-3 px-4 text-right">CLR</th>
                <th className="py-3 px-4 text-right">Fat %</th>
                <th className="py-3 px-4 text-right">SNF %</th>
                <th className="py-3 px-4 text-right">Rate / L</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-neutral-700">
              {filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-neutral-50/70 transition-colors">
                  <td className="py-3 px-4 font-mono text-neutral-600 whitespace-nowrap">
                    {sale.date}
                  </td>

                  <td className="py-3 px-4">
                    <p className="font-bold text-neutral-900">{saleBuyerName(sale) || '—'}</p>
                    {sale.notes && (
                      <p className="text-[11px] text-neutral-400 truncate max-w-[240px]">{sale.notes}</p>
                    )}
                  </td>

                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5 font-medium text-neutral-700">
                      <Truck className="w-3.5 h-3.5 text-emerald-700" />
                      <span>{sale.session}</span>
                    </span>
                  </td>

                  <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900 tabular-nums">
                    {Number(sale.quantityLiters).toFixed(1)}
                  </td>

                  <td className="py-3 px-4 text-right font-mono tabular-nums text-neutral-600">
                    {sale.clr != null ? Number(sale.clr).toFixed(1) : '—'}
                  </td>

                  <td className="py-3 px-4 text-right font-mono tabular-nums text-neutral-600">
                    {sale.fatPercentage != null ? `${Number(sale.fatPercentage).toFixed(2)}%` : '—'}
                  </td>

                  <td className="py-3 px-4 text-right font-mono tabular-nums text-neutral-600">
                    {sale.snfPercentage != null ? `${Number(sale.snfPercentage).toFixed(2)}%` : '—'}
                  </td>

                  <td className="py-3 px-4 text-right font-mono tabular-nums text-neutral-600">
                    <p className="font-semibold text-neutral-900">
                      {currencySymbol}{Number(sale.ratePerLiter).toFixed(2)}
                    </p>
                    {sale.baseRate != null && (
                      <p className="text-[10px] text-neutral-400">
                        Base {currencySymbol}{Number(sale.baseRate).toFixed(2)}
                      </p>
                    )}
                  </td>

                  <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900 tabular-nums">
                    {currencySymbol}{Number(sale.totalAmount).toFixed(2)}
                  </td>

                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[11px] border ${
                        sale.paymentStatus === 'Paid'
                          ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                          : 'text-amber-800 bg-amber-50 border-amber-200'
                      }`}
                    >
                      {sale.paymentStatus === 'Paid' ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <Clock className="w-3 h-3" />
                      )}
                      {sale.paymentStatus}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenEdit(sale)}
                        className="p-1.5 text-neutral-400 hover:text-emerald-700 rounded transition-colors cursor-pointer"
                        title="Edit sale"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('Delete this milk sale entry?')) {
                            deleteMilkSale(sale.id);
                          }
                        }}
                        className="p-1.5 text-neutral-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                        title="Delete sale"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredSales.length === 0 && (
          <div className="py-12 text-center text-neutral-500">
            <Milk className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
            <p className="text-sm font-semibold">No milk sales match this filter</p>
            <p className="text-xs text-neutral-400 mt-1">
              Click &quot;+ Record Milk Sale&quot; to log a sale to a buyer.
            </p>
          </div>
        )}
      </div>

      {/* Add / edit sale modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-emerald-950/25 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-neutral-200">
            <form onSubmit={handleSave}>
              <div className="p-5 border-b border-neutral-200 flex items-center justify-between sticky top-0 bg-white z-10">
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    {editingSaleId ? 'Edit Milk Sale' : 'Record Milk Sale'}
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Daily milk sale to an existing customer.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">Sale Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-800 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">Session</label>
                    <select
                      value={formData.session}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          session: e.target.value as MilkSaleSession,
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 bg-white"
                    >
                      <option value="Morning">Morning AM</option>
                      <option value="Evening">Evening PM</option>
                      <option value="Combined">Combined Daily</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-neutral-700 font-semibold mb-1">Buyer *</label>
                  <select
                    required
                    value={formData.buyerId}
                    onChange={(e) => handleBuyerChange(e.target.value)}
                    disabled={customers.length === 0}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 bg-white focus:outline-hidden focus:border-emerald-600 disabled:bg-neutral-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Select buyer...</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} — {customer.customerType} · {customer.route}
                      </option>
                    ))}
                  </select>
                  {formData.buyerName &&
                    !customers.some(
                      (customer) => customer.id === formData.buyerId
                    ) && (
                      <p className="mt-1 text-[10px] text-amber-700">
                        Current buyer “{formData.buyerName}” is not linked to a
                        customer. Select a buyer above to link it.
                      </p>
                    )}
                  {customers.length === 0 && (
                    <p className="mt-1 text-[10px] text-amber-700">
                      No customers available. Add one in Revenue &amp; Customers
                      first.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">Quantity (L) *</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      required
                      value={formData.quantityLiters}
                      onChange={(e) =>
                        setFormData({ ...formData, quantityLiters: Number(e.target.value) })
                      }
                      className="w-full px-2 py-2 rounded-lg border border-neutral-300 font-mono focus:outline-hidden focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">CLR</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="40"
                      value={formData.clr}
                      onChange={(e) =>
                        setFormData({ ...formData, clr: Number(e.target.value) })
                      }
                      className="w-full px-2 py-2 rounded-lg border border-neutral-300 font-mono focus:outline-hidden focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">Fat %</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="10"
                      value={formData.fatPercentage}
                      onChange={(e) =>
                        setFormData({ ...formData, fatPercentage: Number(e.target.value) })
                      }
                      className="w-full px-2 py-2 rounded-lg border border-neutral-300 font-mono focus:outline-hidden focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">SNF % (auto)</label>
                    <input
                      type="text"
                      readOnly
                      value={formSnf.toFixed(2)}
                      className="w-full px-2 py-2 rounded-lg border border-neutral-200 bg-neutral-50 font-mono font-bold text-emerald-900 cursor-default"
                    />
                  </div>
                </div>

                <p className="text-[10px] text-neutral-400">
                  SNF is calculated automatically from CLR and butterfat.
                </p>

                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-neutral-700">
                        Rate calculation
                      </p>
                      <p className="text-[10px] text-neutral-400">
                        Use the quality formula or enter a manual rate per litre.
                      </p>
                    </div>
                    <div className="inline-flex rounded-lg border border-neutral-300 bg-white p-0.5">
                      <button
                        type="button"
                        onClick={() => handleRateModeChange('quality')}
                        className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                          formData.rateMode === 'quality'
                            ? 'bg-emerald-700 text-white'
                            : 'text-neutral-600 hover:bg-neutral-100'
                        }`}
                      >
                        Quality-based
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRateModeChange('manual')}
                        className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                          formData.rateMode === 'manual'
                            ? 'bg-emerald-700 text-white'
                            : 'text-neutral-600 hover:bg-neutral-100'
                        }`}
                      >
                        Manual rate
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">
                      Base Rate ({currencySymbol} / L) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={formData.baseRate}
                      onChange={(e) =>
                        setFormData({ ...formData, baseRate: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 font-mono focus:outline-hidden focus:border-emerald-600"
                    />
                    <p className="mt-1 text-[10px] text-neutral-400">
                      {formData.rateMode === 'manual'
                        ? 'Quality reference only; the manual rate is applied.'
                        : "Buyer's chart @ rate. Defaults to 43; adjust per buyer."}
                    </p>
                  </div>

                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">
                      Rate / L ({currencySymbol}) *
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      readOnly={formData.rateMode !== 'manual'}
                      value={
                        formData.rateMode === 'manual'
                          ? formData.manualRateInput
                          : formPricing.ratePerLiter.toFixed(2)
                      }
                      onChange={(e) => {
                        if (formData.rateMode !== 'manual') return;
                        setFormData({
                          ...formData,
                          manualRateInput: e.target.value,
                        });
                      }}
                      className={`w-full px-3 py-2 rounded-lg border font-mono focus:outline-hidden ${
                        formData.rateMode === 'manual'
                          ? 'border-amber-300 bg-amber-50 font-bold text-amber-950 focus:border-amber-500'
                          : 'border-neutral-200 bg-neutral-50 font-bold text-emerald-900 cursor-default'
                      }`}
                    />
                    <p className="mt-1 text-[10px] text-neutral-400">
                      {formData.rateMode === 'manual'
                        ? 'Manual override applied.'
                        : 'Auto from base rate and quality.'}
                    </p>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-neutral-700 font-semibold mb-1">
                      Total Amount
                    </label>
                    <div className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 font-mono font-bold text-neutral-900">
                      {currencySymbol}{formTotal.toFixed(2)}
                    </div>
                  </div>
                </div>

                {formData.rateMode === 'manual' &&
                  (!Number.isFinite(formManualRate) || formManualRate <= 0) && (
                  <p className="text-[10px] font-semibold text-red-600">
                    Enter a manual rate per litre greater than zero.
                  </p>
                )}

                {formData.rateMode === 'manual' ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-amber-950">
                        Quality-based rate (reference)
                      </span>
                      <span className="font-mono font-semibold text-amber-950">
                        {currencySymbol}{formPricing.ratePerLiter.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-amber-200 pt-1.5 text-xs">
                      <span className="font-bold text-amber-950">
                        Manual rate applied
                      </span>
                      <span className="font-mono font-bold text-amber-950">
                        {currencySymbol}{formRatePerLiter.toFixed(2)}
                      </span>
                    </div>
                    <p className="border-t border-amber-200 pt-1.5 text-[10px] font-mono text-amber-900">
                      {Number(formData.quantityLiters).toFixed(1)} L ×{' '}
                      {formRatePerLiter.toFixed(2)} ={' '}
                      {formTotal.toFixed(2)}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-emerald-950">Fat rate per 1%</span>
                      <span className="font-mono font-semibold text-emerald-950">
                        {currencySymbol}{formPricing.fatRate.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-emerald-950">SNF rate per 1%</span>
                      <span className="font-mono font-semibold text-emerald-950">
                        {currencySymbol}{formPricing.snfRate.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-emerald-200 pt-1.5 text-xs">
                      <span className="font-bold text-emerald-950">Rate per litre</span>
                      <span className="font-mono font-bold text-emerald-950">
                        {currencySymbol}{formPricing.ratePerLiter.toFixed(2)}
                      </span>
                    </div>
                    <p className="border-t border-emerald-200 pt-1.5 text-[10px] font-mono text-emerald-900">
                      {Number(formData.fatPercentage).toFixed(2)} ×{' '}
                      {formPricing.fatRate.toFixed(4)} +{' '}
                      {formSnf.toFixed(2)} × {formPricing.snfRate.toFixed(4)} ={' '}
                      {formPricing.ratePerLiter.toFixed(2)}
                    </p>
                  </div>
                )}

                <p className="text-[10px] text-neutral-400">
                  {formData.rateMode === 'manual'
                    ? 'Manual rate overrides the quality calculation. Total = litres × manual rate.'
                    : 'Rate/L = Base × (1.5 × Fat + SNF) ÷ 15.25. Total = litres × Rate/L.'}
                </p>

                <div>
                  <label className="block text-neutral-700 font-semibold mb-1">Payment Status</label>
                  <select
                    value={formData.paymentStatus}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        paymentStatus: e.target.value as MilkSale['paymentStatus'],
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 bg-white"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-700 font-semibold mb-1">Notes (Optional)</label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="e.g. Morning dispatch, tanker #, quality bonus"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:outline-hidden focus:border-emerald-600"
                  />
                </div>

                <p className="text-[10px] text-neutral-400">
                  Recording a sale reduces the first bulk tank by the quantity sold.
                </p>
              </div>

              <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 cursor-pointer shadow-xs"
                >
                  {editingSaleId ? 'Save Changes' : 'Record Sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
