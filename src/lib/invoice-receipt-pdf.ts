import type { jsPDF } from 'jspdf';
import type { Invoice } from '../types/dairy';

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_Y = 286;

const EMERALD: [number, number, number] = [4, 120, 87];
const EMERALD_DARK: [number, number, number] = [6, 78, 59];
const EMERALD_SOFT: [number, number, number] = [236, 253, 245];
const EMERALD_LIGHT: [number, number, number] = [209, 250, 229];
const STONE_900: [number, number, number] = [28, 25, 23];
const STONE_600: [number, number, number] = [87, 83, 78];
const STONE_400: [number, number, number] = [168, 162, 158];
const BORDER: [number, number, number] = [231, 229, 228];
const WHITE: [number, number, number] = [255, 255, 255];

const moneyFormat = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const litresFormat = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const MONTHS = [
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

export interface InvoiceReceiptDailyRow {
  date: string;
  clr: number | null;
  fat: number | null;
  snf: number | null;
  liters: number;
  amount: number;
  ratePerLiter: number;
}

export interface InvoiceReceiptPdfInput {
  invoice: Invoice;
  dailyRows: InvoiceReceiptDailyRow[];
  qualityTotals: {
    clr: number | null;
    fat: number | null;
    snf: number | null;
  };
  saleCount: number;
  customerPhone?: string;
  customerAddress?: string;
  customerRoute?: string;
}

function money(value: number): string {
  return moneyFormat.format(Number.isFinite(value) ? value : 0);
}

function litres(value: number): string {
  return litresFormat.format(Number.isFinite(value) ? value : 0);
}

function quality(value: number | null, digits = 2): string {
  return value != null && Number.isFinite(value) ? value.toFixed(digits) : '-';
}

function pdfDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getUTCDate()).padStart(2, '0')} ${
    MONTHS[date.getUTCMonth()]
  } ${date.getUTCFullYear()}`;
}

export function invoiceReceiptFilename(invoice: Invoice): string {
  const safeId = invoice.id.replace(/[^a-z0-9-_]+/gi, '-');
  const safeBuyer = invoice.customerName
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `Milk-Invoice-${safeBuyer || 'Buyer'}-${safeId}.pdf`;
}

async function createInvoiceReceiptDoc(
  input: InvoiceReceiptPdfInput
): Promise<jsPDF> {
  const [{ jsPDF: JsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new JsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });
  const { invoice } = input;
  const balanceDue = Math.max(
    0,
    Number((invoice.totalAmount - invoice.paidAmount).toFixed(2))
  );

  // Header band
  doc.setFillColor(...EMERALD_DARK);
  doc.rect(0, 0, PAGE_WIDTH, 32, 'F');
  doc.setFillColor(...EMERALD);
  doc.rect(0, 32, PAGE_WIDTH, 1.6, 'F');

  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('VERDANT MEADOW DAIRY FARM', MARGIN, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...EMERALD_LIGHT);
  doc.text('Silo Complex · Pure Farm Milk & Creamery', MARGIN, 20);
  doc.text('Lic: DL-99201-AGRI · Phone: +1 (555) 019-4488', MARGIN, 25);

  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('MILK INVOICE RECEIPT', PAGE_WIDTH - MARGIN, 14, {
    align: 'right',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(invoice.id, PAGE_WIDTH - MARGIN, 20, { align: 'right' });
  doc.text(`Issued ${pdfDate(invoice.issueDate)}`, PAGE_WIDTH - MARGIN, 25, {
    align: 'right',
  });

  // Billed-to and billing period
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...STONE_400);
  doc.text('BILLED TO', MARGIN, 42);

  doc.setFontSize(11);
  doc.setTextColor(...STONE_900);
  const buyerNameLines = doc.splitTextToSize(
    invoice.customerName,
    CONTENT_WIDTH / 2 - 6
  ) as string[];
  doc.text(buyerNameLines, MARGIN, 48);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...STONE_600);
  let buyerLine = 48 + buyerNameLines.length * 5;
  if (input.customerPhone) {
    doc.text(`Phone: ${input.customerPhone}`, MARGIN, buyerLine);
    buyerLine += 4.4;
  }
  if (input.customerRoute) {
    doc.text(`Route: ${input.customerRoute}`, MARGIN, buyerLine);
    buyerLine += 4.4;
  }
  if (input.customerAddress) {
    const addressLines = doc.splitTextToSize(
      input.customerAddress,
      CONTENT_WIDTH / 2 - 6
    ) as string[];
    doc.text(addressLines, MARGIN, buyerLine);
  }

  const rightX = PAGE_WIDTH - MARGIN;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...STONE_400);
  doc.text('BILLING PERIOD', rightX, 42, { align: 'right' });

  doc.setFontSize(10);
  doc.setTextColor(...STONE_900);
  doc.text(invoice.billingMonth, rightX, 48, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...STONE_600);
  doc.text(`Due: ${pdfDate(invoice.dueDate)}`, rightX, 53, { align: 'right' });
  doc.text(
    `Milk: ${litres(invoice.totalLiters)} L · Avg rate: INR ${money(
      invoice.ratePerLiter
    )}/L`,
    rightX,
    57.4,
    { align: 'right' }
  );
  doc.text(
    `${input.saleCount} recorded sale${input.saleCount === 1 ? '' : 's'}`,
    rightX,
    61.8,
    { align: 'right' }
  );

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, 68, PAGE_WIDTH - MARGIN, 68);

  // Sales detail table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...STONE_600);
  doc.text('MILK SALES DETAILS', MARGIN, 74);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...STONE_400);
  doc.text(
    input.dailyRows.length > 0
      ? `${input.dailyRows.length} day${
          input.dailyRows.length === 1 ? '' : 's'
        } · ${input.saleCount} recorded sale${input.saleCount === 1 ? '' : 's'}`
      : 'Billing period summary',
    MARGIN,
    78.5
  );

  const body =
    input.dailyRows.length > 0
      ? input.dailyRows.map((row) => [
          pdfDate(row.date),
          quality(row.clr, 1),
          quality(row.fat, 2),
          quality(row.snf, 2),
          `${litres(row.liters)} L`,
          `INR ${money(row.ratePerLiter)}/L`,
          `INR ${money(row.amount)}`,
        ])
      : [
          [
            'Recorded sales summary',
            '-',
            '-',
            '-',
            `${litres(invoice.totalLiters)} L`,
            `INR ${money(invoice.ratePerLiter)}/L`,
            `INR ${money(invoice.totalAmount)}`,
          ],
        ];

  const foot =
    input.dailyRows.length > 0
      ? [
          [
            'Total',
            quality(input.qualityTotals.clr, 1),
            quality(input.qualityTotals.fat, 2),
            quality(input.qualityTotals.snf, 2),
            `${litres(invoice.totalLiters)} L`,
            `INR ${money(invoice.ratePerLiter)}/L`,
            `INR ${money(invoice.totalAmount)}`,
          ],
        ]
      : undefined;

  autoTable(doc, {
    startY: 83,
    head: [['Date', 'CLR', 'Fat %', 'SNF %', 'Volume', 'Avg Rate', 'Amount']],
    body,
    foot,
    theme: 'plain',
    margin: { left: MARGIN, right: MARGIN, top: 24, bottom: 24 },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
      textColor: STONE_900,
      lineColor: BORDER,
      lineWidth: 0.1,
      overflow: 'linebreak',
    },
    headStyles: {
      fontStyle: 'bold',
      fontSize: 7.5,
      fillColor: EMERALD_SOFT,
      textColor: EMERALD_DARK,
      lineColor: BORDER,
      lineWidth: 0.1,
    },
    footStyles: {
      fontStyle: 'bold',
      fontSize: 8,
      fillColor: EMERALD_SOFT,
      textColor: STONE_900,
      lineColor: BORDER,
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { cellWidth: 34 },
      1: { cellWidth: 18, halign: 'right' },
      2: { cellWidth: 18, halign: 'right' },
      3: { cellWidth: 18, halign: 'right' },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 32, halign: 'right' },
      6: { halign: 'right' },
    },
  });

  let cursorY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 120;
  cursorY += 10;

  // Totals block, kept together on one page
  if (cursorY > PAGE_HEIGHT - 78) {
    doc.addPage();
    cursorY = 26;
  }

  const boxWidth = 78;
  const boxX = PAGE_WIDTH - MARGIN - boxWidth;

  doc.setDrawColor(...BORDER);
  doc.setFillColor(250, 250, 249);
  doc.roundedRect(boxX, cursorY - 4, boxWidth, 34, 2, 2, 'FD');

  const row = (label: string, value: string, y: number, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 9.5 : 8.5);
    doc.setTextColor(...(bold ? STONE_900 : STONE_600));
    doc.text(label, boxX + 4, y);
    doc.setTextColor(...(bold ? STONE_900 : STONE_600));
    doc.text(value, boxX + boxWidth - 4, y, { align: 'right' });
  };

  row('Subtotal', `INR ${money(invoice.totalAmount)}`, cursorY + 3);
  row('Paid to date', `- INR ${money(invoice.paidAmount)}`, cursorY + 9.5);

  doc.setDrawColor(...BORDER);
  doc.line(boxX + 4, cursorY + 14, boxX + boxWidth - 4, cursorY + 14);
  row('Balance Due', `INR ${money(balanceDue)}`, cursorY + 21, true);

  // Status note under the totals
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...STONE_600);
  const statusLabel =
    balanceDue <= 0.005
      ? 'Payment received in full. Thank you.'
      : `Payment pending: INR ${money(balanceDue)} due by ${pdfDate(
          invoice.dueDate
        )}.`;
  doc.text(statusLabel, boxX, cursorY + 42);

  // Terms / footer note
  if (cursorY + 58 < PAGE_HEIGHT - 30) {
    doc.setDrawColor(...BORDER);
    doc.line(MARGIN, cursorY + 52, PAGE_WIDTH - MARGIN, cursorY + 52);
    doc.setFontSize(7.5);
    doc.setTextColor(...STONE_400);
    doc.text(
      'Thank you for choosing pure, ethically-farmed dairy milk. Please make cheques or transfers payable to Verdant Meadow Farms.',
      MARGIN,
      cursorY + 58
    );
  }

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, FOOTER_Y - 5, PAGE_WIDTH - MARGIN, FOOTER_Y - 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...STONE_400);
    doc.text(
      'DairyFlow · Verdant Meadow Dairy Farm · Official Milk Invoice Receipt',
      MARGIN,
      FOOTER_Y
    );
    doc.text(`Page ${page} of ${pageCount}`, PAGE_WIDTH - MARGIN, FOOTER_Y, {
      align: 'right',
    });
  }

  return doc;
}

export async function downloadInvoiceReceiptPdf(
  input: InvoiceReceiptPdfInput
): Promise<void> {
  const doc = await createInvoiceReceiptDoc(input);
  doc.save(invoiceReceiptFilename(input.invoice));
}

/**
 * Opens the A4 receipt PDF in a new tab so it can be printed or saved through
 * the browser PDF viewer. Falls back to a direct download if popups are
 * blocked.
 */
export async function printInvoiceReceiptPdf(
  input: InvoiceReceiptPdfInput
): Promise<void> {
  const previewWindow =
    typeof window !== 'undefined' ? window.open('', '_blank') : null;

  try {
    const doc = await createInvoiceReceiptDoc(input);
    const url = String(doc.output('bloburl'));

    if (previewWindow) {
      previewWindow.location.href = url;
    } else {
      doc.save(invoiceReceiptFilename(input.invoice));
    }
  } catch (error) {
    previewWindow?.close();
    throw error;
  }
}
