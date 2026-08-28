import { Transaction } from '../types';
import { format } from 'date-fns';

export interface GroupedStatementRow {
  date: number;
  invoiceNo?: string;
  type: string;
  typeLabel: string;
  notes?: string;
  amount: number;
}

export interface StatementOptions {
  isCompany?: boolean;
  roleTitle?: string;
}

export function generateStatementHtml(entityName: string, transactions: Transaction[], options?: StatementOptions): string {
  const sorted = [...transactions].sort((a, b) => a.date - b.date);

  const isCompany = options?.isCompany ?? (options?.roleTitle === 'کۆمپانیا');
  const pageTitle = isCompany ? `حساباتی کۆمپانیا - ${entityName}` : `کەشف حیساب - ${entityName}`;
  const headerSubtitle = isCompany ? `حساباتی دارایی کۆمپانیا: ${entityName}` : `کەشف حیساب - ${entityName}`;

  let totalDebt = 0;
  let totalPaid = 0;
  let totalCash = 0;

  const groupedMap = new Map<string, GroupedStatementRow>();
  const individualRows: GroupedStatementRow[] = [];

  sorted.forEach((t) => {
    let typeLabel = '';
    if (t.type.includes('debt') && !t.type.includes('paid')) {
      typeLabel = 'قەرز';
      totalDebt += t.amount || 0;
    } else if (t.type.includes('paid')) {
      typeLabel = 'واسڵکراو';
      totalPaid += t.amount || 0;
    } else {
      typeLabel = 'نەقد';
      totalCash += t.amount || 0;
    }

    const cleanInvoice = t.invoiceNo?.trim();

    if (cleanInvoice) {
      const invKey = `${t.type}_${cleanInvoice}`;
      if (groupedMap.has(invKey)) {
        const existing = groupedMap.get(invKey)!;
        existing.amount += t.amount || 0;
        if (t.date > existing.date) existing.date = t.date;
      } else {
        groupedMap.set(invKey, {
          date: t.date,
          invoiceNo: cleanInvoice,
          type: t.type,
          typeLabel,
          notes: t.type.includes('paid') ? 'واسڵکردنی قەرز' : undefined,
          amount: t.amount || 0,
        });
      }
    } else {
      individualRows.push({
        date: t.date,
        invoiceNo: undefined,
        type: t.type,
        typeLabel,
        notes: t.description || (t.type.includes('paid') ? 'واسڵکراو' : '-'),
        amount: t.amount || 0,
      });
    }
  });

  const finalRows: GroupedStatementRow[] = [
    ...Array.from(groupedMap.values()),
    ...individualRows
  ];

  finalRows.sort((a, b) => a.date - b.date);

  const rowsHtml = finalRows
    .map((r, idx) => {
      let badgeStyle = 'background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;';
      if (r.typeLabel === 'قەرز') badgeStyle = 'background:#fef3c7;color:#92400e;border:1px solid #fde68a;';
      if (r.typeLabel === 'واسڵکراو') badgeStyle = 'background:#dcfce7;color:#166534;border:1px solid #bbf7d0;';
      if (r.typeLabel === 'نەقد') badgeStyle = 'background:#e0e7ff;color:#3730a3;border:1px solid #c7d2fe;';

      const invoiceDisplay = r.invoiceNo ? `<span style="font-weight:bold;color:#4338ca;font-family:monospace;font-size:14px;">#${r.invoiceNo}</span>` : `<span style="color:#94a3b8;">-</span>`;

      return `<tr>
        <td style="text-align:center;font-weight:bold;color:#64748b;">${idx + 1}</td>
        <td dir="ltr" style="text-align:center;white-space:nowrap;">${invoiceDisplay}</td>
        <td dir="ltr" style="text-align:center;white-space:nowrap;font-size:13px;">${format(r.date, 'yyyy-MM-dd HH:mm')}</td>
        <td style="text-align:center;"><span style="display:inline-block;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:bold;${badgeStyle}">${r.typeLabel}</span></td>
        <td dir="ltr" style="text-align:left;font-weight:bold;font-size:14px;color:${r.typeLabel === 'قەرز' ? '#b45309' : (r.typeLabel === 'واسڵکراو' ? '#15803d' : '#3730a3')};">
          ${(r.amount || 0).toLocaleString()} د.ع
        </td>
      </tr>`;
    })
    .join('');

  const finalBalance = totalDebt - totalPaid;

  return `
    <html dir="rtl">
      <head>
        <title>${pageTitle}</title>
        <meta charset="utf-8" />
        <style>
          body { font-family: Tahoma, 'Segoe UI', Arial, sans-serif; padding: 24px; color: #1e293b; line-height: 1.5; background: #fff; }
          .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; }
          .header h2 { margin: 0 0 6px 0; color: #1e1b4b; font-size: 24px; }
          .header h3 { margin: 0 0 6px 0; color: #4338ca; font-size: 18px; }
          .header p { margin: 0; font-size: 12px; color: #64748b; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; text-align: right; }
          th { background-color: #f1f5f9; color: #334155; font-weight: bold; border: 1px solid #cbd5e1; padding: 10px 12px; font-size: 13px; text-align: center; }
          td { border: 1px solid #e2e8f0; padding: 10px 14px; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .summary { margin-top: 24px; padding: 18px; border: 2px solid #cbd5e1; border-radius: 12px; background: #f8fafc; }
          .summary-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
          .summary-total { border-top: 2px solid #cbd5e1; padding-top: 10px; margin-top: 10px; font-size: 18px; font-weight: bold; color: ${finalBalance > 0 ? '#b91c1c' : '#15803d'}; }
          @media print {
            body { padding: 10px; }
            @page { margin: 15mm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>کۆمپانیای RF</h2>
          <h3>${headerSubtitle}</h3>
          <p>بەرواری چاپ: <span dir="ltr">${format(Date.now(), 'yyyy-MM-dd HH:mm')}</span></p>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 45px;">#</th>
              <th style="width: 140px;">ژمارەی وەسڵ</th>
              <th style="width: 160px;">بەروار و کات</th>
              <th style="width: 110px;">جۆری مامەڵە</th>
              <th style="width: 160px; text-align: left;">بڕی پارە</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="5" style="text-align:center;padding:20px;color:#94a3b8;">هیچ تۆمارێک نەدۆزرایەوە</td></tr>'}
          </tbody>
        </table>
        <div class="summary">
          <div class="summary-row">
            <span>کۆی قەرزەکان:</span>
            <span dir="ltr" style="font-weight:bold;color:#b45309;">${totalDebt.toLocaleString()} د.ع</span>
          </div>
          <div class="summary-row">
            <span>کۆی واسڵکراو (دراوە):</span>
            <span dir="ltr" style="font-weight:bold;color:#166534;">${totalPaid.toLocaleString()} د.ع</span>
          </div>
          <div class="summary-row">
            <span>کۆی نەقد:</span>
            <span dir="ltr" style="font-weight:bold;color:#4338ca;">${totalCash.toLocaleString()} د.ع</span>
          </div>
          <div class="summary-row summary-total">
            <span>ماوەی باڵانس (قەرز):</span>
            <span dir="ltr">${finalBalance.toLocaleString()} د.ع</span>
          </div>
        </div>
        <script>
          window.onload = () => window.print();
        </script>
      </body>
    </html>
  `;
}

export function printStatementPopup(entityName: string, transactions: Transaction[], options?: StatementOptions) {
  const html = generateStatementHtml(entityName, transactions, options);
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

export interface PaymentReceiptData {
  entityName: string;
  roleTitle?: string;
  invoiceNo?: string;
  originalDebtAmount: number;
  paidAmount: number;
  remainingDebtAmount: number;
  date: number;
  description?: string;
}

export function generatePaymentReceiptHtml(data: PaymentReceiptData): string {
  const role = data.roleTitle || 'کۆمپانیا';
  return `
    <html dir="rtl">
      <head>
        <title>پسوڵەی واسڵکردن - ${data.entityName}</title>
        <meta charset="utf-8" />
        <style>
          body { font-family: Tahoma, 'Segoe UI', Arial, sans-serif; padding: 24px; color: #1e293b; line-height: 1.5; background: #fff; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #059669; padding-bottom: 12px; }
          .header h2 { margin: 0 0 4px 0; color: #064e3b; font-size: 24px; }
          .header h3 { margin: 0; color: #059669; font-size: 17px; font-weight: bold; }
          .header p { margin: 4px 0 0 0; font-size: 12px; color: #64748b; }
          
          .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 20px; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
          .info-row:last-child { margin-bottom: 0; }
          .label { color: #64748b; font-weight: 500; }
          .value { font-weight: bold; color: #0f172a; }
          
          .amount-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .amount-table th { background: #f1f5f9; padding: 10px 14px; text-align: right; border: 1px solid #cbd5e1; font-size: 13px; color: #334155; }
          .amount-table td { padding: 12px 14px; border: 1px solid #e2e8f0; font-size: 14px; }
          
          .badge-paid { color: #166534; font-weight: bold; font-size: 18px; }
          .badge-rem { color: #b45309; font-weight: bold; font-size: 18px; }
          
          .notes { background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #92400e; margin-bottom: 24px; }
          
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 10px; }
          .sig-block { text-align: center; }
          .sig-line { margin-top: 35px; border-top: 1px dashed #64748b; width: 160px; }
          
          @media print {
            body { padding: 10px; }
            @page { margin: 15mm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>کۆمپانیای RF</h2>
          <h3>پسوڵەی واسڵکردنی قەرز (پاردانەوە)</h3>
          <p>بەرواری چاپ: <span dir="ltr">${format(Date.now(), 'yyyy-MM-dd HH:mm')}</span></p>
        </div>

        <div class="info-box">
          <div class="info-row">
            <span class="label">ناوی ${role}:</span>
            <span class="value">${data.entityName}</span>
          </div>
          ${data.invoiceNo ? `
          <div class="info-row">
            <span class="label">ژمارەی سەر وەسڵ:</span>
            <span class="value" dir="ltr" style="font-family:monospace;color:#059669;">#${data.invoiceNo}</span>
          </div>
          ` : ''}
          <div class="info-row">
            <span class="label">بەرواری واسڵکردن:</span>
            <span class="value" dir="ltr">${format(data.date, 'yyyy-MM-dd HH:mm')}</span>
          </div>
        </div>

        <table class="amount-table">
          <thead>
            <tr>
              <th>وردەکاری حیساب</th>
              <th style="text-align: left; width: 180px;">بڕی پارە</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>کۆی قەرزی سەر وەسڵەکە (یان قەرزی پێشوو)</strong></td>
              <td dir="ltr" style="text-align: left; font-weight: bold; color: #334155; font-size: 15px;">
                ${data.originalDebtAmount.toLocaleString()} د.ع
              </td>
            </tr>
            <tr style="background: #f0fdf4;">
              <td><strong style="color: #166534;">بڕی پارەی واسڵکراو (دراوە لەم پسوڵەیەدا)</strong></td>
              <td dir="ltr" style="text-align: left;" class="badge-paid">
                ${data.paidAmount.toLocaleString()} د.ع
              </td>
            </tr>
            <tr style="background: #fffbeb;">
              <td><strong style="color: #b45309;">بڕی ماوە لەسەر ئەم وەسڵە (قەرزی ئێستا)</strong></td>
              <td dir="ltr" style="text-align: left;" class="badge-rem">
                ${data.remainingDebtAmount.toLocaleString()} د.ع
              </td>
            </tr>
          </tbody>
        </table>

        ${data.description ? `
        <div class="notes">
          <strong>تێبینی:</strong> ${data.description}
        </div>
        ` : ''}

        <div class="signatures">
          <div class="sig-block">
            <div>واژووی ڕادەستکەر (پێدەر)</div>
            <div class="sig-line"></div>
          </div>
          <div class="sig-block">
            <div>واژووی وەرگر (کۆمپانیای RF)</div>
            <div class="sig-line"></div>
          </div>
        </div>

        <script>
          window.onload = () => window.print();
        </script>
      </body>
    </html>
  `;
}

export function printPaymentReceiptPopup(data: PaymentReceiptData) {
  const html = generatePaymentReceiptHtml(data);
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

export interface DailyRepActivityData {
  repName: string;
  roleTitle: string; // 'مەندووب' or 'کاشڤان'
  date: number;
  sales: {
    id: string;
    marketName: string;
    invoiceNo?: string;
    amount: number;
    paymentType: string; // 'نەقد' or 'قەرز'
    itemsSummary?: string;
    giftsSummary?: string;
  }[];
  collections: {
    id: string;
    marketName: string;
    invoiceNo?: string;
    amount: number;
    notes?: string;
  }[];
  gifts?: {
    id?: string;
    marketName: string;
    invoiceNo?: string;
    name: string;
    quantity: number;
    unit?: string;
  }[];
}

export function generateDailyRepReceiptHtml(data: DailyRepActivityData): string {
  const totalCashSales = data.sales.filter(s => s.paymentType.includes('نەقد')).reduce((sum, s) => sum + s.amount, 0);
  const totalDebtSales = data.sales.filter(s => s.paymentType.includes('قەرز')).reduce((sum, s) => sum + s.amount, 0);
  const totalSalesAmount = totalCashSales + totalDebtSales;
  const totalCollectedDebt = data.collections.reduce((sum, c) => sum + c.amount, 0);
  const totalCashInHand = totalCashSales + totalCollectedDebt;

  const totalGiftItemsCount = (data.gifts || []).reduce((sum, g) => sum + (g.quantity || 0), 0);

  const salesRowsHtml = data.sales.map((s, idx) => `
    <tr>
      <td style="text-align:center;font-weight:bold;color:#64748b;">${idx + 1}</td>
      <td style="font-weight:bold;color:#0f172a;">${s.marketName}</td>
      <td dir="ltr" style="text-align:center;font-family:monospace;font-size:13px;color:#4338ca;">${s.invoiceNo ? `#${s.invoiceNo}` : '-'}</td>
      <td style="text-align:center;">
        <span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:bold;${s.paymentType.includes('نەقد') ? 'background:#dcfce7;color:#166534;' : 'background:#fef3c7;color:#92400e;'}">
          ${s.paymentType}
        </span>
      </td>
      <td dir="ltr" style="text-align:left;font-weight:bold;color:#0f172a;">${s.amount.toLocaleString()} د.ع</td>
    </tr>
  `).join('') || '<tr><td colspan="5" style="text-align:center;padding:12px;color:#94a3b8;">هیچ فرۆشتنێک لەم بەروارەدا تۆمار نەکراوە</td></tr>';

  const collectionRowsHtml = data.collections.map((c, idx) => `
    <tr>
      <td style="text-align:center;font-weight:bold;color:#64748b;">${idx + 1}</td>
      <td style="font-weight:bold;color:#0f172a;">${c.marketName}</td>
      <td dir="ltr" style="text-align:center;font-family:monospace;font-size:13px;color:#059669;">${c.invoiceNo ? `#${c.invoiceNo}` : '-'}</td>
      <td style="color:#64748b;font-size:13px;">${c.notes || 'وەرگرتنەوەی قەرز'}</td>
      <td dir="ltr" style="text-align:left;font-weight:bold;color:#166534;">${c.amount.toLocaleString()} د.ع</td>
    </tr>
  `).join('') || '<tr><td colspan="5" style="text-align:center;padding:12px;color:#94a3b8;">هیچ قەرزێک لەم بەروارەدا وەرنەگیراوەتەوە</td></tr>';

  const giftRowsHtml = (data.gifts && data.gifts.length > 0) ? data.gifts.map((g, idx) => `
    <tr style="background: #fefce8;">
      <td style="text-align:center;font-weight:bold;color:#854d0e;">${idx + 1}</td>
      <td style="font-weight:bold;color:#713f12;">🎁 ${g.name}</td>
      <td style="text-align:center;font-weight:bold;color:#854d0e;">${g.quantity} ${g.unit === 'packet' ? 'پاکەت' : 'کارتۆن'}</td>
      <td style="font-weight:medium;color:#334155;">${g.marketName}</td>
      <td dir="ltr" style="text-align:center;font-family:monospace;font-size:13px;color:#a16207;">${g.invoiceNo ? `#${g.invoiceNo}` : '-'}</td>
    </tr>
  `).join('') : '';

  return `
    <html dir="rtl">
      <head>
        <title>وەسڵی ڕۆژانەی ${data.roleTitle} - ${data.repName}</title>
        <meta charset="utf-8" />
        <style>
          body { font-family: Tahoma, 'Segoe UI', Arial, sans-serif; padding: 24px; color: #1e293b; line-height: 1.5; background: #fff; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #3b82f6; padding-bottom: 12px; }
          .header h2 { margin: 0 0 4px 0; color: #1e3a8a; font-size: 24px; }
          .header h3 { margin: 0; color: #2563eb; font-size: 17px; font-weight: bold; }
          .header p { margin: 4px 0 0 0; font-size: 12px; color: #64748b; }
          
          .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 20px; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 14px; }
          .info-row:last-child { margin-bottom: 0; }
          .label { color: #64748b; font-weight: 500; }
          .value { font-weight: bold; color: #0f172a; }

          .section-title { font-size: 16px; font-weight: bold; color: #1e293b; margin: 18px 0 8px 0; display: flex; items-center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
          
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th { background: #f1f5f9; padding: 8px 12px; text-align: right; border: 1px solid #cbd5e1; font-size: 13px; color: #334155; }
          td { padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 13px; }
          
          .summary-box { background: #f0fdf4; border: 2px solid #86efac; border-radius: 12px; padding: 16px; margin: 24px 0; }
          .summary-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
          .total-highlight { border-top: 2px dashed #4ade80; padding-top: 10px; margin-top: 10px; font-size: 18px; font-weight: bold; color: #166534; }
          
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 10px; }
          .sig-block { text-align: center; }
          .sig-line { margin-top: 35px; border-top: 1px dashed #64748b; width: 160px; }
          
          @media print {
            body { padding: 10px; }
            @page { margin: 15mm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>کۆمپانیای RF</h2>
          <h3>وەسڵی ڕۆژانەی کار و حساباتی ${data.roleTitle}</h3>
          <p>بەرواری چاپ: <span dir="ltr">${format(Date.now(), 'yyyy-MM-dd HH:mm')}</span></p>
        </div>

        <div class="info-box">
          <div class="info-row">
            <span class="label">ناوی ${data.roleTitle}:</span>
            <span class="value">${data.repName}</span>
          </div>
          <div class="info-row">
            <span class="label">بەرواری کار:</span>
            <span class="value" dir="ltr">${format(data.date, 'yyyy-MM-dd')}</span>
          </div>
        </div>

        <div class="section-title">
          <span>📦 لیستی فرۆشتنەکانی ئەمڕۆ (${data.sales.length} وەسڵ)</span>
          <span dir="ltr" style="font-size: 14px; color: #4338ca;">کۆی فرۆش: ${totalSalesAmount.toLocaleString()} د.ع</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">#</th>
              <th>ناوی مارکێت / شوێن</th>
              <th style="width: 130px; text-align: center;">ژمارەی وەسڵ</th>
              <th style="width: 100px; text-align: center;">جۆری پارەدان</th>
              <th style="width: 140px; text-align: left;">بڕی پارە</th>
            </tr>
          </thead>
          <tbody>
            ${salesRowsHtml}
          </tbody>
        </table>

        <div class="section-title">
          <span>💰 لیستی قەرزە وەرگیراوەکان لە مارکێتەکان (${data.collections.length} پسوڵە)</span>
          <span dir="ltr" style="font-size: 14px; color: #166534;">کۆی قەرزی وەرگیراو: ${totalCollectedDebt.toLocaleString()} د.ع</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">#</th>
              <th>ناوی مارکێت / کڕیار</th>
              <th style="width: 130px; text-align: center;">ژمارەی وەسڵ</th>
              <th>تێبینی / وردەکاری</th>
              <th style="width: 140px; text-align: left;">بڕی پارە</th>
            </tr>
          </thead>
          <tbody>
            ${collectionRowsHtml}
          </tbody>
        </table>

        ${(data.gifts && data.gifts.length > 0) ? `
        <div class="section-title" style="color: #854d0e; border-bottom: 2px solid #fde047;">
          <span>🎁 لیستی کاڵا و بڕی هەدیە دراوەکان (${totalGiftItemsCount} دانە)</span>
          <span style="font-size: 13px; background: #fef08a; color: #713f12; padding: 2px 8px; border-radius: 6px; font-weight: bold;">تێچووی وەرگیراو: ٠ د.ع</span>
        </div>
        <table>
          <thead>
            <tr style="background: #fef9c3;">
              <th style="width: 40px; text-align: center; color: #854d0e;">#</th>
              <th style="text-align: right; color: #854d0e;">ناوی کاڵای هەدیە</th>
              <th style="width: 120px; text-align: center; color: #854d0e;">بڕی هەدیە</th>
              <th style="text-align: right; color: #854d0e;">ناوی مارکێت / شوێن</th>
              <th style="width: 130px; text-align: center; color: #854d0e;">ژمارەی وەسڵ</th>
            </tr>
          </thead>
          <tbody>
            ${giftRowsHtml}
          </tbody>
        </table>
        ` : ''}

        <div class="summary-box">
          <div class="summary-row">
            <span>کۆی فرۆشتنی نەقد:</span>
            <span dir="ltr" style="font-weight: bold; color: #166534;">${totalCashSales.toLocaleString()} د.ع</span>
          </div>
          <div class="summary-row">
            <span>کۆی فرۆشتنی بە قەرز:</span>
            <span dir="ltr" style="font-weight: bold; color: #b45309;">${totalDebtSales.toLocaleString()} د.ع</span>
          </div>
          <div class="summary-row">
            <span>کۆی قەرزی وەرگیراوە لە مارکێتەکان (کاش):</span>
            <span dir="ltr" style="font-weight: bold; color: #166534;">${totalCollectedDebt.toLocaleString()} د.ع</span>
          </div>
          ${totalGiftItemsCount > 0 ? `
          <div class="summary-row" style="background: #fef9c3; padding: 6px 10px; border-radius: 8px; border: 1px solid #fde047; margin: 8px 0;">
            <span style="font-weight: bold; color: #854d0e;">🎁 کۆی گشتی بڕی هەدیەکان (بێ بەرامبەر):</span>
            <span style="font-weight: bold; color: #854d0e;">${totalGiftItemsCount} دانە</span>
          </div>
          ` : ''}
          <div class="summary-row total-highlight">
            <span>کۆی گشتی پارەی نەقد بۆ ڕادەستکردن بە بەڕێوەبەر:</span>
            <span dir="ltr">${totalCashInHand.toLocaleString()} د.ع</span>
          </div>
        </div>

        <div class="signatures">
          <div class="sig-block">
            <div>واژووی ${data.roleTitle} (${data.repName})</div>
            <div class="sig-line"></div>
          </div>
          <div class="sig-block">
            <div>واژووی بەڕێوەبەر / وردبین</div>
            <div class="sig-line"></div>
          </div>
        </div>

        <script>
          window.onload = () => window.print();
        </script>
      </body>
    </html>
  `;
}

export function printDailyRepReceiptPopup(data: DailyRepActivityData) {
  const html = generateDailyRepReceiptHtml(data);
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

export interface MarketDebtReceiptData {
  marketName: string;
  amount: number;
  collectorName: string;
  date: number;
  receiptNo?: string;
  notes?: string;
  previousDebt?: number;
  remainingDebt?: number;
  costAmount?: number;
  profitAmount?: number;
}

export function generateMarketDebtReceiptHtml(data: MarketDebtReceiptData): string {
  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ckb">
      <head>
        <meta charset="utf-8" />
        <title>وەسڵی وەرگرتنی پارەی قەرز - ${data.marketName}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            padding: 24px;
            color: #1e293b;
            background: #ffffff;
            font-size: 14px;
            max-width: 480px;
            margin: 0 auto;
          }
          .receipt-box {
            border: 2px solid #0f172a;
            border-radius: 12px;
            padding: 20px;
          }
          .header {
            text-align: center;
            border-bottom: 2px dashed #94a3b8;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .header h2 { font-size: 20px; font-weight: 900; color: #0f172a; margin-bottom: 4px; }
          .header h3 { font-size: 15px; font-weight: 700; color: #166534; margin-bottom: 4px; }
          .header p { font-size: 12px; color: #64748b; }
          
          .info-table { width: 100%; margin-bottom: 16px; border-collapse: collapse; }
          .info-table td { padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
          .info-table .label { color: #64748b; font-weight: bold; width: 40%; }
          .info-table .val { font-weight: bold; color: #0f172a; text-align: left; }
          
          .amount-box {
            background: #f0fdf4;
            border: 2px solid #86efac;
            border-radius: 10px;
            padding: 14px;
            text-align: center;
            margin: 16px 0;
          }
          .amount-box .title { font-size: 12px; color: #166534; font-weight: bold; margin-bottom: 4px; }
          .amount-box .amount-val { font-size: 24px; font-weight: 900; color: #15803d; font-family: monospace; }
          
          .debt-breakdown {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 14px;
            margin-bottom: 16px;
            font-size: 13px;
          }
          .debt-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
          .debt-row:last-child { margin-bottom: 0; padding-top: 4px; border-top: 1px dashed #cbd5e1; font-weight: bold; }
          
          .signatures { display: flex; justify-content: space-between; margin-top: 30px; padding-top: 10px; }
          .sig-block { text-align: center; font-size: 12px; }
          .sig-line { margin-top: 30px; border-top: 1px dashed #64748b; width: 140px; }
          
          @media print {
            body { padding: 5px; }
            @page { margin: 10mm; }
          }
        </style>
      </head>
      <body>
        <div class="receipt-box">
          <div class="header">
            <h2>کۆمپانیای RF</h2>
            <h3>وەسڵی وەرگرتنەوەی پارەی قەرز (پسوڵە)</h3>
            <p>بەروار: <span dir="ltr">${format(data.date, 'yyyy-MM-dd HH:mm')}</span></p>
          </div>

          <table class="info-table">
            <tr>
              <td class="label">ناوی مارکێت / کڕیار:</td>
              <td class="val">${data.marketName}</td>
            </tr>
            <tr>
              <td class="label">وەرگیراوە لەلایەن:</td>
              <td class="val">${data.collectorName}</td>
            </tr>
            ${data.receiptNo ? `
            <tr>
              <td class="label">ژمارەی وەسڵ / دەفتەر:</td>
              <td class="val" dir="ltr"><span style="font-family: monospace;">#${data.receiptNo}</span></td>
            </tr>
            ` : ''}
            ${data.notes ? `
            <tr>
              <td class="label">تێبینی:</td>
              <td class="val">${data.notes}</td>
            </tr>
            ` : ''}
          </table>

          <div class="amount-box">
            <div class="title">بڕی پارەی وەرگیراو (واسڵکراو)</div>
            <div class="amount-val" dir="ltr">${data.amount.toLocaleString()} د.ع</div>
          </div>

          ${(data.costAmount !== undefined || data.profitAmount !== undefined) ? `
          <div style="display:flex;justify-content:space-between;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;margin:10px 0;font-size:12px;">
            <div>
              <span style="color:#64748b;">تێچوو (سەرمایە): </span>
              <strong dir="ltr" style="color:#334155;">${(data.costAmount || 0).toLocaleString()} د.ع</strong>
            </div>
            <div>
              <span style="color:#64748b;">قازانج: </span>
              <strong dir="ltr" style="color:#166534;">+${(data.profitAmount || 0).toLocaleString()} د.ع</strong>
            </div>
          </div>
          ` : ''}

          ${data.previousDebt !== undefined ? `
          <div class="debt-breakdown">
            <div class="debt-row">
              <span style="color:#64748b;">قەرزی پێشوو:</span>
              <span dir="ltr" style="font-family:monospace;font-weight:bold;color:#b45309;">${data.previousDebt.toLocaleString()} د.ع</span>
            </div>
            <div class="debt-row">
              <span style="color:#64748b;">بڕی واسڵکراو:</span>
              <span dir="ltr" style="font-family:monospace;font-weight:bold;color:#15803d;">-${data.amount.toLocaleString()} د.ع</span>
            </div>
            <div class="debt-row">
              <span>قەرزی ماوە پاش دانەوە:</span>
              <span dir="ltr" style="font-family:monospace;color:${(data.remainingDebt ?? 0) > 0 ? '#b91c1c' : '#15803d'};">
                ${(data.remainingDebt ?? 0).toLocaleString()} د.ع
              </span>
            </div>
          </div>
          ` : ''}

          <div class="signatures">
            <div class="sig-block">
              <div>واژووی کڕیار / مارکێت</div>
              <div class="sig-line"></div>
            </div>
            <div class="sig-block">
              <div>واژووی وەرگر (${data.collectorName})</div>
              <div class="sig-line"></div>
            </div>
          </div>
        </div>

        <script>
          window.onload = () => window.print();
        </script>
      </body>
    </html>
  `;
}

export function printMarketDebtReceiptPopup(data: MarketDebtReceiptData) {
  const html = generateMarketDebtReceiptHtml(data);
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}


