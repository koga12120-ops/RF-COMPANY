import re

with open('src/components/Dashboard.tsx', 'r') as f:
    content = f.read()

# Add imports
content = content.replace("import CompaniesView from './views/CompaniesView';", "import CompaniesGroupView from './views/CompaniesGroupView';")
content = content.replace("import MarketsView from './views/MarketsView';", "import MarketsGroupView from './views/MarketsGroupView';")

# Fix Dashboard activeTabs
content = content.replace(
    "case 'companies': return <CompaniesView />;",
    "case 'companies_group': return <CompaniesGroupView />;"
)
content = content.replace(
    "case 'markets': return <MarketsView />;",
    "case 'markets_group': return <MarketsGroupView />;"
)
content = content.replace(
    "{ id: 'companies', label: 'کۆمپانیاکان', icon: Building2 },",
    "{ id: 'companies_group', label: 'کۆمپانیا و حیسابات', icon: Building2 },"
)
content = content.replace(
    "{ id: 'markets', label: 'مارکێتەکان', icon: Store },",
    "{ id: 'markets_group', label: 'مارکێت و حیسابات', icon: Store },"
)

# Admin menu should not have independent debts, cash, paid.
# Wait, user said "مارکێتەکان و قەرزەکان و نەقدەکان بخەرە یەک تاب لەناو تابەکە ببێتە ٣ تاب"
# Let's remove them from admin menu.
# I'll manually recreate the admin menu.

adminMenu_block = """  const adminMenu = [
    { id: 'inventory', label: 'داخڵکردن و کۆگا', icon: Package },
    { id: 'stock_history', label: 'مێژووی هاتنی کاڵا', icon: History },
    { id: 'orders', label: 'تەسفییەکردن', icon: ShoppingCart },
    { id: 'companies_group', label: 'کۆمپانیا و حیسابات', icon: Building2 },
    { id: 'markets_group', label: 'مارکێت و حیسابات', icon: Store },
    { id: 'ledger', label: 'دەفتەری حیسابات', icon: Calculator },
    { id: 'reps', label: 'مەندووبەکان', icon: Users },
    { id: 'paid', label: 'واسڵکراوەکان', icon: CheckCircle },
  ];"""
content = re.sub(r"const adminMenu = \[[\s\S]*?\];", adminMenu_block, content)

with open('src/components/Dashboard.tsx', 'w') as f:
    f.write(content)
