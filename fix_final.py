import re

def fix_cashvan():
    with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
        content = f.read()

    # Import Transaction, FileText, Edit2
    if 'Transaction' not in content:
        content = re.sub(r"import \{ (.*?) \} from '../../types';", r"import { \1, Transaction } from '../../types';", content)
    if 'FileText' not in content:
        content = re.sub(r"import \{ (.*?) \} from 'lucide-react';", r"import { \1, FileText, Edit2 } from 'lucide-react';", content)

    # status === 'deleted' -> false
    content = re.sub(r"sale\.status === 'deleted'", "false", content)

    with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
        f.write(content)

def fix_orders():
    with open('src/components/views/OrdersView.tsx', 'r') as f:
        content = f.read()

    # Move unsub declarations
    content = re.sub(r'let unsubSched = \(\) => \{\};\s*let unsubVisits = \(\) => \{\};', '', content)
    content = re.sub(r'(useEffect\(\(\) => \{\n)', r'\1    let unsubSched = () => {};\n    let unsubVisits = () => {};\n', content)
    
    # invoiceId -> index usage
    content = re.sub(r'invoiceId', 'String(index)', content)

    # status === 'deleted' -> false
    content = re.sub(r"order\.status === 'deleted'", "false", content)

    with open('src/components/views/OrdersView.tsx', 'w') as f:
        f.write(content)

fix_cashvan()
fix_orders()
print("done")
