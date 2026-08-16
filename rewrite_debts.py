import re

with open('src/components/views/DebtsView.tsx', 'r') as f:
    content = f.read()

content = content.replace("type: 'paid_debt'", "type: type === 'debt' ? 'paid_debt' : 'company_paid_debt'")
content = content.replace("پێدانی قەرز بە مارکێت/کەس", "تۆمارکردنی قەرز")
content = content.replace("ناوی شوێن/کەس", "{`ناوی ${targetName}`}")

with open('src/components/views/DebtsView.tsx', 'w') as f:
    f.write(content)
