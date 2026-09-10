import { Transaction } from '../types';
import { format } from 'date-fns';
import { getCompanySettings } from './companySettings';

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

export interface ReceiptHeaderOptions {
  title?: string;
  subtitle?: string;
  invoiceNo?: string;
  repName?: string;
  repPhone?: string;
  marketName?: string;
  customerName?: string;
  date?: number;
  companyName?: string;
  companyPhone?: string;
  isSale?: boolean;
}

export function renderReceiptHeaderHtml(options?: ReceiptHeaderOptions): string {
  const settings = getCompanySettings();
  const cName = options?.companyName || settings.name || 'کۆمپانیای RF';
  const cPhone = options?.companyPhone || settings.phone || '07506144894';
  const isSale = options?.isSale === true;

  const repName = options?.repName || '---';
  const repPhone = options?.repPhone || '---';
  const cleanInvoiceNo = options?.invoiceNo ? options.invoiceNo.replace(/^#/, '') : '---';
  const customer = options?.customerName || options?.marketName || '---';

  const logoSrc = typeof window !== 'undefined' && window.location?.origin 
    ? `${window.location.origin}/LOGO1.jpg` 
    : '/LOGO1.jpg';

  const leftContent = isSale ? `
    <div style="text-align: right; min-width: 170px; max-width: 240px; font-size: 12px; color: #0f172a; line-height: 1.6;">
      <div><span style="color: #64748b; font-weight: 600;">ناوی مەندووب:</span> <strong style="color: #0f172a;">${repName}</strong></div>
      <div><span style="color: #64748b; font-weight: 600;">ژمارەی مەندووب:</span> <strong dir="ltr" style="color: #0f172a;">${repPhone}</strong></div>
      <div><span style="color: #64748b; font-weight: 600;">ژمارەی وەسل:</span> <strong dir="ltr" style="font-family: monospace; color: #0369a1; font-weight: 800;">#${cleanInvoiceNo}</strong></div>
      <div><span style="color: #64748b; font-weight: 600;">ناوی کڕیار(مارکێت یان کۆگا):</span> <strong style="color: #0f172a;">${customer}</strong></div>
    </div>
  ` : `
    <div style="min-width: 170px; max-width: 240px;"></div>
  `;

  return `
    <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 15px; direction: rtl; font-family: system-ui, -apple-system, sans-serif;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
        <!-- لای ڕاست: لۆگۆ و ناوی کۆمپانیا RF و ژمارە مۆبایلی کۆمپانیا -->
        <div style="text-align: right; min-width: 170px; max-width: 240px; flex-shrink: 0;">
          <div style="margin-bottom: 4px;">
            <img src="${logoSrc}" alt="Logo" style="height: 55px; max-width: 90px; object-fit: contain; display: block;" onerror="this.style.display='none'" />
          </div>
          <div style="font-size: 18px; font-weight: 900; color: #0f172a; line-height: 1.2;">${cName}</div>
          <div style="font-size: 12px; font-weight: 700; color: #334155; margin-top: 3px;">ژمارەی مۆبایلی کۆمپانیا: <span dir="ltr">${cPhone}</span></div>
        </div>

        <!-- ناوەڕاست: (تەنها) TAM TAM -->
        <div style="flex: 1; text-align: center; display: flex; align-items: center; justify-content: center; min-height: 60px;">
          <div style="font-size: 32px; font-weight: 900; letter-spacing: 2px; color: #0f172a; font-family: system-ui, -apple-system, sans-serif;">
            TAM TAM
          </div>
        </div>

        <!-- لای چەپ: ناوی مەندووب، ژمارەی مەندووب، ژمارەی وەسل، ناوی کڕیار(مارکێت یان کۆگا) - تەنها بۆ هەموو فرۆشتنەکان، باقی وەسڵەکانی تر لای چەپیان نابێت -->
        <div style="flex-shrink: 0;">
          ${leftContent}
        </div>
      </div>
    </div>
  `;
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
        ${renderReceiptHeaderHtml({
          title: headerSubtitle,
          date: Date.now()
        })}
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
        ${renderReceiptHeaderHtml({
          title: 'پسوڵەی واسڵکردنی قەرز (پاردانەوە)',
          invoiceNo: data.invoiceNo,
          date: Date.now()
        })}

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
            <div>واژووی وەرگر (${getCompanySettings().name})</div>
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
  repPhone?: string;
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
        ${renderReceiptHeaderHtml({
          title: `وەسڵی ڕۆژانەی کار و حساباتی ${data.roleTitle}`,
          repName: data.repName,
          repPhone: data.repPhone,
          date: Date.now()
        })}

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
  collectorPhone?: string;
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
          ${renderReceiptHeaderHtml({
            title: 'وەسڵی وەرگرتنەوەی پارەی قەرز (پسوڵە)',
            repName: data.collectorName,
            repPhone: data.collectorPhone,
            invoiceNo: data.receiptNo,
            date: data.date
          })}

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

export function printExpenseVoucherPopup(expense: Transaction) {
  const header = renderReceiptHeaderHtml({
    title: 'پسوڵەی خەرجی',
    subtitle: 'پسوڵەی فەرمی خەرجی دەفتەری حسابات',
    invoiceNo: expense.invoiceNo || expense.id.slice(-6).toUpperCase(),
    date: expense.date
  });

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ckb">
      <head>
        <meta charset="utf-8" />
        <title>پسوڵەی خەرجی</title>
        <style>
          @page { size: auto; margin: 12mm; }
          body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; color: #0f172a; }
          .container { max-width: 580px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed #e2e8f0; font-size: 14px; }
          .label { color: #64748b; font-weight: 600; }
          .value { font-weight: 700; color: #0f172a; }
          .amount-box { background: #fff1f2; border: 2px solid #fecdd3; border-radius: 10px; padding: 16px; text-align: center; margin: 20px 0; }
          .amount-title { font-size: 13px; color: #be123c; font-weight: 700; margin-bottom: 4px; }
          .amount-value { font-size: 26px; font-weight: 900; color: #e11d48; font-family: monospace; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; }
          .sig-box { width: 45%; text-align: center; font-size: 13px; font-weight: 700; color: #475569; }
          .sig-line { border-bottom: 1px solid #94a3b8; margin-top: 50px; }
        </style>
      </head>
      <body>
        <div class="container">
          ${header}
          <div class="amount-box">
            <div class="amount-title">بڕی خەرجی پارە</div>
            <div class="amount-value" dir="ltr">${(expense.amount || 0).toLocaleString()} د.ع</div>
          </div>
          <div class="row">
            <span class="label">هۆکار و وردەکاری:</span>
            <span class="value">${expense.description || '-'}</span>
          </div>
          <div class="row">
            <span class="label">بەروار و کات:</span>
            <span class="value" dir="ltr">${format(expense.date, 'yyyy/MM/dd HH:mm')}</span>
          </div>
          <div class="signatures">
            <div class="sig-box">
              <div>واژووی کەسی خەرجکەر</div>
              <div class="sig-line"></div>
            </div>
            <div class="sig-box">
              <div>واژووی ژمێریار / بەڕێوەبەر</div>
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

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

export function printExpensesListReportPopup(expenses: Transaction[], periodLabel: string) {
  const total = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const header = renderReceiptHeaderHtml({
    title: 'ڕاپۆرتی خەرجییەکان',
    subtitle: `ماوەی دیاریکراو: ${periodLabel}`,
    date: Date.now()
  });

  const rows = expenses.map((e, idx) => `
    <tr>
      <td style="padding: 8px; text-align: center; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${idx + 1}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-size: 12px;" dir="ltr">${format(e.date, 'yyyy/MM/dd HH:mm')}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: 700;">${e.description || '-'}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: 800; color: #e11d48; text-align: left; font-family: monospace;" dir="ltr">${(e.amount || 0).toLocaleString()} د.ع</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ckb">
      <head>
        <meta charset="utf-8" />
        <title>ڕاپۆرتی خەرجییەکان</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; color: #0f172a; }
          .container { max-width: 800px; margin: 0 auto; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
          th { background: #f8fafc; border-bottom: 2px solid #cbd5e1; padding: 10px 8px; text-align: right; font-weight: 800; color: #334155; }
          .summary-card { margin-top: 20px; padding: 14px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; }
          .summary-title { font-weight: 800; color: #9f1239; font-size: 15px; }
          .summary-val { font-size: 20px; font-weight: 900; color: #e11d48; font-family: monospace; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; }
          .sig-box { width: 40%; text-align: center; font-size: 13px; font-weight: 700; color: #475569; }
          .sig-line { border-bottom: 1px solid #94a3b8; margin-top: 45px; }
        </style>
      </head>
      <body>
        <div class="container">
          ${header}
          <div class="summary-card">
            <div class="summary-title">کۆی گشتی خەرجییەکان (${expenses.length} مامەڵە):</div>
            <div class="summary-val" dir="ltr">${total.toLocaleString()} د.ع</div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th style="width: 140px;">بەروار</th>
                <th>هۆکار و وردەکاری خەرجی</th>
                <th style="width: 140px; text-align: left;">بڕ (د.ع)</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          <div class="signatures">
            <div class="sig-box">
              <div>ئامادەکاری ژمێریاری</div>
              <div class="sig-line"></div>
            </div>
            <div class="sig-box">
              <div>پەسەندکردنی بەڕێوەبەر</div>
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

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

export interface WarehouseInvoicePrintData {
  invoiceNo: string;
  supplier: string;
  date: number;
  items: Array<{
    id?: string;
    name: string;
    barcode?: string;
    cartonQuantity?: number;
    packetQuantity?: number;
    cartonBonusQuantity?: number;
    packetBonusQuantity?: number;
    cartonCostPrice?: number;
    packetCostPrice?: number;
    cartonSellingPrice?: number;
    packetSellingPrice?: number;
    cartonPurchaseCost?: number;
    packetPurchaseCost?: number;
    costPrice?: number;
    sellingPrice?: number;
    quantity?: number;
    unitType?: string;
  }>;
  totalCartons?: number;
  totalCartonBonus?: number;
  totalPackets?: number;
  totalPacketBonus?: number;
  totalCost?: number;
}

export function printWarehouseInvoicePopup(data: WarehouseInvoicePrintData) {
  const { invoiceNo, supplier, date, items } = data;
  const cleanInvoiceNo = invoiceNo && invoiceNo !== 'بێ ژمارەی وەسڵ' && invoiceNo !== 'بێ وەسڵ' ? invoiceNo : 'بێ وەسڵ';
  const cleanSupplier = supplier || 'کۆمپانیای نەزانراو';
  
  let totalPurchasedCartons = 0;
  let totalCartonBonus = 0;
  let totalPurchasedPackets = 0;
  let totalPacketBonus = 0;
  let calculatedTotalCost = 0;

  items.forEach(item => {
    const cTotal = item.cartonQuantity !== undefined ? item.cartonQuantity : (item.unitType === 'carton' ? (item.quantity || 0) : 0);
    const cBonus = item.cartonBonusQuantity || 0;
    const cPurchased = Math.max(0, cTotal - cBonus);

    const pTotal = item.packetQuantity !== undefined ? item.packetQuantity : 0;
    const pBonus = item.packetBonusQuantity || 0;
    const pPurchased = Math.max(0, pTotal - pBonus);

    totalPurchasedCartons += cPurchased;
    totalCartonBonus += cBonus;
    totalPurchasedPackets += pPurchased;
    totalPacketBonus += pBonus;

    const cCost = item.cartonCostPrice || item.cartonPurchaseCost || item.costPrice || 0;
    const pCost = item.packetCostPrice || item.packetPurchaseCost || 0;
    
    // دیاری (هەدیە) ٠ حساب دەکرێت، تەنها بڕی کڕدراو لێکدانی نرخ دەکرێت
    calculatedTotalCost += (cPurchased * cCost) + (pPurchased * pCost);
  });

  const finalTotalCost = data.totalCost !== undefined ? data.totalCost : calculatedTotalCost;
  const finalPurchasedCartons = data.totalCartons !== undefined ? data.totalCartons : totalPurchasedCartons;
  const finalCartonBonus = data.totalCartonBonus !== undefined ? data.totalCartonBonus : totalCartonBonus;
  const finalPurchasedPackets = data.totalPackets !== undefined ? data.totalPackets : totalPurchasedPackets;
  const finalPacketBonus = data.totalPacketBonus !== undefined ? data.totalPacketBonus : totalPacketBonus;

  const header = renderReceiptHeaderHtml({
    invoiceNo: cleanInvoiceNo !== 'بێ وەسڵ' ? cleanInvoiceNo : undefined,
    date: date || Date.now()
  });

  const rows = items.map((item, idx) => {
    const cTotal = item.cartonQuantity !== undefined ? item.cartonQuantity : (item.unitType === 'carton' ? (item.quantity || 0) : 0);
    const cBonus = item.cartonBonusQuantity || 0;
    const cPurchased = Math.max(0, cTotal - cBonus);

    const pTotal = item.packetQuantity !== undefined ? item.packetQuantity : 0;
    const pBonus = item.packetBonusQuantity || 0;
    const pPurchased = Math.max(0, pTotal - pBonus);

    const cCost = item.cartonCostPrice || item.cartonPurchaseCost || item.costPrice || 0;
    const pCost = item.packetCostPrice || item.packetPurchaseCost || 0;
    const cSell = item.cartonSellingPrice || item.sellingPrice || 0;
    const pSell = item.packetSellingPrice || 0;

    // دیاری بە پارە ئەژمار ناکرێت
    const itemTotalCost = (cPurchased * cCost) + (pPurchased * pCost);

    const bonusParts = [];
    if (cBonus > 0) bonusParts.push(`${cBonus} کارتۆن`);
    if (pBonus > 0) bonusParts.push(`${pBonus} پاکەت`);
    const bonusText = bonusParts.length > 0 ? bonusParts.join(' + ') : '-';

    // نیشاندانی بڕ: بۆ نموونە 100 + 2 هەدیە
    const cartonDisplay = (cPurchased > 0 || cBonus > 0)
      ? (cBonus > 0 ? `${cPurchased} + ${cBonus} هەدیە` : `${cPurchased}`)
      : '-';

    const packetDisplay = (pPurchased > 0 || pBonus > 0)
      ? (pBonus > 0 ? `${pPurchased} + ${pBonus} هەدیە` : `${pPurchased}`)
      : '-';

    return `
      <tr>
        <td style="padding: 8px; text-align: center; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${idx + 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #0f172a;">
          ${item.name}
          ${item.barcode ? `<div style="font-size: 11px; font-family: monospace; color: #64748b;" dir="ltr">${item.barcode}</div>` : ''}
        </td>
        <td style="padding: 8px; text-align: center; border-bottom: 1px solid #e2e8f0; font-weight: 700; font-family: monospace;" dir="rtl">
          ${cartonDisplay}
        </td>
        <td style="padding: 8px; text-align: center; border-bottom: 1px solid #e2e8f0; font-weight: 700; font-family: monospace;" dir="rtl">
          ${packetDisplay}
        </td>
        <td style="padding: 8px; text-align: center; border-bottom: 1px solid #e2e8f0; color: #d97706; font-weight: 700; font-size: 12px;">
          ${bonusText}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: left; font-family: monospace; font-size: 12px;" dir="ltr">
          ${cCost > 0 ? `ک: ${cCost.toLocaleString()}` : ''}
          ${pCost > 0 ? ` پ: ${pCost.toLocaleString()}` : ''}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: left; font-family: monospace; font-size: 12px; color: #2563eb;" dir="ltr">
          ${cSell > 0 ? `ک: ${cSell.toLocaleString()}` : ''}
          ${pSell > 0 ? ` پ: ${pSell.toLocaleString()}` : ''}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: left; font-family: monospace; font-weight: 800; color: #0f172a;" dir="ltr">
          ${itemTotalCost > 0 ? `${itemTotalCost.toLocaleString()} د.ع` : '-'}
        </td>
      </tr>
    `;
  }).join('');

  const cartonMetaStr = finalCartonBonus > 0 
    ? `${finalPurchasedCartons} + ${finalCartonBonus} هەدیە کارتۆن` 
    : `${finalPurchasedCartons} کارتۆن`;

  const packetMetaStr = finalPacketBonus > 0 
    ? `${finalPurchasedPackets} + ${finalPacketBonus} هەدیە پاکەت` 
    : `${finalPurchasedPackets} پاکەت`;

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ckb">
      <head>
        <meta charset="utf-8" />
        <title>وەسڵی #${cleanInvoiceNo} - ${cleanSupplier}</title>
        <style>
          @page { size: auto; margin: 10mm; }
          body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 16px; color: #0f172a; }
          .container { max-width: 820px; margin: 0 auto; }
          .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 16px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; font-size: 13px; }
          .meta-item { display: flex; flex-direction: column; gap: 2px; }
          .meta-label { color: #64748b; font-size: 11px; font-weight: 600; }
          .meta-value { color: #0f172a; font-weight: 800; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; text-align: right; }
          th { background: #f1f5f9; padding: 8px; border-bottom: 2px solid #cbd5e1; font-weight: 700; color: #334155; }
          .summary-card { background: #eef2ff; border: 2px solid #c7d2fe; border-radius: 10px; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; margin-top: 16px; }
          .summary-title { font-size: 14px; font-weight: 700; color: #3730a3; }
          .summary-value { font-size: 22px; font-weight: 900; color: #4338ca; font-family: monospace; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 16px; }
          .sig-box { width: 40%; text-align: center; font-size: 12px; font-weight: 700; color: #475569; }
          .sig-line { border-bottom: 1px solid #94a3b8; margin-top: 45px; }
        </style>
      </head>
      <body>
        <div class="container">
          ${header}
          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">ناوی کۆمپانیا / سەرچاوە:</span>
              <span class="meta-value">${cleanSupplier}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">ژمارەی سەر وەسڵ:</span>
              <span class="meta-value" dir="ltr">#${cleanInvoiceNo}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">بەروار و کات:</span>
              <span class="meta-value" dir="ltr">${format(date || Date.now(), 'yyyy/MM/dd HH:mm')}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">ژمارەی کاڵاکان:</span>
              <span class="meta-value">${items.length} جۆر کاڵا</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">کۆی کارتۆن:</span>
              <span class="meta-value" dir="rtl">${cartonMetaStr}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">کۆی پاکەت:</span>
              <span class="meta-value" dir="rtl">${packetMetaStr}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 35px; text-align: center;">#</th>
                <th>ناوی کاڵا</th>
                <th style="width: 105px; text-align: center;">کارتۆن</th>
                <th style="width: 95px; text-align: center;">پاکەت</th>
                <th style="width: 105px; text-align: center;">دیاری (هەدیە)</th>
                <th style="width: 95px; text-align: left;">تێچوو</th>
                <th style="width: 95px; text-align: left;">فرۆشتن</th>
                <th style="width: 110px; text-align: left;">کۆی تێچوو</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <div class="summary-card">
            <div>
              <div class="summary-title">کۆی گشتی تێچووی وەسڵ:</div>
              <div style="font-size: 11px; color: #4f46e5; margin-top: 3px;">(دیاری و هەدیە بە ٠ د.ع ئەژمار کراوە و لەسەر کۆی گشتی هەژمار نەکراوە)</div>
            </div>
            <div class="summary-value" dir="ltr">${finalTotalCost.toLocaleString()} د.ع</div>
          </div>

          <div class="signatures">
            <div class="sig-box">
              <div>واژووی نوێنەری کۆمپانیا / هێنەر</div>
              <div class="sig-line"></div>
            </div>
            <div class="sig-box">
              <div>واژووی بەرپرسی کۆگا / وەرگر</div>
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

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

export function printCompanyInvoiceDebtPopup(data: {
  invoiceNo: string;
  companyName: string;
  date: number;
  originalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  items: Array<{ description: string; originalAmount: number; paidAmount?: number; remainingAmount?: number }>;
}) {
  const cleanInv = data.invoiceNo ? data.invoiceNo.replace(/^#/, '') : 'بێ وەسڵ';
  const cleanComp = data.companyName || 'کۆمپانیا';

  const rows = data.items.map((it, idx) => `
    <tr>
      <td style="text-align: center; color: #64748b; font-family: monospace;">${idx + 1}</td>
      <td style="font-weight: 600; color: #1e293b;">${it.description || 'کاڵا / مامەڵەی کڕین'}</td>
      <td style="text-align: left; font-family: monospace; font-weight: 700; color: #0f172a;" dir="ltr">${(it.originalAmount || 0).toLocaleString()} د.ع</td>
      ${data.paidAmount > 0 ? `<td style="text-align: left; font-family: monospace; color: #16a34a;" dir="ltr">${(it.paidAmount || 0).toLocaleString()} د.ع</td>` : ''}
      <td style="text-align: left; font-family: monospace; font-weight: 800; color: #d97706;" dir="ltr">${((it.remainingAmount !== undefined ? it.remainingAmount : it.originalAmount) || 0).toLocaleString()} د.ع</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ku">
      <head>
        <meta charset="utf-8" />
        <title>وەسڵی قەرز #${cleanInv} - ${cleanComp}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          * { box-sizing: border-box; }
          body {
            font-family: system-ui, -apple-system, sans-serif;
            margin: 0;
            padding: 12px;
            color: #0f172a;
            background: #fff;
            direction: rtl;
          }
          .invoice-box {
            max-width: 800px;
            margin: 0 auto;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 15px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 10px 14px;
          }
          .meta-item { display: flex; flex-direction: column; gap: 2px; }
          .meta-label { font-size: 11px; color: #64748b; font-weight: 600; }
          .meta-value { font-size: 13px; font-weight: 800; color: #0f172a; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
            font-size: 12px;
          }
          th {
            background-color: #f1f5f9;
            color: #475569;
            font-weight: 700;
            padding: 8px 10px;
            border-bottom: 2px solid #cbd5e1;
            text-align: right;
          }
          td {
            padding: 8px 10px;
            border-bottom: 1px solid #e2e8f0;
          }
          .summary-card {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #fffbeb;
            border: 1.5px solid #fde68a;
            border-radius: 12px;
            padding: 12px 18px;
            margin-top: 10px;
          }
          .summary-title { font-size: 13px; font-weight: 700; color: #92400e; }
          .summary-value { font-size: 18px; font-weight: 900; color: #b45309; font-family: monospace; }
          .signatures {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            font-weight: bold;
            color: #475569;
          }
          .sig-box { text-align: center; width: 200px; }
          .sig-line { border-bottom: 1px dashed #94a3b8; margin-top: 35px; }
          @media print {
            body { padding: 0; }
            .invoice-box { max-width: 100%; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-box">
          ${renderReceiptHeaderHtml({
            invoiceNo: cleanInv,
            customerName: cleanComp,
            date: data.date,
            isSale: false
          })}

          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">ژمارەی وەسڵ:</span>
              <span class="meta-value" dir="ltr" style="font-family: monospace; color: #d97706;">#${cleanInv}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">ناوی کۆمپانیا:</span>
              <span class="meta-value">${cleanComp}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">بەروار:</span>
              <span class="meta-value" dir="ltr">${format(data.date, 'yyyy-MM-dd HH:mm')}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">ژمارەی کاڵاکان:</span>
              <span class="meta-value">${data.items.length} کاڵا</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 35px; text-align: center;">#</th>
                <th>وردەکاری کاڵا / کڕین</th>
                <th style="width: 140px; text-align: left;">بڕی سەرەتایی</th>
                ${data.paidAmount > 0 ? '<th style="width: 130px; text-align: left;">دراوە</th>' : ''}
                <th style="width: 140px; text-align: left;">ماوەی قەرز</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <div class="summary-card">
            <div>
              <div class="summary-title">کۆی ماوەی قەرزی ئەم وەسڵە:</div>
              ${data.paidAmount > 0 ? `<div style="font-size: 11px; color: #16a34a; margin-top: 2px;">(کۆی سەرەتایی: ${(data.originalAmount || 0).toLocaleString()} د.ع - دراوە: ${(data.paidAmount || 0).toLocaleString()} د.ع)</div>` : ''}
            </div>
            <div class="summary-value" dir="ltr">${(data.remainingAmount || 0).toLocaleString()} د.ع</div>
          </div>

          <div class="signatures">
            <div class="sig-box">
              <div>واژووی نوێنەری کۆمپانیا</div>
              <div class="sig-line"></div>
            </div>
            <div class="sig-box">
              <div>واژووی وەرگر / ژمێریار</div>
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

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

export function printCompanyInvoiceCashPopup(data: {
  invoiceNo: string;
  companyName: string;
  date: number;
  totalAmount: number;
  items: Array<{ description?: string; amount?: number }>;
}) {
  const cleanInv = data.invoiceNo ? data.invoiceNo.replace(/^#/, '') : 'بێ وەسڵ';
  const cleanComp = data.companyName || 'کۆمپانیا';

  const rows = data.items.map((it, idx) => `
    <tr>
      <td style="text-align: center; color: #64748b; font-family: monospace;">${idx + 1}</td>
      <td style="font-weight: 600; color: #1e293b;">${it.description || 'کاڵا / مامەڵەی کڕین'}</td>
      <td style="text-align: left; font-family: monospace; font-weight: 800; color: #047857;" dir="ltr">${(it.amount || 0).toLocaleString()} د.ع</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ku">
      <head>
        <meta charset="utf-8" />
        <title>وەسڵی نەقدی #${cleanInv} - ${cleanComp}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          * { box-sizing: border-box; }
          body {
            font-family: system-ui, -apple-system, sans-serif;
            margin: 0;
            padding: 12px;
            color: #0f172a;
            background: #fff;
            direction: rtl;
          }
          .invoice-box {
            max-width: 800px;
            margin: 0 auto;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 15px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 10px 14px;
          }
          .meta-item { display: flex; flex-direction: column; gap: 2px; }
          .meta-label { font-size: 11px; color: #64748b; font-weight: 600; }
          .meta-value { font-size: 13px; font-weight: 800; color: #0f172a; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
            font-size: 12px;
          }
          th {
            background-color: #f1f5f9;
            color: #475569;
            font-weight: 700;
            padding: 8px 10px;
            border-bottom: 2px solid #cbd5e1;
            text-align: right;
          }
          td {
            padding: 8px 10px;
            border-bottom: 1px solid #e2e8f0;
          }
          .summary-card {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #ecfdf5;
            border: 1.5px solid #a7f3d0;
            border-radius: 12px;
            padding: 12px 18px;
            margin-top: 10px;
          }
          .summary-title { font-size: 13px; font-weight: 700; color: #065f46; }
          .summary-value { font-size: 18px; font-weight: 900; color: #047857; font-family: monospace; }
          .signatures {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            font-weight: bold;
            color: #475569;
          }
          .sig-box { text-align: center; width: 200px; }
          .sig-line { border-bottom: 1px dashed #94a3b8; margin-top: 35px; }
          @media print {
            body { padding: 0; }
            .invoice-box { max-width: 100%; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-box">
          ${renderReceiptHeaderHtml({
            invoiceNo: cleanInv,
            customerName: cleanComp,
            date: data.date,
            isSale: false
          })}

          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">ژمارەی وەسڵ:</span>
              <span class="meta-value" dir="ltr" style="font-family: monospace; color: #059669;">#${cleanInv}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">ناوی کۆمپانیا:</span>
              <span class="meta-value">${cleanComp}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">بەروار:</span>
              <span class="meta-value" dir="ltr">${format(data.date, 'yyyy-MM-dd HH:mm')}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">ژمارەی کاڵاکان:</span>
              <span class="meta-value">${data.items.length} کاڵا</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 35px; text-align: center;">#</th>
                <th>وردەکاری کاڵا / کڕین</th>
                <th style="width: 160px; text-align: left;">بڕی نەقد (د.ع)</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <div class="summary-card">
            <div class="summary-title">کۆی گشتی نەقدی وەسڵ:</div>
            <div class="summary-value" dir="ltr">${(data.totalAmount || 0).toLocaleString()} د.ع</div>
          </div>

          <div class="signatures">
            <div class="sig-box">
              <div>واژووی نوێنەری کۆمپانیا</div>
              <div class="sig-line"></div>
            </div>
            <div class="sig-box">
              <div>واژووی وەرگر / ژمێریار</div>
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

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}



