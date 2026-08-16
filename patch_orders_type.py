import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "await addDoc(collection(db, 'markets'), { name: marketName, phone: '', location: location || '', createdAt: Date.now() });",
    "await addDoc(collection(db, 'markets'), { name: marketName, phone: '', location: location || '', type: 'market', createdAt: Date.now() });"
)

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)
