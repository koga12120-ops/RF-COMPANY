import re

with open('src/components/views/InventoryView.tsx', 'r') as f:
    content = f.read()

find_str = """  let filteredItems = items.filter(item => 
    (item.name.includes(searchTerm) || item.barcode.includes(searchTerm)) &&
    (filterSupplier ? item.supplier === filterSupplier : true)
  );"""

replace_str = """  let filteredItems = items.filter(item => {
    const nameMatch = item.name ? item.name.includes(searchTerm) : false;
    const barcodeMatch = item.barcode ? item.barcode.includes(searchTerm) : false;
    return (nameMatch || barcodeMatch) && (filterSupplier ? item.supplier === filterSupplier : true);
  });"""

content = content.replace(find_str, replace_str)

with open('src/components/views/InventoryView.tsx', 'w') as f:
    f.write(content)
