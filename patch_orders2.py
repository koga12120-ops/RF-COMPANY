import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

old_submit = """    try {
      await addDoc(collection(db, 'orders'), {"""

new_submit = """    try {
      if (repName && !reps.find(r => r.name === repName)) {
        await addDoc(collection(db, 'reps'), { name: repName, phone: '', totalSales: 0, totalProfit: 0, createdAt: Date.now() });
      }
      if (marketName && !markets.find(m => m.name === marketName)) {
        await addDoc(collection(db, 'markets'), { name: marketName, phone: '', location: location || '', createdAt: Date.now() });
      }

      await addDoc(collection(db, 'orders'), {"""

content = content.replace(old_submit, new_submit)

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)
