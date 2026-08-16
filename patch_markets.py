import re

with open('src/components/views/MarketsView.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "const [phone, setPhone] = useState('');",
    "const [phone, setPhone] = useState('');\n  const [type, setType] = useState<'market' | 'warehouse'>('market');"
)

content = content.replace(
    "await addDoc(collection(db, 'markets'), { name, location, phone, createdAt: Date.now() });",
    "await addDoc(collection(db, 'markets'), { name, location, phone, type, createdAt: Date.now() });"
)

content = content.replace(
    "await updateDoc(doc(db, 'markets', editingId), { name, location, phone });",
    "await updateDoc(doc(db, 'markets', editingId), { name, location, phone, type });"
)

content = content.replace(
    "setPhone(market.phone);",
    "setPhone(market.phone);\n    setType(market.type || 'market');"
)

content = content.replace(
    "setPhone('');",
    "setPhone('');\n    setType('market');"
)

form_inputs = """
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">ناوی شوێن</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">جۆری کڕیار</label>
              <select
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={type}
                onChange={(e) => setType(e.target.value as 'market' | 'warehouse')}
              >
                <option value="market">مارکێت (فرۆشتن بە نرخی ئاسایی)</option>
                <option value="warehouse">کۆگا/جوملە (فرۆشتن بە نرخی کۆگا)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">ناونیشان</label>
              <input
"""

content = re.sub(
    r'<div className="grid grid-cols-1 md:grid-cols-3 gap-4">\s*<div>\s*<label className="block text-sm text-gray-600 mb-1">ناوی مارکێت</label>\s*<input\s*type="text"\s*required\s*className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"\s*value=\{name\}\s*onChange=\{\(e\) => setName\(e\.target\.value\)\}\s*/>\s*</div>\s*<div>\s*<label className="block text-sm text-gray-600 mb-1">ناونیشان</label>\s*<input',
    form_inputs,
    content
)

table_headers = """
              <thead className="bg-slate-50 text-slate-500 text-sm">
                <tr>
                  <th className="px-6 py-4 font-semibold">ناو</th>
                  <th className="px-6 py-4 font-semibold">جۆر</th>
                  <th className="px-6 py-4 font-semibold">ناونیشان</th>
                  <th className="px-6 py-4 font-semibold">ژمارەی تەلەفۆن</th>
"""

content = re.sub(
    r'<thead className="bg-slate-50 text-slate-500 text-sm">\s*<tr>\s*<th className="px-6 py-4 font-semibold">ناوی مارکێت</th>\s*<th className="px-6 py-4 font-semibold">ناونیشان</th>\s*<th className="px-6 py-4 font-semibold">ژمارەی تەلەفۆن</th>',
    table_headers,
    content
)

table_rows = """
                  <tr key={market.id} className="hover:bg-slate-50 transition border-b border-slate-50 last:border-0">
                    <td className="px-6 py-4 font-bold text-slate-800">{market.name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${market.type === 'warehouse' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {market.type === 'warehouse' ? 'کۆگا/جوملە' : 'مارکێت'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{market.location || '-'}</td>
                    <td className="px-6 py-4 text-slate-600" dir="ltr">{market.phone || '-'}</td>
"""

content = re.sub(
    r'<tr key=\{market\.id\} className="hover:bg-slate-50 transition border-b border-slate-50 last:border-0">\s*<td className="px-6 py-4 font-bold text-slate-800">\{market\.name\}</td>\s*<td className="px-6 py-4 text-slate-600">\{market\.location \|\| \'-\'\}</td>\s*<td className="px-6 py-4 text-slate-600" dir="ltr">\{market\.phone \|\| \'-\'\}</td>',
    table_rows,
    content
)

with open('src/components/views/MarketsView.tsx', 'w') as f:
    f.write(content)
