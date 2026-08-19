import re

with open('src/components/views/AdminCashvanView.tsx', 'r') as f:
    content = f.read()

content = content.replace('{t.totalCost.toLocaleString()}', '{t.totalValue.toLocaleString()} د.ع')

with open('src/components/views/AdminCashvanView.tsx', 'w') as f:
    f.write(content)

print("done")
