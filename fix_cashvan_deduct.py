import re

with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

if 'getDoc' not in content:
    content = content.replace("import { collection, query, where, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';", "import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, getDoc } from 'firebase/firestore';")

old_deduct = """      // Deduct from cashvan_inventory
      for (const cartItem of cart) {
        const itemRef = doc(db, 'cashvan_inventory', cartItem.id);
        const newQty = cartItem.quantity - cartItem.cartQty;
        await updateDoc(itemRef, { quantity: newQty });
      }"""

new_deduct = """      // Deduct from cashvan_inventory
      for (const cartItem of cart) {
        const itemRef = doc(db, 'cashvan_inventory', cartItem.id);
        const itemSnap = await getDoc(itemRef);
        if (itemSnap.exists()) {
          const currentQty = itemSnap.data().quantity || 0;
          const newQty = currentQty - cartItem.cartQty;
          await updateDoc(itemRef, { quantity: newQty });
        }
      }"""

content = content.replace(old_deduct, new_deduct)

with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(content)
