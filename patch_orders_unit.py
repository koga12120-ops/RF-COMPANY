import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "const [selectedItems, setSelectedItems] = useState<{item: Item, quantity: number}[]>([]);",
    "const [selectedItems, setSelectedItems] = useState<{item: Item, quantity: number, unit: 'piece'|'carton'}[]>([]);"
)

old_add = """  const handleAddItemToOrder = (item: Item) => {
    const exists = selectedItems.find(si => si.item.id === item.id);
    if (exists) {
      setSelectedItems(selectedItems.map(si => 
        si.item.id === item.id ? { ...si, quantity: si.quantity + 1 } : si
      ));
    } else {
      setSelectedItems([...selectedItems, { item, quantity: 1 }]);
    }
  };"""

new_add = """  const handleAddItemToOrder = (item: Item) => {
    const exists = selectedItems.find(si => si.item.id === item.id);
    if (exists) {
      const newQty = exists.quantity + 1;
      const totalPieces = exists.unit === 'carton' ? newQty * (exists.item.ratio || 1) : newQty;
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
      setSelectedItems([...selectedItems, { item, quantity: 1, unit: 'piece' }]);
    }
  };"""
content = content.replace(old_add, new_add)

old_update = """  const handleUpdateItemQuantity = (id: string, qty: number) => {
    if (qty <= 0) {
      setSelectedItems(selectedItems.filter(si => si.item.id !== id));
      return;
    }
    setSelectedItems(selectedItems.map(si => 
      si.item.id === id ? { ...si, quantity: qty } : si
    ));
  };"""

new_update = """  const handleUpdateItemQuantity = (id: string, qty: number, unit?: 'piece'|'carton') => {
    if (qty <= 0) {
      setSelectedItems(selectedItems.filter(si => si.item.id !== id));
      return;
    }
    
    const item = selectedItems.find(si => si.item.id === id);
    if (item) {
      const selectedUnit = unit || item.unit;
      const totalPieces = selectedUnit === 'carton' ? qty * (item.item.ratio || 1) : qty;
      if (totalPieces > item.item.quantity) {
        alert('بڕی داواکراو لە کۆگا بەردەست نییە. تەنها ' + item.item.quantity + ' دانە ماوە.');
        return;
      }
    }

    setSelectedItems(selectedItems.map(si => 
      si.item.id === id ? { ...si, quantity: qty, unit: unit || si.unit } : si
    ));
  };"""
content = content.replace(old_update, new_update)

old_submit = """    const totalAmount = selectedItems.reduce((acc, curr) => acc + (curr.item.sellingPrice * curr.quantity), 0);
    const orderItems = selectedItems.map(si => ({
      itemId: si.item.id,
      name: si.item.name,
      price: si.item.sellingPrice,
      quantity: si.quantity
    }));"""

new_submit = """    const totalAmount = selectedItems.reduce((acc, curr) => {
      const price = curr.unit === 'carton' ? curr.item.sellingPrice * (curr.item.ratio || 1) : curr.item.sellingPrice;
      return acc + (price * curr.quantity);
    }, 0);
    const orderItems = selectedItems.map(si => ({
      itemId: si.item.id,
      name: si.item.name,
      price: si.unit === 'carton' ? si.item.sellingPrice * (si.item.ratio || 1) : si.item.sellingPrice,
      quantity: si.quantity,
      unit: si.unit
    }));"""
content = content.replace(old_submit, new_submit)

old_cart_item = """                          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1">
                            <input
                              type="number"
                              min="0"
                              className="w-12 outline-none text-center text-sm font-medium"
                              value={si.quantity}
                              onChange={(e) => handleUpdateItemQuantity(si.item.id, Number(e.target.value))}
                              dir="ltr"
                            />
                          </div>
                          <span className="font-bold min-w-[80px] text-left text-slate-800 text-sm" dir="ltr">
                            {(si.quantity * si.item.sellingPrice).toLocaleString()}
                          </span>"""

new_cart_item = """                          <div className="flex items-center gap-2">
                            <select 
                              className="text-sm border border-slate-200 rounded-lg p-1 bg-slate-50 outline-none"
                              value={si.unit}
                              onChange={(e) => handleUpdateItemQuantity(si.item.id, si.quantity, e.target.value as 'piece'|'carton')}
                            >
                              <option value="piece">دانە</option>
                              <option value="carton">کارتۆن</option>
                            </select>
                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1">
                              <input
                                type="number"
                                min="0"
                                className="w-12 outline-none text-center text-sm font-medium bg-transparent"
                                value={si.quantity}
                                onChange={(e) => handleUpdateItemQuantity(si.item.id, Number(e.target.value))}
                                dir="ltr"
                              />
                            </div>
                          </div>
                          <span className="font-bold min-w-[80px] text-left text-slate-800 text-sm" dir="ltr">
                            {(si.quantity * (si.unit === 'carton' ? si.item.sellingPrice * (si.item.ratio || 1) : si.item.sellingPrice)).toLocaleString()}
                          </span>"""
content = content.replace(old_cart_item, new_cart_item)

old_totals = "{selectedItems.reduce((acc, curr) => acc + (curr.item.sellingPrice * curr.quantity), 0).toLocaleString()}"
new_totals = "{selectedItems.reduce((acc, curr) => acc + (curr.quantity * (curr.unit === 'carton' ? curr.item.sellingPrice * (curr.item.ratio || 1) : curr.item.sellingPrice)), 0).toLocaleString()}"
content = content.replace(old_totals, new_totals)

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)

