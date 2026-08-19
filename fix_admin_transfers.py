import re

with open('src/components/views/AdminCashvanView.tsx', 'r') as f:
    content = f.read()

# Make sure table head has "کردارەکان"
th_replace = """                  <th className="p-4">کۆی تێچوو</th>
                  <th className="p-4">کردارەکان</th>"""
if '<th className="p-4">کۆی تێچوو</th>\n                  <th className="p-4">کردارەکان</th>' not in content:
    content = content.replace('<th className="p-4">کۆی تێچوو</th>', th_replace)

td_replace = """                    <td className="p-4 font-bold text-indigo-600" dir="ltr">{t.totalValue.toLocaleString()} د.ع</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleEditTransfer(t)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Edit2 size={16}/></button>
                        <button onClick={() => handleDeleteTransfer(t.id)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Trash2 size={16}/></button>
                      </div>
                    </td>"""
content = re.sub(r'<td className="p-4 font-bold text-indigo-600" dir="ltr">\{t\.totalValue\.toLocaleString\(\)\} د\.ع</td>', td_replace, content)

# Check if handleEditTransfer exists
if 'const handleEditTransfer' not in content:
    edit_transfer = """
  const handleEditTransfer = async (t: CashvanTransfer) => {
    const newTotal = window.prompt('کۆی تێچووی نوێ بنووسە:', t.totalValue.toString());
    if (newTotal !== null && !isNaN(Number(newTotal))) {
      await updateDoc(doc(db, 'cashvan_transfers', t.id), { totalValue: Number(newTotal) });
    }
  };
"""
    content = content.replace("  const handleDeleteTransfer = async", edit_transfer + "\n  const handleDeleteTransfer = async")

with open('src/components/views/AdminCashvanView.tsx', 'w') as f:
    f.write(content)

print("done")
