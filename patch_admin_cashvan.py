import re

with open('src/components/views/AdminCashvanView.tsx', 'r') as f:
    content = f.read()

# Add imports for deleteDoc
if 'deleteDoc' not in content:
    content = content.replace("import { collection, query, onSnapshot, updateDoc, doc, addDoc, getDocs, where } from 'firebase/firestore';", "import { collection, query, onSnapshot, updateDoc, doc, addDoc, getDocs, where, deleteDoc } from 'firebase/firestore';")

if 'Trash2' not in content:
    content = content.replace("import { Truck, CheckCircle2, DollarSign, History } from 'lucide-react';", "import { Truck, CheckCircle2, DollarSign, History, Trash2, Edit2, Printer } from 'lucide-react';")

handlers = """
  const handleDeleteSale = async (id: string) => {
    if (window.confirm('دڵنیایت لە سڕینەوەی ئەم وەسڵە؟')) {
      await deleteDoc(doc(db, 'cashvan_sales', id));
    }
  };

  const handleEditSale = async (sale: CashvanSale) => {
    const newAmount = window.prompt('کۆی گشتی نوێ بنووسە:', sale.totalAmount.toString());
    if (newAmount !== null && !isNaN(Number(newAmount))) {
      await updateDoc(doc(db, 'cashvan_sales', sale.id), { totalAmount: Number(newAmount) });
    }
  };

  const handleDeleteTransfer = async (id: string) => {
    if (window.confirm('دڵنیایت لە سڕینەوەی ئەم کاڵا پێدانە؟')) {
      await deleteDoc(doc(db, 'cashvan_transfers', id));
    }
  };
"""

# Insert handlers before handleAccount
content = content.replace("  const handleAccount = async", handlers + "\n  const handleAccount = async")

# Add buttons for Sales
sales_actions = """                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAccount(sale)}
                            className="px-4 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 font-bold rounded-lg transition flex items-center gap-2"
                          >
                            <CheckCircle2 size={16} /> ناردن بۆ حیسابات
                          </button>
                          <button onClick={() => handleEditSale(sale)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Edit2 size={16}/></button>
                          <button onClick={() => handleDeleteSale(sale.id)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Trash2 size={16}/></button>
                        </div>"""

content = re.sub(r'<button\s*onClick=\{\(\) => handleAccount\(sale\)\}.*?</button>', sales_actions, content, flags=re.DOTALL)

# Add buttons for Transfers
transfers_th = """                  <th className="p-4">کۆی تێچوو</th>
                  <th className="p-4">کردارەکان</th>"""
content = content.replace('<th className="p-4">کۆی تێچوو</th>', transfers_th)

transfers_td = """                    <td className="p-4 font-bold text-slate-800" dir="ltr">{t.totalCost.toLocaleString()}</td>
                    <td className="p-4">
                      <button onClick={() => handleDeleteTransfer(t.id)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Trash2 size={16}/></button>
                    </td>"""
content = re.sub(r'<td className="p-4 font-bold text-slate-800" dir="ltr">\{t\.totalCost\.toLocaleString\(\)\}</td>', transfers_td, content)

with open('src/components/views/AdminCashvanView.tsx', 'w') as f:
    f.write(content)

print("done")
