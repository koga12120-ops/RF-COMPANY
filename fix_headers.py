import re

with open('src/components/views/AdminCashvanView.tsx', 'r') as f:
    content = f.read()

# Fix pending table double کردارەکان
content = content.replace('<th className="p-4">کردارەکان</th>\n                    <th className="p-4">کردارەکان</th>', '<th className="p-4">کردارەکان</th>')

# Fix accounted table missing کردارەکان
content = content.replace('<th className="p-4">بڕی پارە</th>\n                  </tr>', '<th className="p-4">بڕی پارە</th>\n                  <th className="p-4">کردارەکان</th>\n                  </tr>')

with open('src/components/views/AdminCashvanView.tsx', 'w') as f:
    f.write(content)

print("done")
