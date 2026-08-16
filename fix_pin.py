import re

with open('src/components/PinEntry.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "await onSuccess('cashvan');\n        await onSuccess('sales_rep');",
    "await onSuccess('cashvan');"
)

with open('src/components/PinEntry.tsx', 'w') as f:
    f.write(content)
