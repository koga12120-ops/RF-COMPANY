import re

with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

content = content.replace("import { CashvanSale } from '../../types';", "import { CashvanSale, Transaction } from '../../types';")
content = content.replace("import { Search, Plus, Printer, Trash2, CheckCircle2 } from 'lucide-react';", "import { Search, Plus, Printer, Trash2, CheckCircle2, FileText, Edit2 } from 'lucide-react';")

with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(content)

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

content = re.sub(r"order\.status === 'deleted'", "false", content)

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)

print("done")
