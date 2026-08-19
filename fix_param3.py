import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

content = content.replace("onClick={() => printOrder(order, invoiceId.padStart(6, '0'))}", "onClick={() => printOrder(order, String(orders.length - index).padStart(6, '0'))}")

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)

print("done")
