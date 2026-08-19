import re

with open('src/components/views/LedgerView.tsx', 'r') as f:
    content = f.read()

if 'Printer' not in content:
    content = re.sub(r'import { (.*?) } from \'lucide-react\';', r'import { \1, Printer } from \'lucide-react\';', content)

print_func = """
  const printDeal = (d: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html dir="rtl">
        <head>
          <title>پسوڵەی دەفتەر حسابات - ${d.invoiceNumber}</title>
          <style>
            body { font-family: Tahoma, Arial, sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 10px; }
            .title { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
            .subtitle { color: #666; font-size: 14px; }
            .details { margin-bottom: 30px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 10px; padding: 5px 0; border-bottom: 1px dashed #eee; }
            .label { font-weight: bold; }
            .amount { font-size: 20px; font-weight: bold; text-align: center; margin: 30px 0; padding: 15px; border: 2px solid #333; border-radius: 8px; }
            .footer { text-align: center; margin-top: 50px; font-size: 12px; color: #888; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">کۆمپانیای RF</div>
            <div class="subtitle">پسوڵەی دەفتەر حسابات</div>
          </div>
          
          <div class="details">
            <div class="row">
              <span class="label">جۆر:</span>
              <span>${d.isDeleted ? 'سڕاوەتەوە' : d.type}</span>
            </div>
            <div class="row">
              <span class="label">ناوی لایەن:</span>
              <span>${d.entityName}</span>
            </div>
            <div class="row">
              <span class="label">کەس:</span>
              <span>${d.personName}</span>
            </div>
            <div class="row">
              <span class="label">بەروار:</span>
              <span dir="ltr">${format(d.date, 'yyyy-MM-dd HH:mm')}</span>
            </div>
            <div class="row">
              <span class="label">ژمارەی فاتیرە:</span>
              <span dir="ltr">${d.invoiceNumber}</span>
            </div>
          </div>
          
          <div class="amount" dir="ltr">
            ${(d.amount || 0).toLocaleString()} د.ع
          </div>
          
          <div style="display: flex; justify-content: space-between; margin-top: 50px;">
            <div style="text-align: center;">
              <div>واژووی پێدەر</div>
              <div style="margin-top: 30px; border-top: 1px solid #333; width: 150px;"></div>
            </div>
            <div style="text-align: center;">
              <div>واژووی وەرگر</div>
              <div style="margin-top: 30px; border-top: 1px solid #333; width: 150px;"></div>
            </div>
          </div>
          
          <div class="footer">
            کات و بەرواری چاپ: <span dir="ltr">${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</span>
          </div>
          <script>
            window.onload = () => window.print();
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };
"""

content = re.sub(r'(  return \(\n\s*<div)', print_func + r'\1', content)

# Replace Trash2 button with Printer + Trash2
button_html = """                        <div className="flex items-center gap-2">
                            <button
                              onClick={() => printDeal(d)}
                              className="text-blue-600 hover:bg-blue-50 p-1.5 rounded transition"
                              title="چاپکردن"
                            >
                              <Printer size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteDeal(d)}
                              className="text-red-600 hover:bg-red-50 p-1.5 rounded transition"
                              title="سڕینەوە"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>"""

content = re.sub(r'<button\s*onClick=\{\(\) => handleDeleteDeal\(d\)\}.*?</button>', button_html, content, flags=re.DOTALL)

with open('src/components/views/LedgerView.tsx', 'w') as f:
    f.write(content)

print("done")
