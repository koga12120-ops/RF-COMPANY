import re

with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

# Add market type recognition logic to market creation
content = content.replace(
    "await addDoc(collection(db, 'markets'), { name: selectedMarket, location: '', phone: '', createdAt: Date.now() });",
    "await addDoc(collection(db, 'markets'), { name: selectedMarket, location: '', phone: '', type: 'market', createdAt: Date.now() });"
)

with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(content)
