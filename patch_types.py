import re

with open('src/types.ts', 'r') as f:
    content = f.read()

content = content.replace("export interface CashvanSale {\n  id: string;", "export interface CashvanSale {\n  id: string;\n  paymentType?: 'cash' | 'debt';")

with open('src/types.ts', 'w') as f:
    f.write(content)
