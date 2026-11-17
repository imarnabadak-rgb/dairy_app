import type { Customer, Invoice, InvoicePayment, MilkSale } from '@/types/dairy';
import { saleBelongsToCustomer } from './sales/ledger';

export interface CustomerRevenueReportInput {
  customers: Customer[];
  sales: MilkSale[];
  invoices: Invoice[];
  /** First day of the report range (YYYY-MM-DD). */
  from: string;
  /** Last day of the report range (YYYY-MM-DD). */
  to: string;
}

export interface CustomerRevenueReportSummary {
  customersWithActivity: number;
  liters: number;
  gross: number;
  paid: number;
  outstanding: number;
  invoiced: number;
  invoicePaid: number;
  invoiceBalance: number;
  collected: number;
  invoiceCount: number;
  saleCount: number;
}

export interface CustomerRevenueReportResult {
  csv: string;
  summary: CustomerRevenueReportSummary;
}

interface PaymentEvent {
  date: string;
  amount: number;
  collectedBy?: string;
  invoice: Invoice;
}

function number(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '';
}

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(',');
}

function money(value: number): string {
  return number(value, 2);
}

/** Dated receipts, including the legacy fallback to the invoice issue date. */
export function invoicePaymentEvents(invoices: Invoice[]): PaymentEvent[] {
  return invoices.flatMap((invoice) => {
    const payments: InvoicePayment[] = invoice.payments ?? [];
    if (payments.length > 0) {
      return payments.map((payment) => ({
        date: payment.date,
        amount: Number(payment.amount) || 0,
        collectedBy: payment.collectedBy,
        invoice,
      }));
    }

    const paidAmount = Number(invoice.paidAmount) || 0;
    return paidAmount > 0
      ? [
          {
            date: invoice.issueDate,
            amount: paidAmount,
            collectedBy: undefined,
            invoice,
          },
        ]
      : [];
  });
}

export function buildCustomerRevenueReport(
  input: CustomerRevenueReportInput
): CustomerRevenueReportResult {
  const { customers, sales, invoices, from, to } = input;
  const inRange = (date: string | undefined) =>
    Boolean(date) && (date as string) >= from && (date as string) <= to;

  const periodSales = sales.filter((sale) => inRange(sale.date));
  const periodInvoices = invoices.filter((invoice) => inRange(invoice.issueDate));
  const periodPayments = invoicePaymentEvents(invoices).filter((payment) =>
    inRange(payment.date)
  );

  const customerRows = customers
    .map((customer) => {
      const customerSales = periodSales.filter((sale) =>
        saleBelongsToCustomer(sale, customer)
      );
      const customerInvoices = periodInvoices.filter(
        (invoice) => invoice.customerId === customer.id
      );
      const customerPayments = periodPayments.filter(
        (payment) => payment.invoice.customerId === customer.id
      );

      const liters = customerSales.reduce(
        (sum, sale) => sum + (Number(sale.quantityLiters) || 0),
        0
      );
      const gross = customerSales.reduce(
        (sum, sale) => sum + (Number(sale.totalAmount) || 0),
        0
      );
      const paid = customerSales
        .filter((sale) => sale.paymentStatus === 'Paid')
        .reduce((sum, sale) => sum + (Number(sale.totalAmount) || 0), 0);
      const invoiced = customerInvoices.reduce(
        (sum, invoice) => sum + (Number(invoice.totalAmount) || 0),
        0
      );
      const invoicePaid = customerInvoices.reduce(
        (sum, invoice) => sum + (Number(invoice.paidAmount) || 0),
        0
      );
      const collected = customerPayments.reduce(
        (sum, payment) => sum + payment.amount,
        0
      );

      return {
        customer,
        saleCount: customerSales.length,
        liters,
        gross,
        paid,
        outstanding: Math.max(0, gross - paid),
        invoiced,
        invoicePaid,
        invoiceBalance: Math.max(0, invoiced - invoicePaid),
        collected,
      };
    })
    .filter(
      (row) =>
        row.saleCount > 0 ||
        row.invoiced > 0 ||
        row.collected > 0 ||
        row.invoiceBalance > 0
    )
    .sort((a, b) => b.gross - a.gross || b.collected - a.collected);

  const summary: CustomerRevenueReportSummary = {
    customersWithActivity: customerRows.length,
    liters: customerRows.reduce((sum, row) => sum + row.liters, 0),
    gross: customerRows.reduce((sum, row) => sum + row.gross, 0),
    paid: customerRows.reduce((sum, row) => sum + row.paid, 0),
    outstanding: customerRows.reduce((sum, row) => sum + row.outstanding, 0),
    invoiced: customerRows.reduce((sum, row) => sum + row.invoiced, 0),
    invoicePaid: customerRows.reduce((sum, row) => sum + row.invoicePaid, 0),
    invoiceBalance: customerRows.reduce((sum, row) => sum + row.invoiceBalance, 0),
    collected: customerRows.reduce((sum, row) => sum + row.collected, 0),
    invoiceCount: periodInvoices.length,
    saleCount: periodSales.length,
  };

  const lines: string[] = [];
  lines.push(csvRow(['DairyFlow Customer Revenue Report']));
  lines.push(csvRow(['Period', from, 'to', to]));
  lines.push('');

  lines.push(csvRow(['Financial Summary', 'Value']));
  lines.push(csvRow(['Customers with activity', summary.customersWithActivity]));
  lines.push(csvRow(['Milk sales recorded', summary.saleCount]));
  lines.push(csvRow(['Milk sold (L)', number(summary.liters)]));
  lines.push(csvRow(['Gross milk revenue', money(summary.gross)]));
  lines.push(csvRow(['Paid milk sales', money(summary.paid)]));
  lines.push(csvRow(['Outstanding milk sales', money(summary.outstanding)]));
  lines.push(csvRow(['Invoices issued', summary.invoiceCount]));
  lines.push(csvRow(['Invoiced amount (issued in period)', money(summary.invoiced)]));
  lines.push(csvRow(['Invoice payments collected', money(summary.collected)]));
  lines.push(csvRow(['Outstanding invoice balance', money(summary.invoiceBalance)]));
  lines.push('');

  lines.push(
    csvRow([
      'Customer Revenue',
      'Customer',
      'Phone',
      'Route',
      'Milk Sold (L)',
      'Gross Revenue',
      'Paid',
      'Outstanding',
      'Invoiced',
      'Collected',
      'Invoice Balance',
    ])
  );
  customerRows.forEach((row) => {
    lines.push(
      csvRow([
        '',
        row.customer.name,
        row.customer.phone,
        row.customer.route,
        number(row.liters),
        money(row.gross),
        money(row.paid),
        money(row.outstanding),
        money(row.invoiced),
        money(row.collected),
        money(row.invoiceBalance),
      ])
    );
  });
  lines.push(
    csvRow([
      'Total',
      '',
      '',
      '',
      number(summary.liters),
      money(summary.gross),
      money(summary.paid),
      money(summary.outstanding),
      money(summary.invoiced),
      money(summary.collected),
      money(summary.invoiceBalance),
    ])
  );
  lines.push('');

  lines.push(
    csvRow([
      'Invoice Details',
      'Invoice',
      'Customer',
      'Billing Period',
      'Issue Date',
      'Due Date',
      'Total',
      'Paid',
      'Balance',
      'Status',
    ])
  );
  if (periodInvoices.length === 0) {
    lines.push(csvRow(['', 'No invoices issued in this period']));
  } else {
    [...periodInvoices]
      .sort((a, b) => a.issueDate.localeCompare(b.issueDate))
      .forEach((invoice) => {
        lines.push(
          csvRow([
            '',
            invoice.id,
            invoice.customerName,
            invoice.billingMonth,
            invoice.issueDate,
            invoice.dueDate,
            money(Number(invoice.totalAmount) || 0),
            money(Number(invoice.paidAmount) || 0),
            money(
              Math.max(
                0,
                (Number(invoice.totalAmount) || 0) -
                  (Number(invoice.paidAmount) || 0)
              )
            ),
            invoice.status,
          ])
        );
      });
  }
  lines.push('');

  lines.push(
    csvRow([
      'Payment Receipts',
      'Date',
      'Invoice',
      'Customer',
      'Amount',
      'Collected By',
    ])
  );
  if (periodPayments.length === 0) {
    lines.push(csvRow(['', 'No payments collected in this period']));
  } else {
    [...periodPayments]
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((payment) => {
        lines.push(
          csvRow([
            '',
            payment.date,
            payment.invoice.id,
            payment.invoice.customerName,
            money(payment.amount),
            payment.collectedBy ?? '',
          ])
        );
      });
  }

  return { csv: lines.join('\r\n'), summary };
}

export function customerRevenueReportFilename(from: string, to: string): string {
  return `dairyflow-customer-revenue_${from}_to_${to}.csv`;
}
