import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

content = content.replace("orders.map((order) => (", "orders.map((order, index) => (")

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)

print("done")
