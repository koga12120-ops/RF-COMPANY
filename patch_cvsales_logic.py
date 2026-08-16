import re

with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

old_add = """  const addToCart = (item: any) => {
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
  };

  const updateCartQty = (id: string, qty: number, unit?: 'piece'|'carton') => {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    
    setCart(prev => {
      const cartItem = prev.find(p => p.id === id);
      if (!cartItem) return prev;
      
      const newUnit = unit || cartItem.unit || 'piece';
      const totalPieces = newUnit === 'carton' ? qty * (item.ratio || 1) : qty;
      
      if (totalPieces > item.quantity) {
        alert('بڕی داواکراو بەردەست نییە. تەنها ' + item.quantity + ' دانە ماوە.');
        return prev;
      }

      if (qty < 1) return prev.filter(p => p.id !== id);

      const finalPrice = newUnit === 'carton' ? (item.sellingPrice * (item.ratio || 1)) : item.sellingPrice;
      return prev.map(p => p.id === id ? { ...p, cartQty: qty, unit: newUnit, finalPrice } : p);
    });
  };

  const updateCartPrice = (id: string, price: number) => {
    setCart(prev => prev.map(p => p.id === id ? { ...p, finalPrice: price } : p));
  };"""

new_add = """  const getPriceByUnit = (item: any, unit: string) => {
    if (unit === 'carton') return item.cartonSellingPrice || (item.sellingPrice * (item.ratio || 1));
    if (unit === 'packet') return item.packetSellingPrice || (item.sellingPrice * (item.packetRatio || 1));
    return item.sellingPrice || 0;
  };

  const getPiecesByUnit = (item: any, unit: string, qty: number) => {
    if (unit === 'carton') return qty * (item.ratio || 1);
    if (unit === 'packet') return qty * (item.packetRatio || 1);
    return qty;
  };

  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(p => p.id === item.id);
      if (existing) {
        const newQty = existing.cartQty + 1;
        const totalPieces = getPiecesByUnit(item, existing.unit || 'piece', newQty);
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
      return [...prev, { ...item, cartQty: 1, finalPrice: getPriceByUnit(item, 'piece'), unit: 'piece' }];
    });
  };

  const updateCartQty = (id: string, qty: number, unit?: string) => {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    
    setCart(prev => {
      const cartItem = prev.find(p => p.id === id);
      if (!cartItem) return prev;
      
      const newUnit = unit || cartItem.unit || 'piece';
      const totalPieces = getPiecesByUnit(item, newUnit, qty);
      
      if (totalPieces > item.quantity) {
        alert(`بڕی داواکراو بەردەست نییە. تەنها ${item.quantity} دانە ماوە.`);
        return prev;
      }

      if (qty < 1) return prev.filter(p => p.id !== id);

      // Only update finalPrice automatically if the unit changes. If the user changed the price manually, keep it.
      // But if unit changes, we must reset the price to the default for that unit.
      const finalPrice = unit && unit !== cartItem.unit ? getPriceByUnit(item, newUnit) : cartItem.finalPrice;
      return prev.map(p => p.id === id ? { ...p, cartQty: qty, unit: newUnit, finalPrice } : p);
    });
  };

  const updateCartPrice = (id: string, price: number) => {
    setCart(prev => prev.map(p => p.id === id ? { ...p, finalPrice: price } : p));
  };
  
  const handleQuantityDelta = (id: string, delta: number) => {
    const cartItem = cart.find(c => c.id === id);
    if (cartItem) {
      updateCartQty(id, cartItem.cartQty + delta, cartItem.unit);
    }
  };"""
content = content.replace(old_add, new_add)

old_sale = """      const saleData: Omit<CashvanSale, 'id'> = {
        cashvanName: userName,
        marketName: selectedMarket,
        items: cart.map(c => ({
          itemId: c.itemId || c.id,
          name: c.name,
          quantity: c.cartQty,
          price: c.finalPrice,
          ratio: c.ratio || 1,
          barcode: c.barcode || '-'
        })),"""

new_sale = """      const saleData: Omit<CashvanSale, 'id'> = {
        cashvanName: userName,
        marketName: selectedMarket,
        items: cart.map(c => ({
          itemId: c.itemId || c.id,
          name: c.name,
          quantity: c.cartQty,
          price: c.finalPrice,
          unit: c.unit || 'piece',
          ratio: c.ratio || 1,
          barcode: c.barcode || '-'
        })),"""
content = content.replace(old_sale, new_sale)

old_cart_ui = """                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1 items-end">
                    <select 
                      className="px-2 py-1 border border-slate-200 rounded-lg outline-none text-xs bg-slate-50"
                      value={c.unit || 'piece'}
                      onChange={(e) => updateCartQty(c.id, c.cartQty, e.target.value as 'piece'|'carton')}
                    >
                      <option value="piece">دانە</option>
                      <option value="carton">کارتۆن</option>
                    </select>
                    <input
                      type="number"
                      className="w-16 px-2 py-1 text-center border border-slate-200 rounded-lg outline-none text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                      value={c.cartQty}
                      onChange={(e) => updateCartQty(c.id, Number(e.target.value))}
                      dir="ltr"
                    />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <input
                      type="number"
                      step="any"
                      className="w-20 px-2 py-1 text-center border border-slate-200 rounded-lg outline-none text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                      value={c.finalPrice}
                      onChange={(e) => updateCartPrice(c.id, Number(e.target.value))}
                      dir="ltr"
                    />
                    <span className="font-bold text-slate-800 text-sm" dir="ltr">
                      {(c.cartQty * c.finalPrice).toLocaleString()}
                    </span>
                  </div>
                </div>"""

new_cart_ui = """                <div className="flex items-center gap-3 flex-wrap justify-end">
                  <div className="flex flex-col gap-1 items-end">
                    <select 
                      className="px-2 py-1 border border-slate-200 rounded-lg outline-none text-xs bg-slate-50"
                      value={c.unit || 'piece'}
                      onChange={(e) => updateCartQty(c.id, c.cartQty, e.target.value)}
                    >
                      <option value="piece">دانە</option>
                      {c.packetRatio > 0 && <option value="packet">پاکەت</option>}
                      {c.ratio > 0 && <option value="carton">کارتۆن</option>}
                    </select>
                    <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-2 py-1 bg-white">
                      <button type="button" onClick={() => handleQuantityDelta(c.id, -1)} className="px-2 text-xl font-bold text-slate-500 hover:text-indigo-600 focus:outline-none">-</button>
                      <span className="w-8 text-center text-sm font-medium">{c.cartQty}</span>
                      <button type="button" onClick={() => handleQuantityDelta(c.id, 1)} className="px-2 text-xl font-bold text-slate-500 hover:text-indigo-600 focus:outline-none">+</button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <input
                      type="number"
                      step="any"
                      className="w-20 px-2 py-1 text-center border border-slate-200 rounded-lg outline-none text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                      value={c.finalPrice}
                      onChange={(e) => updateCartPrice(c.id, Number(e.target.value))}
                      dir="ltr"
                    />
                    <span className="font-bold text-slate-800 text-sm" dir="ltr">
                      {(c.cartQty * c.finalPrice).toLocaleString()}
                    </span>
                  </div>
                </div>"""
content = content.replace(old_cart_ui, new_cart_ui)

old_print = """    const printContent = `
      <div dir="rtl" style="font-family: sans-serif; padding: 20px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="${window.location.origin}/LOGO1.jpg" alt="Logo" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: 10px;" />
          <h1 style="margin: 0; color: #1e293b; font-size: 24px;">کۆمپانیای RF</h1>
          <h2 style="margin: 5px 0; color: #333; font-size: 18px;">بۆ بازرگانی گشتی</h2>
          <p style="margin: 5px 0; font-size: 14px;">ناونیشان: هەولێر-ڕێگای کەرکوک</p>
          <p style="margin: 5px 0; font-size: 14px;">ژمارە مۆبایل: 07506144894</p>
        </div>"""

new_print = """    const printContent = `
      <div dir="rtl" style="font-family: sans-serif; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
          <div style="text-align: center; flex: 1;">
            <h1 style="margin: 0; color: #1e293b; font-size: 42px; font-weight: 900; letter-spacing: 2px;">TAM TAM</h1>
          </div>
          <div style="text-align: right; width: 250px;">
            <img src="${window.location.origin}/LOGO1.jpg" alt="Logo" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: 5px;" onerror="this.style.display='none'" />
            <h2 style="margin: 0; color: #333; font-size: 16px;">فاتورەی کاشڤان</h2>
            <p style="margin: 2px 0; font-size: 12px;">ناونیشان: هەولێر-ڕێگای کەرکوک</p>
            <p style="margin: 2px 0; font-size: 12px;">مۆبایل: 07506144894</p>
          </div>
        </div>"""
content = content.replace(old_print, new_print)

old_table_body = """          <tbody>
            ${sale.items.map((item, index) => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px;">${index + 1}</td>
                <td style="padding: 10px;">${item.barcode}</td>
                <td style="padding: 10px;">${item.name}</td>
                <td style="padding: 10px;">${item.quantity} ${item.unit === 'carton' ? 'کارتۆن' : 'دانە'}</td>
                <td style="padding: 10px;">${item.price.toLocaleString()}</td>
                <td style="padding: 10px;">${(item.quantity * item.price).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>"""

new_table_body = """          <tbody>
            ${sale.items.map((item, index) => {
              const unitLabel = item.unit === 'carton' ? 'کار' : (item.unit === 'packet' ? 'پاک' : 'دان');
              return `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px;">${index + 1}</td>
                <td style="padding: 10px;">${item.barcode}</td>
                <td style="padding: 10px;">${item.name}</td>
                <td style="padding: 10px;">${item.quantity}/${unitLabel}</td>
                <td style="padding: 10px;">${item.price.toLocaleString()}</td>
                <td style="padding: 10px;">${(item.quantity * item.price).toLocaleString()}</td>
              </tr>
            `;
            }).join('')}
          </tbody>"""
content = content.replace(old_table_body, new_table_body)

with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(content)
