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
  Trash2,
  Download
} from 'lucide-react';
import {
  buildCustomerRevenueReport,
  customerRevenueReportFilename,
} from '../lib/customer-revenue-report';
import { downloadCsvFile } from '../lib/dashboard-report';
import {
  downloadInvoiceReceiptPdf,
  printInvoiceReceiptPdf,
} from '../lib/invoice-receipt-pdf';

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
    setInvoicePayments,
    generateCustomerInvoice
  } = useDairy();

  const [selectedBuyerId, setSelectedBuyerId] = useState('');
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState<string>(todayISO());
  const [collectedBy, setCollectedBy] = useState<string>('');
  const [collectorInvoice, setCollectorInvoice] = useState<Invoice | null>(null);
  const [collectorDrafts, setCollectorDrafts] = useState<
    { id: string; date: string; amount: number; collectedBy: string }[]
  >([]);
  const [selectedInvoiceToPrint, setSelectedInvoiceToPrint] = useState<Invoice | null>(null);
  const [isReceiptPdfBusy, setIsReceiptPdfBusy] = useState(false);
  const [isGenerateInvoiceOpen, setIsGenerateInvoiceOpen] = useState(false);
  const [isRevenueReportOpen, setIsRevenueReportOpen] = useState(false);
  const [reportFrom, setReportFrom] = useState(selectedDate || todayISO());
  const [reportTo, setReportTo] = useState(selectedDate || todayISO());
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

  // Revenue report preview for the dates entered in the download modal.
  const revenueReportPreview = useMemo(() => {
    const from = reportFrom <= reportTo ? reportFrom : reportTo;
    const to = reportFrom <= reportTo ? reportTo : reportFrom;
    return buildCustomerRevenueReport({
      customers,
      sales,
      invoices,
      from,
      to,
    });
  }, [customers, invoices, sales, reportFrom, reportTo]);

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

  // The ledger is buyer-first: pick a buyer, then show every milk sale,
  // invoice and payment recorded for that account in one place.
  const sortedCustomers = useMemo(
    () => [...customers].sort((a, b) => a.name.localeCompare(b.name)),
    [customers]
  );

  const buyerDetail = useMemo(() => {
    const customer = customers.find((entry) => entry.id === selectedBuyerId);
    if (!customer) return null;

    const ledger = customerLedger.get(customer.id) ?? summarizeSales([]);
    const buyerInvoices = resolvedInvoices
      .filter((invoice) => invoice.customerId === customer.id)
      .sort((a, b) =>
        (b.billingTo ?? b.issueDate).localeCompare(a.billingTo ?? a.issueDate)
      );
    const salesNewestFirst = [...ledger.sales].sort(
      (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
    );
    const totalBilled = Number(
      buyerInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0).toFixed(2)
    );
    const totalCollected = Number(
      buyerInvoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0).toFixed(2)
    );
    const balanceDue =
      buyerInvoices.length > 0
        ? Math.max(0, Number((totalBilled - totalCollected).toFixed(2)))
        : ledger.outstanding;

    return {
      customer,
      ledger,
      invoices: buyerInvoices,
      salesNewestFirst,
      totalBilled,
      totalCollected,
      balanceDue,
    };
  }, [customerLedger, customers, resolvedInvoices, selectedBuyerId]);

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

    recordInvoicePayment(
      selectedInvoiceForPayment.id,
      paymentAmount,
      paymentDate,
      collectedBy
    );
    setSelectedInvoiceForPayment(null);
    setPaymentAmount(0);
    setPaymentDate(todayISO());
    setCollectedBy('');
  };

  const openCollectorEditor = (invoice: Invoice) => {
    const payments =
      invoice.payments && invoice.payments.length > 0
        ? invoice.payments
        : invoice.paidAmount > 0
          ? [
              {
                id: `legacy-${invoice.id}`,
                date: invoice.issueDate,
                amount: invoice.paidAmount,
                collectedBy: '',
              },
            ]
          : [];

    setCollectorInvoice(invoice);
    setCollectorDrafts(
      payments.map((payment) => ({
        id: payment.id,
        date: payment.date,
        amount: Number(payment.amount) || 0,
        collectedBy: payment.collectedBy ?? '',
      }))
    );
  };

  const handleSaveCollectors = (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectorInvoice) return;

    const stamp = Date.now();
    setInvoicePayments(
      collectorInvoice.id,
      collectorDrafts.map((draft, index) => ({
        id: draft.id.startsWith('legacy-')
          ? `pmt-${stamp}-${index}`
          : draft.id,
        date: draft.date,
        amount: draft.amount,
        collectedBy: draft.collectedBy.trim() || undefined,
      }))
    );
    setCollectorInvoice(null);
    setCollectorDrafts([]);
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

  const openRevenueReport = () => {
    const anchor = selectedDate || todayISO();
    setReportFrom(anchor);
    setReportTo(anchor);
    setIsRevenueReportOpen(true);
  };

  const selectReportToday = () => {
    const anchor = selectedDate || todayISO();
    setReportFrom(anchor);
    setReportTo(anchor);
  };

  const selectReportLast10Days = () => {
    const anchor = selectedDate || todayISO();
    setReportFrom(addDays(anchor, -9));
    setReportTo(anchor);
  };

  const selectReportThisMonth = () => {
    const anchor = selectedDate || todayISO();
    setReportFrom(startOfMonthISO(anchor));
    setReportTo(endOfMonthISO(anchor));
  };

  const handleDownloadRevenueReport = () => {
    if (!reportFrom || !reportTo) return;
    const from = reportFrom <= reportTo ? reportFrom : reportTo;
    const to = reportFrom <= reportTo ? reportTo : reportFrom;
    const { csv } = buildCustomerRevenueReport({
      customers,
      sales,
      invoices,
      from,
      to,
    });
    downloadCsvFile(customerRevenueReportFilename(from, to), csv);
    setIsRevenueReportOpen(false);
  };

  const buildReceiptPdfInput = () => {
    if (!selectedInvoiceToPrint) return null;
    const customer = customers.find(
      (entry) => entry.id === selectedInvoiceToPrint.customerId
    );

    return {
      invoice: selectedInvoiceToPrint,
      dailyRows: selectedInvoicePrintDaily,
      qualityTotals: selectedInvoicePrintQualityTotals,
      saleCount: selectedInvoicePrintSales.length,
      customerPhone: customer?.phone,
      customerAddress: customer?.address,
      customerRoute: customer?.route,
    };
  };

  const handleDownloadReceiptPdf = async () => {
    const input = buildReceiptPdfInput();
    if (!input) return;

    setIsReceiptPdfBusy(true);
    try {
      await downloadInvoiceReceiptPdf(input);
    } catch (error) {
      console.error('Failed to generate invoice PDF', error);
    } finally {
      setIsReceiptPdfBusy(false);
    }
  };

  const handlePrintReceipt = async () => {
    const input = buildReceiptPdfInput();
    if (!input) return;

    setIsReceiptPdfBusy(true);
    try {
      await printInvoiceReceiptPdf(input);
    } catch (error) {
      console.error('Failed to open invoice PDF', error);
    } finally {
      setIsReceiptPdfBusy(false);
    }
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
            onClick={openRevenueReport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>Revenue Report</span>
          </button>
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

      {/* Buyer ledger filter */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs p-4">
        <div className="mb-3">
          <h2 className="text-sm font-bold text-stone-900">Customer &amp; Billing Ledger</h2>
          <p className="text-[11px] text-stone-500">
            Pick a buyer to open their complete account — milk sales, invoices,
            payments and balance due.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <label className="flex-1 min-w-0">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
              Select buyer
            </span>
            <select
              value={selectedBuyerId}
              onChange={(e) => setSelectedBuyerId(e.target.value)}
              className="w-full appearance-none rounded-lg border border-stone-200 bg-stone-50/60 px-3 py-2 text-sm font-semibold text-stone-900 focus:outline-hidden focus:border-emerald-600 focus:bg-white cursor-pointer"
            >
              <option value="">Choose a buyer to view the full ledger…</option>
              {sortedCustomers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} · {customer.customerType} · {customer.route}
                </option>
              ))}
            </select>
          </label>

          {buyerDetail && (
            <button
              onClick={() => setSelectedBuyerId('')}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>

        <p className="text-[11px] text-stone-400 mt-2">
          {customers.length} buyer{customers.length === 1 ? '' : 's'} ·{' '}
          {resolvedInvoices.length} invoice{resolvedInvoices.length === 1 ? '' : 's'} ·
          select a buyer to see every milk sale, invoice and payment
        </p>
      </div>

      {!buyerDetail && (
        <div className="bg-white rounded-xl border border-dashed border-stone-300 py-12 px-4 text-center">
          <div className="mx-auto w-11 h-11 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <p className="mt-3 text-sm font-semibold text-stone-700">
            Select a buyer to open their billing ledger
          </p>
          <p className="text-[11px] text-stone-400 mt-1">
            Their milk sales, billed invoices, collected payments and balance due
            will appear here.
          </p>
        </div>
      )}

      {buyerDetail && (
        <div className="space-y-4">
          {/* Buyer profile */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-xs p-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-11 h-11 shrink-0 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-sm font-extrabold">
                  {buyerDetail.customer.name
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase() ?? '')
                    .join('') || '?'}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-stone-900 truncate">
                    {buyerDetail.customer.name}
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    {buyerDetail.customer.customerType} ·{' '}
                    {buyerDetail.customer.milkType} ·{' '}
                    {buyerDetail.customer.dailyQuotaLiters} L/day quota
                  </p>
                  <p
                    className="text-[11px] text-stone-400 truncate"
                    title={buyerDetail.customer.address}
                  >
                    {buyerDetail.customer.phone} · {buyerDetail.customer.route}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => openGenerateInvoice(buyerDetail.customer.id)}
                  className="px-3 py-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 cursor-pointer"
                >
                  Generate Invoice
                </button>
                <button
                  onClick={() => handleDeleteCustomer(buyerDetail.customer)}
                  title="Delete customer"
                  aria-label={`Delete ${buyerDetail.customer.name}`}
                  className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 border-t border-stone-100 pt-3 text-[11px]">
              <div>
                <dt className="text-stone-400 font-semibold uppercase tracking-wider text-[9px]">
                  Phone
                </dt>
                <dd className="text-stone-800 font-mono">{buyerDetail.customer.phone}</dd>
              </div>
              <div>
                <dt className="text-stone-400 font-semibold uppercase tracking-wider text-[9px]">
                  Route
                </dt>
                <dd className="text-stone-800">{buyerDetail.customer.route}</dd>
              </div>
              <div>
                <dt className="text-stone-400 font-semibold uppercase tracking-wider text-[9px]">
                  Email
                </dt>
                <dd className="text-stone-800 truncate">
                  {buyerDetail.customer.email || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-stone-400 font-semibold uppercase tracking-wider text-[9px]">
                  Status
                </dt>
                <dd className="text-stone-800">{buyerDetail.customer.status}</dd>
              </div>
              <div className="col-span-2 sm:col-span-4">
                <dt className="text-stone-400 font-semibold uppercase tracking-wider text-[9px]">
                  Address
                </dt>
                <dd className="text-stone-800">{buyerDetail.customer.address || '—'}</dd>
              </div>
            </dl>
          </div>

          {/* Buyer totals */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-stone-200 shadow-xs p-4">
              <p className="text-[9px] font-bold uppercase tracking-wider text-stone-400">
                Total Milk Sale
              </p>
              <p className="mt-1 font-mono font-bold text-lg text-stone-900 tabular-nums">
                {currencySymbol}
                {buyerDetail.ledger.totalAmount.toFixed(2)}
              </p>
              <p className="text-[10px] text-stone-400">
                {buyerDetail.ledger.liters.toFixed(2)} L ·{' '}
                {currencySymbol}
                {buyerDetail.ledger.averageRatePerLiter.toFixed(2)}/L avg
              </p>
              <p className="text-[10px] text-stone-400">
                {buyerDetail.ledger.sales.length} sale
                {buyerDetail.ledger.sales.length === 1 ? '' : 's'} recorded
              </p>
            </div>

            <div className="bg-white rounded-xl border border-stone-200 shadow-xs p-4">
              <p className="text-[9px] font-bold uppercase tracking-wider text-stone-400">
                Total Billed
              </p>
              <p className="mt-1 font-mono font-bold text-lg text-stone-900 tabular-nums">
                {currencySymbol}
                {buyerDetail.totalBilled.toFixed(2)}
              </p>
              <p className="text-[10px] text-stone-400">
                {buyerDetail.invoices.length} invoice
                {buyerDetail.invoices.length === 1 ? '' : 's'} issued
              </p>
            </div>

            <div className="bg-white rounded-xl border border-emerald-100 shadow-xs p-4">
              <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-700/70">
                Collected
              </p>
              <p className="mt-1 font-mono font-bold text-lg text-emerald-800 tabular-nums">
                {currencySymbol}
                {(buyerDetail.invoices.length > 0
                  ? buyerDetail.totalCollected
                  : buyerDetail.ledger.paidAmount
                ).toFixed(2)}
              </p>
              <p className="text-[10px] text-emerald-700/70">
                {buyerDetail.invoices.length > 0
                  ? 'received against invoices'
                  : 'from paid milk sales'}
              </p>
            </div>

            <div
              className={`rounded-xl border shadow-xs p-4 ${
                buyerDetail.balanceDue > 0
                  ? 'bg-amber-50/60 border-amber-200'
                  : 'bg-white border-stone-200'
              }`}
            >
              <p
                className={`text-[9px] font-bold uppercase tracking-wider ${
                  buyerDetail.balanceDue > 0
                    ? 'text-amber-700/80'
                    : 'text-stone-400'
                }`}
              >
                Balance Due
              </p>
              <p
                className={`mt-1 font-mono font-bold text-lg tabular-nums ${
                  buyerDetail.balanceDue > 0 ? 'text-amber-900' : 'text-emerald-700'
                }`}
              >
                {currencySymbol}
                {buyerDetail.balanceDue.toFixed(2)}
              </p>
              <p
                className={`text-[10px] ${
                  buyerDetail.balanceDue > 0
                    ? 'text-amber-700/80'
                    : 'text-stone-400'
                }`}
              >
                {buyerDetail.balanceDue > 0
                  ? buyerDetail.invoices.length > 0
                    ? 'Outstanding on invoices'
                    : 'Unpaid milk sales'
                  : 'Settled'}
              </p>
            </div>
          </div>

          {/* Invoices and payments */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  Invoices &amp; Payments
                </h3>
                <p className="text-[11px] text-stone-500">
                  Billing periods, collections and receipts for this buyer
                </p>
              </div>
              <span className="text-[11px] font-semibold text-stone-500">
                {buyerDetail.invoices.length} invoice
                {buyerDetail.invoices.length === 1 ? '' : 's'}
              </span>
            </div>

            {buyerDetail.invoices.length === 0 ? (
              <div className="px-4 py-8 text-center text-stone-500">
                <p className="text-xs font-semibold">No invoices yet</p>
                <p className="text-[11px] text-stone-400 mt-1">
                  Generate an invoice to bill {buyerDetail.customer.name} for their
                  milk sales.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {buyerDetail.invoices.map((invoice) => {
                  const isPaid = invoice.status === 'Paid';
                  const invoiceBalance = Math.max(
                    0,
                    Number((invoice.totalAmount - invoice.paidAmount).toFixed(2))
                  );
                  const collectors = Array.from(
                    new Set(
                      (invoice.payments ?? [])
                        .map((payment) => payment.collectedBy?.trim())
                        .filter((name): name is string => Boolean(name))
                    )
                  );
                  const payments = [...(invoice.payments ?? [])].sort((a, b) =>
                    a.date.localeCompare(b.date)
                  );

                  return (
                    <div key={invoice.id} className="px-4 py-3">
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] font-bold text-stone-800">
                              {invoice.id}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                                isPaid
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : invoice.status === 'Partially Paid'
                                    ? 'bg-sky-50 text-sky-800 border-sky-200'
                                    : invoice.status === 'Overdue'
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              {isPaid ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : (
                                <Clock className="w-3 h-3" />
                              )}
                              {invoice.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-500 mt-1">
                            {invoice.billingMonth} · Issued{' '}
                            {formatReceiptDate(invoice.issueDate)} · Due{' '}
                            {formatReceiptDate(invoice.dueDate)}
                          </p>
                          <p className="text-[10px] text-stone-400 mt-0.5">
                            {invoice.totalLiters} L at {currencySymbol}
                            {invoice.ratePerLiter.toFixed(2)}/L ·{' '}
                            {invoice.saleIds?.length ?? 0} milk sale
                            {(invoice.saleIds?.length ?? 0) === 1 ? '' : 's'}
                          </p>
                        </div>

                        <div className="grid grid-cols-3 gap-2 lg:min-w-[280px]">
                          <div className="rounded-lg bg-stone-50 border border-stone-100 px-2 py-1.5 text-right">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-stone-400">
                              Billed
                            </p>
                            <p className="font-mono text-xs font-bold text-stone-900 tabular-nums">
                              {currencySymbol}
                              {invoice.totalAmount.toFixed(2)}
                            </p>
                          </div>
                          <div className="rounded-lg bg-emerald-50/70 border border-emerald-100 px-2 py-1.5 text-right">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-700/70">
                              Collected
                            </p>
                            <p className="font-mono text-xs font-bold text-emerald-800 tabular-nums">
                              {currencySymbol}
                              {invoice.paidAmount.toFixed(2)}
                            </p>
                          </div>
                          <div
                            className={`rounded-lg border px-2 py-1.5 text-right ${
                              invoiceBalance > 0
                                ? 'bg-amber-50/70 border-amber-200'
                                : 'bg-stone-50 border-stone-100'
                            }`}
                          >
                            <p
                              className={`text-[9px] font-bold uppercase tracking-wider ${
                                invoiceBalance > 0
                                  ? 'text-amber-700/80'
                                  : 'text-stone-400'
                              }`}
                            >
                              Balance
                            </p>
                            <p
                              className={`font-mono text-xs font-bold tabular-nums ${
                                invoiceBalance > 0
                                  ? 'text-amber-900'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {currencySymbol}
                              {invoiceBalance.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="text-[10px] text-stone-500 min-w-0">
                          {payments.length > 0 ? (
                            <ul className="space-y-0.5">
                              {payments.map((payment) => (
                                <li key={payment.id}>
                                  <span className="font-semibold text-stone-700">
                                    {formatReceiptDate(payment.date)}
                                  </span>{' '}
                                  · {currencySymbol}
                                  {payment.amount.toFixed(2)}
                                  {payment.collectedBy
                                    ? ` · collected by ${payment.collectedBy}`
                                    : ''}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span>
                              {collectors.length > 0
                                ? `Collected by ${collectors.join(', ')}`
                                : 'No payment receipts recorded'}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {!isPaid && invoiceBalance > 0 && (
                            <button
                              onClick={() => {
                                setSelectedInvoiceForPayment(invoice);
                                setPaymentAmount(invoiceBalance);
                                setPaymentDate(todayISO());
                                setCollectedBy('');
                              }}
                              className="px-3 py-1 text-[11px] font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded transition-colors cursor-pointer shadow-xs"
                            >
                              Collect
                            </button>
                          )}
                          {invoice.paidAmount > 0 && (
                            <button
                              onClick={() => openCollectorEditor(invoice)}
                              title="Edit Collected By for recorded payments"
                              className="px-2 py-1 text-[11px] font-semibold text-stone-600 hover:text-emerald-800 hover:bg-emerald-50 rounded border border-stone-200 transition-colors cursor-pointer"
                            >
                              Edit collectors
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedInvoiceToPrint(invoice)}
                            title="Preview / Print Voucher"
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded border border-stone-200 transition-colors cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Print
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Milk sale records */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-100 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  Milk Sale Records
                </h3>
                <p className="text-[11px] text-stone-500">
                  Every sale recorded for this buyer, newest first
                </p>
              </div>
              <span className="text-[11px] font-semibold text-stone-500">
                {buyerDetail.salesNewestFirst.length} sale
                {buyerDetail.salesNewestFirst.length === 1 ? '' : 's'} ·{' '}
                {buyerDetail.ledger.liters.toFixed(2)} L
              </span>
            </div>

            {buyerDetail.salesNewestFirst.length === 0 ? (
              <div className="px-4 py-8 text-center text-stone-500">
                <p className="text-xs font-semibold">No milk sales yet</p>
                <p className="text-[11px] text-stone-400 mt-1">
                  Sales recorded in the Sales tab will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[10px] sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Session</th>
                      <th className="py-2 px-3 text-right">Qty (L)</th>
                      <th className="py-2 px-3 text-right">CLR</th>
                      <th className="py-2 px-3 text-right">Fat %</th>
                      <th className="py-2 px-3 text-right">SNF %</th>
                      <th className="py-2 px-3 text-right">Rate / L</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                      <th className="py-2 px-3">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-stone-700">
                    {buyerDetail.salesNewestFirst.map((sale) => (
                      <tr key={sale.id} className="hover:bg-stone-50/60">
                        <td className="py-2 px-3 whitespace-nowrap font-medium">
                          {formatReceiptDate(sale.date)}
                        </td>
                        <td className="py-2 px-3 text-stone-500">{sale.session}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {Number(sale.quantityLiters).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {formatReceiptClr(sale.clr ?? null)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {sale.fatPercentage != null
                            ? sale.fatPercentage.toFixed(2)
                            : '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {sale.snfPercentage != null
                            ? sale.snfPercentage.toFixed(2)
                            : '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {currencySymbol}
                          {Number(sale.ratePerLiter).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-stone-900 tabular-nums">
                          {currencySymbol}
                          {Number(sale.totalAmount).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              sale.paymentStatus === 'Paid'
                                ? 'bg-emerald-50 text-emerald-800'
                                : 'bg-amber-50 text-amber-800'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                sale.paymentStatus === 'Paid'
                                  ? 'bg-emerald-600'
                                  : 'bg-amber-500'
                              }`}
                            />
                            {sale.paymentStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Collected By</label>
                  <input
                    type="text"
                    value={collectedBy}
                    onChange={(e) => setCollectedBy(e.target.value)}
                    placeholder="e.g. Owner, Farm Manager, Delivery Agent"
                    list="invoice-collected-by-options"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300"
                  />
                  <datalist id="invoice-collected-by-options">
                    <option value="Owner" />
                    <option value="Farm Manager" />
                    <option value="Accountant" />
                    <option value="Delivery Agent" />
                  </datalist>
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

      {/* Edit Collected By (old payment receipts) Modal */}
      {collectorInvoice && (
        <div className="fixed inset-0 z-50 bg-emerald-950/25 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl border border-stone-200">
            <form onSubmit={handleSaveCollectors}>
              <div className="p-5 border-b border-stone-200 flex items-center justify-between sticky top-0 bg-white z-10">
                <div>
                  <h3 className="text-base font-bold text-stone-900">Edit Collected By</h3>
                  <p className="text-xs text-stone-500">
                    {collectorInvoice.customerName} · Invoice {collectorInvoice.id}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCollectorInvoice(null)}
                  className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Total Billed:</span>
                    <span className="font-mono">{currencySymbol}{collectorInvoice.totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Paid to date:</span>
                    <strong className="font-mono text-emerald-800">
                      {currencySymbol}{collectorInvoice.paidAmount.toFixed(2)}
                    </strong>
                  </div>
                </div>

                {collectorDrafts.length === 0 ? (
                  <p className="text-xs text-stone-500">
                    No payment receipts recorded for this invoice yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {collectorDrafts.map((draft, index) => (
                      <div
                        key={`${draft.id}-${index}`}
                        className="rounded-lg border border-stone-200 p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between text-[11px] text-stone-500">
                          <span className="font-mono">{draft.date}</span>
                          <strong className="font-mono text-stone-900">
                            {currencySymbol}{draft.amount.toFixed(2)}
                          </strong>
                        </div>
                        <div>
                          <label className="block text-[11px] text-stone-600 font-semibold mb-1">
                            Collected By
                          </label>
                          <input
                            type="text"
                            value={draft.collectedBy}
                            onChange={(e) =>
                              setCollectorDrafts((prev) =>
                                prev.map((entry, entryIndex) =>
                                  entryIndex === index
                                    ? { ...entry, collectedBy: e.target.value }
                                    : entry
                                )
                              )
                            }
                            placeholder="e.g. Owner, Farm Manager, Delivery Agent"
                            list="collector-edit-options"
                            className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300"
                          />
                        </div>
                      </div>
                    ))}
                    <datalist id="collector-edit-options">
                      <option value="Owner" />
                      <option value="Farm Manager" />
                      <option value="Accountant" />
                      <option value="Delivery Agent" />
                    </datalist>
                    <p className="text-[10px] text-stone-500">
                      Older payments without a receipt history appear with the invoice date.
                      Saving turns them into dated receipts, so dashboard “Collected By”
                      totals update for the correct period.
                    </p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCollectorInvoice(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 cursor-pointer shadow-xs transition-colors"
                >
                  Save Collectors
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Printable Voucher Preview Modal */}
      {selectedInvoiceToPrint && (
        <div className="fixed inset-0 z-50 bg-emerald-950/25 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-[840px] w-full max-h-[90vh] flex flex-col shadow-2xl border border-stone-300 overflow-hidden">
            <div className="p-4 border-b border-stone-200 bg-stone-50 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-stone-700">
                Official Milk Invoice Receipt
                <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  A4 PDF
                </span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadReceiptPdf}
                  disabled={isReceiptPdfBusy}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-700 text-white text-xs font-bold rounded hover:bg-emerald-800 cursor-pointer shadow-xs transition-colors disabled:opacity-60 disabled:cursor-wait"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isReceiptPdfBusy ? 'Preparing…' : 'Download A4 PDF'}</span>
                </button>
                <button
                  onClick={handlePrintReceipt}
                  disabled={isReceiptPdfBusy}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-emerald-300 text-emerald-800 text-xs font-bold rounded hover:bg-emerald-50 cursor-pointer shadow-xs transition-colors disabled:opacity-60 disabled:cursor-wait"
                  title="Open the A4 PDF to print or save it"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print A4</span>
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

      {/* Download Revenue Report Modal */}
      {isRevenueReportOpen && (
        <div className="fixed inset-0 z-50 bg-emerald-950/25 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-stone-200">
            <div className="p-5 border-b border-stone-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-stone-900">Download Revenue Report</h3>
                <p className="text-xs text-stone-500">
                  Customer-wise sales, invoices & collected payments
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRevenueReportOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">From Date</label>
                  <input
                    type="date"
                    value={reportFrom}
                    onChange={(e) => setReportFrom(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">To Date</label>
                  <input
                    type="date"
                    value={reportTo}
                    onChange={(e) => setReportTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={selectReportToday}
                  className="px-2 py-0.5 text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={selectReportLast10Days}
                  className="px-2 py-0.5 text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 cursor-pointer"
                >
                  Last 10 days
                </button>
                <button
                  type="button"
                  onClick={selectReportThisMonth}
                  className="px-2 py-0.5 text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 cursor-pointer"
                >
                  This month
                </button>
              </div>

              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <p className="text-[10px] text-stone-500">Milk Sold</p>
                  <p className="font-mono font-bold text-stone-900 tabular-nums">
                    {revenueReportPreview.summary.liters.toFixed(2)} L
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-stone-500">Gross Revenue</p>
                  <p className="font-mono font-bold text-stone-900 tabular-nums">
                    {currencySymbol}{revenueReportPreview.summary.gross.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-stone-500">Paid Milk Sales</p>
                  <p className="font-mono font-bold text-emerald-800 tabular-nums">
                    {currencySymbol}{revenueReportPreview.summary.paid.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-stone-500">Outstanding Sales</p>
                  <p className="font-mono font-bold text-amber-800 tabular-nums">
                    {currencySymbol}{revenueReportPreview.summary.outstanding.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-stone-500">Invoiced</p>
                  <p className="font-mono font-bold text-stone-900 tabular-nums">
                    {currencySymbol}{revenueReportPreview.summary.invoiced.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-stone-500">Collected</p>
                  <p className="font-mono font-bold text-emerald-800 tabular-nums">
                    {currencySymbol}{revenueReportPreview.summary.collected.toFixed(2)}
                  </p>
                </div>
              </div>

              <p className="text-[10px] text-stone-500">
                The CSV includes a financial summary, customer-wise revenue, invoice
                details and payment receipts for the selected dates. Defaults to the
                date selected in the top bar.
              </p>

              {reportFrom > reportTo && (
                <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  The dates are reversed; the report will use the earlier date as start.
                </p>
              )}
            </div>

            <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRevenueReportOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDownloadRevenueReport}
                disabled={!reportFrom || !reportTo}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 cursor-pointer shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5" />
                Download CSV
              </button>
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
