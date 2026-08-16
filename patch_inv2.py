import re

with open('src/components/views/InventoryView.tsx', 'r') as f:
    content = f.read()

old_submit = """    try {
      if (isEditing) {"""

new_submit = """    try {
      if (supplier && !companies.find(c => c.name === supplier)) {
        await addDoc(collection(db, 'companies'), { name: supplier, location: '', phone: '', createdAt: Date.now() });
      }
      
      if (isEditing) {"""

content = content.replace(old_submit, new_submit)

with open('src/components/views/InventoryView.tsx', 'w') as f:
    f.write(content)
