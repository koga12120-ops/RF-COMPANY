import re

with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

new_func = """  const handleDeleteSale = async (sale: any, isEdit: boolean = false) => {
    if (!isEdit && !window.confirm('دڵنیایت لە سڕینەوە؟')) return;

    try {
      if (isEdit) { await deleteDoc(doc(db, 'cashvan_sales', sale.id)); } else { await updateDoc(doc(db, 'cashvan_sales', sale.id), { status: 'deleted', deletedBy: userName }); }
      for (const item of sale.items) {
        const q = query(collection(db, 'cashvan_inventory'), where('itemId', '==', item.itemId), where('cashvanName', '==', sale.cashvanName));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const itemDoc = snap.docs[0];
          const totalPieces = item.unit === 'carton' ? item.quantity * (item.ratio || 1) : (item.unit === 'packet' ? item.quantity * (item.packetRatio || 1) : item.quantity);
          await updateDoc(doc(db, 'cashvan_inventory', itemDoc.id), {
            quantity: (itemDoc.data().quantity || 0) + totalPieces
          });
        }
      }
    } catch (e: any) {
      console.error(e);
      alert('Error: ' + e.message);
    }
  };"""

content = re.sub(r'  const handleDeleteSale = async \(sale: any, isEdit: boolean = false\) => \{.*?\n  \};\n', new_func + '\n', content, flags=re.DOTALL)

with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(content)

print("done")
