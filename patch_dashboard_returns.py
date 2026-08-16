import re

with open('src/components/Dashboard.tsx', 'r') as f:
    content = f.read()

content = content.replace("import AdminCashvanView from './views/AdminCashvanView';", "import AdminCashvanView from './views/AdminCashvanView';\nimport ReturnsView from './views/ReturnsView';")
content = content.replace("import { Truck } from 'lucide-react';", "import { Truck, Undo2 } from 'lucide-react';")

old_menu = """    { id: 'stock_history', label: 'مێژووی کۆگا', icon: History, roles: ['admin', 'warehouse'] },
    { id: 'companies', label: 'کۆمپانیاکان', icon: Building2, roles: ['admin'] },
    { id: 'ledger', label: 'دەفتەری حیسابات', icon: Calculator, roles: ['admin'] },
    { id: 'reps', label: 'مەندووبەکان', icon: Users, roles: ['admin'] },
    { id: 'admin_cashvan', label: 'کاشڤانەکان', icon: Truck, roles: ['admin'] },
  ];"""

new_menu = """    { id: 'stock_history', label: 'مێژووی کۆگا', icon: History, roles: ['admin', 'warehouse'] },
    { id: 'returns', label: 'گەڕاوە', icon: Undo2, roles: ['admin', 'warehouse'] },
    { id: 'companies', label: 'کۆمپانیاکان', icon: Building2, roles: ['admin'] },
    { id: 'ledger', label: 'دەفتەری حیسابات', icon: Calculator, roles: ['admin'] },
    { id: 'reps', label: 'مەندووبەکان', icon: Users, roles: ['admin'] },
    { id: 'admin_cashvan', label: 'کاشڤانەکان', icon: Truck, roles: ['admin'] },
  ];"""
content = content.replace(old_menu, new_menu)

old_case = """      case 'ledger': return <LedgerView />;"""
new_case = """      case 'ledger': return <LedgerView />;
      case 'returns': return <ReturnsView role={role} />;"""
content = content.replace(old_case, new_case)

with open('src/components/Dashboard.tsx', 'w') as f:
    f.write(content)

