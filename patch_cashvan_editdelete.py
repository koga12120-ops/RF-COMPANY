import re

with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

funcs = """
  const handleDeleteSale = async (sale: any) => {
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
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditSale = async (sale: any) => {
    await handleDeleteSale(sale);
    setSelectedMarket(sale.marketName);
    const newCart = sale.items.map(i => {
      const invItem = inventory.find(inv => inv.itemId === i.itemId) || { id: i.itemId, itemId: i.itemId, name: i.name, quantity: 999, costPrice: 0 } as any;
      return {
        ...invItem,
        cartQty: i.quantity,
        unit: i.unit,
        finalPrice: i.price,
        barcode: i.barcode,
        ratio: i.ratio,
        packetRatio: i.packetRatio
      };
    });
    setCart(newCart);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const printReceipt"""

content = content.replace("  const printReceipt", funcs)

# Add Edit and Delete buttons to the table
buttons = """                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => printReceipt(sale, sale.id)} className="p-1.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100"><Printer size={16} /></button>
                        <button onClick={() => handleEditSale(sale)} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"><Edit2 size={16} /></button>
                        <button onClick={() => handleDeleteSale(sale)} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100"><Trash2 size={16} /></button>
                      </div>
                    </td>"""

# Find the print button and replace
content = re.sub(r'<td className="p-3">\s*<button onClick=\{\(\) => printReceipt\(sale, sale\.id\)\}.*?</button>\s*</td>', buttons, content, flags=re.DOTALL)

# Add missing imports
if 'deleteDoc' not in content:
    content = content.replace("updateDoc,", "updateDoc, deleteDoc,")
if 'Edit2' not in content:
    content = content.replace("Trash2 }", "Trash2, Edit2 }")

with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(content)
print("done")
