import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

find_str = """                <datalist id="market-list">
                  {markets.map(m => (
                    <option key={m.id} value={m.name} />
                  ))}
                </datalist>"""

replace_str = """                <datalist id="market-list">
                  {displayMarkets.map(m => (
                    <option key={m.id} value={m.name} />
                  ))}
                </datalist>"""

if find_str in content:
    content = content.replace(find_str, replace_str)
    with open('src/components/views/OrdersView.tsx', 'w') as f:
        f.write(content)
    print("Patched OrdersView.tsx successfully.")
else:
    print("Could not find the target string in OrdersView.tsx.")
