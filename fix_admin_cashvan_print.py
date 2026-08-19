import re

with open('src/components/views/AdminCashvanView.tsx', 'r') as f:
    content = f.read()

if 'getDocs' not in content:
    content = re.sub(r"import \{ collection, (.*?) \} from 'firebase/firestore';", r"import { collection, \1, getDocs } from 'firebase/firestore';", content)

if 'FileText' not in content:
    content = content.replace("Printer } from 'lucide-react';", "Printer, FileText } from 'lucide-react';")

statement_func = """
  const printStatement = async (entityName: string) => {
    if (!entityName || entityName === 'نەزانراو' || entityName === '') {
      alert('ناوی مارکێت دیاری نەکراوە بۆ چاپکردنی کەشف حیساب');
      return;
    }
    const q = query(collection(db, 'transactions'), where('relatedEntityId', '==', entityName));
    const snap = await getDocs(q);
    const allTrans: Transaction[] = [];
    snap.forEach(d => allTrans.push({ id: d.id, ...d.data() } as Transaction));
    
    allTrans.sort((a,b) => a.date - b.date);
    
    let totalDebt = 0;
    let totalPaid = 0;
    let totalCash = 0;

    const rowsHtml = allTrans.map(t => {
      let typeLabel = '';
      if (t.type.includes('debt') && !t.type.includes('paid')) { typeLabel = 'قەرز'; totalDebt += t.amount || 0; }
      else if (t.type.includes('paid')) { typeLabel = 'واسڵکراو'; totalPaid += t.amount || 0; }
      else { typeLabel = 'نەقد/تر'; totalCash += t.amount || 0; }
      
      return `<tr>
        <td dir="ltr">${format(t.date, 'yyyy-MM-dd HH:mm')}</td>
        <td>${typeLabel}</td>
        <td>${t.description}</td>
        <td dir="ltr">${(t.amount || 0).toLocaleString()}</td>
      </tr>`;
    }).join('');
    
    let finalBalance = totalDebt - totalPaid;
    
    const html = `
    <html dir="rtl">
      <head>
        <title>کەشف حیساب - ${entityName}</title>
        <style>
          body { font-family: Tahoma, Arial, sans-serif; padding: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
          th { background-color: #f8f9fa; }
          .header { text-align: center; margin-bottom: 20px; }
          .summary { margin-top: 20px; padding: 15px; border: 2px solid #333; border-radius: 8px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>کۆمپانیای RF</h2>
          <h3>کەشف حیساب - ${entityName}</h3>
          <p>بەرواری چاپ: <span dir="ltr">${format(Date.now(), 'yyyy-MM-dd HH:mm')}</span></p>
        </div>
        <table style="width: 100%">
          <thead><tr><th>بەروار و کات</th><th>جۆر</th><th>وردەکاری</th><th>بڕی پارە</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="summary">
          <p>کۆی قەرزەکان: <span dir="ltr">${totalDebt.toLocaleString()}</span></p>
          <p>کۆی واسڵکراو: <span dir="ltr">${totalPaid.toLocaleString()}</span></p>
          <p>کۆی نەقد: <span dir="ltr">${totalCash.toLocaleString()}</span></p>
          <hr style="margin: 10px 0;" />
          <h3 style="margin: 0; font-size: 20px;">ماوەی قەرز (باڵانس): <span dir="ltr">${finalBalance.toLocaleString()}</span> د.ع</h3>
        </div>
        <script>window.onload = () => window.print();</script>
      </body>
    </html>`;
    const win = window.open('', '_blank');
    win?.document.write(html);
    win?.document.close();
  };
"""

if 'const printStatement' not in content:
    content = content.replace("  const handleDeleteSale = async", statement_func + "\n  const handleDeleteSale = async")

button_html = """                          <button onClick={() => printStatement(sale.marketName)} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100" title="کەشف حیساب"><FileText size={16}/></button>
                          <button onClick={() => handleEditSale(sale)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Edit2 size={16}/></button>"""

content = re.sub(r'<button onClick=\{\(\) => handleEditSale\(sale\)\} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Edit2 size=\{16\}/></button>', button_html, content)

with open('src/components/views/AdminCashvanView.tsx', 'w') as f:
    f.write(content)

print("done")
