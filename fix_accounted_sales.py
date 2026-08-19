import re

with open('src/components/views/AdminCashvanView.tsx', 'r') as f:
    content = f.read()

# Add buttons to accounted sales table
# The headers currently are:
# <th className="p-4">کاشڤان</th>
# <th className="p-4">مارکێت</th>
# <th className="p-4">بەروار</th>
# <th className="p-4">بڕی پارە</th>
# We need to add کردارەکان
th_replace = """                    <th className="p-4">بڕی پارە</th>
                    <th className="p-4">کردارەکان</th>"""
content = re.sub(r'<th className="p-4">بڕی پارە</th>', th_replace, content, count=1) # only in accounted table? wait, we also have pending table

td_replace = """                      <td className="p-4" dir="ltr">{sale.totalAmount.toLocaleString()}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleEditSale(sale)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Edit2 size={16}/></button>
                          <button onClick={() => handleDeleteSale(sale.id)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Trash2 size={16}/></button>
                        </div>
                      </td>"""
content = re.sub(r'<td className="p-4" dir="ltr">\{sale\.totalAmount\.toLocaleString\(\)\}</td>', td_replace, content)

with open('src/components/views/AdminCashvanView.tsx', 'w') as f:
    f.write(content)

print("done")
