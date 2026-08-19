import re

for view in ['LedgerView', 'StockHistoryView', 'DebtsView', 'PaidDebtsView', 'CashView']:
    with open(f'src/components/views/{view}.tsx', 'r') as f:
        content = f.read()

    content = content.replace("from \\'lucide-react\\';", "from 'lucide-react';")

    with open(f'src/components/views/{view}.tsx', 'w') as f:
        f.write(content)

print("done")
