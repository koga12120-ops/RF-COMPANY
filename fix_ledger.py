import re

with open('src/components/views/LedgerView.tsx', 'r') as f:
    content = f.read()

content = content.replace("const totalExpense = calculateTotal(['expense']);", "const totalExpense = calculateTotal(['expense', 'company_cash', 'paid_company_debt']);")

# Wait, what if someone wants to filter the table? 
# Does the table show these types? Let's check the table rendering.
with open('src/components/views/LedgerView.tsx', 'w') as f:
    f.write(content)
