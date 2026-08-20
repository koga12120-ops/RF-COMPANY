import re

with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "    if (!window.confirm('دڵنیایت لە سڕینەوە؟')) return;\n", 
    "    if (!isEdit && !window.confirm('دڵنیایت لە سڕینەوە؟')) return;\n"
)

with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(content)

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "    if (!window.confirm('دڵنیایت لە سڕینەوە؟')) return;\n", 
    "    if (!isEdit && !window.confirm('دڵنیایت لە سڕینەوە؟')) return;\n"
)

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)

print("done")
