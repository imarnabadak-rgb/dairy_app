import type { jsPDF } from 'jspdf';
import type { DashboardReportInput } from './dashboard-report';
import {
  buildDashboardReportData,
  type DailyActivityModel,
} from './dashboard-report-data';

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_Y = 286;

const EMERALD: [number, number, number] = [4, 120, 87];
const EMERALD_DARK: [number, number, number] = [6, 78, 59];
const EMERALD_SOFT: [number, number, number] = [236, 253, 245];
const STONE_900: [number, number, number] = [28, 25, 23];
const STONE_600: [number, number, number] = [87, 83, 78];
const STONE_400: [number, number, number] = [168, 162, 158];
const BORDER: [number, number, number] = [229, 231, 235];
const WHITE: [number, number, number] = [255, 255, 255];

const integerFormat = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
});
const litreFormat = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function litres(value: number): string {
  return litreFormat.format(Number.isFinite(value) ? value : 0);
}

function amount(value: number): string {
  return integerFormat.format(
    Number.isFinite(value) ? Math.round(value) : 0
  );
}

function quality(value: number | null, digits = 1): string {
  return value != null && Number.isFinite(value) ? value.toFixed(digits) : '-';
}

function monthLabel(month: string): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return month;
  return date.toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function aggregateMonthly(rows: DailyActivityModel[]): DailyActivityModel[] {
  const byMonth = new Map<
    string,
    {
      milk: number;
      fatWeighted: number;
      fatMilk: number;
      snfWeighted: number;
      snfMilk: number;
      sold: number;
      sales: number;
      expenses: number;
    }
  >();

  for (const row of rows) {
    const key = row.date.slice(0, 7);
    const record = byMonth.get(key) ?? {
      milk: 0,
      fatWeighted: 0,
      fatMilk: 0,
      snfWeighted: 0,
      snfMilk: 0,
      sold: 0,
      sales: 0,
      expenses: 0,
    };

    record.milk += row.milk;
    record.sold += row.sold;
    record.sales += row.sales;
    record.expenses += row.expenses;
    if (row.fat != null && row.milk > 0) {
      record.fatWeighted += row.fat * row.milk;
      record.fatMilk += row.milk;
    }
    if (row.snf != null && row.milk > 0) {
      record.snfWeighted += row.snf * row.milk;
      record.snfMilk += row.milk;
    }
    byMonth.set(key, record);
  }

  return Array.from(byMonth.entries())
    .sort(([monthA], [monthB]) => monthA.localeCompare(monthB))
    .map(([month, record]) => ({
      date: monthLabel(month),
      milk: record.milk,
      fat: record.fatMilk > 0 ? record.fatWeighted / record.fatMilk : null,
      snf: record.snfMilk > 0 ? record.snfWeighted / record.snfMilk : null,
      sold: record.sold,
      sales: record.sales,
      expenses: record.expenses,
    }));
}

function drawPageHeader(doc: jsPDF, periodRangeLabel: string): void {
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, 16, PAGE_WIDTH - MARGIN, 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...EMERALD_DARK);
  doc.text('Verdant Meadow Dairy Farm', MARGIN, 11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...STONE_600);
  doc.text('Farm Management Report', MARGIN + 44, 11);
  doc.text(periodRangeLabel, PAGE_WIDTH - MARGIN, 11, { align: 'right' });
}

function ensureSpace(
  doc: jsPDF,
  y: number,
  needed: number,
  periodRangeLabel: string
): number {
  if (y + needed <= PAGE_HEIGHT - 22) return y;
  doc.addPage();
  drawPageHeader(doc, periodRangeLabel);
  return 24;
}

function fitText(doc: jsPDF, text: string, maxWidth: number, startSize: number): number {
  let size = startSize;
  doc.setFontSize(size);
  while (size > 7 && doc.getTextWidth(text) > maxWidth) {
    size -= 0.5;
    doc.setFontSize(size);
  }
  return size;
}

function sectionTitle(doc: jsPDF, y: number, title: string): number {
  doc.setFillColor(...EMERALD);
  doc.roundedRect(MARGIN, y - 3.2, 2.2, 4.4, 0.8, 0.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...STONE_900);
  doc.text(title, MARGIN + 5, y);
  return y + 5;
}

function emptyNote(doc: jsPDF, y: number, text: string): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...STONE_600);
  doc.text(text, MARGIN, y);
  return y + 8;
}

export async function downloadDashboardReportPdf(
  input: DashboardReportInput,
  filename: string
): Promise<void> {
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
  const data = buildDashboardReportData(input);
  const summary = input.summary;
  const totals = data.buyers.reduce(
    (acc, buyer) => {
      acc.liters += buyer.liters;
      acc.amount += buyer.amount;
      acc.paid += buyer.paid;
      acc.pending += buyer.pending;
      return acc;
    },
    { liters: 0, amount: 0, paid: 0, pending: 0 }
  );

  // Header band
  doc.setFillColor(...EMERALD_DARK);
  doc.rect(0, 0, PAGE_WIDTH, 34, 'F');
  doc.setFillColor(...EMERALD);
  doc.rect(0, 34, PAGE_WIDTH, 1.6, 'F');

  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('VERDANT MEADOW DAIRY FARM', MARGIN, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(209, 250, 229);
  doc.text('Farm Management Report', MARGIN, 21);
  doc.setFontSize(8);
  doc.text('Owner monitoring summary', MARGIN, 27);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...WHITE);
  doc.text(input.periodLabel, PAGE_WIDTH - MARGIN, 14, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(209, 250, 229);
  doc.text(input.periodRangeLabel, PAGE_WIDTH - MARGIN, 20, {
    align: 'right',
  });
  doc.setFontSize(7.5);
  doc.text(
    `Generated ${new Date(input.generatedAt).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`,
    PAGE_WIDTH - MARGIN,
    26,
    { align: 'right' }
  );

  let y = 43;

  // KPI cards
  const cardGap = 4;
  const cardWidth = (CONTENT_WIDTH - cardGap * 3) / 4;
  const cardHeight = 23;
  const cards: Array<{
    label: string;
    value: string;
    hint: string;
    highlight?: boolean;
  }> = [
    {
      label: 'MILK PRODUCED (L)',
      value: litres(summary.totalMilk),
      hint: `${litres(summary.avgMilkPerDay)} L/day avg`,
    },
    {
      label: 'MILK SOLD (L)',
      value: litres(summary.milkSold),
      hint: `INR ${amount(summary.salesValue)} sales`,
    },
    {
      label: 'REVENUE COLLECTED',
      value: `INR ${amount(summary.revenueCollected)}`,
      hint: `INR ${amount(summary.invoicedRevenue)} invoiced`,
    },
    {
      label: 'NET PROFIT',
      value: `INR ${amount(summary.netProfit)}`,
      hint: `${summary.profitMargin.toFixed(0)}% margin`,
      highlight: true,
    },
  ];

  cards.forEach((card, index) => {
    const x = MARGIN + index * (cardWidth + cardGap);
    doc.setFillColor(...(card.highlight ? EMERALD_SOFT : WHITE));
    doc.setDrawColor(...(card.highlight ? EMERALD : BORDER));
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cardWidth, cardHeight, 1.6, 1.6, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.6);
    doc.setTextColor(...STONE_600);
    doc.text(card.label, x + 3.5, y + 6);

    doc.setTextColor(...(card.highlight ? EMERALD_DARK : STONE_900));
    fitText(doc, card.value, cardWidth - 7, 13);
    doc.text(card.value, x + 3.5, y + 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...STONE_600);
    doc.text(card.hint, x + 3.5, y + 19.6);
  });

  y += cardHeight + 7;

  // Herd & quality strip
  doc.setFillColor(248, 250, 249);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 10, 1.4, 1.4, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  doc.setTextColor(...STONE_600);
  doc.text('HERD', MARGIN + 4, y + 6.3);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...STONE_900);
  doc.text(
    `${summary.lactatingCount} lactating  ·  ${summary.pregnantCount} pregnant  ·  ${summary.dryCount} dry  ·  ${summary.withdrawalCount} in withdrawal`,
    MARGIN + 16,
    y + 6.3
  );
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...STONE_600);
  doc.text('QUALITY', MARGIN + 105, y + 6.3);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...STONE_900);
  doc.text(
    `Fat ${quality(summary.avgFat, 2)}%  ·  SNF ${quality(
      summary.avgSnf,
      2
    )}%  ·  CLR ${summary.avgClr || '-'}`,
    MARGIN + 122,
    y + 6.3
  );

  y += 18;

  // Cow-wise production
  y = ensureSpace(doc, y, 34, input.periodRangeLabel);
  y = sectionTitle(doc, y, 'Milk Production by Cow');
  if (data.cows.length === 0) {
    y = emptyNote(doc, y, 'No milk production recorded for this period.');
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN, top: 22 },
      theme: 'grid',
      head: [['Cow', 'Breed', 'Days', 'Milk (L)', 'Avg/day', 'Fat %', 'SNF %']],
      body: data.cows.map((cow) => [
        `${cow.cowTag}${cow.cowName && cow.cowName !== cow.cowTag ? ` · ${cow.cowName}` : ''}`,
        cow.breed || '-',
        String(cow.days),
        litres(cow.liters),
        litres(cow.avgLitersPerDay),
        quality(cow.fat),
        quality(cow.snf),
      ]),
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 1.9,
        textColor: STONE_900,
        lineColor: BORDER,
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: EMERALD,
        textColor: WHITE,
        fontStyle: 'bold',
        fontSize: 7.8,
        cellPadding: 2,
      },
      alternateRowStyles: { fillColor: [249, 250, 249] },
      columnStyles: {
        0: { cellWidth: 44 },
        1: { cellWidth: 30 },
        2: { cellWidth: 14, halign: 'right' },
        3: { cellWidth: 26, halign: 'right' },
        4: { cellWidth: 24, halign: 'right' },
        5: { cellWidth: 22, halign: 'right' },
        6: { cellWidth: 22, halign: 'right' },
      },
      didDrawPage: (hook) => {
        if (hook.pageNumber > 1) drawPageHeader(doc, input.periodRangeLabel);
      },
    });
    y = (doc as jsPDF & { lastAutoTable?: { finalY: number } })
      .lastAutoTable!.finalY + 7;
  }

  // Buyer-wise sales
  y = ensureSpace(doc, y, 34, input.periodRangeLabel);
  y = sectionTitle(doc, y, 'Milk Sales by Buyer');
  if (data.buyers.length === 0) {
    y = emptyNote(doc, y, 'No milk sales recorded for this period.');
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN, top: 22 },
      theme: 'grid',
      head: [['Buyer', 'Litres', 'Avg Rate', 'Amount (INR)', 'Paid', 'Pending']],
      body: data.buyers.map((buyer) => [
        buyer.buyerName,
        litres(buyer.liters),
        `${buyer.avgRate.toFixed(2)}`,
        amount(buyer.amount),
        amount(buyer.paid),
        amount(buyer.pending),
      ]),
      foot: [
        [
          'Total',
          litres(totals.liters),
          totals.liters > 0 ? (totals.amount / totals.liters).toFixed(2) : '-',
          amount(totals.amount),
          amount(totals.paid),
          amount(totals.pending),
        ],
      ],
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 1.9,
        textColor: STONE_900,
        lineColor: BORDER,
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: EMERALD,
        textColor: WHITE,
        fontStyle: 'bold',
        fontSize: 7.8,
        cellPadding: 2,
      },
      footStyles: {
        fillColor: EMERALD_SOFT,
        textColor: EMERALD_DARK,
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 2,
      },
      alternateRowStyles: { fillColor: [249, 250, 249] },
      columnStyles: {
        0: { cellWidth: 56 },
        1: { cellWidth: 22, halign: 'right' },
        2: { cellWidth: 24, halign: 'right' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 24, halign: 'right' },
        5: { cellWidth: 26, halign: 'right' },
      },
      didDrawPage: (hook) => {
        if (hook.pageNumber > 1) drawPageHeader(doc, input.periodRangeLabel);
      },
    });
    y = (doc as jsPDF & { lastAutoTable?: { finalY: number } })
      .lastAutoTable!.finalY + 7;
  }

  // Daily or monthly farm activity
  const monthly = data.dailyActivity.length > 45;
  const activityRows = monthly
    ? aggregateMonthly(data.dailyActivity)
    : data.dailyActivity;

  y = ensureSpace(doc, y, 34, input.periodRangeLabel);
  y = sectionTitle(
    doc,
    y,
    monthly ? 'Monthly Farm Activity' : 'Daily Farm Activity'
  );
  if (activityRows.length === 0) {
    y = emptyNote(doc, y, 'No activity recorded for this period.');
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN, top: 22 },
      theme: 'grid',
      head: [
        [
          monthly ? 'Month' : 'Date',
          'Milk (L)',
          'Fat %',
          'SNF %',
          'Sold (L)',
          'Sales (INR)',
          'Expenses (INR)',
        ],
      ],
      body: activityRows.map((row) => [
        monthly ? row.date : row.date.split('-').reverse().join('/'),
        litres(row.milk),
        quality(row.fat),
        quality(row.snf),
        litres(row.sold),
        amount(row.sales),
        amount(row.expenses),
      ]),
      styles: {
        font: 'helvetica',
        fontSize: 7.8,
        cellPadding: 1.7,
        textColor: STONE_900,
        lineColor: BORDER,
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: EMERALD,
        textColor: WHITE,
        fontStyle: 'bold',
        fontSize: 7.6,
        cellPadding: 2,
      },
      alternateRowStyles: { fillColor: [249, 250, 249] },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 24, halign: 'right' },
        2: { cellWidth: 18, halign: 'right' },
        3: { cellWidth: 18, halign: 'right' },
        4: { cellWidth: 24, halign: 'right' },
        5: { cellWidth: 32, halign: 'right' },
        6: { cellWidth: 34, halign: 'right' },
      },
      didDrawPage: (hook) => {
        if (hook.pageNumber > 1) drawPageHeader(doc, input.periodRangeLabel);
      },
    });
    y = (doc as jsPDF & { lastAutoTable?: { finalY: number } })
      .lastAutoTable!.finalY + 7;
  }

  // Expenses by category
  y = ensureSpace(doc, y, 34, input.periodRangeLabel);
  y = sectionTitle(doc, y, 'Where the Money Went');
  if (data.expenseCategories.length === 0) {
    y = emptyNote(doc, y, 'No farm expenses recorded for this period.');
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN, top: 22 },
      theme: 'grid',
      head: [['Expense Category', 'Amount (INR)', 'Share']],
      body: data.expenseCategories.map((category) => [
        category.category,
        amount(category.amount),
        `${category.share.toFixed(1)}%`,
      ]),
      foot: [['Total Expenses', amount(summary.totalExpenses), '100%']],
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 2,
        textColor: STONE_900,
        lineColor: BORDER,
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: EMERALD,
        textColor: WHITE,
        fontStyle: 'bold',
        fontSize: 7.8,
        cellPadding: 2,
      },
      footStyles: {
        fillColor: EMERALD_SOFT,
        textColor: EMERALD_DARK,
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 2,
      },
      alternateRowStyles: { fillColor: [249, 250, 249] },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 46, halign: 'right' },
        2: { cellWidth: 36, halign: 'right' },
      },
      didDrawPage: (hook) => {
        if (hook.pageNumber > 1) drawPageHeader(doc, input.periodRangeLabel);
      },
    });
    y = (doc as jsPDF & { lastAutoTable?: { finalY: number } })
      .lastAutoTable!.finalY + 8;
  }

  // Bottom line: revenue, expenses, profit. If the full block does not fit,
  // fall back to a compact strip so short reports stay on one page.
  const compactPnl =
    y + 52 > PAGE_HEIGHT - 22 && y + 32 <= PAGE_HEIGHT - 16;
  if (!compactPnl) {
    y = ensureSpace(doc, y, 52, input.periodRangeLabel);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...STONE_600);
  doc.text('FARM P&L FOR THE PERIOD', MARGIN, y);
  y += 4;

  const boxGap = 4;
  const boxWidth = (CONTENT_WIDTH - boxGap * 3) / 4;
  const boxHeight = compactPnl ? 18 : 23;
  const boxes: Array<{
    label: string;
    value: string;
    hint: string;
    tone: 'neutral' | 'profit' | 'loss';
  }> = [
    {
      label: 'REVENUE',
      value: `INR ${amount(summary.revenueCollected)}`,
      hint: `INR ${amount(summary.invoicedRevenue)} invoiced`,
      tone: 'neutral',
    },
    {
      label: 'EXPENSES',
      value: `INR ${amount(summary.totalExpenses)}`,
      hint: `${summary.expenseCount} expense entr${summary.expenseCount === 1 ? 'y' : 'ies'}`,
      tone: 'neutral',
    },
    {
      label: summary.netProfit >= 0 ? 'NET PROFIT' : 'NET LOSS',
      value: `INR ${amount(Math.abs(summary.netProfit))}`,
      hint: `${summary.profitMargin.toFixed(0)}% margin`,
      tone: summary.netProfit >= 0 ? 'profit' : 'loss',
    },
    {
      label: 'OUTSTANDING',
      value: `INR ${amount(data.pendingSalesValue)}`,
      hint: 'Unpaid milk sales',
      tone: 'neutral',
    },
  ];

  boxes.forEach((box, index) => {
    const x = MARGIN + index * (boxWidth + boxGap);
    const fill =
      box.tone === 'profit'
        ? EMERALD
        : box.tone === 'loss'
          ? ([254, 242, 242] as [number, number, number])
          : WHITE;
    const border =
      box.tone === 'profit'
        ? EMERALD
        : box.tone === 'loss'
          ? ([254, 202, 202] as [number, number, number])
          : BORDER;
    const valueColor =
      box.tone === 'profit'
        ? WHITE
        : box.tone === 'loss'
          ? ([153, 27, 27] as [number, number, number])
          : STONE_900;
    const labelColor =
      box.tone === 'profit' ? ([209, 250, 229] as [number, number, number]) : STONE_600;
    const hintColor =
      box.tone === 'profit' ? ([209, 250, 229] as [number, number, number]) : STONE_600;

    doc.setFillColor(...fill);
    doc.setDrawColor(...border);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, boxWidth, boxHeight, 1.6, 1.6, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.6);
    doc.setTextColor(...labelColor);
    doc.text(box.label, x + 3.5, y + (compactPnl ? 5 : 6));

    doc.setTextColor(...valueColor);
    fitText(doc, box.value, boxWidth - 7, compactPnl ? 10.5 : 11.5);
    doc.text(box.value, x + 3.5, y + (compactPnl ? 11.6 : 14));

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.6);
    doc.setTextColor(...hintColor);
    doc.text(box.hint, x + 3.5, y + (compactPnl ? 16 : 19.6));
  });

  y += boxHeight + (compactPnl ? 4 : 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(...STONE_600);
  doc.text(
    `Milk sales ${amount(summary.salesValue)} INR  ·  Paid sales ${amount(
      summary.paidSalesValue
    )} INR  ·  Withheld milk ${litres(summary.withheldMilk)} L  ·  Feed stock ${amount(
      summary.feedStockKg
    )} kg`,
    MARGIN,
    y
  );

  // Footers
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
      'DairyFlow · Verdant Meadow Dairy Farm · Farm Management Report',
      MARGIN,
      FOOTER_Y
    );
    doc.text(`Page ${page} of ${pageCount}`, PAGE_WIDTH - MARGIN, FOOTER_Y, {
      align: 'right',
    });
  }

  doc.save(filename);
}
