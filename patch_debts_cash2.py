import re

with open('src/components/views/DebtsView.tsx', 'r') as f:
    content = f.read()

old_submit = """    try {
      await addDoc(collection(db, 'transactions'), {"""

new_submit = """    try {
      if (relatedEntityId && !suggestions.find(s => s.name === relatedEntityId)) {
        const collectionName = type.includes('company') ? 'companies' : 'markets';
        await addDoc(collection(db, collectionName), { name: relatedEntityId, location: '', phone: '', createdAt: Date.now() });
      }

      await addDoc(collection(db, 'transactions'), {"""

content = content.replace(old_submit, new_submit)

with open('src/components/views/DebtsView.tsx', 'w') as f:
    f.write(content)

with open('src/components/views/CashView.tsx', 'r') as f:
    content = f.read()
content = content.replace(old_submit, new_submit)

with open('src/components/views/CashView.tsx', 'w') as f:
    f.write(content)
