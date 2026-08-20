import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

# Replace the submission logic
submit_logic_old = """      await addDoc(collection(db, 'orders'), {
        repName,
        marketName,
        location,
        totalAmount,
        totalProfit,
        items: orderItems,
        status: 'pending',
        timestamp: Date.now()
      });"""

submit_logic_new = """      if (editingOrderId) {
        await updateDoc(doc(db, 'orders', editingOrderId), {
          repName,
          marketName,
          location,
          totalAmount,
          totalProfit,
          items: orderItems,
          status: 'pending',
          timestamp: Date.now()
        });
        setEditingOrderId(null);
      } else {
        await addDoc(collection(db, 'orders'), {
          repName,
          marketName,
          location,
          totalAmount,
          totalProfit,
          items: orderItems,
          status: 'pending',
          timestamp: Date.now()
        });
      }"""

content = content.replace(submit_logic_old, submit_logic_new)

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)

print("done")
