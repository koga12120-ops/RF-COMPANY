import re

with open('src/components/views/StockHistoryView.tsx', 'r') as f:
    content = f.read()

# Imports
if 'deleteDoc' not in content:
    content = content.replace("import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';", "import { collection, onSnapshot, query, orderBy, where, deleteDoc, doc, updateDoc } from 'firebase/firestore';")

if 'Trash2' not in content:
    content = content.replace("import { Package, Search, Calendar } from 'lucide-react';", "import { Package, Search, Calendar, Trash2, Edit2, Printer } from 'lucide-react';")

handlers = """
  const handleDelete = async (id: string) => {
    if (window.confirm('دڵنیایت لە سڕینەوەی ئەم مێژووە؟')) {
      await deleteDoc(doc(db, 'stock_history', id));
    }
  };

  const handleEdit = async (history: StockHistory) => {
    const newQty = window.prompt('بڕی هاتوو نوێ بنووسە:', history.quantityAdded.toString());
    if (newQty !== null && !isNaN(Number(newQty))) {
      await updateDoc(doc(db, 'stock_history', history.id), { quantityAdded: Number(newQty) });
    }
  };

  const printHistory = (history: StockHistory) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html dir="rtl">
        <head>
          <title>پسوڵەی هاتنی کاڵا - ${history.itemName}</title>
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
            <div class="subtitle">پسوڵەی هاتنی کاڵا بۆ کۆگا</div>
          </div>
          
          <div class="details">
            <div class="row">
              <span class="label">ناوی کاڵا:</span>
              <span>${history.itemName}</span>
            </div>
            <div class="row">
              <span class="label">بەروار:</span>
              <span dir="ltr">${format(history.date, 'yyyy-MM-dd HH:mm')}</span>
            </div>
          </div>
          
          <div class="amount" dir="ltr">
            بڕی هاتوو: ${history.quantityAdded}
          </div>
          
          <div style="display: flex; justify-content: space-between; margin-top: 50px;">
            <div style="text-align: center;">
              <div>واژووی کۆگا</div>
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

content = content.replace("  const filteredHistory = history.filter(h =>", handlers + "\n  const filteredHistory = history.filter(h =>")

# Table headers
th_replace = """                  <th className="px-4 py-3 font-semibold">بڕی هاتوو</th>
                  <th className="px-4 py-3 font-semibold">بەروار</th>
                  <th className="px-4 py-3 font-semibold">کردارەکان</th>"""
content = content.replace("""                  <th className="px-4 py-3 font-semibold">بڕی هاتوو</th>
                  <th className="px-4 py-3 font-semibold">بەروار</th>""", th_replace)

# Table rows
td_replace = """                    <td className="px-4 py-3 text-slate-500 font-mono text-xs" dir="ltr">{format(h.date, 'yyyy-MM-dd HH:mm')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => printHistory(h)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Printer size={16}/></button>
                        <button onClick={() => handleEdit(h)} className="p-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100"><Edit2 size={16}/></button>
                        <button onClick={() => handleDelete(h.id)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Trash2 size={16}/></button>
                      </div>
                    </td>"""
content = re.sub(r'<td className="px-4 py-3 text-slate-500 font-mono text-xs" dir="ltr">\{format\(h.date, \'yyyy-MM-dd HH:mm\'\)\}</td>', td_replace, content)

# Also we need to span the empty table state to 4 columns instead of 3
content = content.replace("colSpan={3}", "colSpan={4}")

with open('src/components/views/StockHistoryView.tsx', 'w') as f:
    f.write(content)

print("done")
