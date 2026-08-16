import re

with open('src/components/views/PaidDebtsView.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "export default function PaidDebtsView() {",
    "export default function PaidDebtsView({ type = 'paid_debt' }: { type?: 'paid_debt' | 'company_paid_debt' }) {"
)

content = content.replace(
    "where('type', '==', 'paid_debt')",
    "where('type', '==', type)"
)

content = content.replace(
    "  }, []);",
    "  }, [type]);"
)

with open('src/components/views/PaidDebtsView.tsx', 'w') as f:
    f.write(content)
