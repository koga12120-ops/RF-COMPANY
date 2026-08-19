import re

with open('src/components/views/StockHistoryView.tsx', 'r') as f:
    content = f.read()

# Fix table header
th_replace = """                  <th className="px-4 py-3 font-semibold">بڕی هاتوو</th>
                  <th className="px-4 py-3 font-semibold">کات</th>
                  <th className="px-4 py-3 font-semibold">کردارەکان</th>"""
content = re.sub(r'<th className="px-4 py-3 font-semibold">بڕی هاتوو</th>\s*<th className="px-4 py-3 font-semibold">کات</th>', th_replace, content)

# Fix table row
td_replace = """                    <td className="px-4 py-4 text-slate-500 font-mono text-xs" dir="ltr">
                      {format(item.date, 'HH:mm')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => printHistory(item)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Printer size={16}/></button>
                        <button onClick={() => handleEdit(item)} className="p-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100"><Edit2 size={16}/></button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Trash2 size={16}/></button>
                      </div>
                    </td>"""
content = re.sub(r'<td className="px-4 py-4 text-slate-500 font-mono text-xs" dir="ltr">\s*\{format\(item\.date, \'HH:mm\'\)\}\s*</td>', td_replace, content)

with open('src/components/views/StockHistoryView.tsx', 'w') as f:
    f.write(content)

print("done")
