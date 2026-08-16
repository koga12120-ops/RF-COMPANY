import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

# Make sure getDoc is imported
if 'getDoc' not in content:
    content = content.replace("import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';", "import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';")
elif 'import { collection' in content and 'getDoc' not in content:
    content = content.replace("deleteDoc }", "deleteDoc, getDoc }")

# Replace updateOrderStatus definition
old_fn = """  const updateOrderStatus = async (id: string, status: Order['status']) => {
    try {
      await updateDoc(doc(db, 'orders', id), { status });
    } catch (error) {
      console.error(error);
    }
  };"""

new_fn = """  const updateOrderStatus = async (order: Order, status: Order['status']) => {
    try {
      if (status === 'completed' && order.status !== 'completed') {
        for (const item of order.items) {
          const itemRef = doc(db, 'items', item.itemId);
          const itemSnap = await getDoc(itemRef);
          if (itemSnap.exists()) {
            const newQty = (itemSnap.data().quantity || 0) - item.quantity;
            await updateDoc(itemRef, { quantity: newQty });
          }
        }
      }
      await updateDoc(doc(db, 'orders', order.id), { status });
    } catch (error) {
      console.error(error);
    }
  };"""

content = content.replace(old_fn, new_fn)

# Replace invocations
content = content.replace("updateOrderStatus(order.id, 'printed')", "updateOrderStatus(order, 'printed')")
content = content.replace("updateOrderStatus(order.id, 'completed')", "updateOrderStatus(order, 'completed')")

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)
