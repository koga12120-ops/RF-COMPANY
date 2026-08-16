import re

with open('src/components/views/MarketsView.tsx', 'r') as f:
    content = f.read()

# Add states
content = content.replace(
    "const [phone, setPhone] = useState('');",
    "const [phone, setPhone] = useState('');\n  const [type, setType] = useState<'market' | 'warehouse'>('market');"
)

# Fix adding
content = content.replace(
    "await addDoc(collection(db, 'markets'), { name, location, phone, createdAt: Date.now() });",
    "await addDoc(collection(db, 'markets'), { name, location, phone, type, createdAt: Date.now() });"
)

# Fix editing
content = content.replace(
    "await updateDoc(doc(db, 'markets', editingId), { name, location, phone });",
    "await updateDoc(doc(db, 'markets', editingId), { name, location, phone, type });"
)

# Fix edit loading
content = content.replace(
    "setPhone(market.phone);",
    "setPhone(market.phone);\n    setType(market.type || 'market');"
)

# Fix resetting
content = content.replace(
    "setPhone('');",
    "setPhone('');\n    setType('market');"
)

# Fix inputs HTML
form_inputs = """        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1">ناوی مارکێت / شوێن</label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">جۆری کڕیار</label>
            <select
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as 'market' | 'warehouse')}
            >
              <option value="market">مارکێت (فرۆشتن بە نرخی ئاسایی)</option>
              <option value="warehouse">کۆگا/جوملە (فرۆشتن بە نرخی کۆگا)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">ناونیشان / گەڕەک</label>
            <input"""

content = re.sub(
    r'<div className="grid grid-cols-1 md:grid-cols-3 gap-4">\s*<div>\s*<label className="block text-sm text-slate-600 mb-1">ناوی مارکێت / شوێن</label>\s*<input\s*type="text"\s*required\s*className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"\s*value=\{name\}\s*onChange=\{\(e\) => setName\(e\.target\.value\)\}\s*/>\s*</div>\s*<div>\s*<label className="block text-sm text-slate-600 mb-1">ناونیشان / گەڕەک</label>\s*<input',
    form_inputs,
    content
)

# Fix table headers HTML
table_headers = """              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">ناوی شوێن</th>
                  <th className="px-4 py-3 font-semibold">جۆر</th>
                  <th className="px-4 py-3 font-semibold">ناونیشان</th>
                  <th className="px-4 py-3 font-semibold">تەلەفۆن</th>"""

content = re.sub(
    r'<thead className="bg-slate-50 text-slate-500 text-xs uppercase">\s*<tr>\s*<th className="px-4 py-3 font-semibold">ناوی مارکێت</th>\s*<th className="px-4 py-3 font-semibold">ناونیشان</th>\s*<th className="px-4 py-3 font-semibold">تەلەفۆن</th>',
    table_headers,
    content
)

# Fix table rows HTML
table_rows = """                  <tr key={market.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-4 font-medium text-slate-900">{market.name}</td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${market.type === 'warehouse' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {market.type === 'warehouse' ? 'کۆگا/جوملە' : 'مارکێت'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{market.location}</td>
                    <td className="px-4 py-4 text-slate-500 font-mono text-xs" dir="ltr">{market.phone || '-'}</td>"""

content = re.sub(
    r'<tr key=\{market\.id\} className="hover:bg-slate-50/50 transition">\s*<td className="px-4 py-4 font-medium text-slate-900">\{market\.name\}</td>\s*<td className="px-4 py-4 text-slate-600">\{market\.location\}</td>\s*<td className="px-4 py-4 text-slate-500 font-mono text-xs" dir="ltr">\{market\.phone \|\| \'-\'\}</td>',
    table_rows,
    content
)

with open('src/components/views/MarketsView.tsx', 'w') as f:
    f.write(content)
