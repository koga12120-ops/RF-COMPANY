import re

with open('src/components/views/InventoryView.tsx', 'r') as f:
    content = f.read()

old_if1 = """          if (supplier) {
            await addDoc(collection(db, 'transactions'), {
              type: paymentType === 'cash' ? 'company_cash' : 'company_debt',
              amount: costPricePerPiece * quantityAdded,
              date: Date.now(),
              description: paymentType === 'cash' ? `نەقدی زیادکردنی کاڵای ${name}` : `قەرزی زیادکردنی کاڵای ${name}`,
              relatedEntityId: supplier
            });
          }"""

new_if1 = """          await addDoc(collection(db, 'transactions'), {
            type: paymentType === 'cash' ? 'company_cash' : 'company_debt',
            amount: costPricePerPiece * quantityAdded,
            date: Date.now(),
            description: paymentType === 'cash' ? `نەقدی زیادکردنی کاڵای ${name}` : `قەرزی زیادکردنی کاڵای ${name}`,
            relatedEntityId: supplier || 'نەزانراو'
          });"""
content = content.replace(old_if1, new_if1)

old_if2 = """          if (supplier) {
            await addDoc(collection(db, 'transactions'), {
              type: paymentType === 'cash' ? 'company_cash' : 'company_debt',
              amount: costPricePerPiece * newQuantity,
              date: Date.now(),
              description: paymentType === 'cash' ? `نەقدی کڕینی کاڵای ${name}` : `قەرزی کڕینی کاڵای ${name}`,
              relatedEntityId: supplier
            });
          }"""

new_if2 = """          await addDoc(collection(db, 'transactions'), {
            type: paymentType === 'cash' ? 'company_cash' : 'company_debt',
            amount: costPricePerPiece * newQuantity,
            date: Date.now(),
            description: paymentType === 'cash' ? `نەقدی کڕینی کاڵای ${name}` : `قەرزی کڕینی کاڵای ${name}`,
            relatedEntityId: supplier || 'نەزانراو'
          });"""
content = content.replace(old_if2, new_if2)

with open('src/components/views/InventoryView.tsx', 'w') as f:
    f.write(content)

