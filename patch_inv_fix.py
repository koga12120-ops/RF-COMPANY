import re

with open('src/components/views/InventoryView.tsx', 'r') as f:
    content = f.read()

fixed_part = """      } else {
        itemData.quantity = totalPieces;
        const docRef = await addDoc(collection(db, 'items'), { ...itemData, createdAt: Date.now() });
        
        if (totalPieces > 0) {
          await addDoc(collection(db, 'stock_history'), {
            itemId: docRef.id,
            itemName: name,
            quantityAdded: totalPieces,
            date: Date.now()
          });
          
          await addDoc(collection(db, 'transactions'), {
            type: paymentType === 'cash' ? 'company_cash' : 'company_debt',
            amount: costPricePerPiece * totalPieces,
            date: Date.now(),
            description: paymentType === 'cash' ? `نەقدی کڕینی کاڵای ${name}` : `قەرزی کڕینی کاڵای ${name}`,
            relatedEntityId: supplier || 'نەزانراو'
          });
        }
      }
      resetForm();"""

# Replace lines 172 to 205
lines = content.split('\n')
new_lines = lines[:171] + fixed_part.split('\n') + lines[204:]
new_content = '\n'.join(new_lines)

with open('src/components/views/InventoryView.tsx', 'w') as f:
    f.write(new_content)
