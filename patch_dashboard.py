import re

with open('src/components/Dashboard.tsx', 'r') as f:
    content = f.read()

old_admin = """  const adminMenu = [
    { id: 'inventory', label: 'داخڵکردن و کۆگا', icon: Package },
    { id: 'stock_history', label: 'مێژووی هاتنی کاڵا', icon: History },
    { id: 'orders', label: 'تەسفییەکردن', icon: ShoppingCart },
    { id: 'admin_cashvan', label: 'حیساباتی کاشڤان', icon: Truck },
    { id: 'companies_group', label: 'کۆمپانیا و حیسابات', icon: Building2 },
    { id: 'markets_group', label: 'مارکێت و حیسابات', icon: Store },
    { id: 'ledger', label: 'دەفتەری حیسابات', icon: Calculator },
    { id: 'reps', label: 'مەندووبەکان', icon: Users },
  ];"""

new_admin = """  const adminMenu = [
    { id: 'inventory', label: 'داخڵکردن و کۆگا', icon: Package },
    { id: 'stock_history', label: 'مێژووی هاتنی کاڵا', icon: History },
    { id: 'returns', label: 'گەڕاوەی کاڵا', icon: Undo2 },
    { id: 'orders', label: 'تەسفییەکردن', icon: ShoppingCart },
    { id: 'admin_cashvan', label: 'حیساباتی کاشڤان', icon: Truck },
    { id: 'companies_group', label: 'کۆمپانیا و حیسابات', icon: Building2 },
    { id: 'markets_group', label: 'مارکێت و حیسابات', icon: Store },
    { id: 'ledger', label: 'دەفتەری حیسابات', icon: Calculator },
    { id: 'reps', label: 'مەندووبەکان', icon: Users },
  ];"""

content = content.replace(old_admin, new_admin)

old_warehouse = """  const warehouseMenu = [
    { id: 'inventory', label: 'داخڵکردن و کۆگا', icon: Package },
    { id: 'stock_history', label: 'مێژووی هاتنی کاڵا', icon: History },
    { id: 'orders', label: 'ئۆردەرەکان', icon: ShoppingCart },
    { id: 'warehouse_cashvan', label: 'پێدان بە کاشڤان', icon: Truck },
  ];"""

new_warehouse = """  const warehouseMenu = [
    { id: 'inventory', label: 'داخڵکردن و کۆگا', icon: Package },
    { id: 'stock_history', label: 'مێژووی هاتنی کاڵا', icon: History },
    { id: 'returns', label: 'گەڕاوەی کاڵا', icon: Undo2 },
    { id: 'orders', label: 'ئۆردەرەکان', icon: ShoppingCart },
    { id: 'warehouse_cashvan', label: 'پێدان بە کاشڤان', icon: Truck },
  ];"""

content = content.replace(old_warehouse, new_warehouse)

with open('src/components/Dashboard.tsx', 'w') as f:
    f.write(content)
