import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

old_func_start = """const printOrder = async (order: Order) => {
    let oldDebt = 0;
    try {
      const q = query(collection(db, 'transactions'), where('type', '==', 'debt'), where('relatedEntityId', '==', order.marketName));
      const snapshot = await getDocs(q);
      snapshot.forEach(doc => {
        oldDebt += doc.data().amount || 0;
      });
    } catch (e) {
      console.error('Error fetching old debt', e);
    }"""

new_func_start = """const printOrder = async (order: Order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    let oldDebt = 0;
    try {
      const q = query(collection(db, 'transactions'), where('type', '==', 'debt'), where('relatedEntityId', '==', order.marketName));
      const snapshot = await getDocs(q);
      snapshot.forEach(doc => {
        oldDebt += doc.data().amount || 0;
      });
    } catch (e) {
      console.error('Error fetching old debt', e);
    }"""

content = content.replace(old_func_start, new_func_start)

# Now we need to remove the printWindow creation further down
old_window_open = """    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {"""

new_window_open = """    `;

    if (printWindow) {"""

content = content.replace(old_window_open, new_window_open)

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)
