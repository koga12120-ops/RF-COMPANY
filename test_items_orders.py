import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

content = content.replace("for (const item of order.items) {", "for (const item of (order.items || [])) {")
content = content.replace("const mappedItems = order.items.map(oi => {", "const mappedItems = (order.items || []).map(oi => {")
content = content.replace("${order.items.map((item, index) => {", "${(order.items || []).map((item, index) => {")
content = content.replace("{order.items.reduce((acc, curr) => acc + curr.quantity, 0)}", "{(order.items || []).reduce((acc, curr) => acc + curr.quantity, 0)}")

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)

print("done")
