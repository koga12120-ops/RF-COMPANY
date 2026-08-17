import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

content = content.replace('getPriceByUnit(si.item, si.unit || \'piece\')', 'calcPrice(si.item, si.unit || \'piece\')')
content = content.replace('getPriceByUnit(curr.item, curr.unit || \'piece\')', 'calcPrice(curr.item, curr.unit || \'piece\')')

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)
