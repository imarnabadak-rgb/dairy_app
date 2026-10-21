'use client';

import React, { useState } from 'react';
import { useDairy } from '../context/DairyContext';
import { FarmExpense, ExpenseCategory } from '../types/dairy';
import { 
  Receipt, 
  Plus, 
  Trash2, 
  Search, 
  Filter, 
  DollarSign, 
  Wheat, 
  Syringe, 
  Users, 
  Zap, 
  Fuel, 
  Package, 
  X,
  CreditCard,
  Calendar
} from 'lucide-react';

export const ExpensesView: React.FC = () => {
  const { 
    expenses, 
    addExpense, 
    deleteExpense, 
    selectedDate, 
    setSelectedDate, 
    currencySymbol 
  } = useDairy();

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState<{
    title: string;
    category: ExpenseCategory;
    amount: number;
    date: string;
    vendor: string;
    paymentMethod: FarmExpense['paymentMethod'];
    receiptNumber: string;
    notes: string;
  }>({
    title: '',
    category: 'Feed & Fodder',
    amount: 150.00,
    date: selectedDate,
    vendor: '',
    paymentMethod: 'Bank Transfer',
    receiptNumber: '',
    notes: ''
  });

  // Category icons & styling helper
  const getCategoryIcon = (cat: ExpenseCategory) => {
    switch (cat) {
      case 'Feed & Fodder':
        return <Wheat className="w-3.5 h-3.5 text-emerald-700" />;
      case 'Veterinary & Vaccines':
        return <Syringe className="w-3.5 h-3.5 text-emerald-700" />;
      case 'Labor & Milking Staff':
        return <Users className="w-3.5 h-3.5 text-emerald-700" />;
      case 'Electricity & Cold Storage':
        return <Zap className="w-3.5 h-3.5 text-emerald-700" />;
      case 'Fuel & Equipment':
        return <Fuel className="w-3.5 h-3.5 text-emerald-700" />;
      default:
        return <Package className="w-3.5 h-3.5 text-emerald-700" />;
    }
  };

  // Metrics
  const totalAllTimeExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
  const todayExpenses = expenses
    .filter((e) => e.date === selectedDate)
    .reduce((acc, e) => acc + e.amount, 0);

  // Category totals
  const categoriesList: ExpenseCategory[] = [
    'Feed & Fodder',
    'Veterinary & Vaccines',
    'Labor & Milking Staff',
    'Fuel & Equipment',
    'Electricity & Cold Storage',
    'Farm Misc & Supplies'
  ];

  const categoryTotals = categoriesList.map((cat) => {
    const sum = expenses.filter((e) => e.category === cat).reduce((acc, e) => acc + e.amount, 0);
    const pct = totalAllTimeExpenses > 0 ? Math.round((sum / totalAllTimeExpenses) * 100) : 0;
    return { category: cat, total: sum, percentage: pct };
  }).sort((a, b) => b.total - a.total);

  // Filtered list
  const filteredExpenses = expenses.filter((e) => {
    const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
    const matchesSearch =
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.vendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.receiptNumber && e.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleOpenAdd = () => {
    setFormData({
      title: '',
      category: 'Feed & Fodder',
      amount: 120.00,
      date: selectedDate,
      vendor: '',
      paymentMethod: 'Bank Transfer',
      receiptNumber: `REC-${Date.now().toString().slice(-4)}`,
      notes: ''
    });
    setIsAddModalOpen(true);
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || formData.amount <= 0) return;

    addExpense({
      title: formData.title.trim(),
      category: formData.category,
      amount: Number(formData.amount),
      date: formData.date,
      vendor: formData.vendor.trim() || 'General Farm Supplier',
      paymentMethod: formData.paymentMethod,
      receiptNumber: formData.receiptNumber.trim() || undefined,
      notes: formData.notes.trim() || undefined
    });

    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
            <span>Farm Operational Expenses</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
              P&L Tracking
            </span>
          </h1>
          <p className="text-xs text-neutral-500">
            Feed, veterinary care, vaccination batches, payroll wages, cold-storage power & farm consumables
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-colors shadow-xs cursor-pointer font-bold border border-emerald-800"
        >
          <Plus className="w-4 h-4 text-emerald-100" />
          <span>+ Log Farm Expense</span>
        </button>
      </div>

      {/* Aggregate Expense Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-medium mb-1">
            <span>Total Logged Expenses</span>
            <DollarSign className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-neutral-400 text-base">{currencySymbol}</span>
            <span className="text-2xl font-bold text-neutral-900 tabular-nums">
              {totalAllTimeExpenses.toFixed(2)}
            </span>
          </div>
          <span className="text-[11px] text-neutral-400 mt-1 block">
            Across {expenses.length} expense vouchers
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-medium mb-1">
            <span>Expenses on {selectedDate}</span>
            <Calendar className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-neutral-400 text-base">{currencySymbol}</span>
            <span className="text-2xl font-bold text-neutral-900 tabular-nums">
              {todayExpenses.toFixed(2)}
            </span>
          </div>
          <span className="text-[11px] text-neutral-400 mt-1 block">
            Today's outlays
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-medium mb-1">
            <span>Top Cost Center</span>
            <Wheat className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-base font-bold text-neutral-900 truncate">
              {categoryTotals[0]?.category || 'Feed & Fodder'}
            </span>
          </div>
          <span className="text-[11px] text-emerald-800 font-medium mt-1 block">
            {currencySymbol}{categoryTotals[0]?.total.toFixed(2)} ({categoryTotals[0]?.percentage}% of total outlays)
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-medium mb-1">
            <span>Veterinary & Vaccine Care</span>
            <Syringe className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-neutral-400 text-base">{currencySymbol}</span>
            <span className="text-2xl font-bold text-neutral-900 tabular-nums">
              {(categoryTotals.find((c) => c.category === 'Veterinary & Vaccines')?.total || 0).toFixed(2)}
            </span>
          </div>
          <span className="text-[11px] text-neutral-400 mt-1 block">
            Bio-security & herd immunity investments
          </span>
        </div>
      </div>

      {/* Category Breakdown Progress Grid */}
      <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs">
        <h2 className="text-xs font-bold text-neutral-800 uppercase tracking-wider mb-4">
          Cost Allocation by Operational Center
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categoryTotals.map((cat) => (
            <div key={cat.category} className="p-3 bg-neutral-50 rounded-lg border border-neutral-200/80">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
                  {getCategoryIcon(cat.category)}
                  <span>{cat.category}</span>
                </span>
                <span className="text-xs font-bold font-mono text-neutral-900 tabular-nums">
                  {currencySymbol}{cat.total.toFixed(2)}
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-600 h-1.5 rounded-full transition-all"
                  style={{ width: `${cat.percentage}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-neutral-400 mt-1">
                <span>{cat.percentage}% of farm budget</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search expense description, vendor, or receipt #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:outline-hidden focus:border-emerald-600 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-neutral-500">Category:</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 text-neutral-700 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
            >
              <option value="all">All Categories</option>
              {categoriesList.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Expense Vouchers Table */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Expense Item & Purpose</th>
                <th className="py-3 px-4">Cost Center</th>
                <th className="py-3 px-4">Vendor / Payee</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4">Voucher / Receipt</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-neutral-700">
              {filteredExpenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-neutral-50/70 transition-colors">
                  <td className="py-3 px-4 font-mono text-neutral-600 tabular-nums">
                    {exp.date}
                  </td>

                  <td className="py-3 px-4">
                    <p className="font-bold text-neutral-900 text-xs">{exp.title}</p>
                    {exp.notes && (
                      <p className="text-[11px] text-neutral-400 truncate max-w-xs">{exp.notes}</p>
                    )}
                  </td>

                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5 font-medium text-neutral-800">
                      {getCategoryIcon(exp.category)}
                      <span>{exp.category}</span>
                    </span>
                  </td>

                  <td className="py-3 px-4 text-neutral-800 font-medium">
                    {exp.vendor}
                  </td>

                  <td className="py-3 px-4 text-neutral-600">
                    <span className="inline-flex items-center gap-1 text-[11px] bg-neutral-100 px-2 py-0.5 rounded">
                      <CreditCard className="w-3 h-3 text-neutral-500" />
                      <span>{exp.paymentMethod}</span>
                    </span>
                  </td>

                  <td className="py-3 px-4 font-mono text-neutral-500 text-[11px]">
                    {exp.receiptNumber || '—'}
                  </td>

                  <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900 tabular-nums text-xs">
                    {currencySymbol}{exp.amount.toFixed(2)}
                  </td>

                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete expense "${exp.title}"?`)) {
                          deleteExpense(exp.id);
                        }
                      }}
                      className="p-1.5 text-neutral-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                      title="Delete expense"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredExpenses.length === 0 && (
          <div className="py-12 text-center text-neutral-500">
            <p className="text-sm font-semibold">No expense records match this filter</p>
            <p className="text-xs text-neutral-400 mt-1">Click "+ Log Farm Expense" to record feed, veterinary, or farm costs.</p>
          </div>
        )}
      </div>

      {/* Log Expense Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-emerald-950/25 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-neutral-200">
            <form onSubmit={handleSaveExpense}>
              <div className="p-5 border-b border-neutral-200 flex items-center justify-between sticky top-0 bg-white z-10">
                <h3 className="text-base font-bold text-neutral-900">Record Farm Expense Voucher</h3>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block text-neutral-700 font-semibold mb-1">Expense Description / Item *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Alfalfa hay bales delivery, FMD vaccine vials, Tractor diesel"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:outline-hidden focus:border-emerald-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">Expense Category *</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as ExpenseCategory })}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 bg-white"
                    >
                      {categoriesList.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">Amount ({currencySymbol}) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 font-mono text-sm font-bold focus:outline-hidden focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">Expense Date</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">Vendor / Payee</label>
                    <input
                      type="text"
                      value={formData.vendor}
                      onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                      placeholder="e.g. NutriFeed Mills, Local Vet Clinic"
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">Payment Method</label>
                    <select
                      value={formData.paymentMethod}
                      onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as FarmExpense['paymentMethod'] })}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 bg-white"
                    >
                      <option value="Bank Transfer">Bank Transfer / Wire</option>
                      <option value="Card / UPI">Card / UPI / Online</option>
                      <option value="Cash">Cash on Delivery</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-neutral-700 font-semibold mb-1">Receipt / Voucher #</label>
                    <input
                      type="text"
                      value={formData.receiptNumber}
                      onChange={(e) => setFormData({ ...formData, receiptNumber: e.target.value })}
                      placeholder="e.g. INV-9921"
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-neutral-700 font-semibold mb-1">Notes / Specifications</label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Batch details, purpose, delivery bunker location..."
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer shadow-xs transition-colors"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
