import re

with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

# Make cart state unit-aware
content = content.replace(
    "const [cart, setCart] = useState<any[]>([]);",
    "const [cart, setCart] = useState<(any & {unit?: 'piece'|'carton'})[]>([]);"
)

old_add = """  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(p => p.id === item.id);
      if (existing) {
        if (existing.cartQty >= item.quantity) return prev;
        return prev.map(p => p.id === item.id ? { ...p, cartQty: p.cartQty + 1 } : p);
      }
      if (item.quantity <= 0) return prev;
      return [...prev, { ...item, cartQty: 1, finalPrice: item.sellingPrice }];
    });
  };"""

new_add = """  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(p => p.id === item.id);
      if (existing) {
        const newQty = existing.cartQty + 1;
        const totalPieces = existing.unit === 'carton' ? newQty * (item.ratio || 1) : newQty;
        if (totalPieces > item.quantity) {
          alert('بڕی داواکراو بەردەست نییە');
          return prev;
        }
        return prev.map(p => p.id === item.id ? { ...p, cartQty: newQty } : p);
      }
      if (item.quantity < 1) {
        alert('بڕی داواکراو بەردەست نییە');
        return prev;
      }
      return [...prev, { ...item, cartQty: 1, finalPrice: item.sellingPrice, unit: 'piece' }];
    });
  };"""
content = content.replace(old_add, new_add)

old_update = """  const updateCartQty = (id: string, qty: number) => {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    if (qty > item.quantity) qty = item.quantity;
    if (qty < 1) {
      setCart(prev => prev.filter(p => p.id !== id));
      return;
    }
    setCart(prev => prev.map(p => p.id === id ? { ...p, cartQty: qty } : p));
  };"""

new_update = """  const updateCartQty = (id: string, qty: number, unit?: 'piece'|'carton') => {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    
    setCart(prev => {
      const cartItem = prev.find(p => p.id === id);
      if (!cartItem) return prev;
      
      const newUnit = unit || cartItem.unit || 'piece';
      const totalPieces = newUnit === 'carton' ? qty * (item.ratio || 1) : qty;
      
      if (totalPieces > item.quantity) {
        alert('بڕی داواکراو بەردەست نییە');
        return prev;
      }
      
      if (qty < 1) {
        return prev.filter(p => p.id !== id);
      }
      
      const price = newUnit === 'carton' ? item.sellingPrice * (item.ratio || 1) : item.sellingPrice;
      
      return prev.map(p => p.id === id ? { ...p, cartQty: qty, unit: newUnit, finalPrice: price } : p);
    });
  };"""
content = content.replace(old_update, new_update)

old_cart_item = """                          <input
                            type="number"
                            className="w-16 px-2 py-1 border rounded text-center"
                            value={item.cartQty}
                            onChange={(e) => updateCartQty(item.id, Number(e.target.value))}
                            min="1"
                          />"""

new_cart_item = """                          <div className="flex flex-col gap-1">
                            <select 
                              className="text-xs border rounded p-1"
                              value={item.unit || 'piece'}
                              onChange={(e) => updateCartQty(item.id, item.cartQty, e.target.value as 'piece'|'carton')}
                            >
                              <option value="piece">دانە</option>
                              <option value="carton">کارتۆن</option>
                            </select>
                            <input
                              type="number"
                              className="w-16 px-2 py-1 border rounded text-center"
                              value={item.cartQty}
                              onChange={(e) => updateCartQty(item.id, Number(e.target.value))}
                              min="1"
                            />
                          </div>"""
content = content.replace(old_cart_item, new_cart_item)

old_submit = """        items: cart.map(c => ({
          itemId: c.id,
          name: c.name,
          quantity: c.cartQty,
          price: c.finalPrice
        })),"""

new_submit = """        items: cart.map(c => ({
          itemId: c.id,
          name: c.name,
          quantity: c.cartQty,
          unit: c.unit || 'piece',
          price: c.finalPrice
        })),"""
content = content.replace(old_submit, new_submit)

# Also need to make sure handleSale correctly updates inventory 
# Wait, Cashvan doesn't deduct from items table, it deducts from Cashvan inventory!
# But wait, when the Cashvan is loaded initially, does it store pieces or cartons?
# Let's check handleSale in CashvanSalesView.tsx
# "const newQty = currentQty - cartItem.cartQty;" -> this must be updated to deduct total pieces!

old_deduct = """          const currentQty = itemDoc.data().quantity || 0;
          const newQty = currentQty - cartItem.cartQty;
          await updateDoc(itemRef, { quantity: newQty });"""

new_deduct = """          const currentQty = itemDoc.data().quantity || 0;
          const piecesToDeduct = cartItem.unit === 'carton' ? cartItem.cartQty * (itemDoc.data().ratio || 1) : cartItem.cartQty;
          const newQty = currentQty - piecesToDeduct;
          await updateDoc(itemRef, { quantity: newQty });"""
content = content.replace(old_deduct, new_deduct)


with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(content)

