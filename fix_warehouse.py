with open('src/components/Dashboard.tsx', 'r') as f:
    content = f.read()

import re

# We want to change the one in warehouseMenu back to 'ئۆردەرەکان'
# Find warehouseMenu
pattern = r"(const warehouseMenu = \[[\s\S]*?\];)"
match = re.search(pattern, content)
if match:
    warehouse_block = match.group(1)
    new_warehouse_block = warehouse_block.replace("'تەسفییەکردن'", "'ئۆردەرەکان'")
    content = content.replace(warehouse_block, new_warehouse_block)

with open('src/components/Dashboard.tsx', 'w') as f:
    f.write(content)

