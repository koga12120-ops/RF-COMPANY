import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "${order.status === \\'pending\\' ? \\'bg-red-50 border-red-200\\' : \\'bg-green-50 border-green-200\\'}",
    "${order.status === 'pending' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}"
)

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)
