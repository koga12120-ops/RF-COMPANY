import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

# Replace datalist block
# <div>
#   <label className="block text-sm text-slate-600 mb-1">ناوی مارکێت / شوێن</label>
#   <input ... list="market-list" ... />
#   <datalist id="market-list">...</datalist>
# </div>

find_str = """                <input
                  type="text"
                  required
                  list="market-list"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  value={marketName}
                  onChange={handleMarketChange}
                />
                <datalist id="market-list">
                  {displayMarkets.map(m => (
                    <option key={m.id} value={m.name} />
                  ))}
                </datalist>"""
                
replace_str = """                <select
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  value={marketName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMarketName(val);
                    const existingMarket = displayMarkets.find(m => m.name === val);
                    if (existingMarket) {
                      setLocation(existingMarket.location);
                    }
                  }}
                >
                  <option value="" disabled>-- هەڵبژێرە --</option>
                  {displayMarkets.map(m => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>"""

if find_str in content:
    content = content.replace(find_str, replace_str)
    with open('src/components/views/OrdersView.tsx', 'w') as f:
        f.write(content)
else:
    print("Not found in OrdersView")

with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

find_str_2 = """              <input
                type="text"
                required
                list="market-list"
                className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="ناوی مارکێت بنووسە..."
                value={selectedMarket}
                onChange={(e) => setSelectedMarket(e.target.value)}
              />
              <datalist id="market-list">
                {markets.map(m => (
                  <option key={m.id} value={m.name} />
                ))}
              </datalist>"""
              
replace_str_2 = """              <select
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                value={selectedMarket}
                onChange={(e) => setSelectedMarket(e.target.value)}
              >
                <option value="" disabled>-- هەڵبژێرە --</option>
                {markets.map(m => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>"""
              
if find_str_2 in content:
    content = content.replace(find_str_2, replace_str_2)
    with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
        f.write(content)
else:
    print("Not found in Cashvan")

print("done")
