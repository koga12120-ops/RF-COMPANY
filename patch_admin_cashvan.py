import re

with open('src/components/views/AdminCashvanView.tsx', 'r') as f:
    content = f.read()

content = content.replace("type: 'cash',", "type: sale.paymentType || 'cash',")
content = content.replace("description: `فرۆشتنی نەقدی کاشڤان", "description: `فرۆشتنی کاشڤان")

with open('src/components/views/AdminCashvanView.tsx', 'w') as f:
    f.write(content)

with open('src/components/views/WarehouseCashvanView.tsx', 'r') as f:
    content = f.read()

content = content.replace("type: 'cash',", "type: sale.paymentType || 'cash',")
content = content.replace("description: `فرۆشتنی نەقدی کاشڤان", "description: `فرۆشتنی کاشڤان")

with open('src/components/views/WarehouseCashvanView.tsx', 'w') as f:
    f.write(content)

print("patched admin and warehouse views")
