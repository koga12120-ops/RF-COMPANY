import re

with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

old_sale = """    try {
      const totalAmount = cart.reduce((acc, curr) => acc + (curr.finalPrice * curr.cartQty), 0);"""

new_sale = """    try {
      if (selectedMarket && !markets.find(m => m.name === selectedMarket)) {
        await addDoc(collection(db, 'markets'), { name: selectedMarket, location: '', phone: '', createdAt: Date.now() });
      }
      
      const totalAmount = cart.reduce((acc, curr) => acc + (curr.finalPrice * curr.cartQty), 0);"""

content = content.replace(old_sale, new_sale)

with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(content)
