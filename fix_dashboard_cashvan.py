import re

with open('src/components/Dashboard.tsx', 'r') as f:
    content = f.read()

pattern = r"const cashvanMenu = \[\{ id: 'orders', label: 'کاشڤان نەقدە', icon: ShoppingCart \}\];"
replacement = "const cashvanMenu = [{ id: 'cashvan_sales', label: 'کاشڤان نەقدە', icon: ShoppingCart }];"
content = re.sub(pattern, replacement, content)

with open('src/components/Dashboard.tsx', 'w') as f:
    f.write(content)
