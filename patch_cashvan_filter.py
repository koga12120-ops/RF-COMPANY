import re

with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

find_str = """  const filteredInv = inventory.filter(i => 
    i.quantity > 0 && (i.name.toLowerCase().includes(searchTerm.toLowerCase()) || (i.barcode && i.barcode.includes(searchTerm)))
  );"""

replace_str = """  const filteredInv = inventory.filter(i => {
    if (i.quantity <= 0) return false;
    const nameMatch = i.name ? i.name.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    const barcodeMatch = i.barcode ? i.barcode.includes(searchTerm) : false;
    return nameMatch || barcodeMatch;
  });"""

content = content.replace(find_str, replace_str)

with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(content)
