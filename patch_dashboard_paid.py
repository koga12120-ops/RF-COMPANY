import re

with open('src/components/Dashboard.tsx', 'r') as f:
    content = f.read()

content = content.replace("    { id: 'paid', label: 'واسڵکراوەکان', icon: CheckCircle },\n", "")
content = content.replace("import PaidDebtsView from './views/PaidDebtsView';\n", "")
content = content.replace("      case 'paid': return <PaidDebtsView />;\n", "")

with open('src/components/Dashboard.tsx', 'w') as f:
    f.write(content)
