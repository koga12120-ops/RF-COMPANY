import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

content = content.replace("const printOrder = async (order: Order, String(index): string) => {", "const printOrder = async (order: Order, invoiceId: string) => {")
content = content.replace("printOrder(order, String(orders.length - index).padStart(6, '0'))", "printOrder(order, String(orders.length - index).padStart(6, '0'))")

# where was it actually failing?
# onClick={() => printOrder(order, String(index))} maybe? Let's fix that.
# Let me just revert `String(index)` back to `invoiceId` globally, except where we want index.
# It was `String(orders.length - index).padStart(6, '0')` which had `invoiceId` before because of my previous script replacing `String(orders.length - index)` to `invoiceId`.

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)

print("done")
