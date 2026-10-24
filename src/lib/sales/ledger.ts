import type { Customer, Invoice, MilkSale } from '@/types/dairy';

export interface SalesSummary {
  sales: MilkSale[];
  liters: number;
  totalAmount: number;
  paidAmount: number;
  outstanding: number;
  averageRatePerLiter: number;
}

export function saleBuyerName(sale: MilkSale): string {
  return (sale.buyerName ?? sale.centerName ?? '').trim();
}

/**
 * Links a sale to a customer. Newer sales use buyerId; older records fall back
 * to the buyer name so they still appear in the customer's ledger.
 */
export function saleBelongsToCustomer(
  sale: MilkSale,
  customer: Pick<Customer, 'id' | 'name'>
): boolean {
  if (sale.buyerId) {
    return sale.buyerId === customer.id;
  }

  const buyerName = saleBuyerName(sale).toLowerCase();
  return Boolean(buyerName) && buyerName === customer.name.trim().toLowerCase();
}

export function isSaleInRange(sale: MilkSale, from?: string, to?: string): boolean {
  if (from && sale.date < from) return false;
  if (to && sale.date > to) return false;
  return true;
}

/**
 * Returns the latest milk-sale records behind an invoice. Invoices generated
 * from the Sales tab carry saleIds; older invoices fall back to the customer
 * and billing period.
 */
export function getInvoiceSales(
  invoice: Pick<Invoice, 'billingFrom' | 'billingTo' | 'saleIds'>,
  customer: Pick<Customer, 'id' | 'name'> | undefined,
  sales: MilkSale[]
): MilkSale[] {
  if (!customer || !invoice.billingFrom || !invoice.billingTo) return [];

  const linkedSaleIds = new Set(invoice.saleIds ?? []);
  return sales.filter((sale) => {
    if (linkedSaleIds.size > 0) return linkedSaleIds.has(sale.id);
    return (
      saleBelongsToCustomer(sale, customer) &&
      isSaleInRange(sale, invoice.billingFrom, invoice.billingTo)
    );
  });
}

export function summarizeSales(sales: MilkSale[]): SalesSummary {
  let liters = 0;
  let totalAmount = 0;
  let paidAmount = 0;

  for (const sale of sales) {
    const quantity = Number(sale.quantityLiters) || 0;
    const savedTotal = Number(sale.totalAmount);
    const rate = Number(sale.ratePerLiter) || 0;
    const amount = Number.isFinite(savedTotal) ? savedTotal : quantity * rate;

    liters += quantity;
    totalAmount += amount;

    if (sale.paymentStatus === 'Paid') {
      paidAmount += amount;
    }
  }

  const roundedLiters = Number(liters.toFixed(2));
  const roundedTotal = Number(totalAmount.toFixed(2));
  const roundedPaid = Number(paidAmount.toFixed(2));

  return {
    sales,
    liters: roundedLiters,
    totalAmount: roundedTotal,
    paidAmount: roundedPaid,
    outstanding: Math.max(0, Number((roundedTotal - roundedPaid).toFixed(2))),
    averageRatePerLiter:
      roundedLiters > 0 ? Number((roundedTotal / roundedLiters).toFixed(2)) : 0,
  };
}
