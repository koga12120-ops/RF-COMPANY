import re

# Update OrdersView.tsx
with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

# Filter out deleted orders
content = content.replace("setOrders(ordersData);", "setOrders(ordersData.filter(o => o.status !== 'deleted'));")

# Add getDefaultUnit and update handleAddItemToOrder
new_handle_add_item = """  const getDefaultUnit = (item: Item) => {
    if (item.sellingPrice > 0 || item.wholesalePrice > 0 || (!item.ratio && !item.packetRatio)) return 'piece';
    if (item.packetRatio > 0 && (item.packetSellingPrice > 0 || item.packetWholesalePrice > 0)) return 'packet';
    if (item.ratio > 0 && (item.cartonSellingPrice > 0 || item.cartonWholesalePrice > 0)) return 'carton';
    return 'piece';
  };

  const handleAddItemToOrder = (item: Item) => {
    const exists = selectedItems.find(si => si.item.id === item.id);
    if (exists) {
      const newQty = exists.quantity + 1;
      const totalPieces = getPiecesByUnit(exists.item, exists.unit || 'piece', newQty);
      if (totalPieces > exists.item.quantity) {
        alert('بڕی داواکراو لە کۆگا بەردەست نییە');
        return;
      }
      setSelectedItems(selectedItems.map(si => 
        si.item.id === item.id ? { ...si, quantity: newQty } : si
      ));
    } else {
      if (item.quantity < 1) {
        alert('بڕی داواکراو لە کۆگا بەردەست نییە');
        return;
      }
      const unit = getDefaultUnit(item);
      setSelectedItems([...selectedItems, { item, quantity: 1, unit }]);
    }
  };"""

content = re.sub(r"  const handleAddItemToOrder = \(item: Item\) => \{.*?\n  \};", new_handle_add_item, content, flags=re.DOTALL)

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)

# Update CashvanSalesView.tsx
with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

# Filter out deleted sales
content = content.replace("setSales(data.sort((a,b) => b.date - a.date));", "setSales(data.filter(s => s.status !== 'deleted').sort((a,b) => b.date - a.date));")

# Add getDefaultUnit and update handleAddItemToCart
new_handle_add_cart = """  const getDefaultUnit = (item: any) => {
    if (item.sellingPrice > 0 || item.wholesalePrice > 0 || (!item.ratio && !item.packetRatio)) return 'piece';
    if (item.packetRatio > 0 && (item.packetSellingPrice > 0 || item.packetWholesalePrice > 0)) return 'packet';
    if (item.ratio > 0 && (item.cartonSellingPrice > 0 || item.cartonWholesalePrice > 0)) return 'carton';
    return 'piece';
  };

  const handleAddItemToCart = (item: any) => {
    setCart((prev) => {
      const existing = prev.find(p => p.id === item.id);
      if (existing) {
        const newQty = existing.cartQty + 1;
        const totalPieces = existing.unit === 'carton' ? newQty * (item.ratio || 1) : (existing.unit === 'packet' ? newQty * (item.packetRatio || 1) : newQty);
        if (totalPieces > item.quantity) {
          alert('بڕی داواکراو لە کاشڤان بەردەست نییە');
          return prev;
        }
        return prev.map(p => p.id === item.id ? { ...p, cartQty: newQty } : p);
      }
      if (item.quantity < 1) {
        alert('بڕی داواکراو لە کاشڤان بەردەست نییە');
        return prev;
      }
      const unit = getDefaultUnit(item);
      return [...prev, { ...item, cartQty: 1, finalPrice: calcPrice(item, unit, selectedMarket), unit }];
    });
  };"""

content = re.sub(r"  const handleAddItemToCart = \(item: any\) => \{.*?\n  \};", new_handle_add_cart, content, flags=re.DOTALL)

with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(content)

print("done")
