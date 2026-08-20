import re

for filepath in ['src/components/views/CashvanSalesView.tsx', 'src/components/views/AdminCashvanView.tsx']:
    with open(filepath, 'r') as f:
        content = f.read()
    
    content = content.replace("for (const item of sale.items) {", "for (const item of (sale.items || [])) {")
    
    with open(filepath, 'w') as f:
        f.write(content)

print("done")
