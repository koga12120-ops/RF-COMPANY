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

export function generateStatementHtml(entityName: string, transactions: Transaction[]): string {
  const sorted = [...transactions].sort((a, b) => a.date - b.date);

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
        <title>کەشف حیساب - ${entityName}</title>
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
          <h3>کەشف حیساب - ${entityName}</h3>
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

export function printStatementPopup(entityName: string, transactions: Transaction[]) {
  const html = generateStatementHtml(entityName, transactions);
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
