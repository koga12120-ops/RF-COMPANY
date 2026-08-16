import re

with open('src/components/views/WarehouseCashvanView.tsx', 'r') as f:
    content = f.read()

old_select = """            <select
              className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none"
              value={selectedCashvan}
              onChange={(e) => setSelectedCashvan(e.target.value)}
            >
              <option value="">-- هەڵبژێرە --</option>
              {cashvans.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>"""

new_input = """            <input
              type="text"
              list="cashvan-list"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              value={selectedCashvan}
              onChange={(e) => setSelectedCashvan(e.target.value)}
              placeholder="ناوی کاشڤان بنووسە..."
            />
            <datalist id="cashvan-list">
              {cashvans.map(c => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>"""

content = content.replace(old_select, new_input)

with open('src/components/views/WarehouseCashvanView.tsx', 'w') as f:
    f.write(content)
