import re

with open('src/components/views/InventoryView.tsx', 'r') as f:
    content = f.read()

old_edit = """        if (newQuantity > oldQuantity) {
          const quantityAdded = newQuantity - oldQuantity;
          await addDoc(collection(db, 'stock_history'), {
            itemId: editId,
            itemName: name,
            quantityAdded,
            date: Date.now()
          });
        }"""

new_edit = """        if (newQuantity > oldQuantity) {
          const quantityAdded = newQuantity - oldQuantity;
          await addDoc(collection(db, 'stock_history'), {
            itemId: editId,
            itemName: name,
            quantityAdded,
            date: Date.now()
          });
          
          if (supplier) {
            await addDoc(collection(db, 'transactions'), {
              type: paymentType === 'cash' ? 'company_cash' : 'company_debt',
              amount: Number(costPrice) * quantityAdded,
              date: Date.now(),
              description: paymentType === 'cash' ? `نەقدی زیادکردنی کاڵای ${name}` : `قەرزی زیادکردنی کاڵای ${name}`,
              relatedEntityId: supplier
            });
          }
        }"""

content = content.replace(old_edit, new_edit)

with open('src/components/views/InventoryView.tsx', 'w') as f:
    f.write(content)

