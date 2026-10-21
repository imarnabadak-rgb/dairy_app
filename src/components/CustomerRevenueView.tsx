'use client';

import React, { useState } from 'react';
import { useDairy } from '../context/DairyContext';
import { Customer, CustomerType, Invoice } from '../types/dairy';
import { 
  Users, 
  DollarSign, 
  FileText, 
  Plus, 
  CheckCircle2, 
  Clock, 
  X, 
  Printer, 
  Phone, 
  MapPin,
  Search,
  CreditCard
} from 'lucide-react';

export const CustomerRevenueView: React.FC = () => {
  const {
    customers,
    invoices,
    currencySymbol,
    addCustomer,
    updateCustomer,
    recordInvoicePayment,
    generateCustomerInvoice
  } = useDairy();

  const [activeSubTab, setActiveSubTab] = useState<'customers' | 'invoices'>('customers');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [selectedInvoiceToPrint, setSelectedInvoiceToPrint] = useState<Invoice | null>(null);
  const [isGenerateInvoiceOpen, setIsGenerateInvoiceOpen] = useState(false);
  const [selectedCustForInvoice, setSelectedCustForInvoice] = useState(customers[0]?.id || '');
  const [invoiceMonth, setInvoiceMonth] = useState('October 2026');

  // New Customer Form State
  const [custForm, setCustForm] = useState<{
    name: string;
    phone: string;
    email: string;
    customerType: CustomerType;
    address: string;
    route: string;
    dailyQuotaLiters: number;
    milkType: Customer['milkType'];
    unitPrice: number;
    preferredSession: Customer['preferredSession'];
    status: Customer['status'];
  }>({
    name: '',
    phone: '',
    email: '',
    customerType: 'Household',
    address: '',
    route: 'North Ridge Residential',
    dailyQuotaLiters: 2.0,
    milkType: 'Whole Cow Milk',
    unitPrice: 2.20,
    preferredSession: 'Morning',
    status: 'Active'
  });

  // Calculate totals
  const totalReceivables = customers.reduce((acc, c) => acc + c.balanceDue, 0);
  const totalBilledThisPeriod = invoices.reduce((acc, inv) => acc + inv.totalAmount, 0);
  const totalCollectedInvoices = invoices.reduce((acc, inv) => acc + inv.paidAmount, 0);

  // Filtered lists
  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.route.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredInvoices = invoices.filter(
    (inv) =>
      inv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.billingMonth.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custForm.name.trim() || !custForm.phone.trim()) return;

    addCustomer({
      name: custForm.name.trim(),
      phone: custForm.phone.trim(),
      email: custForm.email.trim() || undefined,
      customerType: custForm.customerType,
      address: custForm.address.trim(),
      route: custForm.route,
      dailyQuotaLiters: Number(custForm.dailyQuotaLiters),
      milkType: custForm.milkType,
      unitPrice: Number(custForm.unitPrice),
      preferredSession: custForm.preferredSession,
      status: custForm.status
    });

    setIsAddCustomerOpen(false);
    setCustForm({
      name: '',
      phone: '',
      email: '',
      customerType: 'Household',
      address: '',
      route: 'North Ridge Residential',
      dailyQuotaLiters: 2.0,
      milkType: 'Whole Cow Milk',
      unitPrice: 2.20,
      preferredSession: 'Morning',
      status: 'Active'
    });
  };

  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForPayment || paymentAmount <= 0) return;

    recordInvoicePayment(selectedInvoiceForPayment.id, paymentAmount);
    setSelectedInvoiceForPayment(null);
    setPaymentAmount(0);
  };

  const handleGenerateInvoiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    generateCustomerInvoice(selectedCustForInvoice, invoiceMonth);
    setIsGenerateInvoiceOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900">
            Customer Directory & Financial Revenue
          </h1>
          <p className="text-xs text-stone-500">
            Subscriber management, route quotas, monthly invoicing, payment ledger & receivables
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsGenerateInvoiceOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-colors cursor-pointer shadow-xs"
          >
            <FileText className="w-4 h-4 text-emerald-200" />
            <span>Generate Monthly Invoice</span>
          </button>
          <button
            onClick={() => setIsAddCustomerOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-colors shadow-xs cursor-pointer border border-emerald-800"
          >
            <Plus className="w-4 h-4 text-emerald-100" />
            <span>+ Add New Customer</span>
          </button>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs font-medium mb-1">
            <span>Active Customers / Accounts</span>
            <Users className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-stone-900 tabular-nums">
              {customers.length}
            </span>
            <span className="text-xs text-stone-500">subscribers</span>
          </div>
          <span className="text-[11px] text-stone-400 mt-1 block">
            Daily quota commitment: {customers.reduce((a, b) => a + b.dailyQuotaLiters, 0)} Liters/day
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs font-medium mb-1">
            <span>Total Invoiced (This Season)</span>
            <DollarSign className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-stone-400 text-base">{currencySymbol}</span>
            <span className="text-2xl font-bold text-stone-900 tabular-nums">
              {totalBilledThisPeriod.toFixed(2)}
            </span>
          </div>
          <span className="text-[11px] text-emerald-700 font-medium mt-1 block">
            {currencySymbol}{totalCollectedInvoices.toFixed(2)} settled across {invoices.length} invoices
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs font-medium mb-1">
            <span>Outstanding Receivables</span>
            <Clock className="w-4 h-4 text-amber-700" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-stone-400 text-base">{currencySymbol}</span>
            <span className="text-2xl font-bold text-amber-800 tabular-nums">
              {totalReceivables.toFixed(2)}
            </span>
          </div>
          <span className="text-[11px] text-stone-400 mt-1 block">
            Pending customer ledger balances
          </span>
        </div>
      </div>

      {/* Sub-tab Navigation (Customers vs Invoices) */}
      <div className="flex items-center justify-between border-b border-stone-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('customers')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              activeSubTab === 'customers'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 bg-stone-100'
            }`}
          >
            Customer Accounts ({customers.length})
          </button>
          <button
            onClick={() => setActiveSubTab('invoices')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              activeSubTab === 'invoices'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 bg-stone-100'
            }`}
          >
            Billing Invoices & Ledger ({invoices.length})
          </button>
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search name, route, invoice #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-stone-200 bg-stone-50/50 focus:outline-hidden focus:border-emerald-600 focus:bg-white"
          />
        </div>
      </div>

      {/* View 1: Customers Table */}
      {activeSubTab === 'customers' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Type / Classification</th>
                  <th className="py-3 px-4">Route & Address</th>
                  <th className="py-3 px-4">Phone / Contact</th>
                  <th className="py-3 px-4 text-right">Daily Quota</th>
                  <th className="py-3 px-4 text-right">Rate / Liter</th>
                  <th className="py-3 px-4 text-right">Ledger Balance</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                {filteredCustomers.map((cust) => {
                  const hasDue = cust.balanceDue > 0;

                  return (
                    <tr key={cust.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-bold text-stone-900 text-xs">{cust.name}</p>
                        <span className="text-[11px] text-stone-400">{cust.milkType}</span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-medium text-stone-800">{cust.customerType}</span>
                      </td>

                      <td className="py-3 px-4">
                        <p className="text-stone-800 font-medium">{cust.route}</p>
                        <p className="text-[11px] text-stone-400 truncate max-w-[200px]" title={cust.address}>
                          {cust.address}
                        </p>
                      </td>

                      <td className="py-3 px-4 text-stone-600 font-mono">
                        {cust.phone}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-stone-900 tabular-nums">
                        {cust.dailyQuotaLiters.toFixed(1)} L
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-stone-700 tabular-nums">
                        {currencySymbol}{cust.unitPrice.toFixed(2)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <span className={`font-bold ${hasDue ? 'text-amber-800' : 'text-emerald-700'}`}>
                          {currencySymbol}{cust.balanceDue.toFixed(2)}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedCustForInvoice(cust.id);
                            setIsGenerateInvoiceOpen(true);
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 cursor-pointer"
                        >
                          Invoice &rarr;
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredCustomers.length === 0 && (
            <div className="py-12 text-center text-stone-500">
              <p className="text-sm font-semibold">No customers found</p>
            </div>
          )}
        </div>
      )}

      {/* View 2: Invoices & Ledger Table */}
      {activeSubTab === 'invoices' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Billing Month</th>
                  <th className="py-3 px-4 text-right">Total Liters</th>
                  <th className="py-3 px-4 text-right">Rate / L</th>
                  <th className="py-3 px-4 text-right">Total Billed</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                {filteredInvoices.map((inv) => {
                  const isPaid = inv.status === 'Paid';
                  const balanceRemaining = inv.totalAmount - inv.paidAmount;

                  return (
                    <tr key={inv.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-stone-900">
                        {inv.id}
                      </td>

                      <td className="py-3 px-4 font-bold text-stone-900">
                        {inv.customerName}
                      </td>

                      <td className="py-3 px-4 text-stone-600">
                        {inv.billingMonth}
                      </td>

                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {inv.totalLiters} L
                      </td>

                      <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-600">
                        {currencySymbol}{inv.ratePerLiter.toFixed(2)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-stone-900 tabular-nums">
                        {currencySymbol}{inv.totalAmount.toFixed(2)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-800 font-semibold">
                        {currencySymbol}{inv.paidAmount.toFixed(2)}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-900'
                              : inv.status === 'Partially Paid'
                              ? 'bg-sky-100 text-sky-900'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {isPaid ? <CheckCircle2 className="w-3 h-3 text-emerald-700" /> : <Clock className="w-3 h-3" />}
                          <span>{inv.status}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isPaid && (
                            <button
                              onClick={() => {
                                setSelectedInvoiceForPayment(inv);
                                setPaymentAmount(balanceRemaining);
                              }}
                              className="px-2 py-1 text-[11px] font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded transition-colors cursor-pointer shadow-xs"
                            >
                              Collect
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedInvoiceToPrint(inv)}
                            className="p-1 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded transition-colors cursor-pointer"
                            title="Preview / Print Voucher"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredInvoices.length === 0 && (
            <div className="py-12 text-center text-stone-500">
              <p className="text-sm font-semibold">No invoices match your search</p>
            </div>
          )}
        </div>
      )}

      {/* Record Payment Modal */}
      {selectedInvoiceForPayment && (
        <div className="fixed inset-0 z-50 bg-emerald-950/25 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-xl border border-stone-200">
            <form onSubmit={handleRecordPaymentSubmit}>
              <div className="p-5 border-b border-stone-200 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-stone-900">Record Payment</h3>
                  <p className="text-xs text-stone-500">Invoice {selectedInvoiceForPayment.id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedInvoiceForPayment(null)}
                  className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                <div className="bg-stone-50 p-3 rounded-lg border border-stone-200">
                  <div className="flex justify-between mb-1">
                    <span className="text-stone-500">Customer:</span>
                    <strong className="text-stone-900">{selectedInvoiceForPayment.customerName}</strong>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-stone-500">Total Billed:</span>
                    <span className="font-mono">{currencySymbol}{selectedInvoiceForPayment.totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Remaining Balance:</span>
                    <strong className="font-mono text-amber-800">
                      {currencySymbol}{(selectedInvoiceForPayment.totalAmount - selectedInvoiceForPayment.paidAmount).toFixed(2)}
                    </strong>
                  </div>
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Payment Amount ({currencySymbol}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedInvoiceForPayment.totalAmount - selectedInvoiceForPayment.paidAmount}
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 font-mono text-sm font-bold focus:outline-hidden focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedInvoiceForPayment(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 cursor-pointer shadow-xs transition-colors"
                >
                  Confirm Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Printable Voucher Preview Modal */}
      {selectedInvoiceToPrint && (
        <div className="fixed inset-0 z-50 bg-emerald-950/25 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-stone-300 overflow-hidden">
            <div className="p-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
              <span className="text-xs font-bold text-stone-700">Official Milk Invoice Receipt</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-700 text-white text-xs font-bold rounded hover:bg-emerald-800 cursor-pointer shadow-xs transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Receipt</span>
                </button>
                <button
                  onClick={() => setSelectedInvoiceToPrint(null)}
                  className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Voucher Paper */}
            <div className="p-8 space-y-6 text-xs text-stone-800 bg-white font-sans">
              <div className="flex justify-between items-start border-b border-stone-200 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-emerald-950">VERDANT MEADOW DAIRY FARM</h2>
                  <p className="text-[11px] text-stone-500">Silo Complex · Pure Farm Milk & Creamery</p>
                  <p className="text-[11px] text-stone-500">Lic: DL-99201-AGRI · Phone: +1 (555) 019-4488</p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-sm text-stone-900 block">{selectedInvoiceToPrint.id}</span>
                  <span className="text-[11px] text-stone-500">Date: {selectedInvoiceToPrint.issueDate}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[11px] text-stone-400 uppercase font-semibold block mb-0.5">Billed To:</span>
                  <p className="font-bold text-stone-900">{selectedInvoiceToPrint.customerName}</p>
                  <p className="text-stone-600 text-[11px]">Monthly Dairy Account Subscription</p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-stone-400 uppercase font-semibold block mb-0.5">Billing Period:</span>
                  <p className="font-bold text-stone-900">{selectedInvoiceToPrint.billingMonth}</p>
                  <p className="text-[11px] text-stone-500">Due: {selectedInvoiceToPrint.dueDate}</p>
                </div>
              </div>

              {/* Itemized Table */}
              <table className="w-full text-left border-t border-b border-stone-200 my-4">
                <thead>
                  <tr className="text-stone-500 font-semibold border-b border-stone-200">
                    <th className="py-2">Description</th>
                    <th className="py-2 text-right">Volume</th>
                    <th className="py-2 text-right">Unit Rate</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  <tr>
                    <td className="py-2 font-medium">Farm Fresh Chilled Milk Supply</td>
                    <td className="py-2 text-right font-mono">{selectedInvoiceToPrint.totalLiters} L</td>
                    <td className="py-2 text-right font-mono">{currencySymbol}{selectedInvoiceToPrint.ratePerLiter.toFixed(2)}</td>
                    <td className="py-2 text-right font-mono font-bold">{currencySymbol}{selectedInvoiceToPrint.totalAmount.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-48 space-y-1.5 text-right">
                  <div className="flex justify-between text-stone-600">
                    <span>Subtotal:</span>
                    <span className="font-mono">{currencySymbol}{selectedInvoiceToPrint.totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-800 font-semibold">
                    <span>Paid to date:</span>
                    <span className="font-mono">- {currencySymbol}{selectedInvoiceToPrint.paidAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-stone-300 pt-1 font-bold text-sm text-stone-900">
                    <span>Balance Due:</span>
                    <span className="font-mono">
                      {currencySymbol}{(selectedInvoiceToPrint.totalAmount - selectedInvoiceToPrint.paidAmount).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-stone-200 pt-4 text-center text-[10px] text-stone-400">
                Thank you for choosing pure, ethically-farmed dairy milk! Please make checks or transfers payable to Verdant Meadow Farms.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate Monthly Invoice Modal */}
      {isGenerateInvoiceOpen && (
        <div className="fixed inset-0 z-50 bg-emerald-950/25 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-stone-200">
            <form onSubmit={handleGenerateInvoiceSubmit}>
              <div className="p-5 border-b border-stone-200 flex items-center justify-between">
                <h3 className="text-base font-bold text-stone-900">Generate Customer Invoice</h3>
                <button
                  type="button"
                  onClick={() => setIsGenerateInvoiceOpen(false)}
                  className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Customer Account *</label>
                  <select
                    value={selectedCustForInvoice}
                    onChange={(e) => setSelectedCustForInvoice(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.dailyQuotaLiters}L/day @ {currencySymbol}{c.unitPrice}/L)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Billing Month Cycle</label>
                  <input
                    type="text"
                    value={invoiceMonth}
                    onChange={(e) => setInvoiceMonth(e.target.value)}
                    placeholder="e.g. October 2026"
                    className="w-full px-3 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsGenerateInvoiceOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 cursor-pointer"
                >
                  Generate & Add to Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Customer Modal */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-50 bg-emerald-950/25 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl border border-stone-200">
            <form onSubmit={handleSaveCustomer}>
              <div className="p-5 border-b border-stone-200 flex items-center justify-between sticky top-0 bg-white z-10">
                <h3 className="text-base font-bold text-stone-900">Register New Customer / Route Subscriber</h3>
                <button
                  type="button"
                  onClick={() => setIsAddCustomerOpen(false)}
                  className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">Customer / Business Name *</label>
                    <input
                      type="text"
                      required
                      value={custForm.name}
                      onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
                      placeholder="e.g. Oak Tree Cafe"
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">Phone Number *</label>
                    <input
                      type="text"
                      required
                      value={custForm.phone}
                      onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })}
                      placeholder="+1 (555) 000-0000"
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">Customer Type</label>
                    <select
                      value={custForm.customerType}
                      onChange={(e) => setCustForm({ ...custForm, customerType: e.target.value as CustomerType })}
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300 bg-white"
                    >
                      <option value="Household">Household Residential</option>
                      <option value="Commercial / Cafe">Commercial / Cafe</option>
                      <option value="Retail Store">Retail Store / Deli</option>
                      <option value="Dairy Co-op">Dairy Cooperative Hub</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">Delivery Route Zone</label>
                    <select
                      value={custForm.route}
                      onChange={(e) => setCustForm({ ...custForm, route: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300 bg-white"
                    >
                      <option value="North Ridge Residential">North Ridge Residential</option>
                      <option value="South Valley Highway Route">South Valley Highway Route</option>
                      <option value="Commercial Central Route">Commercial Central Route</option>
                      <option value="Town Center Domestic">Town Center Domestic</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">Daily Quota (Liters)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={custForm.dailyQuotaLiters}
                      onChange={(e) => setCustForm({ ...custForm, dailyQuotaLiters: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">Unit Price ({currencySymbol} / Liter)</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0.50"
                      value={custForm.unitPrice}
                      onChange={(e) => setCustForm({ ...custForm, unitPrice: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300 font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-stone-700 font-semibold mb-1">Delivery Address & Landmarks</label>
                    <input
                      type="text"
                      value={custForm.address}
                      onChange={(e) => setCustForm({ ...custForm, address: e.target.value })}
                      placeholder="Street, door number, special porch drop instructions"
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCustomerOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 cursor-pointer"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
