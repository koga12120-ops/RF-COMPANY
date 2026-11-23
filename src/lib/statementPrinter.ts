import { Transaction } from '../types';
import { format } from 'date-fns';
import { getCompanySettings } from './companySettings';

export function printHtml(html: string, options?: { isThermal?: boolean }) {
  const cleanedHtml = html.replace(/<script\b[^>]*>[\s\S]*?window\.print\(\)[\s\S]*?<\/script>/gi, '');

  const dispatchPreview = () => {
    window.dispatchEvent(
      new CustomEvent('tamtam:print-preview', {
        detail: { html: cleanedHtml, isThermal: Boolean(options?.isThermal) }
      })
    );
  };

  try {
    const existing = document.getElementById('tamtam-print-iframe');
    if (existing) existing.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'tamtam-print-iframe';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';

    let triggered = false;
    const triggerPrint = () => {
      if (triggered) return;
      triggered = true;
      const win = iframe.contentWindow;
      if (!win) {
        dispatchPreview();
        return;
      }
      let beforePrintFired = false;
      const onBeforePrint = () => {
        beforePrintFired = true;
      };
      win.addEventListener('beforeprint', onBeforePrint, { once: true });
      try {
        win.focus();
        win.print();
        setTimeout(() => {
          if (!beforePrintFired) {
            dispatchPreview();
          }
        }, 400);
      } catch {
        dispatchPreview();
      }
    };

    iframe.onload = () => {
      setTimeout(triggerPrint, 120);
    };

    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      dispatchPreview();
      return;
    }

    doc.open();
    doc.write(cleanedHtml);
    doc.close();

    setTimeout(triggerPrint, 650);
  } catch {
    dispatchPreview();
  }
}

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
  isThermal?: boolean;
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
  isThermal?: boolean;
}

export function renderReceiptHeaderHtml(options?: ReceiptHeaderOptions): string {
  const settings = getCompanySettings();
  const cName = options?.companyName || settings.name || 'کۆمپانیای RF';
  let cPhone = options?.companyPhone || settings.phone || '07506144894';
  if (!cPhone.includes('07783890464')) {
    cPhone = cPhone ? `${cPhone} - 07783890464` : '07506144894 - 07783890464';
  }
  const isSale = options?.isSale === true;
  const isThermal = options?.isThermal === true;

  const repName = options?.repName || '---';
  const repPhone = options?.repPhone || '---';
  const cleanInvoiceNo = options?.invoiceNo ? options.invoiceNo.replace(/^#/, '') : '---';
  const customer = options?.customerName || options?.marketName || '---';

  const logoSrc = typeof window !== 'undefined' && window.location?.origin 
    ? `${window.location.origin}/LOGO1.jpg` 
    : '/LOGO1.jpg';

  if (isThermal) {
    return `
      <div style="text-align: center; border-bottom: 2.5px dashed #000; padding-bottom: 8px; margin-bottom: 10px; direction: rtl; font-family: system-ui, -apple-system, sans-serif; color: #000;">
        <div style="margin-bottom: 4px; display: flex; justify-content: center;">
          <img src="${logoSrc}" alt="Logo" style="height: 52px; max-width: 90px; object-fit: contain; display: block;" onerror="this.style.display='none'" />
        </div>
        <div style="font-size: 24px; font-weight: 900; letter-spacing: 1px; color: #000; line-height: 1.2;">TAM TAM</div>
        <div style="font-size: 16px; font-weight: 900; color: #000; margin-top: 3px;">${cName}</div>
        <div style="font-size: 13.5px; font-weight: 900; color: #000; margin-top: 3px;">ژمارەی مۆبایل: <span dir="ltr">${cPhone}</span></div>
      </div>
    `;
  }

  const leftContent = isSale ? `
    <div style="text-align: right; min-width: 185px; max-width: 260px; font-size: 13px; color: #000; line-height: 1.7; font-weight: 800;">
      <div><span style="color: #000; font-weight: 800;">ناوی مەندووب:</span> <strong style="color: #000; font-weight: 900;">${repName}</strong></div>
      <div><span style="color: #000; font-weight: 800;">ژمارەی مەندووب:</span> <strong dir="ltr" style="color: #000; font-weight: 900;">${repPhone}</strong></div>
      <div><span style="color: #000; font-weight: 800;">ژمارەی وەسل:</span> <strong dir="ltr" style="font-family: monospace; color: #1e3a8a; font-weight: 900; font-size: 14px;">#${cleanInvoiceNo}</strong></div>
      <div><span style="color: #000; font-weight: 800;">ناوی کڕیار(مارکێت یان کۆگا):</span> <strong style="color: #000; font-weight: 900;">${customer}</strong></div>
    </div>
  ` : `
    <div style="min-width: 170px; max-width: 240px;"></div>
  `;

  return `
    <div style="border-bottom: 3px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 16px; direction: rtl; font-family: system-ui, -apple-system, sans-serif; color: #000;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
        <!-- لای ڕاست: لۆگۆ و ناوی کۆمپانیا RF و ژمارە مۆبایلی کۆمپانیا -->
        <div style="text-align: right; min-width: 175px; max-width: 250px; flex-shrink: 0;">
          <div style="margin-bottom: 4px;">
            <img src="${logoSrc}" alt="Logo" style="height: 58px; max-width: 95px; object-fit: contain; display: block;" onerror="this.style.display='none'" />
          </div>
          <div style="font-size: 19px; font-weight: 900; color: #000; line-height: 1.2;">${cName}</div>
          <div style="font-size: 12.5px; font-weight: 800; color: #000; margin-top: 3px;">ژمارەی مۆبایلی کۆمپانیا: <span dir="ltr">${cPhone}</span></div>
        </div>

        <!-- ناوەڕاست: TAM TAM و سەردێڕی وەسڵ -->
        <div style="flex: 1; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60px;">
          <div style="font-size: 32px; font-weight: 900; letter-spacing: 2px; color: #172554; font-family: system-ui, -apple-system, sans-serif;">
            TAM TAM
          </div>
          ${options?.title ? `<div style="font-size: 14px; font-weight: 900; color: #1e3a8a; margin-top: 4px;">${options.title}</div>` : ''}
          ${options?.subtitle ? `<div style="font-size: 12px; font-weight: 800; color: #000; margin-top: 2px;">${options.subtitle}</div>` : ''}
        </div>

        <!-- لای چەپ: ناوی مەندووب، ژمارەی مەندووب، ژمارەی وەسل، ناوی کڕیار(مارکێت یان کۆگا) -->
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
    let typeLabel = 'نەقد';
    if (t.type.includes('debt') && !t.type.includes('paid')) {
      typeLabel = 'قەرز';
      totalDebt += t.amount || 0;
    } else if (t.type.includes('paid')) {
      typeLabel = 'نەقد';
      totalPaid += t.amount || 0;
      totalCash += t.amount || 0;
    } else {
      typeLabel = 'نەقد';
      totalCash += t.amount || 0;
    }

    const cleanInvoice = t.invoiceNo?.trim();

    if (cleanInvoice) {
      const invKey = cleanInvoice;
      if (groupedMap.has(invKey)) {
        const existing = groupedMap.get(invKey)!;
        existing.amount += t.amount || 0;
        if (t.date > existing.date) existing.date = t.date;
        if (t.type.includes('debt') && !t.type.includes('paid')) {
          existing.typeLabel = 'قەرز';
        }
      } else {
        groupedMap.set(invKey, {
          date: t.date,
          invoiceNo: cleanInvoice,
          type: t.type,
          typeLabel,
          notes: undefined,
          amount: t.amount || 0,
        });
      }
    } else {
      individualRows.push({
        date: t.date,
        invoiceNo: undefined,
        type: t.type,
        typeLabel,
        notes: t.description || (t.type.includes('debt') ? 'قەرز' : 'نەقد'),
        amount: t.amount || 0,
      });
    }
  });

  const finalRows: GroupedStatementRow[] = [
    ...Array.from(groupedMap.values()),
    ...individualRows
  ];

  finalRows.sort((a, b) => a.date - b.date);

  const finalBalance = totalDebt - totalPaid;

  if (options?.isThermal) {
    const thermalRows = finalRows
      .map((r, idx) => {
        const invoiceDisplay = r.invoiceNo ? `#${r.invoiceNo}` : '-';
        return `<tr>
          <td style="text-align:center;font-weight:900;color:#000;">${idx + 1}</td>
          <td style="text-align:right;font-weight:900;color:#000;">
            <div>${invoiceDisplay} | ${r.typeLabel}</div>
            <div dir="ltr" style="font-size:11.5px;font-weight:800;text-align:right;">${format(r.date, 'yyyy-MM-dd HH:mm')}</div>
          </td>
          <td dir="ltr" style="text-align:left;font-weight:900;color:#000;">
            ${(r.amount || 0).toLocaleString()} د.ع
          </td>
        </tr>`;
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ckb">
        <head>
          <title>${pageTitle}</title>
          <meta charset="utf-8" />
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; color: #000 !important; }
            @page { size: auto; margin: 0; }
            @media print {
              html, body { width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .thermal-box { width: 100% !important; max-width: 100% !important; margin: 0 auto !important; padding: 1.5mm !important; border: none !important; }
            }
            body { font-family: system-ui, -apple-system, sans-serif; font-size: 13.5px; font-weight: 800; padding: 4px; color: #000; background: #fff; width: 100%; max-width: 80mm; margin: 0 auto; line-height: 1.4; }
            .thermal-box { border: 1.5px dashed #000; border-radius: 6px; padding: 6px; }
            .badge { text-align: center; font-weight: 900; font-size: 15px; border: 2px solid #000; padding: 4px; border-radius: 4px; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 13px; }
            th { padding: 5px 2px; border-top: 2px solid #000; border-bottom: 2px solid #000; font-weight: 900; }
            td { padding: 5px 2px; border-bottom: 1.5px dashed #000; font-weight: 800; }
            .summary { border: 2px solid #000; border-radius: 6px; padding: 6px; margin-top: 8px; font-size: 13.5px; font-weight: 900; }
            .summary-row { display: flex; justify-content: space-between; padding: 2.5px 0; }
            .summary-total { border-top: 2px dashed #000; margin-top: 4px; padding-top: 5px; font-size: 15.5px; font-weight: 900; }
          </style>
        </head>
        <body>
          <div class="thermal-box">
            ${renderReceiptHeaderHtml({ title: headerSubtitle, date: Date.now(), isThermal: true })}
            <div class="badge">${headerSubtitle}</div>
            <table>
              <thead>
                <tr>
                  <th style="width: 24px; text-align: center;">#</th>
                  <th style="text-align: right;">وەسڵ / بەروار</th>
                  <th style="text-align: left;">بڕ</th>
                </tr>
              </thead>
              <tbody>
                ${thermalRows || '<tr><td colspan="3" style="text-align:center;padding:12px;">هیچ تۆمارێک نەدۆزرایەوە</td></tr>'}
              </tbody>
            </table>
            <div class="summary">
              <div class="summary-row"><span>کۆی قەرز:</span><span dir="ltr">${totalDebt.toLocaleString()} د.ع</span></div>
              <div class="summary-row"><span>کۆی واسڵکراو:</span><span dir="ltr">${totalPaid.toLocaleString()} د.ع</span></div>
              <div class="summary-row"><span>کۆی نەقد:</span><span dir="ltr">${totalCash.toLocaleString()} د.ع</span></div>
              <div class="summary-row summary-total"><span>باڵانسی ماوە:</span><span dir="ltr">${finalBalance.toLocaleString()} د.ع</span></div>
            </div>
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `;
  }

  const rowsHtml = finalRows
    .map((r, idx) => {
      let badgeStyle = 'background:#ffffff;color:#000000;border:2px solid #000000;';
      if (r.typeLabel === 'قەرز') badgeStyle = 'background:#ffffff;color:#92400e;border:2px solid #92400e;';
      if (r.typeLabel === 'واسڵکراو') badgeStyle = 'background:#ffffff;color:#14532d;border:2px solid #14532d;';
      if (r.typeLabel === 'نەقد') badgeStyle = 'background:#1e3a8a;color:#ffffff;border:2px solid #1e3a8a;';

      const invoiceDisplay = r.invoiceNo ? `<span style="font-weight:900;color:#1e3a8a;font-family:monospace;font-size:14px;">#${r.invoiceNo}</span>` : `<span style="color:#000;font-weight:800;">-</span>`;

      return `<tr>
        <td style="text-align:center;font-weight:900;color:#000;">${idx + 1}</td>
        <td dir="ltr" style="text-align:center;white-space:nowrap;">${invoiceDisplay}</td>
        <td dir="ltr" style="text-align:center;white-space:nowrap;font-size:13px;font-weight:800;color:#000;">${format(r.date, 'yyyy-MM-dd HH:mm')}</td>
        <td style="text-align:center;"><span style="display:inline-block;padding:3px 10px;border-radius:6px;font-size:12.5px;font-weight:900;${badgeStyle}">${r.typeLabel}</span></td>
        <td dir="ltr" style="text-align:left;font-weight:900;font-size:14px;color:${r.typeLabel === 'قەرز' ? '#92400e' : (r.typeLabel === 'واسڵکراو' ? '#14532d' : '#1e3a8a')};">
          ${(r.amount || 0).toLocaleString()} د.ع
        </td>
      </tr>`;
    })
    .join('');

  return `
    <html dir="rtl">
      <head>
        <title>${pageTitle}</title>
        <meta charset="utf-8" />
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          * { box-sizing: border-box; }
          body { font-family: Tahoma, 'Segoe UI', Arial, sans-serif; padding: 16px; color: #000000; line-height: 1.5; background: #fff; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; text-align: right; }
          th { background-color: #1e3a8a; color: #ffffff; font-weight: 900; border: 1.5px solid #0f172a; padding: 10px 12px; font-size: 13.5px; text-align: center; }
          td { border: 1.5px solid #334155; padding: 10px 12px; color: #000000; font-weight: 800; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .summary { margin-top: 24px; padding: 18px; border: 2.5px solid #1e3a8a; border-radius: 12px; background: #ffffff; color: #000000; }
          .summary-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 15px; font-weight: 800; color: #000000; }
          .summary-total { border-top: 2px solid #000000; padding-top: 10px; margin-top: 10px; font-size: 19px; font-weight: 900; color: ${finalBalance > 0 ? '#991b1b' : '#14532d'}; }
          @media print {
            body { padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
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
            ${rowsHtml || '<tr><td colspan="5" style="text-align:center;padding:20px;color:#000;font-weight:800;">هیچ تۆمارێک نەدۆزرایەوە</td></tr>'}
          </tbody>
        </table>
        <div class="summary">
          <div class="summary-row">
            <span>کۆی قەرزەکان:</span>
            <span dir="ltr" style="font-weight:900;color:#92400e;">${totalDebt.toLocaleString()} د.ع</span>
          </div>
          <div class="summary-row">
            <span>کۆی واسڵکراو (دراوە):</span>
            <span dir="ltr" style="font-weight:900;color:#14532d;">${totalPaid.toLocaleString()} د.ع</span>
          </div>
          <div class="summary-row">
            <span>کۆی نەقد:</span>
            <span dir="ltr" style="font-weight:900;color:#1e3a8a;">${totalCash.toLocaleString()} د.ع</span>
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
  printHtml(html, { isThermal: options?.isThermal });
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
          @page { size: A4 portrait; margin: 12mm; }
          * { box-sizing: border-box; }
          body { font-family: Tahoma, 'Segoe UI', Arial, sans-serif; padding: 16px; color: #000000; line-height: 1.5; background: #fff; font-weight: 700; }
          
          .info-box { background: #ffffff; border: 2px solid #1e3a8a; border-radius: 12px; padding: 14px; margin-bottom: 20px; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14.5px; }
          .info-row:last-child { margin-bottom: 0; }
          .label { color: #000000; font-weight: 800; }
          .value { font-weight: 900; color: #000000; }
          
          .amount-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .amount-table th { background: #1e3a8a; padding: 10px 14px; text-align: right; border: 1.5px solid #0f172a; font-size: 14px; color: #ffffff; font-weight: 900; }
          .amount-table td { padding: 12px 14px; border: 1.5px solid #334155; font-size: 14.5px; font-weight: 800; color: #000000; }
          
          .badge-paid { color: #14532d; font-weight: 900; font-size: 19px; }
          .badge-rem { color: #92400e; font-weight: 900; font-size: 19px; }
          
          .notes { background: #ffffff; border: 2px solid #92400e; border-radius: 8px; padding: 10px 14px; font-size: 13.5px; font-weight: 800; color: #000000; margin-bottom: 24px; }
          
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 10px; font-weight: 800; color: #000000; }
          .sig-block { text-align: center; }
          .sig-line { margin-top: 35px; border-top: 1.5px dashed #000000; width: 160px; }
          
          @media print {
            body { padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
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
            <span class="value" dir="ltr" style="font-family:monospace;color:#1e3a8a;font-weight:900;">#${data.invoiceNo}</span>
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
              <th style="text-align: left; width: 190px;">بڕی پارە</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>کۆی قەرزی سەر وەسڵەکە (یان قەرزی پێشوو)</strong></td>
              <td dir="ltr" style="text-align: left; font-weight: 900; color: #000000; font-size: 16px;">
                ${data.originalDebtAmount.toLocaleString()} د.ع
              </td>
            </tr>
            <tr>
              <td><strong style="color: #14532d;">بڕی پارەی واسڵکراو (دراوە لەم پسوڵەیەدا)</strong></td>
              <td dir="ltr" style="text-align: left;" class="badge-paid">
                ${data.paidAmount.toLocaleString()} د.ع
              </td>
            </tr>
            <tr>
              <td><strong style="color: #92400e;">بڕی ماوە لەسەر ئەم وەسڵە (قەرزی ئێستا)</strong></td>
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
            <div>واژووی مارکێت</div>
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
  printHtml(html, { isThermal: false });
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
  isA4?: boolean;
}

export function generateDailyRepReceiptHtml(data: DailyRepActivityData): string {
  const totalCashSales = data.sales.filter(s => s.paymentType.includes('نەقد')).reduce((sum, s) => sum + s.amount, 0);
  const totalDebtSales = data.sales.filter(s => s.paymentType.includes('قەرز')).reduce((sum, s) => sum + s.amount, 0);
  const totalSalesAmount = totalCashSales + totalDebtSales;
  const totalCollectedDebt = data.collections.reduce((sum, c) => sum + c.amount, 0);
  const totalCashInHand = totalCashSales + totalCollectedDebt;

  const totalGiftItemsCount = (data.gifts || []).reduce((sum, g) => sum + (g.quantity || 0), 0);

  if (data.isA4) {
    const a4SalesRows = data.sales.map((s, idx) => `
      <tr>
        <td style="text-align: center; font-weight: 900;">${idx + 1}</td>
        <td style="text-align: right; font-weight: 900;">
          <div>${s.marketName} ${s.invoiceNo ? `<span style="font-family: monospace; color: #1e3a8a;">(#${s.invoiceNo})</span>` : ''}</div>
          ${s.itemsSummary ? `<div style="font-size: 11.5px; font-weight: 700; margin-top: 2px;">${s.itemsSummary}</div>` : ''}
        </td>
        <td style="text-align: center; font-weight: 900;">
          <span style="display:inline-block;padding:2px 8px;border-radius:5px;border:1.5px solid ${s.paymentType.includes('نەقد') ? '#1e3a8a' : '#92400e'};color:${s.paymentType.includes('نەقد') ? '#1e3a8a' : '#92400e'};">
            ${s.paymentType.includes('نەقد') ? 'نەقد' : 'قەرز'}
          </span>
        </td>
        <td dir="ltr" style="text-align: left; font-weight: 900; font-family: monospace;">${s.amount.toLocaleString()} د.ع</td>
      </tr>
    `).join('') || '<tr><td colspan="4" style="text-align:center;padding:14px;">هیچ فرۆشتنێک تۆمار نەکراوە</td></tr>';

    const a4CollectionRows = data.collections.map((c, idx) => `
      <tr>
        <td style="text-align: center; font-weight: 900;">${idx + 1}</td>
        <td style="text-align: right; font-weight: 900;">
          ${c.marketName} ${c.invoiceNo ? `<span style="font-family: monospace; color: #1e3a8a;">(#${c.invoiceNo})</span>` : ''}
          ${c.notes ? `<div style="font-size: 11.5px; font-weight: 700;">${c.notes}</div>` : ''}
        </td>
        <td dir="ltr" style="text-align: left; font-weight: 900; font-family: monospace; color: #14532d;">${c.amount.toLocaleString()} د.ع</td>
      </tr>
    `).join('') || '';

    const a4GiftRows = (data.gifts && data.gifts.length > 0) ? data.gifts.map((g, idx) => `
      <tr>
        <td style="text-align: center; font-weight: 900;">${idx + 1}</td>
        <td style="text-align: right; font-weight: 900;">🎁 ${g.name} - ${g.marketName}</td>
        <td style="text-align: center; font-weight: 900;">${g.quantity} ${g.unit === 'packet' ? 'پاکەت' : 'کارتۆن'}</td>
      </tr>
    `).join('') : '';

    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ckb">
        <head>
          <meta charset="utf-8" />
          <title>زانیاری فرۆشەکان - ${data.repName}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            * { box-sizing: border-box; }
            body { font-family: Tahoma, 'Segoe UI', Arial, sans-serif; padding: 14px; color: #000; background: #fff; font-weight: 700; line-height: 1.5; }
            .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; border: 2px solid #1e3a8a; border-radius: 10px; padding: 12px; margin-bottom: 16px; font-size: 13.5px; }
            .info-item strong { color: #1e3a8a; font-weight: 900; }
            .sec-title { display: flex; justify-content: space-between; align-items: center; background: #1e3a8a; color: #fff; padding: 8px 14px; border-radius: 8px; font-weight: 900; font-size: 14px; margin: 16px 0 8px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 12px; }
            th { background: #172554; color: #fff; padding: 8px; border: 1.5px solid #000; font-weight: 900; }
            td { padding: 8px; border: 1.5px solid #334155; color: #000; font-weight: 800; }
            .summary-box { border: 2.5px solid #1e3a8a; border-radius: 10px; padding: 14px; margin-top: 16px; font-size: 14.5px; font-weight: 900; }
            .summary-row { display: flex; justify-content: space-between; padding: 4px 0; }
            .total-hand { border-top: 2px solid #000; margin-top: 6px; padding-top: 8px; font-size: 17px; color: #1e3a8a; }
            .signatures { display: flex; justify-content: space-between; margin-top: 40px; font-weight: 800; font-size: 13px; text-align: center; }
            .sig-line { margin-top: 35px; border-top: 1.5px dashed #000; width: 160px; }
            @media print { body { padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
          </style>
        </head>
        <body>
          ${renderReceiptHeaderHtml({
            title: `ڕاپۆرتی فرۆش و کار (${data.roleTitle})`,
            repName: data.repName,
            repPhone: data.repPhone,
            date: data.date,
            isThermal: false
          })}
          <div class="info-grid">
            <div class="info-item">ناوی ${data.roleTitle}: <strong>${data.repName}</strong></div>
            <div class="info-item">بەرواری کار: <strong dir="ltr">${format(data.date, 'yyyy/MM/dd')}</strong></div>
            <div class="info-item">ژمارەی وەسڵەکان: <strong>${data.sales.length} وەسڵ</strong></div>
          </div>

          <div class="sec-title">
            <span>📦 لیستی فرۆشتنەکان</span>
            <span dir="ltr">${totalSalesAmount.toLocaleString()} د.ع</span>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 35px; text-align: center;">#</th>
                <th style="text-align: right;">مارکێت / وەسڵ</th>
                <th style="width: 90px; text-align: center;">شێواز</th>
                <th style="width: 140px; text-align: left;">بڕ (د.ع)</th>
              </tr>
            </thead>
            <tbody>${a4SalesRows}</tbody>
          </table>

          ${data.collections && data.collections.length > 0 ? `
            <div class="sec-title">
              <span>💰 قەرزی وەرگیراو</span>
              <span dir="ltr">${totalCollectedDebt.toLocaleString()} د.ع</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 35px; text-align: center;">#</th>
                  <th style="text-align: right;">مارکێت / تێبینی</th>
                  <th style="width: 140px; text-align: left;">بڕ (د.ع)</th>
                </tr>
              </thead>
              <tbody>${a4CollectionRows}</tbody>
            </table>
          ` : ''}

          ${data.gifts && data.gifts.length > 0 ? `
            <div class="sec-title">
              <span>🎁 کاڵای هەدیە (${totalGiftItemsCount})</span>
              <span>٠ د.ع</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 35px; text-align: center;">#</th>
                  <th style="text-align: right;">کاڵا / مارکێت</th>
                  <th style="width: 110px; text-align: center;">بڕ</th>
                </tr>
              </thead>
              <tbody>${a4GiftRows}</tbody>
            </table>
          ` : ''}

          <div class="summary-box">
            <div class="summary-row"><span>فرۆشتنی نەقد:</span><span dir="ltr">${totalCashSales.toLocaleString()} د.ع</span></div>
            <div class="summary-row"><span>فرۆشتنی بە قەرز:</span><span dir="ltr">${totalDebtSales.toLocaleString()} د.ع</span></div>
            <div class="summary-row"><span>کۆی گشتی فرۆش:</span><span dir="ltr">${totalSalesAmount.toLocaleString()} د.ع</span></div>
            ${totalCollectedDebt > 0 ? `<div class="summary-row"><span>قەرزی وەرگیراو:</span><span dir="ltr">+${totalCollectedDebt.toLocaleString()} د.ع</span></div>` : ''}
            <div class="summary-row total-hand"><span>کۆی پارەی نەقد (دەست):</span><span dir="ltr">${totalCashInHand.toLocaleString()} د.ع</span></div>
          </div>

          <div class="signatures">
            <div><div>واژووی ${data.roleTitle}</div><div class="sig-line"></div></div>
            <div><div>واژووی بەڕێوەبەر</div><div class="sig-line"></div></div>
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `;
  }

  const salesRowsHtml = data.sales.map((s, idx) => `
    <tr>
      <td style="text-align: center; color: #000; font-size: 12.5px; font-weight: 900;">${idx + 1}</td>
      <td style="text-align: right; font-weight: 900; color: #000; font-size: 13px;">
        ${s.marketName}
        ${s.invoiceNo ? `<div style="font-family: monospace; font-size: 12.5px; font-weight: 900; color: #000;">#${s.invoiceNo}</div>` : ''}
        ${s.itemsSummary ? `<div style="font-size: 11.5px; color: #000; font-weight: 800;">${s.itemsSummary}</div>` : ''}
      </td>
      <td style="text-align: center;">
        <span style="display: inline-block; padding: 2px 5px; border: 1.5px solid #000; border-radius: 4px; font-size: 12px; font-weight: 900; color: #000;">
          ${s.paymentType.includes('نەقد') ? 'نەقد' : 'قەرز'}
        </span>
      </td>
      <td dir="ltr" style="text-align: left; font-weight: 900; color: #000; font-size: 13px;">${s.amount.toLocaleString()}</td>
    </tr>
  `).join('') || '<tr><td colspan="4" style="text-align: center; padding: 10px; color: #000; font-size: 13px; font-weight: 900;">هیچ فرۆشتنێک تۆمار نەکراوە</td></tr>';

  const collectionRowsHtml = data.collections.map((c, idx) => `
    <tr>
      <td style="text-align: center; color: #000; font-size: 12.5px; font-weight: 900;">${idx + 1}</td>
      <td style="text-align: right; font-weight: 900; color: #000; font-size: 13px;">
        ${c.marketName}
        ${c.invoiceNo ? `<span style="font-family: monospace; font-size: 12.5px; font-weight: 900; color: #000; margin-right: 4px;">#${c.invoiceNo}</span>` : ''}
        ${c.notes ? `<div style="font-size: 11.5px; color: #000; font-weight: 800;">${c.notes}</div>` : ''}
      </td>
      <td dir="ltr" style="text-align: left; font-weight: 900; color: #000; font-size: 13px;">${c.amount.toLocaleString()}</td>
    </tr>
  `).join('') || '<tr><td colspan="3" style="text-align: center; padding: 10px; color: #000; font-size: 13px; font-weight: 900;">هیچ قەرزێک وەرنەگیراوەتەوە</td></tr>';

  const giftRowsHtml = (data.gifts && data.gifts.length > 0) ? data.gifts.map((g, idx) => `
    <tr>
      <td style="text-align: center; font-weight: 900; color: #000; font-size: 12.5px;">${idx + 1}</td>
      <td style="font-weight: 900; color: #000; font-size: 13px;">
        🎁 ${g.name}
        <div style="font-size: 11.5px; color: #000; font-weight: 800;">${g.marketName}</div>
      </td>
      <td style="text-align: center; font-weight: 900; color: #000; font-size: 13px;">${g.quantity} ${g.unit === 'packet' ? 'پاکەت' : 'کارتۆن'}</td>
    </tr>
  `).join('') : '';

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ckb">
      <head>
        <meta charset="utf-8" />
        <title>زانیاری فرۆشەکان - ${data.repName}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; color: #000 !important; }
          @page { 
            size: auto; 
            margin: 0; 
          }
          @media print { 
            html, body { 
              width: 100% !important; 
              max-width: 100% !important; 
              min-width: 0 !important; 
              margin: 0 !important; 
              padding: 0 !important; 
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            } 
            .thermal-box {
              width: 100% !important;
              max-width: 100% !important;
              min-width: 0 !important;
              margin: 0 auto !important;
              padding: 1mm 1.5mm !important;
              border: none !important;
            }
            .no-print { display: none !important; }
          }
          body { 
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
            font-size: 13.5px; 
            font-weight: 800;
            direction: rtl; 
            text-align: right; 
            padding: 4px; 
            color: #000; 
            background: #fff; 
            line-height: 1.45;
            width: 100%;
            max-width: 80mm;
            margin: 0 auto;
          }
          .thermal-box {
            border: 1.5px dashed #000;
            border-radius: 6px;
            padding: 6px;
          }
          .invoice-badge-box {
            text-align: center;
            font-weight: 900;
            font-size: 15px;
            margin-bottom: 8px;
            border: 2px solid #000;
            background: #fff;
            color: #000 !important;
            padding: 4px;
            border-radius: 4px;
          }
          .info-grid {
            border: 1.5px solid #000;
            border-radius: 6px;
            padding: 6px;
            font-size: 13px;
            font-weight: 800;
            margin-bottom: 8px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 2px 0;
          }
          .info-row .label {
            color: #000;
            font-weight: 800;
          }
          .info-row .val {
            font-weight: 900;
            color: #000;
          }
          .section-title {
            font-size: 13.5px;
            font-weight: 900;
            color: #000;
            border-bottom: 2px solid #000;
            border-right: 4px solid #000;
            padding: 4px 6px;
            margin: 8px 0 4px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 6px; 
            font-size: 13px; 
          }
          th { 
            background: #fff; 
            color: #000; 
            padding: 5px 2px; 
            border-top: 2px solid #000; 
            border-bottom: 2px solid #000; 
            font-weight: 900; 
            font-size: 12.5px;
          }
          td { 
            padding: 5px 2px; 
            border-bottom: 1.5px dashed #000; 
            color: #000;
            font-weight: 800;
          }
          .summary-box {
            border: 2px solid #000;
            border-radius: 6px;
            padding: 7px;
            margin-top: 8px;
            font-size: 13.5px;
            font-weight: 900;
            background: #fff;
            color: #000;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 2.5px 0;
            color: #000;
          }
          .summary-row.total-hand {
            border-top: 2px dashed #000;
            margin-top: 4px;
            padding-top: 4px;
            font-size: 15.5px;
            font-weight: 900;
            color: #000;
            border: 2px solid #000;
            padding: 5px;
            border-radius: 4px;
          }
          .signatures {
            display: flex;
            justify-content: space-between;
            margin-top: 18px;
            padding-top: 6px;
            font-size: 12.5px;
            font-weight: 900;
            text-align: center;
            color: #000;
          }
          .sig-line {
            margin-top: 22px;
            border-top: 1.5px dashed #000;
            width: 90px;
          }
          .footer-note {
            text-align: center;
            margin-top: 10px;
            font-size: 12px;
            font-weight: 900;
            color: #000;
          }
        </style>
      </head>
      <body>
        <div class="thermal-box">
          ${renderReceiptHeaderHtml({
            title: `زانیاری فرۆش و کار (${data.roleTitle})`,
            repName: data.repName,
            repPhone: data.repPhone,
            date: data.date,
            isThermal: true
          })}

          <div class="invoice-badge-box">
            زانیاری لەسەر فرۆشەکان و حسابات
          </div>

          <div class="info-grid">
            <div class="info-row">
              <span class="label">ناوی ${data.roleTitle}:</span>
              <span class="val">${data.repName}</span>
            </div>
            <div class="info-row">
              <span class="label">بەرواری کار:</span>
              <span class="val" dir="ltr">${format(data.date, 'yyyy/MM/dd')}</span>
            </div>
            <div class="info-row">
              <span class="label">ژمارەی وەسڵەکان:</span>
              <span class="val" dir="ltr">${data.sales.length} وەسڵ</span>
            </div>
          </div>

          <div class="section-title">
            <span>📦 لیستی فرۆشتنەکان</span>
            <span dir="ltr" style="font-family: monospace;">${totalSalesAmount.toLocaleString()} د.ع</span>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 22px; text-align: center;">#</th>
                <th style="text-align: right;">مارکێت / وەسڵ</th>
                <th style="width: 48px; text-align: center;">شێواز</th>
                <th style="width: 72px; text-align: left;">بڕ (د.ع)</th>
              </tr>
            </thead>
            <tbody>
              ${salesRowsHtml}
            </tbody>
          </table>

          ${data.collections && data.collections.length > 0 ? `
          <div class="section-title">
            <span>💰 قەرزی وەرگیراو</span>
            <span dir="ltr" style="font-family: monospace; color: #000;">${totalCollectedDebt.toLocaleString()} د.ع</span>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 22px; text-align: center;">#</th>
                <th style="text-align: right;">مارکێت / تێبینی</th>
                <th style="width: 72px; text-align: left;">بڕ (د.ع)</th>
              </tr>
            </thead>
            <tbody>
              ${collectionRowsHtml}
            </tbody>
          </table>
          ` : ''}

          ${data.gifts && data.gifts.length > 0 ? `
          <div class="section-title" style="background: #fff; border: 1.5px solid #000;">
            <span style="color: #000;">🎁 کاڵای هەدیە (${totalGiftItemsCount})</span>
            <span style="font-size: 12px; color: #000;">٠ د.ع</span>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 22px; text-align: center;">#</th>
                <th style="text-align: right;">کاڵا / مارکێت</th>
                <th style="width: 60px; text-align: center;">بڕ</th>
              </tr>
            </thead>
            <tbody>
              ${giftRowsHtml}
            </tbody>
          </table>
          ` : ''}

          <div class="summary-box">
            <div class="summary-row">
              <span style="color: #000;">فرۆشتنی نەقد:</span>
              <strong dir="ltr" style="color: #000;">${totalCashSales.toLocaleString()} د.ع</strong>
            </div>
            <div class="summary-row">
              <span style="color: #000;">فرۆشتنی بە قەرز:</span>
              <strong dir="ltr" style="color: #000;">${totalDebtSales.toLocaleString()} د.ع</strong>
            </div>
            <div class="summary-row">
              <span style="color: #000;">کۆی گشتی فرۆش:</span>
              <strong dir="ltr" style="color: #000;">${totalSalesAmount.toLocaleString()} د.ع</strong>
            </div>
            ${totalCollectedDebt > 0 ? `
            <div class="summary-row">
              <span style="color: #000;">قەرزی وەرگیراو:</span>
              <strong dir="ltr" style="color: #000;">+${totalCollectedDebt.toLocaleString()} د.ع</strong>
            </div>
            ` : ''}
            ${totalGiftItemsCount > 0 ? `
            <div class="summary-row" style="color: #000;">
              <span>کۆی عەدەدی هەدیە:</span>
              <strong>${totalGiftItemsCount} دانە</strong>
            </div>
            ` : ''}
            <div class="summary-row total-hand">
              <span>کۆی پارەی نەقد (دەست):</span>
              <span dir="ltr">${totalCashInHand.toLocaleString()} د.ع</span>
            </div>
          </div>

          <div class="signatures">
            <div>
              <div>واژووی ${data.roleTitle}</div>
              <div class="sig-line"></div>
            </div>
            <div>
              <div>واژووی بەڕێوەبەر</div>
              <div class="sig-line"></div>
            </div>
          </div>

          <div class="footer-note">
            کۆمپانیای RF بۆ بازرگانی گشتی
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
  printHtml(html, { isThermal: !data.isA4 });
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
  isA4?: boolean;
}

export function generateMarketDebtReceiptHtml(data: MarketDebtReceiptData): string {
  if (data.isA4) {
    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ckb">
        <head>
          <meta charset="utf-8" />
          <title>وەسڵی واسڵکردن - ${data.marketName}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            * { box-sizing: border-box; }
            body { font-family: Tahoma, 'Segoe UI', Arial, sans-serif; padding: 16px; color: #000000; background: #ffffff; font-weight: 800; line-height: 1.5; }
            .badge-title { text-align: center; font-weight: 900; font-size: 17px; background: #1e3a8a; color: #ffffff; padding: 8px 14px; border-radius: 8px; margin-bottom: 18px; }
            .info-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 14.5px; }
            .info-table td { padding: 10px 12px; border: 1.5px solid #334155; color: #000000; font-weight: 800; }
            .info-table .label { width: 32%; background: #f8fafc; font-weight: 900; color: #000000; }
            .info-table .val { font-weight: 900; color: #000000; }
            .amount-box { border: 2.5px solid #1e3a8a; border-radius: 10px; padding: 16px; text-align: center; margin: 18px 0; }
            .amount-box .title { font-size: 14px; font-weight: 900; color: #1e3a8a; margin-bottom: 4px; }
            .amount-box .amount-val { font-size: 26px; font-weight: 900; color: #14532d; font-family: monospace; }
            .debt-breakdown { border: 2px solid #000000; border-radius: 10px; padding: 14px; margin-bottom: 22px; font-size: 15px; font-weight: 900; }
            .debt-row { display: flex; justify-content: space-between; padding: 5px 0; }
            .debt-row:last-child { border-top: 2px solid #000; margin-top: 6px; padding-top: 8px; font-size: 17px; color: #92400e; }
            .signatures { display: flex; justify-content: space-between; margin-top: 45px; font-size: 13.5px; font-weight: 900; }
            .sig-block { text-align: center; }
            .sig-line { margin-top: 38px; border-top: 1.5px dashed #000; width: 160px; }
            @media print { body { padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
          </style>
        </head>
        <body>
          ${renderReceiptHeaderHtml({
            title: 'پسوڵەی واسڵکردنی قەرزی مارکێت',
            repName: data.collectorName,
            repPhone: data.collectorPhone,
            invoiceNo: data.receiptNo,
            customerName: data.marketName,
            date: data.date,
            isThermal: false
          })}
          <div class="badge-title">پسوڵەی واسڵکردنی قەرز</div>
          <table class="info-table">
            <tr><td class="label">ناوی مارکێت / کڕیار:</td><td class="val">${data.marketName}</td></tr>
            <tr><td class="label">وەرگیراوە لەلایەن:</td><td class="val">${data.collectorName}</td></tr>
            ${data.receiptNo ? `<tr><td class="label">ژمارەی وەسڵ / دەفتەر:</td><td class="val" dir="ltr" style="font-family: monospace; color: #1e3a8a;">#${data.receiptNo}</td></tr>` : ''}
            <tr><td class="label">بەروار و کات:</td><td class="val" dir="ltr">${format(data.date, 'yyyy/MM/dd HH:mm')}</td></tr>
            ${data.notes ? `<tr><td class="label">تێبینی:</td><td class="val">${data.notes}</td></tr>` : ''}
          </table>
          <div class="amount-box">
            <div class="title">بڕی پارەی واسڵکراو (دراوە لەم پسوڵەیەدا)</div>
            <div class="amount-val" dir="ltr">${data.amount.toLocaleString()} د.ع</div>
          </div>
          ${data.previousDebt !== undefined ? `
          <div class="debt-breakdown">
            <div class="debt-row"><span>قەرزی پێشوو:</span><span dir="ltr" style="font-family:monospace;">${data.previousDebt.toLocaleString()} د.ع</span></div>
            <div class="debt-row"><span>بڕی واسڵکراو:</span><span dir="ltr" style="font-family:monospace;color:#14532d;">-${data.amount.toLocaleString()} د.ع</span></div>
            <div class="debt-row"><span>قەرزی ماوە پاش دانەوە:</span><span dir="ltr" style="font-family:monospace;">${(data.remainingDebt ?? 0).toLocaleString()} د.ع</span></div>
          </div>
          ` : ''}
          <div class="signatures">
            <div class="sig-block"><div>واژووی مارکێت</div><div class="sig-line"></div></div>
            <div class="sig-block"><div>واژووی وەرگر (${data.collectorName})</div><div class="sig-line"></div></div>
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `;
  }

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ckb">
      <head>
        <meta charset="utf-8" />
        <title>وەسڵی واسڵکردن - ${data.marketName}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; color: #000 !important; }
          @page {
            size: auto;
            margin: 0;
          }
          @media print {
            html, body {
              width: 100% !important;
              max-width: 100% !important;
              min-width: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .receipt-box {
              width: 100% !important;
              max-width: 100% !important;
              min-width: 0 !important;
              margin: 0 auto !important;
              padding: 1mm 1.5mm !important;
              border: none !important;
            }
            .no-print { display: none !important; }
          }
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            padding: 4px;
            color: #000;
            background: #ffffff;
            font-size: 13.5px;
            font-weight: 800;
            width: 100%;
            max-width: 80mm;
            margin: 0 auto;
            line-height: 1.45;
          }
          .receipt-box {
            border: 1.5px dashed #000;
            border-radius: 8px;
            padding: 8px;
            color: #000;
            width: 100%;
            max-width: 80mm;
            margin: 0 auto;
          }
          
          .info-table { width: 100%; margin-bottom: 8px; border-collapse: collapse; font-size: 13.5px; }
          .info-table td { padding: 5px 0; border-bottom: 1.5px dashed #000; color: #000; font-weight: 800; }
          .info-table .label { color: #000; font-weight: 900; width: 42%; }
          .info-table .val { font-weight: 900; color: #000; text-align: left; }
          
          .amount-box {
            background: #fff;
            border: 2px solid #000;
            border-radius: 6px;
            padding: 10px;
            text-align: center;
            margin: 10px 0;
            color: #000;
          }
          .amount-box .title { font-size: 13.5px; color: #000; font-weight: 900; margin-bottom: 3px; }
          .amount-box .amount-val { font-size: 23px; font-weight: 900; color: #000; font-family: monospace; }
          
          .debt-breakdown {
            background: #fff;
            border: 1.5px solid #000;
            border-radius: 6px;
            padding: 7px 9px;
            margin-bottom: 10px;
            font-size: 13.5px;
            font-weight: 900;
            color: #000;
          }
          .debt-row { display: flex; justify-content: space-between; margin-bottom: 4px; color: #000; }
          .debt-row:last-child { margin-bottom: 0; padding-top: 4px; border-top: 1.5px dashed #000; font-weight: 900; font-size: 14.5px; }
          
          .signatures { display: flex; justify-content: space-between; margin-top: 18px; padding-top: 6px; font-size: 12.5px; font-weight: 900; color: #000; }
          .sig-block { text-align: center; color: #000; }
          .sig-line { margin-top: 22px; border-top: 1.5px dashed #000; width: 100px; }
          
          .footer-note {
            text-align: center;
            margin-top: 10px;
            font-size: 12px;
            font-weight: 900;
            color: #000;
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
            customerName: data.marketName,
            date: data.date,
            isThermal: true
          })}

          <div style="text-align: center; font-weight: 900; font-size: 15px; margin-bottom: 8px; border: 2px solid #000; background: #fff; color: #000; padding: 4px; border-radius: 4px;">
            پسوڵەی واسڵکردنی قەرز
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
              <td class="val" dir="ltr"><span style="font-family: monospace; font-size: 14.5px; font-weight: 900; color: #000;">#${data.receiptNo}</span></td>
            </tr>
            ` : ''}
            <tr>
              <td class="label">بەروار و کات:</td>
              <td class="val" dir="ltr" style="color: #000;">${format(data.date, 'yyyy/MM/dd HH:mm')}</td>
            </tr>
            ${data.notes ? `
            <tr>
              <td class="label">تێبینی:</td>
              <td class="val" style="color: #000;">${data.notes}</td>
            </tr>
            ` : ''}
          </table>

          <div class="amount-box">
            <div class="title">بڕی پارەی واسڵکراو (دراوە لەم پسوڵەیەدا)</div>
            <div class="amount-val" dir="ltr">${data.amount.toLocaleString()} د.ع</div>
          </div>

          ${data.previousDebt !== undefined ? `
          <div class="debt-breakdown">
            <div class="debt-row">
              <span style="color:#000;">قەرزی پێشوو:</span>
              <span dir="ltr" style="font-family:monospace;font-weight:900;color:#000;">${data.previousDebt.toLocaleString()} د.ع</span>
            </div>
            <div class="debt-row">
              <span style="color:#000;">بڕی واسڵکراو:</span>
              <span dir="ltr" style="font-family:monospace;font-weight:900;color:#000;">-${data.amount.toLocaleString()} د.ع</span>
            </div>
            <div class="debt-row">
              <span style="color:#000; font-weight: 900;">قەرزی ماوە پاش دانەوە:</span>
              <span dir="ltr" style="font-family:monospace; font-weight: 900; color: #000; font-size: 15px;">
                ${(data.remainingDebt ?? 0).toLocaleString()} د.ع
              </span>
            </div>
          </div>
          ` : ''}

          <div class="signatures">
            <div class="sig-block">
              <div>واژووی مارکێت</div>
              <div class="sig-line"></div>
            </div>
            <div class="sig-block">
              <div>واژووی وەرگر (${data.collectorName})</div>
              <div class="sig-line"></div>
            </div>
          </div>

          <div class="footer-note">
            سوپاس بۆ مامەڵەکردنتان لەگەڵ کۆمپانیای RF
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
  printHtml(html, { isThermal: !data.isA4 });
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
          @page { size: A4 portrait; margin: 12mm; }
          * { box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 16px; color: #000000; font-weight: 800; }
          .container { width: 100%; border: 2px solid #1e3a8a; border-radius: 12px; padding: 24px; }
          .row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1.5px dashed #000000; font-size: 15px; }
          .label { color: #000000; font-weight: 900; }
          .value { font-weight: 900; color: #000000; }
          .amount-box { background: #ffffff; border: 2.5px solid #9f1239; border-radius: 10px; padding: 18px; text-align: center; margin: 22px 0; }
          .amount-title { font-size: 14px; color: #9f1239; font-weight: 900; margin-bottom: 6px; }
          .amount-value { font-size: 28px; font-weight: 900; color: #881337; font-family: monospace; }
          .signatures { display: flex; justify-content: space-between; margin-top: 50px; padding-top: 20px; }
          .sig-box { width: 45%; text-align: center; font-size: 14px; font-weight: 900; color: #000000; }
          .sig-line { border-bottom: 1.5px solid #000000; margin-top: 50px; }
          @media print { body { padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
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

  printHtml(html, { isThermal: false });
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
      <td style="padding: 8px; text-align: center; border: 1.5px solid #334155; font-family: monospace; font-weight: 900; color: #000;">${idx + 1}</td>
      <td style="padding: 8px; border: 1.5px solid #334155; font-family: monospace; font-size: 13px; font-weight: 800; color: #000;" dir="ltr">${format(e.date, 'yyyy/MM/dd HH:mm')}</td>
      <td style="padding: 8px; border: 1.5px solid #334155; font-weight: 900; color: #000;">${e.description || '-'}</td>
      <td style="padding: 8px; border: 1.5px solid #334155; font-weight: 900; color: #881337; text-align: left; font-family: monospace;" dir="ltr">${(e.amount || 0).toLocaleString()} د.ع</td>
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
          * { box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 14px; color: #000000; font-weight: 700; }
          .container { width: 100%; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13.5px; }
          th { background: #1e3a8a; border: 1.5px solid #000000; padding: 10px 8px; text-align: right; font-weight: 900; color: #ffffff; }
          .summary-card { margin-top: 18px; padding: 14px; background: #ffffff; border: 2.5px solid #9f1239; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; }
          .summary-title { font-weight: 900; color: #881337; font-size: 15.5px; }
          .summary-val { font-size: 21px; font-weight: 900; color: #881337; font-family: monospace; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; }
          .sig-box { width: 40%; text-align: center; font-size: 13.5px; font-weight: 900; color: #000000; }
          .sig-line { border-bottom: 1.5px solid #000000; margin-top: 45px; }
          @media print { body { padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
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
                <th style="width: 145px;">بەروار</th>
                <th>هۆکار و وردەکاری خەرجی</th>
                <th style="width: 150px; text-align: left;">بڕ (د.ع)</th>
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

  printHtml(html, { isThermal: false });
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
    cartonPurchasedQuantity?: number;
    packetPurchasedQuantity?: number;
    cartonBonusQuantity?: number;
    packetBonusQuantity?: number;
    bonusQuantity?: number;
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
    [key: string]: any;
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
    const cBonus = item.cartonBonusQuantity || (item.unitType === 'carton' ? (item.bonusQuantity || 0) : 0) || 0;
    const cPurchased = item.cartonPurchasedQuantity !== undefined ? item.cartonPurchasedQuantity : Math.max(0, cTotal - cBonus);

    const pTotal = item.packetQuantity !== undefined ? item.packetQuantity : (item.unitType === 'packet' ? (item.quantity || 0) : 0);
    const pBonus = item.packetBonusQuantity || (item.unitType === 'packet' ? (item.bonusQuantity || 0) : 0) || 0;
    const pPurchased = item.packetPurchasedQuantity !== undefined ? item.packetPurchasedQuantity : Math.max(0, pTotal - pBonus);

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
    const cBonus = item.cartonBonusQuantity || (item.unitType === 'carton' ? (item.bonusQuantity || 0) : 0) || 0;
    const cPurchased = item.cartonPurchasedQuantity !== undefined ? item.cartonPurchasedQuantity : Math.max(0, cTotal - cBonus);

    const pTotal = item.packetQuantity !== undefined ? item.packetQuantity : (item.unitType === 'packet' ? (item.quantity || 0) : 0);
    const pBonus = item.packetBonusQuantity || (item.unitType === 'packet' ? (item.bonusQuantity || 0) : 0) || 0;
    const pPurchased = item.packetPurchasedQuantity !== undefined ? item.packetPurchasedQuantity : Math.max(0, pTotal - pBonus);

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
        <td style="padding: 8px; text-align: center; border: 1.5px solid #334155; font-family: monospace; font-weight: 900; color: #000000;">${idx + 1}</td>
        <td style="padding: 8px; border: 1.5px solid #334155; font-weight: 900; color: #000000;">
          ${item.name}
        </td>
        <td style="padding: 8px; text-align: center; border: 1.5px solid #334155; font-weight: 900; color: #000000; font-family: monospace;" dir="rtl">
          ${cartonDisplay}
        </td>
        <td style="padding: 8px; text-align: center; border: 1.5px solid #334155; font-weight: 900; color: #000000; font-family: monospace;" dir="rtl">
          ${packetDisplay}
        </td>
        <td style="padding: 8px; text-align: center; border: 1.5px solid #334155; color: #78350f; font-weight: 900; font-size: 13px;">
          ${bonusText}
        </td>
        <td style="padding: 8px; border: 1.5px solid #334155; text-align: left; font-family: monospace; font-size: 13px; font-weight: 900; color: #000000;" dir="ltr">
          ${cCost > 0 ? `ک: ${cCost.toLocaleString()}` : ''}
          ${pCost > 0 ? ` پ: ${pCost.toLocaleString()}` : ''}
        </td>
        <td style="padding: 8px; border: 1.5px solid #334155; text-align: left; font-family: monospace; font-size: 13px; font-weight: 900; color: #1e3a8a;" dir="ltr">
          ${cSell > 0 ? `ک: ${cSell.toLocaleString()}` : ''}
          ${pSell > 0 ? ` پ: ${pSell.toLocaleString()}` : ''}
        </td>
        <td style="padding: 8px; border: 1.5px solid #334155; text-align: left; font-family: monospace; font-weight: 900; color: #000000;" dir="ltr">
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
        <title>وەسڵی کڕینی کۆگا #${cleanInvoiceNo}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          * { box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 14px; color: #000000; font-weight: 700; }
          .container { width: 100%; }
          .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 16px 0; background: #ffffff; border: 2px solid #1e3a8a; border-radius: 10px; padding: 12px 16px; font-size: 13.5px; }
          .meta-item { display: flex; flex-direction: column; gap: 3px; }
          .meta-label { color: #000000; font-size: 12px; font-weight: 800; }
          .meta-value { color: #000000; font-weight: 900; font-size: 14.5px; }
          table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13.5px; text-align: right; }
          th { background: #1e3a8a; padding: 10px 8px; border: 1.5px solid #000000; font-weight: 900; color: #ffffff; }
          .summary-card { background: #ffffff; border: 2.5px solid #1e3a8a; border-radius: 10px; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; margin-top: 16px; }
          .summary-title { font-size: 15px; font-weight: 900; color: #172554; }
          .summary-value { font-size: 22px; font-weight: 900; color: #1e3a8a; font-family: monospace; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 16px; }
          .sig-box { width: 40%; text-align: center; font-size: 13px; font-weight: 900; color: #000000; }
          .sig-line { border-bottom: 1.5px solid #000000; margin-top: 45px; }
          @media print { body { padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
        </style>
      </head>
      <body>
        <div class="container">
          ${header}
          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">ناوی کۆمپانیا:</span>
              <span class="meta-value">${cleanSupplier}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">ژمارەی سەر وەسڵ:</span>
              <span class="meta-value" style="color: #1e3a8a; font-family: monospace;" dir="ltr">#${cleanInvoiceNo}</span>
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
                <th style="width: 115px; text-align: left;">کۆی تێچوو</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <div class="summary-card">
            <div>
              <div class="summary-title">کۆی گشتی تێچووی وەسڵ:</div>
              <div style="font-size: 12px; font-weight: 800; color: #000000; margin-top: 3px;">(دیاری و هەدیە بە ٠ د.ع ئەژمار کراوە و لەسەر کۆی گشتی هەژمار نەکراوە)</div>
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

  printHtml(html, { isThermal: false });
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
      <td style="text-align: center; color: #000000; font-family: monospace; font-weight: 900;">${idx + 1}</td>
      <td style="font-weight: 900; color: #000000;">${it.description || 'کاڵا / مامەڵەی کڕین'}</td>
      <td style="text-align: left; font-family: monospace; font-weight: 900; color: #000000;" dir="ltr">${(it.originalAmount || 0).toLocaleString()} د.ع</td>
      ${data.paidAmount > 0 ? `<td style="text-align: left; font-family: monospace; font-weight: 900; color: #14532d;" dir="ltr">${(it.paidAmount || 0).toLocaleString()} د.ع</td>` : ''}
      <td style="text-align: left; font-family: monospace; font-weight: 900; color: #92400e;" dir="ltr">${((it.remainingAmount !== undefined ? it.remainingAmount : it.originalAmount) || 0).toLocaleString()} د.ع</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ku">
      <head>
        <meta charset="utf-8" />
        <title>وەسڵی قەرزی کۆمپانیا #${cleanInv}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          * { box-sizing: border-box; }
          body {
            font-family: system-ui, -apple-system, sans-serif;
            margin: 0;
            padding: 12px;
            color: #000000;
            background: #fff;
            direction: rtl;
            font-weight: 700;
          }
          .invoice-box {
            width: 100%;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 15px;
            background: #ffffff;
            border: 2px solid #1e3a8a;
            border-radius: 10px;
            padding: 10px 14px;
          }
          .meta-item { display: flex; flex-direction: column; gap: 2px; }
          .meta-label { font-size: 12px; color: #000000; font-weight: 800; }
          .meta-value { font-size: 14px; font-weight: 900; color: #000000; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
            font-size: 13px;
          }
          th {
            background-color: #1e3a8a;
            color: #ffffff;
            font-weight: 900;
            padding: 10px 10px;
            border: 1.5px solid #000000;
            text-align: right;
          }
          td {
            padding: 9px 10px;
            border: 1.5px solid #334155;
            color: #000000;
            font-weight: 800;
          }
          .summary-card {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #ffffff;
            border: 2.5px solid #92400e;
            border-radius: 12px;
            padding: 12px 18px;
            margin-top: 10px;
          }
          .summary-title { font-size: 14.5px; font-weight: 900; color: #78350f; }
          .summary-value { font-size: 20px; font-weight: 900; color: #92400e; font-family: monospace; }
          .signatures {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            font-weight: 900;
            color: #000000;
          }
          .sig-box { text-align: center; width: 200px; }
          .sig-line { border-bottom: 1.5px dashed #000000; margin-top: 35px; }
          @media print {
            body { padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
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
              <span class="meta-value" dir="ltr" style="font-family: monospace; color: #1e3a8a;">#${cleanInv}</span>
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
              ${data.paidAmount > 0 ? `<div style="font-size: 12px; font-weight: 800; color: #14532d; margin-top: 2px;">(کۆی سەرەتایی: ${(data.originalAmount || 0).toLocaleString()} د.ع - دراوە: ${(data.paidAmount || 0).toLocaleString()} د.ع)</div>` : ''}
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

  printHtml(html, { isThermal: false });
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
      <td style="text-align: center; color: #000000; font-family: monospace; font-weight: 900;">${idx + 1}</td>
      <td style="font-weight: 900; color: #000000;">${it.description || 'کاڵا / مامەڵەی کڕین'}</td>
      <td style="text-align: left; font-family: monospace; font-weight: 900; color: #14532d;" dir="ltr">${(it.amount || 0).toLocaleString()} د.ع</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ku">
      <head>
        <meta charset="utf-8" />
        <title>وەسڵی نەقدی کۆمپانیا #${cleanInv}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          * { box-sizing: border-box; }
          body {
            font-family: system-ui, -apple-system, sans-serif;
            margin: 0;
            padding: 12px;
            color: #000000;
            background: #fff;
            direction: rtl;
            font-weight: 700;
          }
          .invoice-box {
            width: 100%;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 15px;
            background: #ffffff;
            border: 2px solid #1e3a8a;
            border-radius: 10px;
            padding: 10px 14px;
          }
          .meta-item { display: flex; flex-direction: column; gap: 2px; }
          .meta-label { font-size: 12px; color: #000000; font-weight: 800; }
          .meta-value { font-size: 14px; font-weight: 900; color: #000000; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
            font-size: 13px;
          }
          th {
            background-color: #1e3a8a;
            color: #ffffff;
            font-weight: 900;
            padding: 10px 10px;
            border: 1.5px solid #000000;
            text-align: right;
          }
          td {
            padding: 9px 10px;
            border: 1.5px solid #334155;
            color: #000000;
            font-weight: 800;
          }
          .summary-card {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #ffffff;
            border: 2.5px solid #14532d;
            border-radius: 12px;
            padding: 12px 18px;
            margin-top: 10px;
          }
          .summary-title { font-size: 14.5px; font-weight: 900; color: #14532d; }
          .summary-value { font-size: 20px; font-weight: 900; color: #14532d; font-family: monospace; }
          .signatures {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            font-weight: 900;
            color: #000000;
          }
          .sig-box { text-align: center; width: 200px; }
          .sig-line { border-bottom: 1.5px dashed #000000; margin-top: 35px; }
          @media print {
            body { padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
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
              <span class="meta-value" dir="ltr" style="font-family: monospace; color: #1e3a8a;">#${cleanInv}</span>
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

  printHtml(html, { isThermal: false });
}

export interface WarehouseStockSummaryPrintData {
  items: Array<{
    name: string;
    totalCartons: number;
    totalCartonBonus?: number;
    totalPackets?: number;
    totalPacketBonus?: number;
    latestCartonSellingPrice?: number;
    latestPacketSellingPrice?: number;
    suppliers?: string[];
    invoicesCount?: number;
  }>;
  totalCartonsAll: number;
  totalCartonBonusAll?: number;
  totalPacketsAll?: number;
  totalPacketBonusAll?: number;
  date?: number;
}

export function printWarehouseStockSummaryPopup(data: WarehouseStockSummaryPrintData) {
  const settings = getCompanySettings();
  const cName = settings.name || 'کۆمپانیای RF';
  const cPhone = settings.phone || '07506144894';
  const dateStr = format(data.date || Date.now(), 'yyyy/MM/dd HH:mm');

  const rows = data.items.map((it, idx) => {
    const cPurchased = Math.max(0, it.totalCartons - (it.totalCartonBonus || 0));
    const cBonus = it.totalCartonBonus || 0;
    const cartonStr = it.totalCartons > 0
      ? (cBonus > 0 ? `${cPurchased.toLocaleString()} + ${cBonus.toLocaleString()} هەدیە` : `${it.totalCartons.toLocaleString()}`)
      : '-';

    const pPurchased = Math.max(0, (it.totalPackets || 0) - (it.totalPacketBonus || 0));
    const pBonus = it.totalPacketBonus || 0;
    const packetStr = (it.totalPackets || 0) > 0
      ? (pBonus > 0 ? `${pPurchased.toLocaleString()} + ${pBonus.toLocaleString()} هەدیە` : `${(it.totalPackets || 0).toLocaleString()}`)
      : '-';

    const priceParts = [];
    if (it.latestCartonSellingPrice) priceParts.push(`ک: ${it.latestCartonSellingPrice.toLocaleString()} د.ع`);
    if (it.latestPacketSellingPrice) priceParts.push(`پ: ${it.latestPacketSellingPrice.toLocaleString()} د.ع`);
    const priceStr = priceParts.join(' | ') || '-';

    const suppStr = it.suppliers && it.suppliers.length > 0 ? it.suppliers.join('، ') : '-';

    return `
      <tr>
        <td style="text-align: center; color: #000000; font-family: monospace; padding: 7px; font-weight: 900;">${idx + 1}</td>
        <td style="font-weight: 900; color: #000000; padding: 7px; font-size: 13.5px;">${it.name}</td>
        <td style="text-align: center; font-weight: 900; color: #172554; padding: 7px; font-family: monospace; font-size: 13.5px;" dir="rtl">
          ${cartonStr}
        </td>
        <td style="text-align: center; font-weight: 900; color: #14532d; padding: 7px; font-family: monospace;" dir="rtl">
          ${packetStr}
        </td>
        <td style="text-align: center; font-weight: 900; color: #1e3a8a; padding: 7px; font-family: monospace;" dir="ltr">
          ${priceStr}
        </td>
        <td style="padding: 7px; color: #000000; font-size: 12px; font-weight: 800;">
          ${suppStr}
        </td>
      </tr>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ckb">
      <head>
        <meta charset="utf-8" />
        <title>کۆی گشتی بەردەستی کۆگا بەپێی کاڵا</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          * { box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, sans-serif; direction: rtl; margin: 0; padding: 12px; color: #000000; background: #fff; font-weight: 700; }
          .container { width: 100%; }
          .header { text-align: center; border-bottom: 3px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 16px; }
          .title { font-size: 20px; font-weight: 900; color: #172554; margin: 4px 0; }
          .subtitle { font-size: 13px; color: #000000; font-weight: 800; }
          .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #ffffff; border: 2px solid #1e3a8a; border-radius: 10px; padding: 10px; margin-bottom: 16px; font-size: 12.5px; }
          .meta-item { display: flex; flex-direction: column; }
          .meta-label { font-size: 11px; color: #000000; font-weight: 800; }
          .meta-val { font-size: 14.5px; font-weight: 900; color: #000000; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px; }
          th { background: #1e3a8a; border: 1.5px solid #000000; padding: 9px 8px; font-weight: 900; color: #ffffff; text-align: right; }
          td { border: 1.5px solid #334155; color: #000000; font-weight: 800; }
          .summary-card { background: #ffffff; border: 2.5px solid #1e3a8a; border-radius: 12px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
          .summary-title { font-size: 15px; font-weight: 900; color: #172554; }
          .summary-value { font-size: 21px; font-weight: 900; color: #1e3a8a; font-family: monospace; }
          .signatures { display: flex; justify-content: space-between; margin-top: 35px; }
          .sig-box { width: 40%; text-align: center; font-size: 12.5px; font-weight: 900; color: #000000; }
          .sig-line { border-bottom: 1.5px solid #000000; margin-top: 40px; }
          @media print { body { padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div style="font-size: 22px; font-weight: 900; letter-spacing: 1px; color: #172554;">TAM TAM</div>
            <div style="font-size: 15px; font-weight: 900; color: #000000;">${cName}</div>
            <div class="title">لیستی کۆی گشتی بەردەستی کاڵاکان لە کۆگا (بە کارتۆن)</div>
            <div class="subtitle">بەرواری دەرکردن: ${dateStr} | مۆبایل: ${cPhone}</div>
          </div>

          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">ژمارەی جۆرەکان:</span>
              <span class="meta-val">${data.items.length} جۆر کاڵا</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">کۆی گشتی کارتۆن لە کۆگا:</span>
              <span class="meta-val" style="color: #1e3a8a;">${data.totalCartonsAll.toLocaleString()} کارتۆن</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">کۆی پاکەت لە کۆگا:</span>
              <span class="meta-val" style="color: #14532d;">${(data.totalPacketsAll || 0).toLocaleString()} پاکەت</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">کاتی چاپ:</span>
              <span class="meta-val" style="font-size: 12.5px;" dir="ltr">${dateStr}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 30px; text-align: center;">#</th>
                <th>ناوی کاڵا</th>
                <th style="text-align: center;">کۆی کارتۆن</th>
                <th style="text-align: center;">کۆی پاکەت</th>
                <th style="text-align: center;">نرخی فرۆشتن</th>
                <th>کۆمپانیاکان</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <div class="summary-card">
            <div class="summary-title">کۆی گشتی هەموو کارتۆنە بەردەستەکانی کۆگا:</div>
            <div class="summary-value" dir="rtl">${data.totalCartonsAll.toLocaleString()} کارتۆن</div>
          </div>

          <div class="signatures">
            <div class="sig-box">
              <div>واژووی سەرپەرشتیاری کۆگا</div>
              <div class="sig-line"></div>
            </div>
            <div class="sig-box">
              <div>واژووی بەڕێوەبەر / ژمێریار</div>
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

  printHtml(html, { isThermal: false });
}



