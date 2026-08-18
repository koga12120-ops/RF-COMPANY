import re

with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

buttons = """                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => printReceipt(sale, String(sales.length - index).padStart(6, '0'))} className="p-1.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100"><Printer size={16} /></button>
                      {sale.status !== 'accounted' && (
                        <>
                          <button onClick={() => handleEditSale(sale)} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"><Edit2 size={16} /></button>
                          <button onClick={() => handleDeleteSale(sale)} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100"><Trash2 size={16} /></button>
                        </>
                      )}
                    </div>
                  </td>"""

# Find the exact TD block for printReceipt
content = re.sub(r'<td className="p-3">\s*<button\s*onClick=\{\(\) => printReceipt\(sale, String\(sales\.length - index\)\.padStart\(6, \'0\'\)\)\}\s*className="text-blue-600 hover:bg-blue-50 p-1\.5 rounded transition"\s*>\s*<Printer size=\{16\} />\s*</button>\s*</td>', buttons, content, flags=re.DOTALL)

if 'Edit2' not in content:
    content = content.replace("import { Search, Plus, Printer, Trash2, CheckCircle2 } from 'lucide-react';", "import { Search, Plus, Printer, Trash2, CheckCircle2, Edit2 } from 'lucide-react';")

with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(content)

print("done")
