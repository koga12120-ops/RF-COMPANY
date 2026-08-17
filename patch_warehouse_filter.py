import re

with open('src/components/views/WarehouseCashvanView.tsx', 'r') as f:
    content = f.read()

find_str = """  const filteredItems = items.filter(item => 
    item.name.includes(searchTerm) || 
    item.barcode.includes(searchTerm)
  );"""

replace_str = """  const filteredItems = items.filter(item => {
    const nameMatch = item.name ? item.name.includes(searchTerm) : false;
    const barcodeMatch = item.barcode ? item.barcode.includes(searchTerm) : false;
    return nameMatch || barcodeMatch;
  });"""

content = content.replace(find_str, replace_str)

with open('src/components/views/WarehouseCashvanView.tsx', 'w') as f:
    f.write(content)
