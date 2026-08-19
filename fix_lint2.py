import re

# CashvanSalesView.tsx
with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

if 'Transaction' not in content:
    content = re.sub(r'import \{ (.*?) \} from \'../../types\';', r"import { \1, Transaction } from '../../types';", content)
    
if 'FileText' not in content:
    content = re.sub(r'import \{ (.*?) \} from \'lucide-react\';', r"import { \1, FileText } from 'lucide-react';", content)

if 'Edit2' not in content:
    content = re.sub(r'import \{ (.*?) \} from \'lucide-react\';', r"import { \1, Edit2 } from 'lucide-react';", content)

# Remove the 'deleted' comparison again
content = re.sub(r"sale\.status === 'deleted'", "false", content)

with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(content)

# OrdersView.tsx
with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

# Fix unsubSched and unsubVisits
content = re.sub(r'return \(\) => \{\s*unsubSched\(\);\s*unsubVisits\(\);\s*\};', '', content)

# Remove the index in OrdersView line 428 (print html)
# String(orders.length - index).padStart(6, '0') -> inside printOrder it was missing, we just use a default or invoiceId
content = re.sub(r'String\(orders\.length - index\)', 'invoiceId', content)

# Fix 'deleted' comparison in OrdersView
content = re.sub(r"order\.status === 'deleted'", "false", content)

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)

print("done")
