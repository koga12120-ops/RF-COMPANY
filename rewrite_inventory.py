import re

with open('src/components/views/InventoryView.tsx', 'r') as f:
    content = f.read()

# Add supplier state
content = content.replace("const [ratio, setRatio] = useState('');", "const [ratio, setRatio] = useState('');\n  const [supplier, setSupplier] = useState('');\n  const [filterSupplier, setFilterSupplier] = useState('');\n  const [sortDate, setSortDate] = useState<'desc' | 'asc'>('desc');")

# Add to itemData
content = content.replace("ratio: Number(ratio),", "ratio: Number(ratio),\n      supplier,")

# In handleSubmit, for addDoc, add createdAt
content = content.replace("const docRef = await addDoc(collection(db, 'items'), itemData);", "const docRef = await addDoc(collection(db, 'items'), { ...itemData, createdAt: Date.now() });")

# In handleEdit
content = content.replace("setRatio(item.ratio.toString());", "setRatio(item.ratio.toString());\n    setSupplier(item.supplier || '');")

# In resetForm
content = content.replace("setRatio('');", "setRatio('');\n    setSupplier('');")

# In filteredItems, add filtering by supplier and sorting by date
filtering_logic = """
  let filteredItems = items.filter(item => 
    (item.name.includes(searchTerm) || item.barcode.includes(searchTerm)) &&
    (filterSupplier ? item.supplier === filterSupplier : true)
  );

  filteredItems.sort((a, b) => {
    const dateA = a.createdAt || 0;
    const dateB = b.createdAt || 0;
    return sortDate === 'desc' ? dateB - dateA : dateA - dateB;
  });

  const uniqueSuppliers = Array.from(new Set(items.map(i => i.supplier).filter(Boolean)));
"""
content = re.sub(r'const filteredItems = items\.filter\(item => \s*item\.name\.includes\(searchTerm\) \|\| item\.barcode\.includes\(searchTerm\)\s*\);', filtering_logic, content)

# In the form, add Supplier input
supplier_input = """
          <div>
            <label className="block text-sm text-gray-600 mb-1">کۆمپانیا / شوێن</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            />
          </div>
"""
content = content.replace('          <div className="lg:col-span-3 flex items-end gap-3 mt-2">', supplier_input + '          <div className="lg:col-span-3 flex items-end gap-3 mt-2">')


# In the table controls, add supplier filter and date sort
controls = """
          <div className="flex items-center gap-3 w-full md:w-auto">
            <select
              className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
            >
              <option value="">هەموو کۆمپانیاکان</option>
              {uniqueSuppliers.map((sup, i) => (
                <option key={i} value={sup as string}>{sup}</option>
              ))}
            </select>
            <select
              className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              value={sortDate}
              onChange={(e) => setSortDate(e.target.value as 'desc' | 'asc')}
            >
              <option value="desc">نوێترین</option>
              <option value="asc">کۆنترین</option>
            </select>
            <div className="relative w-full md:w-64">
              <input
                type="text"
                placeholder="گەڕان بەپێی ناو یان بارکۆد..."
                className="w-full pr-10 pl-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute right-3 top-2.5 text-slate-400" size={18} />
            </div>
          </div>
"""
content = re.sub(r'<div className="relative w-full md:w-64">[\s\S]*?</select>', controls, content)
content = re.sub(r'<div className="relative w-full md:w-64">[\s\S]*?</select>', controls, content) # Just in case

# Actually the original was:
old_controls = """          <div className="relative w-full md:w-64">
            <input
              type="text"
              placeholder="گەڕان بەپێی ناو یان بارکۆد..."
              className="w-full pr-10 pl-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute right-3 top-2.5 text-slate-400" size={18} />
          </div>"""
content = content.replace(old_controls, controls)


# Add Net Profit to table
content = content.replace('<th className="px-4 py-3 font-semibold">نسبە</th>', '<th className="px-4 py-3 font-semibold">نسبە</th>\n                  <th className="px-4 py-3 font-semibold">قازانجی سافی</th>')
content = content.replace('<th className="px-4 py-3 font-semibold">کۆمپانیا</th>', '<th className="px-4 py-3 font-semibold">نسبە</th>\n                  <th className="px-4 py-3 font-semibold">قازانجی سافی</th>')

row = """<td className="px-4 py-4 text-slate-500" dir="ltr">{item.ratio}%</td>
                    <td className="px-4 py-4 text-green-600 font-bold" dir="ltr">{(item.sellingPrice - item.costPrice).toLocaleString()}</td>"""
content = content.replace('<td className="px-4 py-4 text-slate-500" dir="ltr">{item.ratio}%</td>', row)

# Also add supplier to the table
content = content.replace('<th className="px-4 py-3 font-semibold">ناوی کاڵا</th>', '<th className="px-4 py-3 font-semibold">ناوی کاڵا</th>\n                  <th className="px-4 py-3 font-semibold">کۆمپانیا</th>')
content = content.replace('<td className="px-4 py-4 font-medium text-slate-900">{item.name}</td>', '<td className="px-4 py-4 font-medium text-slate-900">{item.name}</td>\n                    <td className="px-4 py-4 font-medium text-slate-600">{item.supplier || \'-\'}</td>')

content = content.replace('colSpan={7}', 'colSpan={9}')

with open('src/components/views/InventoryView.tsx', 'w') as f:
    f.write(content)
