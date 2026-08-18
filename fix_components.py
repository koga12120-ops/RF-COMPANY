import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

content = content.replace("<Trash2, Edit2", "<Trash2")

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)

with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

content = content.replace("<Trash2, Edit2", "<Trash2")

with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(content)

print("done")
