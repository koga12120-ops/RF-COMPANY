import re

with open('src/components/views/StockHistoryView.tsx', 'r') as f:
    content = f.read()

# Fix table header
content = content.replace('<th className="px-4 py-3 font-semibold">بڕی زیادکراو</th>\n                  <th className="px-4 py-3 font-semibold">کات</th>\n                </tr>', '<th className="px-4 py-3 font-semibold">بڕی زیادکراو</th>\n                  <th className="px-4 py-3 font-semibold">کات</th>\n                  <th className="px-4 py-3 font-semibold">کردارەکان</th>\n                </tr>')

with open('src/components/views/StockHistoryView.tsx', 'w') as f:
    f.write(content)

print("done")
