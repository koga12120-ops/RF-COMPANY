import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

content = content.replace("String(index)", "invoiceId")
content = content.replace("orders.length - index", "index /* we don't have orders.length, or we just pass a string */")

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)

print("done")
