import re

with open('src/components/views/CashView.tsx', 'r') as f:
    content = f.read()

# Change export
content = content.replace(
    "export default function CashView() {",
    "export default function CashView({ type = 'cash', targetName = 'مارکێت' }: { type?: 'cash' | 'company_cash', targetName?: string }) {"
)

# query
content = content.replace("where('type', '==', 'cash')", "where('type', '==', type)")

# addDoc
content = content.replace("type: 'cash',", "type,")

# Text replacements
content = content.replace("فرۆشتنی نەقدی", "تۆمارکردنی نەقد")
content = content.replace("ناوی شوێن/کەس", "{`ناوی ${targetName}`}")

with open('src/components/views/CashView.tsx', 'w') as f:
    f.write(content)
