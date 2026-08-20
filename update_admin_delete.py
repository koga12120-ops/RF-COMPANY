import re

with open('src/components/views/AdminCashvanView.tsx', 'r') as f:
    content = f.read()

new_func = """  const handleDeleteSale = async (sale: CashvanSale) => {
    if (window.confirm('دڵنیایت لە سڕینەوەی ئەم وەسڵە؟')) {
      try {
        await deleteDoc(doc(db, 'cashvan_sales', sale.id));
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
      } catch (error: any) {
        console.error(error);
        alert('هەڵەیەک ڕوویدا لە کاتی سڕینەوە: ' + error.message);
      }
    }
  };"""

content = re.sub(r'  const handleDeleteSale = async \(id: string\) => \{\n    if \(window\.confirm\([^)]+\)\) \{\n      try \{\n        await deleteDoc\(doc\(db, \'cashvan_sales\', id\)\);\n      \} catch \(error: any\) \{\n        console\.error\(error\);\n        alert\([^)]+\);\n      \}\n    \}\n  \};\n', new_func + '\n', content)

content = content.replace("handleDeleteSale(sale.id)", "handleDeleteSale(sale)")

with open('src/components/views/AdminCashvanView.tsx', 'w') as f:
    f.write(content)

print("done")
