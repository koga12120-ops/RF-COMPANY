import re

with open('src/components/views/WarehouseCashvanView.tsx', 'r') as f:
    content = f.read()

old_transfer = """    try {
      const totalValue = cart.reduce((acc, curr) => acc + (curr.item.costPrice * curr.quantity), 0);"""

new_transfer = """    try {
      if (selectedCashvan && !cashvans.find(c => c.name === selectedCashvan)) {
        await addDoc(collection(db, 'cashvans'), { name: selectedCashvan, phone: '', totalSales: 0, totalProfit: 0, createdAt: Date.now() });
      }

      const totalValue = cart.reduce((acc, curr) => acc + (curr.item.costPrice * curr.quantity), 0);"""

content = content.replace(old_transfer, new_transfer)

with open('src/components/views/WarehouseCashvanView.tsx', 'w') as f:
    f.write(content)
