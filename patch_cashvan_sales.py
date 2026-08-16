import re

with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

old_select = """            <select
              className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition"
              value={selectedMarket}
              onChange={(e) => setSelectedMarket(e.target.value)}
            >
              <option value="">-- مارکێت هەڵبژێرە --</option>
              {markets.map(m => (
                <option key={m.id} value={m.name}>{m.name} - {m.location}</option>
              ))}
            </select>"""

new_input = """            <input
              type="text"
              list="markets-list"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition"
              value={selectedMarket}
              onChange={(e) => setSelectedMarket(e.target.value)}
              placeholder="ناوی مارکێت بنووسە..."
            />
            <datalist id="markets-list">
              {markets.map(m => (
                <option key={m.id} value={m.name} />
              ))}
            </datalist>"""

content = content.replace(old_select, new_input)

with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(content)
