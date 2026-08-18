import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

content = re.sub(r'order\.id\.slice\(-6\)\.toUpperCase\(\)', r'String(orders.length - index).padStart(6, \'0\')', content)

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)

with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

content = re.sub(r'sale\.id\.slice\(-6\)\.toUpperCase\(\)', r'String(sales.length - index).padStart(6, \'0\')', content)
# We need to map `index` in sales.map
content = content.replace("sales.map(sale => (", "sales.map((sale, index) => (")

with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(content)
print("done")
