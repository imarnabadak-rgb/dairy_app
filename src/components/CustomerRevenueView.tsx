'use client';

import React, { useMemo, useState } from 'react';
import { useDairy } from '../context/DairyContext';
import { Customer, CustomerType, Invoice } from '../types/dairy';
import {
  getInvoiceSales,
  isSaleInRange,
  saleBelongsToCustomer,
  summarizeSales,
  type SalesSummary,
} from '../lib/sales/ledger';
import {
  addDays,
  endOfMonthISO,
  parseISODate,
  startOfMonthISO,
  todayISO,
} from '../lib/date';
import { 
  Users, 
  IndianRupee, 
  FileText, 
  Plus, 
  CheckCircle2, 
  Clock, 
  X, 
  Printer, 
  Search,
  Trash2
} from 'lucide-react';

interface CustomerLedgerRow {
  customer: Customer;
  invoice: Invoice | null;
  ledger: SalesSummary;
}

interface ReceiptDailyRow {
  date: string;
  clr: number | null;
  fat: number | null;
  snf: number | null;
  liters: number;
  amount: number;
  ratePerLiter: number;
}

const RECEIPT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatReceiptDate(value: string): string {
  const date = parseISODate(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getUTCDate()).padStart(2, '0')} ${
    RECEIPT_MONTHS[date.getUTCMonth()]
  } ${date.getUTCFullYear()}`;
}

function formatReceiptClr(value: number | null): string {
  return value != null ? value.toFixed(1) : '—';
}

function formatReceiptPercent(value: number | null): string {
  return value != null ? `${value.toFixed(2)}%` : '—';
}

export const CustomerRevenueView: React.FC = () => {
  const {
    customers,
    sales,
    invoices,
    selectedDate,
    currencySymbol,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    recordInvoicePayment,
    generateCustomerInvoice
  } = useDairy();

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState<string>(todayISO());
  const [selectedInvoiceToPrint, setSelectedInvoiceToPrint] = useState<Invoice | null>(null);
  const [isGenerateInvoiceOpen, setIsGenerateInvoiceOpen] = useState(false);
  const [selectedCustForInvoice, setSelectedCustForInvoice] = useState(customers[0]?.id || '');
  const [invoiceFrom, setInvoiceFrom] = useState('');
  const [invoiceTo, setInvoiceTo] = useState('');
  const [invoiceDateError, setInvoiceDateError] = useState('');

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
    milkBaseRate: number;
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
    milkBaseRate: 43,
    preferredSession: 'Morning',
    status: 'Active'
  });

  // Customer ledger and invoice figures come from the actual milk sales
  // recorded in the Sales tab, not from delivery quotas or profile prices.
  const customerLedger = useMemo(() => {
    const summaries = new Map<string, SalesSummary>();
    for (const customer of customers) {
      summaries.set(
        customer.id,
        summarizeSales(
          sales.filter((sale) => saleBelongsToCustomer(sale, customer))
        )
      );
    }
    return summaries;
  }, [customers, sales]);

  const invoicePreview = useMemo(() => {
    if (
      !selectedCustForInvoice ||
      !invoiceFrom ||
      !invoiceTo ||
      invoiceFrom > invoiceTo
    ) {
      return null;
    }
    const customer = customers.find((c) => c.id === selectedCustForInvoice);
    if (!customer) return null;

    return summarizeSales(
      sales.filter(
        (sale) =>
          saleBelongsToCustomer(sale, customer) &&
          isSaleInRange(sale, invoiceFrom, invoiceTo)
      )
    );
  }, [customers, invoiceFrom, invoiceTo, sales, selectedCustForInvoice]);

  const existingInvoiceForPeriod = useMemo(() => {
    if (!selectedCustForInvoice || !invoiceFrom || !invoiceTo) return null;
    return (
      invoices.find(
        (invoice) =>
          invoice.customerId === selectedCustForInvoice &&
          invoice.billingFrom === invoiceFrom &&
          invoice.billingTo === invoiceTo
      ) ?? null
    );
  }, [invoices, invoiceFrom, invoiceTo, selectedCustForInvoice]);

  // Invoice rows show the latest sales values, so edits in the Sales tab are
  // reflected immediately in the ledger and on the printed receipt. Invoices
  // without a linked sale or billing range keep their stored snapshot.
  const resolvedInvoices = useMemo(() => {
    const customerById = new Map(customers.map((customer) => [customer.id, customer]));

    return invoices.map((invoice) => {
      const customer = customerById.get(invoice.customerId);
      const periodSales = getInvoiceSales(invoice, customer, sales);
      if (periodSales.length === 0) return invoice;

      const summary = summarizeSales(periodSales);
      if (summary.liters <= 0) return invoice;

      const totalAmount = Number(summary.totalAmount.toFixed(2));
      const paidAmount = Math.min(
        totalAmount,
        Number(Math.max(invoice.paidAmount, summary.paidAmount).toFixed(2))
      );
      const status: Invoice['status'] =
        paidAmount >= totalAmount
          ? 'Paid'
          : paidAmount > 0
          ? 'Partially Paid'
          : invoice.status === 'Overdue'
          ? 'Overdue'
          : 'Pending';

      return {
        ...invoice,
        saleIds: summary.sales.map((sale) => sale.id),
        totalLiters: Number(summary.liters.toFixed(2)),
        ratePerLiter: summary.averageRatePerLiter,
        totalAmount,
        paidAmount,
        status,
      };
    });
  }, [customers, invoices, sales]);

  // The receipt shows the actual sales behind the invoice grouped by date.
  // This keeps the printed breakdown aligned with the live Sales tab data.
  const selectedInvoicePrintSales = useMemo(() => {
    if (!selectedInvoiceToPrint) return [];
    const customer = customers.find(
      (entry) => entry.id === selectedInvoiceToPrint.customerId
    );
    return getInvoiceSales(selectedInvoiceToPrint, customer, sales);
  }, [customers, sales, selectedInvoiceToPrint]);

  const selectedInvoicePrintDaily = useMemo<ReceiptDailyRow[]>(() => {
    const byDate = new Map<
      string,
      {
        date: string;
        liters: number;
        amount: number;
        clrWeighted: number;
        clrLiters: number;
        fatWeighted: number;
        fatLiters: number;
        snfWeighted: number;
        snfLiters: number;
      }
    >();

    for (const sale of selectedInvoicePrintSales) {
      const liters = Number(sale.quantityLiters) || 0;
      const savedTotal = Number(sale.totalAmount);
      const rate = Number(sale.ratePerLiter) || 0;
      const amount = Number.isFinite(savedTotal) ? savedTotal : liters * rate;
      const day = byDate.get(sale.date) ?? {
        date: sale.date,
        liters: 0,
        amount: 0,
        clrWeighted: 0,
        clrLiters: 0,
        fatWeighted: 0,
        fatLiters: 0,
        snfWeighted: 0,
        snfLiters: 0,
      };

      day.liters += liters;
      day.amount += amount;

      if (liters > 0) {
        const clr = sale.clr != null ? Number(sale.clr) : NaN;
        if (Number.isFinite(clr)) {
          day.clrWeighted += clr * liters;
          day.clrLiters += liters;
        }

        const fat = sale.fatPercentage != null ? Number(sale.fatPercentage) : NaN;
        if (Number.isFinite(fat)) {
          day.fatWeighted += fat * liters;
          day.fatLiters += liters;
        }

        const snf = sale.snfPercentage != null ? Number(sale.snfPercentage) : NaN;
        if (Number.isFinite(snf)) {
          day.snfWeighted += snf * liters;
          day.snfLiters += liters;
        }
      }

      byDate.set(sale.date, day);
    }

    return Array.from(byDate.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((day) => ({
        date: day.date,
        clr: day.clrLiters > 0 ? day.clrWeighted / day.clrLiters : null,
        fat: day.fatLiters > 0 ? day.fatWeighted / day.fatLiters : null,
        snf: day.snfLiters > 0 ? day.snfWeighted / day.snfLiters : null,
        liters: day.liters,
        amount: day.amount,
        ratePerLiter: day.liters > 0 ? day.amount / day.liters : 0,
      }));
  }, [selectedInvoicePrintSales]);

  const selectedInvoicePrintQualityTotals = useMemo(() => {
    let clrWeighted = 0;
    let clrLiters = 0;
    let fatWeighted = 0;
    let fatLiters = 0;
    let snfWeighted = 0;
    let snfLiters = 0;

    for (const sale of selectedInvoicePrintSales) {
      const liters = Number(sale.quantityLiters) || 0;
      if (liters <= 0) continue;

      const clr = sale.clr != null ? Number(sale.clr) : NaN;
      if (Number.isFinite(clr)) {
        clrWeighted += clr * liters;
        clrLiters += liters;
      }

      const fat = sale.fatPercentage != null ? Number(sale.fatPercentage) : NaN;
      if (Number.isFinite(fat)) {
        fatWeighted += fat * liters;
        fatLiters += liters;
      }

      const snf = sale.snfPercentage != null ? Number(sale.snfPercentage) : NaN;
      if (Number.isFinite(snf)) {
        snfWeighted += snf * liters;
        snfLiters += liters;
      }
    }

    return {
      clr: clrLiters > 0 ? clrWeighted / clrLiters : null,
      fat: fatLiters > 0 ? fatWeighted / fatLiters : null,
      snf: snfLiters > 0 ? snfWeighted / snfLiters : null,
    };
  }, [selectedInvoicePrintSales]);

  // One unified log row per customer invoice, plus a row for customers who do
  // not have an invoice yet. Customer ledger values repeat across their
  // invoice rows so the log keeps every detail in a single table.
  const customerLogRows = useMemo<CustomerLedgerRow[]>(() => {
    const rows: CustomerLedgerRow[] = [];

    for (const customer of customers) {
      const ledger = customerLedger.get(customer.id) ?? summarizeSales([]);
      const customerInvoices = resolvedInvoices
        .filter((invoice) => invoice.customerId === customer.id)
        .sort((a, b) =>
          (b.billingTo ?? b.issueDate).localeCompare(a.billingTo ?? a.issueDate)
        );

      if (customerInvoices.length === 0) {
        rows.push({ customer, invoice: null, ledger });
      } else {
        for (const invoice of customerInvoices) {
          rows.push({ customer, invoice, ledger });
        }
      }
    }

    return rows;
  }, [customerLedger, customers, resolvedInvoices]);

  // Calculate totals
  const totalReceivables = customers.reduce(
    (acc, customer) => acc + (customerLedger.get(customer.id)?.outstanding ?? 0),
    0
  );
  const totalBilledThisPeriod = resolvedInvoices.reduce(
    (acc, inv) => acc + inv.totalAmount,
    0
  );
  const totalCollectedInvoices = resolvedInvoices.reduce(
    (acc, inv) => acc + inv.paidAmount,
    0
  );

  const filteredLogRows = customerLogRows.filter(({ customer, invoice }) => {
    const query = searchQuery.toLowerCase();
    return (
      customer.name.toLowerCase().includes(query) ||
      customer.customerType.toLowerCase().includes(query) ||
      customer.milkType.toLowerCase().includes(query) ||
      customer.route.toLowerCase().includes(query) ||
      customer.address.toLowerCase().includes(query) ||
      customer.phone.toLowerCase().includes(query) ||
      (invoice
        ? invoice.id.toLowerCase().includes(query) ||
          invoice.customerName.toLowerCase().includes(query) ||
          invoice.billingMonth.toLowerCase().includes(query)
        : false)
    );
  });

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
      milkBaseRate: Number(custForm.milkBaseRate),
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
      milkBaseRate: 43,
      preferredSession: 'Morning',
      status: 'Active'
    });
  };

  const handleDeleteCustomer = (customer: Customer) => {
    const invoiceCount = invoices.filter(
      (invoice) => invoice.customerId === customer.id
    ).length;
    const relatedRecords =
      invoiceCount > 0
        ? `all delivery logs and ${invoiceCount} related invoice${
            invoiceCount === 1 ? '' : 's'
          }`
        : 'all related delivery logs';
    const ledgerBalance = customerLedger.get(customer.id)?.outstanding ?? 0;
    const balanceWarning =
      ledgerBalance > 0
        ? `\n\nOutstanding sales balance: ${currencySymbol}${ledgerBalance.toFixed(2)}.`
        : '';

    if (
      window.confirm(
        `Permanently delete ${customer.name} and ${relatedRecords}?${balanceWarning}\n\nThis cannot be undone.`
      )
    ) {
      deleteCustomer(customer.id);
      if (selectedCustForInvoice === customer.id) {
        setSelectedCustForInvoice('');
      }
    }
  };

  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForPayment || paymentAmount <= 0) return;

    recordInvoicePayment(selectedInvoiceForPayment.id, paymentAmount, paymentDate);
    setSelectedInvoiceForPayment(null);
    setPaymentAmount(0);
    setPaymentDate(todayISO());
  };

  const handleGenerateInvoiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustForInvoice) return;
    if (!invoiceFrom || !invoiceTo) {
      setInvoiceDateError('Select both a start and end date.');
      return;
    }
    if (invoiceFrom > invoiceTo) {
      setInvoiceDateError('The start date must be on or before the end date.');
      return;
    }

    if (existingInvoiceForPeriod && existingInvoiceForPeriod.paidAmount > 0) {
      setInvoiceDateError(
        'This billing period already has an invoice with payments recorded. Choose a different period.'
      );
      return;
    }

    if (!invoicePreview || invoicePreview.liters <= 0) {
      setInvoiceDateError(
        'No milk sales were recorded for this customer in the selected period.'
      );
      return;
    }

    setInvoiceDateError('');
    const generated = generateCustomerInvoice(
      selectedCustForInvoice,
      invoiceFrom,
      invoiceTo
    );
    if (!generated) {
      setInvoiceDateError(
        'No milk sales were recorded for this customer in the selected period.'
      );
      return;
    }
    setIsGenerateInvoiceOpen(false);
  };

  const selectToday = () => {
    const anchor = selectedDate || todayISO();
    setInvoiceFrom(anchor);
    setInvoiceTo(anchor);
    setInvoiceDateError('');
  };

  const selectLast10Days = () => {
    const anchor = selectedDate || todayISO();
    setInvoiceFrom(addDays(anchor, -9));
    setInvoiceTo(anchor);
    setInvoiceDateError('');
  };

  const selectThisMonth = () => {
    const anchor = selectedDate || todayISO();
    setInvoiceFrom(startOfMonthISO(anchor));
    setInvoiceTo(endOfMonthISO(anchor));
    setInvoiceDateError('');
  };

  const openGenerateInvoice = (customerId?: string) => {
    const targetCustomerId =
      customerId || selectedCustForInvoice || customers[0]?.id || '';
    if (targetCustomerId) {
      setSelectedCustForInvoice(targetCustomerId);
    }

    if (!invoiceFrom || !invoiceTo) {
      selectThisMonth();
    }
    setInvoiceDateError('');
    setIsGenerateInvoiceOpen(true);
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
            Subscriber management, route quotas, sales ledger, invoices & receivables
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => openGenerateInvoice()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-colors cursor-pointer shadow-xs"
          >
            <FileText className="w-4 h-4 text-emerald-200" />
            <span>Generate Invoice</span>
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
            <IndianRupee className="w-4 h-4 text-emerald-700" />
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
            Pending balances from recorded milk sales
          </span>
        </div>
      </div>

      {/* Merged customer accounts, invoices & ledger log */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-2">
        <div>
          <h2 className="text-sm font-bold text-stone-900">Customer & Billing Ledger</h2>
          <p className="text-[11px] text-stone-500">
            {customers.length} customer{customers.length === 1 ? '' : 's'} ·{' '}
            {resolvedInvoices.length} invoice
            {resolvedInvoices.length === 1 ? '' : 's'} · {customerLogRows.length} log row
            {customerLogRows.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="relative w-full sm:w-auto sm:min-w-[260px]">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search customer, phone, route, invoice #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-stone-200 bg-stone-50/50 focus:outline-hidden focus:border-emerald-600 focus:bg-white"
          />
        </div>
      </div>

      {/* Unified customer, invoice and ledger log */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Contact & Route</th>
                <th className="py-3 px-4 text-right">Total Milk Sale</th>
                <th className="py-3 px-4 text-right">Ledger Balance</th>
                <th className="py-3 px-4">Invoice & Billing Period</th>
                <th className="py-3 px-4 text-right">Invoice Volume / Rate</th>
                <th className="py-3 px-4 text-right">Total Billed</th>
                <th className="py-3 px-4">Paid / Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {filteredLogRows.map(({ customer, invoice, ledger }) => {
                const hasDue = ledger.outstanding > 0;
                const isPaid = invoice?.status === 'Paid';
                const balanceRemaining = invoice
                  ? Math.max(0, invoice.totalAmount - invoice.paidAmount)
                  : 0;

                return (
                  <tr
                    key={`${customer.id}-${invoice?.id ?? 'no-invoice'}`}
                    className="hover:bg-stone-50/70 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <p className="font-bold text-stone-900 text-xs">{customer.name}</p>
                      <p className="text-[11px] text-stone-400">
                        {customer.customerType} · {customer.milkType}
                      </p>
                    </td>

                    <td className="py-3 px-4">
                      <p className="text-stone-600 font-mono">{customer.phone}</p>
                      <p className="text-stone-800 font-medium">{customer.route}</p>
                      <p
                        className="text-[11px] text-stone-400 truncate max-w-[200px]"
                        title={customer.address}
                      >
                        {customer.address}
                      </p>
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-stone-900 tabular-nums">
                      {ledger.liters.toFixed(1)} L
                      <p className="text-[10px] font-normal text-stone-400">
                        {ledger.sales.length === 0
                          ? 'No sales yet'
                          : `${ledger.sales.length} sale${
                              ledger.sales.length === 1 ? '' : 's'
                            }`}
                      </p>
                    </td>

                    <td
                      className="py-3 px-4 text-right font-mono tabular-nums"
                      title={
                        ledger.sales.length > 0
                          ? `${currencySymbol}${ledger.totalAmount.toFixed(2)} sold · ${currencySymbol}${ledger.paidAmount.toFixed(2)} paid`
                          : 'No milk sales recorded yet'
                      }
                    >
                      <span
                        className={`font-bold ${
                          hasDue ? 'text-amber-800' : 'text-emerald-700'
                        }`}
                      >
                        {currencySymbol}
                        {ledger.outstanding.toFixed(2)}
                      </span>
                      <p className="text-[10px] text-stone-400">
                        {ledger.sales.length === 0
                          ? 'No sales yet'
                          : `${currencySymbol}${ledger.paidAmount.toFixed(2)} paid`}
                      </p>
                    </td>

                    <td className="py-3 px-4">
                      {invoice ? (
                        <>
                          <p className="font-mono font-bold text-stone-900">{invoice.id}</p>
                          <p className="text-[11px] text-stone-500">
                            {invoice.billingMonth}
                          </p>
                          {invoice.saleIds && invoice.saleIds.length > 0 && (
                            <p className="text-[10px] text-stone-400">
                              From {invoice.saleIds.length} milk sale
                              {invoice.saleIds.length === 1 ? '' : 's'}
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-stone-400">No invoice yet</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {invoice ? (
                        <>
                          <p className="font-bold text-stone-900">
                            {invoice.totalLiters} L
                          </p>
                          <p className="text-[10px] text-stone-400">
                            {currencySymbol}
                            {invoice.ratePerLiter.toFixed(2)}/L avg
                          </p>
                        </>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-stone-900 tabular-nums">
                      {invoice
                        ? `${currencySymbol}${invoice.totalAmount.toFixed(2)}`
                        : '—'}
                    </td>

                    <td className="py-3 px-4">
                      {invoice ? (
                        <>
                          <p className="font-mono tabular-nums text-emerald-800 font-semibold">
                            {currencySymbol}
                            {invoice.paidAmount.toFixed(2)}
                          </p>
                          <span
                            className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                              isPaid
                                ? 'bg-emerald-100 text-emerald-900'
                                : invoice.status === 'Partially Paid'
                                ? 'bg-sky-100 text-sky-900'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {isPaid ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            ) : (
                              <Clock className="w-3 h-3" />
                            )}
                            <span>{invoice.status}</span>
                          </span>
                        </>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openGenerateInvoice(customer.id)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 cursor-pointer"
                        >
                          Invoice
                        </button>
                        {invoice && !isPaid && (
                          <button
                            onClick={() => {
                              setSelectedInvoiceForPayment(invoice);
                              setPaymentAmount(balanceRemaining);
                              setPaymentDate(todayISO());
                            }}
                            className="px-2 py-1 text-[11px] font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded transition-colors cursor-pointer shadow-xs"
                          >
                            Collect
                          </button>
                        )}
                        {invoice && (
                          <button
                            onClick={() => setSelectedInvoiceToPrint(invoice)}
                            className="p-1 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded transition-colors cursor-pointer"
                            title="Preview / Print Voucher"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteCustomer(customer)}
                          title="Delete customer"
                          aria-label={`Delete ${customer.name}`}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredLogRows.length === 0 && (
          <div className="py-12 text-center text-stone-500">
            <p className="text-sm font-semibold">No customers or invoices match your search</p>
          </div>
        )}
      </div>

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

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Payment Received On *</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 font-mono text-sm focus:outline-hidden focus:border-emerald-600"
                  />
                  <p className="text-[10px] text-stone-500 mt-1">
                    Cash is counted in the dashboard period that contains this date.
                  </p>
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
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-stone-300 overflow-hidden">
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
            <div className="p-8 space-y-6 text-xs text-stone-800 bg-white font-sans overflow-y-auto flex-1 min-h-0">
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
                  <p className="text-stone-600 text-[11px]">Dairy Account Subscription</p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-stone-400 uppercase font-semibold block mb-0.5">Billing Period:</span>
                  <p className="font-bold text-stone-900">{selectedInvoiceToPrint.billingMonth}</p>
                  <p className="text-[11px] text-stone-500">Due: {selectedInvoiceToPrint.dueDate}</p>
                </div>
              </div>

              {/* Date-wise milk sales details */}
              <div className="space-y-2 my-4">
                <div>
                  <h3 className="text-[11px] uppercase font-semibold text-stone-400">
                    Milk Sales Details
                  </h3>
                  <p className="text-[10px] text-stone-500">
                    {selectedInvoicePrintDaily.length > 0
                      ? `${selectedInvoicePrintDaily.length} day${
                          selectedInvoicePrintDaily.length === 1 ? '' : 's'
                        } · ${selectedInvoicePrintSales.length} recorded sale${
                          selectedInvoicePrintSales.length === 1 ? '' : 's'
                        }`
                      : 'Billing period summary'}
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-t border-b border-stone-200">
                    <thead>
                      <tr className="text-stone-500 font-semibold border-b border-stone-200">
                        <th className="py-2">Date</th>
                        <th className="py-2 text-right">CLR</th>
                        <th className="py-2 text-right">Fat %</th>
                        <th className="py-2 text-right">SNF %</th>
                        <th className="py-2 text-right">Volume</th>
                        <th className="py-2 text-right">Avg Rate</th>
                        <th className="py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {selectedInvoicePrintDaily.length > 0 ? (
                        selectedInvoicePrintDaily.map((day) => (
                          <tr key={day.date}>
                            <td className="py-1.5 font-medium whitespace-nowrap">
                              {formatReceiptDate(day.date)}
                            </td>
                            <td className="py-1.5 text-right font-mono whitespace-nowrap">
                              {formatReceiptClr(day.clr)}
                            </td>
                            <td className="py-1.5 text-right font-mono whitespace-nowrap">
                              {formatReceiptPercent(day.fat)}
                            </td>
                            <td className="py-1.5 text-right font-mono whitespace-nowrap">
                              {formatReceiptPercent(day.snf)}
                            </td>
                            <td className="py-1.5 text-right font-mono whitespace-nowrap">
                              {day.liters.toFixed(2)} L
                            </td>
                            <td className="py-1.5 text-right font-mono whitespace-nowrap">
                              {currencySymbol}
                              {day.ratePerLiter.toFixed(2)}/L
                            </td>
                            <td className="py-1.5 text-right font-mono whitespace-nowrap">
                              {currencySymbol}
                              {day.amount.toFixed(2)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="py-2 font-medium">
                            Recorded sales summary
                          </td>
                          <td className="py-2 text-right font-mono">—</td>
                          <td className="py-2 text-right font-mono">—</td>
                          <td className="py-2 text-right font-mono">—</td>
                          <td className="py-2 text-right font-mono">
                            {selectedInvoiceToPrint.totalLiters.toFixed(2)} L
                          </td>
                          <td className="py-2 text-right font-mono">
                            {currencySymbol}
                            {selectedInvoiceToPrint.ratePerLiter.toFixed(2)}/L
                          </td>
                          <td className="py-2 text-right font-mono font-bold">
                            {currencySymbol}
                            {selectedInvoiceToPrint.totalAmount.toFixed(2)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {selectedInvoicePrintDaily.length > 0 && (
                      <tfoot>
                        <tr className="border-t border-stone-300 text-stone-900">
                          <td className="py-2 font-bold">Total</td>
                          <td className="py-2 text-right font-mono font-bold whitespace-nowrap">
                            {formatReceiptClr(selectedInvoicePrintQualityTotals.clr)}
                          </td>
                          <td className="py-2 text-right font-mono font-bold whitespace-nowrap">
                            {formatReceiptPercent(selectedInvoicePrintQualityTotals.fat)}
                          </td>
                          <td className="py-2 text-right font-mono font-bold whitespace-nowrap">
                            {formatReceiptPercent(selectedInvoicePrintQualityTotals.snf)}
                          </td>
                          <td className="py-2 text-right font-mono font-bold whitespace-nowrap">
                            {selectedInvoiceToPrint.totalLiters.toFixed(2)} L
                          </td>
                          <td className="py-2 text-right font-mono font-bold whitespace-nowrap">
                            {currencySymbol}
                            {selectedInvoiceToPrint.ratePerLiter.toFixed(2)}/L
                          </td>
                          <td className="py-2 text-right font-mono font-bold whitespace-nowrap">
                            {currencySymbol}
                            {selectedInvoiceToPrint.totalAmount.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

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
                    onChange={(e) => {
                      setSelectedCustForInvoice(e.target.value);
                      setInvoiceDateError('');
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.customerType}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
                    <label className="block text-stone-700 font-semibold">Billing Period</label>
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={selectToday}
                        className="px-2 py-0.5 text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 cursor-pointer whitespace-nowrap"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={selectLast10Days}
                        className="px-2 py-0.5 text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 cursor-pointer whitespace-nowrap"
                      >
                        Last 10 days
                      </button>
                      <button
                        type="button"
                        onClick={selectThisMonth}
                        className="px-2 py-0.5 text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 cursor-pointer whitespace-nowrap"
                      >
                        This month
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-stone-500 mb-1">From</label>
                      <input
                        type="date"
                        required
                        value={invoiceFrom}
                        onChange={(e) => {
                          setInvoiceFrom(e.target.value);
                          setInvoiceDateError('');
                        }}
                        className="w-full px-3 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-stone-500 mb-1">To</label>
                      <input
                        type="date"
                        required
                        value={invoiceTo}
                        onChange={(e) => {
                          setInvoiceTo(e.target.value);
                          setInvoiceDateError('');
                        }}
                        className="w-full px-3 py-1.5 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600 font-mono"
                      />
                    </div>
                  </div>
                  {invoiceDateError && (
                    <p className="mt-1.5 text-[11px] text-rose-600">{invoiceDateError}</p>
                  )}
                </div>

                {invoicePreview && invoicePreview.sales.length > 0 && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-stone-600">
                      <span>Recorded sales</span>
                      <span className="font-mono font-semibold text-stone-900">
                        {invoicePreview.sales.length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-stone-600">
                      <span>Milk volume</span>
                      <span className="font-mono font-semibold text-stone-900">
                        {invoicePreview.liters.toFixed(2)} L
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-stone-600">
                      <span>Weighted avg rate</span>
                      <span className="font-mono font-semibold text-stone-900">
                        {currencySymbol}{invoicePreview.averageRatePerLiter.toFixed(2)}/L
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-emerald-200 pt-1.5 text-[11px]">
                      <span className="font-semibold text-stone-700">Invoice total</span>
                      <span className="font-mono font-bold text-emerald-900">
                        {currencySymbol}{invoicePreview.totalAmount.toFixed(2)}
                      </span>
                    </div>
                    {invoicePreview.paidAmount > 0 && (
                      <div className="flex items-center justify-between text-[11px] text-emerald-800">
                        <span>Already paid in Sales</span>
                        <span className="font-mono font-semibold">
                          {currencySymbol}{invoicePreview.paidAmount.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {existingInvoiceForPeriod &&
                  existingInvoiceForPeriod.paidAmount > 0 && (
                    <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-900">
                      An invoice for this period already has {currencySymbol}
                      {existingInvoiceForPeriod.paidAmount.toFixed(2)} in recorded
                      payments. Choose a different billing period.
                    </p>
                  )}

                {existingInvoiceForPeriod &&
                  existingInvoiceForPeriod.paidAmount === 0 &&
                  invoicePreview &&
                  invoicePreview.sales.length > 0 && (
                    <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-900">
                      This period already has an invoice. Generating again will
                      refresh it from the current milk-sale records.
                    </p>
                  )}

                {invoicePreview && invoicePreview.sales.length === 0 && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                    No milk sales found for this customer in the selected period.
                    Record the sale in the Sales tab first, then generate the invoice.
                  </p>
                )}
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
                  disabled={
                    !invoicePreview ||
                    invoicePreview.liters <= 0 ||
                    Boolean(
                      existingInvoiceForPeriod && existingInvoiceForPeriod.paidAmount > 0
                    )
                  }
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 cursor-pointer disabled:cursor-not-allowed disabled:bg-stone-300"
                >
                  {existingInvoiceForPeriod && existingInvoiceForPeriod.paidAmount > 0
                    ? 'Invoice Has Payments'
                    : existingInvoiceForPeriod
                    ? 'Update Invoice from Sales'
                    : 'Generate from Sales'}
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
