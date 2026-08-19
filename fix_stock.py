import re

with open('src/components/views/StockHistoryView.tsx', 'r') as f:
    content = f.read()

# Make sure getDoc, getDocs are imported
if 'getDoc' not in content:
    content = content.replace("import { collection, onSnapshot, query, orderBy, where, deleteDoc, doc, updateDoc } from 'firebase/firestore';", "import { collection, onSnapshot, query, orderBy, where, deleteDoc, doc, updateDoc, getDoc, getDocs } from 'firebase/firestore';")

# Add FileText icon
if 'FileText' not in content:
    content = content.replace("import { Package, Search, Calendar, Trash2, Edit2, Printer }", "import { Package, Search, Calendar, Trash2, Edit2, Printer, FileText }")

new_handleEdit = """
  const handleEdit = async (history: StockHistory) => {
    const newQtyStr = window.prompt('بڕی هاتوو نوێ بنووسە:', history.quantityAdded.toString());
    if (newQtyStr !== null && newQtyStr.trim() !== '') {
      const newQty = Number(newQtyStr);
      if (!isNaN(newQty)) {
        const diff = newQty - history.quantityAdded;
        await updateDoc(doc(db, 'stock_history', history.id), { quantityAdded: newQty });

        // Update item total
        const itemRef = doc(db, 'items', history.itemId);
        const itemSnap = await getDoc(itemRef);
        if (itemSnap.exists()) {
          const currentQty = itemSnap.data().quantity || 0;
          await updateDoc(itemRef, { quantity: currentQty + diff });
        }
      }
    }
  };

  const printAllHistory = async (itemName: string) => {
    const q = query(collection(db, 'stock_history'), where('itemName', '==', itemName));
    const snap = await getDocs(q);
    const hist: StockHistory[] = [];
    snap.forEach(d => hist.push({ id: d.id, ...d.data() } as StockHistory));
    
    hist.sort((a,b) => b.date - a.date);
    
    let totalAdded = 0;
    const rowsHtml = hist.map(h => {
      totalAdded += h.quantityAdded;
      return `<tr>
        <td dir="ltr">${format(h.date, 'yyyy-MM-dd HH:mm')}</td>
        <td>${h.quantityAdded.toLocaleString()}</td>
      </tr>`;
    }).join('');

    const html = `
      <html dir="rtl">
        <head>
          <title>هەموو هاتنەکانی کاڵا - ${itemName}</title>
          <style>
            body { font-family: Tahoma, Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; text-align: right; }
            th, td { border: 1px solid #ddd; padding: 12px; }
            th { background-color: #f8f9fa; }
            .header { text-align: center; margin-bottom: 20px; }
            .summary { margin-top: 20px; padding: 15px; border: 2px solid #333; border-radius: 8px; font-weight: bold; font-size: 18px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>کۆمپانیای RF</h2>
            <h3>ڕاپۆرتی هاتنەکانی کاڵا: ${itemName}</h3>
            <p>بەرواری چاپ: <span dir="ltr">${format(Date.now(), 'yyyy-MM-dd HH:mm')}</span></p>
          </div>
          <table>
            <thead><tr><th>بەروار و کات</th><th>بڕی زیادکراو</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div class="summary">
            کۆی گشتی هاتوو بۆ ئەم کاڵایە: ${totalAdded.toLocaleString()} پارچە
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `;
    const win = window.open('', '_blank');
    win?.document.write(html);
    win?.document.close();
  };
"""

content = re.sub(r'  const handleEdit = async \(history: StockHistory\) => \{.*?\n  \};\n', new_handleEdit, content, flags=re.DOTALL)

# Add PrintAll button to table rows
button_html = """                        <button onClick={() => printHistory(item)} title="چاپکردنی تەنها ئەمە" className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Printer size={16}/></button>
                        <button onClick={() => printAllHistory(item.itemName)} title="هەموو هاتنەکانی ئەم کاڵایە" className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100"><FileText size={16}/></button>"""

content = re.sub(r'<button onClick=\{\(\) => printHistory\(item\)\} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Printer size=\{16\}/></button>', button_html, content)

with open('src/components/views/StockHistoryView.tsx', 'w') as f:
    f.write(content)

print("done")
