import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

edit_func = """  const handleEditOrder = (order: Order) => {
    setRepName(order.repName);
    setMarketName(order.marketName);
    setLocation(order.location);
    // order.items might not have the full 'item' object, just itemId
    // we need to match it with the inventory items
    const mappedItems = order.items.map(oi => {
      const fullItem = items.find(i => i.id === oi.itemId) || {
        id: oi.itemId,
        name: oi.name,
        quantity: 9999, // dummy so it doesn't fail
        costPrice: 0,
        sellingPrice: oi.price,
        wholesalePrice: 0,
        barcode: '',
        ratio: 1,
        packetRatio: 1
      } as unknown as Item;
      
      return {
        item: fullItem,
        quantity: oi.quantity,
        unit: oi.unit || 'piece'
      };
    });
    setSelectedItems(mappedItems);
    setEditingOrderId(order.id);
    setShowNewOrder(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteOrder"""

content = content.replace("  const handleDeleteOrder", edit_func)

# Add editingOrderId state
content = content.replace("const [showNewOrder, setShowNewOrder] = useState(false);", "const [showNewOrder, setShowNewOrder] = useState(false);\n  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);")

# Update handleSubmit to handle update
submit_logic = """      if (editingOrderId) {
        await updateDoc(doc(db, 'orders', editingOrderId), {
          repName,
          marketName,
          location,
          totalAmount,
          totalProfit,
          items: orderItems,
        });
        setEditingOrderId(null);
        alert('داواکارییەکە بەسەرکەوتووی نوێکرایەوە');
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
        alert('داواکارییەکە بەسەرکەوتووی نێردرا');
      }"""

# Find the addDoc part
import re
add_pattern = r"await addDoc\(collection\(db, 'orders'\), \{.*?timestamp: Date\.now\(\)\s*\}\);\s*setShowNewOrder"
match = re.search(r"(await addDoc\(collection\(db, 'orders'\), \{.*?timestamp: Date\.now\(\)\s*\}\);)", content, re.DOTALL)
if match:
    content = content.replace(match.group(1) + "\n\n      setShowNewOrder", submit_logic + "\n\n      setShowNewOrder")
    content = content.replace("alert('داواکارییەکە بەسەرکەوتووی نێردرا');", "")

# Add Edit icon to imports
if "Edit2" not in content:
    content = content.replace("Trash2", "Trash2, Edit2")

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)
print("done")
