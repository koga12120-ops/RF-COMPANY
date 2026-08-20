import re

with open('src/types.ts', 'r') as f:
    content = f.read()

new_items = """  items: {
    itemId: string;
    name: string;
    quantity: number;
    unit?: 'piece' | 'packet' | 'carton';
    price: number;
    ratio?: number;
    packetRatio?: number;
    barcode?: string;
  }[];"""

content = re.sub(r'  items: \{\n    itemId: string;\n    name: string;\n    quantity: number;\n    unit\?: \'piece\' \| \'packet\' \| \'carton\';\n    price: number;\n  \}\[\];', new_items, content)

with open('src/types.ts', 'w') as f:
    f.write(content)

print("done")
