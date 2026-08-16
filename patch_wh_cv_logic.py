import re

with open('src/components/views/WarehouseCashvanView.tsx', 'r') as f:
    content = f.read()

old_add = """  const addToCart = (item: Item) => {
    setCart(prev => {
      const exists = prev.find(p => p.item.id === item.id);
      if (exists) {
        if (exists.quantity + 1 > item.quantity) return prev;
        return prev.map(p => p.item.id === item.id ? { ...p, quantity: p.quantity + 1 } : p);
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const updateQuantity = (itemId: string, qty: number) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    if (qty > item.quantity) qty = item.quantity;
    if (qty < 1) {
      setCart(prev => prev.filter(p => p.item.id !== itemId));
      return;
    }
    setCart(prev => prev.map(p => p.item.id === itemId ? { ...p, quantity: qty } : p));
  };"""

new_add = """  const getPiecesByUnit = (item: Item, unit: string, qty: number) => {
    if (unit === 'carton') return qty * (item.ratio || 1);
    if (unit === 'packet') return qty * (item.packetRatio || 1);
    return qty;
  };

  const addToCart = (item: Item) => {
    setCart(prev => {
      const exists = prev.find(p => p.item.id === item.id);
      if (exists) {
        const newQty = exists.quantity + 1;
        const totalPieces = getPiecesByUnit(item, (exists as any).unit || 'piece', newQty);
        if (totalPieces > item.quantity) return prev;
        return prev.map(p => p.item.id === item.id ? { ...p, quantity: newQty } : p);
      }
      return [...prev, { item, quantity: 1, unit: 'piece' } as any];
    });
  };

  const updateQuantity = (itemId: string, qty: number, unit?: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    setCart(prev => {
      const cartItem = prev.find(p => p.item.id === itemId);
      if (!cartItem) return prev;

      const newUnit = unit || (cartItem as any).unit || 'piece';
      const totalPieces = getPiecesByUnit(item, newUnit, qty);

      if (totalPieces > item.quantity) return prev;
      if (qty < 1) return prev.filter(p => p.item.id !== itemId);
      
      return prev.map(p => p.item.id === itemId ? { ...p, quantity: qty, unit: newUnit } : p);
    });
  };

  const handleQuantityDelta = (itemId: string, delta: number) => {
    const cartItem = cart.find(c => c.item.id === itemId);
    if (cartItem) {
      updateQuantity(itemId, cartItem.quantity + delta, (cartItem as any).unit);
    }
  };"""
content = content.replace(old_add, new_add)

old_cart_ui = """                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max={c.item.quantity}
                    value={c.quantity}
                    onChange={(e) => updateQuantity(c.item.id, parseInt(e.target.value) || 0)}
                    className="w-16 px-2 py-1 text-center border border-slate-200 rounded outline-none"
                  />
                </div>"""

new_cart_ui = """                <div className="flex items-center gap-2">
                  <select 
                    className="px-2 py-1 border border-slate-200 rounded outline-none text-xs bg-slate-50"
                    value={(c as any).unit || 'piece'}
                    onChange={(e) => updateQuantity(c.item.id, c.quantity, e.target.value)}
                  >
                    <option value="piece">دانە</option>
                    {c.item.packetRatio > 0 && <option value="packet">پاکەت</option>}
                    {c.item.ratio > 0 && <option value="carton">کارتۆن</option>}
                  </select>
                  <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-1 py-1 bg-white">
                    <button type="button" onClick={() => handleQuantityDelta(c.item.id, -1)} className="px-2 text-lg font-bold text-slate-500 hover:text-indigo-600">-</button>
                    <span className="w-8 text-center text-sm">{c.quantity}</span>
                    <button type="button" onClick={() => handleQuantityDelta(c.item.id, 1)} className="px-2 text-lg font-bold text-slate-500 hover:text-indigo-600">+</button>
                  </div>
                </div>"""
content = content.replace(old_cart_ui, new_cart_ui)

with open('src/components/views/WarehouseCashvanView.tsx', 'w') as f:
    f.write(content)
