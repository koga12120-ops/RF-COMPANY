import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()
content = content.replace('src="/LOGO1.jpg"', 'src="${window.location.origin}/LOGO1.jpg"')
with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)

with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()
content = content.replace('src="/LOGO1.jpg"', 'src="${window.location.origin}/LOGO1.jpg"')
with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(content)

