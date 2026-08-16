import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

old_add = """  const handleAddItemToOrder = (item: Item) => {
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
  };

  const handleUpdateItemQuantity = (id: string, qty: number, unit?: 'piece'|'carton') => {
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

new_add = """  const getPriceByUnit = (item: Item, unit: string) => {
    if (unit === 'carton') return item.cartonSellingPrice || (item.sellingPrice * (item.ratio || 1));
    if (unit === 'packet') return item.packetSellingPrice || (item.sellingPrice * (item.packetRatio || 1));
    return item.sellingPrice || 0;
  };

  const getPiecesByUnit = (item: Item, unit: string, qty: number) => {
    if (unit === 'carton') return qty * (item.ratio || 1);
    if (unit === 'packet') return qty * (item.packetRatio || 1);
    return qty;
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
      setSelectedItems([...selectedItems, { item, quantity: 1, unit: 'piece' }]);
    }
  };

  const handleUpdateItemQuantity = (id: string, qty: number, unit?: string) => {
    if (qty <= 0) {
      setSelectedItems(selectedItems.filter(si => si.item.id !== id));
      return;
    }
    
    const item = selectedItems.find(si => si.item.id === id);
    if (item) {
      const selectedUnit = unit || item.unit || 'piece';
      const totalPieces = getPiecesByUnit(item.item, selectedUnit, qty);
      if (totalPieces > item.item.quantity) {
        alert(`بڕی داواکراو لە کۆگا بەردەست نییە. تەنها ${item.item.quantity} دانە ماوە.`);
        return;
      }
    }

    setSelectedItems(selectedItems.map(si => 
      si.item.id === id ? { ...si, quantity: qty, unit: (unit || si.unit) as any } : si
    ));
  };

  const handleQuantityDelta = (id: string, delta: number) => {
    const item = selectedItems.find(si => si.item.id === id);
    if (item) {
      handleUpdateItemQuantity(id, item.quantity + delta, item.unit);
    }
  };"""
content = content.replace(old_add, new_add)

old_submit = """    const totalAmount = selectedItems.reduce((acc, curr) => {
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

new_submit = """    const totalAmount = selectedItems.reduce((acc, curr) => {
      const price = getPriceByUnit(curr.item, curr.unit || 'piece');
      return acc + (price * curr.quantity);
    }, 0);

    const orderItems = selectedItems.map(si => ({
      itemId: si.item.id,
      name: si.item.name,
      price: getPriceByUnit(si.item, si.unit || 'piece'),
      quantity: si.quantity,
      unit: si.unit || 'piece'
    }));"""
content = content.replace(old_submit, new_submit)

old_selected = """                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500 font-mono" dir="ltr">{si.item.sellingPrice}</span>
                          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-2 py-1">
                            <input 
                              type="number" 
                              min="1"
                              className="w-12 outline-none text-center text-sm font-medium"
                              value={si.quantity}
                              onChange={(e) => handleUpdateItemQuantity(si.item.id, Number(e.target.value))}
                              dir="ltr"
                            />
                          </div>
                          <span className="font-bold min-w-[80px] text-left text-slate-800 text-sm" dir="ltr">
                            {(si.quantity * si.item.sellingPrice).toLocaleString()}
                          </span>
                        </div>"""

new_selected = """                        <div className="flex items-center gap-3 flex-wrap justify-end">
                          <select 
                            className="px-2 py-1 border border-slate-200 rounded-lg outline-none text-sm bg-slate-50"
                            value={si.unit || 'piece'}
                            onChange={(e) => handleUpdateItemQuantity(si.item.id, si.quantity, e.target.value)}
                          >
                            <option value="piece">دانە</option>
                            {si.item.packetRatio > 0 && <option value="packet">پاکەت</option>}
                            {si.item.ratio > 0 && <option value="carton">کارتۆن</option>}
                          </select>
                          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-2 py-1 bg-white">
                            <button type="button" onClick={() => handleQuantityDelta(si.item.id, -1)} className="px-2 text-xl font-bold text-slate-500 hover:text-indigo-600 focus:outline-none">-</button>
                            <span className="w-8 text-center text-sm font-medium">{si.quantity}</span>
                            <button type="button" onClick={() => handleQuantityDelta(si.item.id, 1)} className="px-2 text-xl font-bold text-slate-500 hover:text-indigo-600 focus:outline-none">+</button>
                          </div>
                          <span className="font-bold min-w-[80px] text-left text-slate-800 text-sm" dir="ltr">
                            {(si.quantity * getPriceByUnit(si.item, si.unit || 'piece')).toLocaleString()}
                          </span>
                        </div>"""
content = content.replace(old_selected, new_selected)

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
            <h2 style="margin: 0; color: #333; font-size: 16px;">وەسڵی کۆگا</h2>
            <p style="margin: 2px 0; font-size: 12px;">ناونیشان: هەولێر-ڕێگای کەرکوک</p>
            <p style="margin: 2px 0; font-size: 12px;">مۆبایل: 07506144894</p>
          </div>
        </div>"""
content = content.replace(old_print, new_print)

old_table_body = """          <tbody>
            ${order.items.map((item, index) => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px;">${index + 1}</td>
                <td style="padding: 10px;">${item.name}</td>
                <td style="padding: 10px;">${item.quantity} ${item.unit === 'carton' ? 'کارتۆن' : 'دانە'}</td>
                <td style="padding: 10px;">${item.price.toLocaleString()}</td>
                <td style="padding: 10px;">${(item.quantity * item.price).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>"""

new_table_body = """          <tbody>
            ${order.items.map((item, index) => {
              const unitLabel = item.unit === 'carton' ? 'کار' : (item.unit === 'packet' ? 'پاک' : 'دان');
              return `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px;">${index + 1}</td>
                <td style="padding: 10px;">${item.name}</td>
                <td style="padding: 10px;">${item.quantity}/${unitLabel}</td>
                <td style="padding: 10px;">${item.price.toLocaleString()}</td>
                <td style="padding: 10px;">${(item.quantity * item.price).toLocaleString()}</td>
              </tr>
            `;
            }).join('')}
          </tbody>"""
content = content.replace(old_table_body, new_table_body)

old_footer_total = """                <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
                  <div className="font-bold text-slate-800 text-sm">کۆی گشتی:</div>
                  <div className="font-bold text-xl text-indigo-600" dir="ltr">
                    {selectedItems.reduce((acc, curr) => acc + (curr.quantity * (curr.unit === 'carton' ? curr.item.sellingPrice * (curr.item.ratio || 1) : curr.item.sellingPrice)), 0).toLocaleString()}
                  </div>
                </div>"""

new_footer_total = """                <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
                  <div className="font-bold text-slate-800 text-sm">کۆی گشتی:</div>
                  <div className="font-bold text-xl text-indigo-600" dir="ltr">
                    {selectedItems.reduce((acc, curr) => acc + (curr.quantity * getPriceByUnit(curr.item, curr.unit || 'piece')), 0).toLocaleString()}
                  </div>
                </div>"""
content = content.replace(old_footer_total, new_footer_total)

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)
