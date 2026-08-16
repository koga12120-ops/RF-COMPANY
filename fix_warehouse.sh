cat << 'INNER_EOF' > src/components/views/WarehouseCashvanView.tsx
import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, onSnapshot, addDoc, getDocs, updateDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { Search, Plus, Send } from 'lucide-react';
import { Item, CashvanTransfer } from '../../types';
import { format } from 'date-fns';

export default function WarehouseCashvanView() {
  const [items, setItems] = useState<Item[]>([]);
  const [cashvans, setCashvans] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<CashvanTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedCashvan, setSelectedCashvan] = useState('');
  const [cart, setCart] = useState<{item: Item, quantity: number, unit: 'piece'|'packet'|'carton'}[]>([]);

  useEffect(() => {
    const unsubItems = onSnapshot(query(collection(db, 'items')), (snapshot) => {
      const data: Item[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Item));
      setItems(data);
      setLoading(false);
    });

    const unsubCashvans = onSnapshot(query(collection(db, 'cashvans')), (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setCashvans(data);
    });

    const unsubTransfers = onSnapshot(query(collection(db, 'cashvan_transfers')), (snapshot) => {
      const data: CashvanTransfer[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as CashvanTransfer));
      setTransfers(data.sort((a, b) => b.date - a.date));
    });

    return () => {
      unsubItems();
      unsubCashvans();
      unsubTransfers();
    };
  }, []);

  const addToCart = (item: Item) => {
    const existing = cart.find(c => c.item.id === item.id);
    if (existing) {
      updateQuantity(item.id, existing.quantity + 1, existing.unit);
    } else {
      setCart([...cart, { item, quantity: 1, unit: 'piece' }]);
    }
  };

  const getPiecesByUnit = (cartItem: {item: Item, quantity: number, unit: string}) => {
    let multiplier = 1;
    if (cartItem.unit === 'carton') multiplier = cartItem.item.ratio || 1;
    if (cartItem.unit === 'packet') multiplier = cartItem.item.packetRatio || 1;
    return cartItem.quantity * multiplier;
  };

  const getPriceByUnit = (item: Item, unit: string) => {
    if (unit === 'carton') return item.cartonCostPrice || 0;
    if (unit === 'packet') return item.packetCostPrice || 0;
    return item.costPrice || 0;
  };

  const handleQuantityDelta = (itemId: string, delta: number) => {
    const existing = cart.find(c => c.item.id === itemId);
    if (!existing) return;
    const newQty = existing.quantity + delta;
    updateQuantity(itemId, newQty, existing.unit);
  };

  const updateQuantity = (itemId: string, qty: number, unit: string) => {
    const cartItem = cart.find(c => c.item.id === itemId);
    if (!cartItem) return;
    
    if (qty < 1) {
      setCart(prev => prev.filter(p => p.item.id !== itemId));
      return;
    }

    // Check available stock
    const item = items.find(i => i.id === itemId);
    if (item) {
      let multiplier = 1;
      if (unit === 'carton') multiplier = item.ratio || 1;
      if (unit === 'packet') multiplier = item.packetRatio || 1;
      
      const totalPiecesRequested = qty * multiplier;
      if (totalPiecesRequested > item.quantity) {
        qty = Math.floor(item.quantity / multiplier);
        if (qty < 1) {
          setCart(prev => prev.filter(p => p.item.id !== itemId));
          return;
        }
      }
    }

    setCart(prev => prev.map(p => p.item.id === itemId ? { ...p, quantity: qty, unit: unit as any } : p));
  };

  const handleTransfer = async () => {
    if (!selectedCashvan || cart.length === 0) return;
    
    try {
      if (selectedCashvan && !cashvans.find(c => c.name === selectedCashvan)) {
        await addDoc(collection(db, 'cashvans'), { name: selectedCashvan, phone: '', totalSales: 0, totalProfit: 0, createdAt: Date.now() });
      }

      const totalValue = cart.reduce((acc, curr) => acc + (getPriceByUnit(curr.item, curr.unit) * curr.quantity), 0);
      
      const transferData: Omit<CashvanTransfer, 'id'> = {
        cashvanName: selectedCashvan,
        items: cart.map(c => ({
          itemId: c.item.id,
          name: c.item.name,
          quantity: c.quantity,
          unit: c.unit,
          price: getPriceByUnit(c.item, c.unit)
        })),
        totalValue,
        date: Date.now()
      };

      await addDoc(collection(db, 'cashvan_transfers'), transferData);

      // Deduct from global items and add to cashvan_inventory
      for (const cartItem of cart) {
        const piecesToTransfer = getPiecesByUnit(cartItem);
        
        // Deduct global
        const itemRef = doc(db, 'items', cartItem.item.id);
        const newQty = cartItem.item.quantity - piecesToTransfer;
        await updateDoc(itemRef, { quantity: newQty });

        // Add to cashvan inventory
        const cInvRef = doc(db, 'cashvan_inventory', `${selectedCashvan}_${cartItem.item.id}`);
        const cInvSnap = await getDoc(cInvRef);
        
        if (cInvSnap.exists()) {
          const currentQty = cInvSnap.data().quantity || 0;
          await updateDoc(cInvRef, { quantity: currentQty + piecesToTransfer });
        } else {
          await setDoc(cInvRef, {
            cashvanName: selectedCashvan,
            itemId: cartItem.item.id,
            name: cartItem.item.name,
            quantity: piecesToTransfer,
            barcode: cartItem.item.barcode,
            
            costPrice: cartItem.item.costPrice,
            sellingPrice: cartItem.item.sellingPrice,
            
            packetRatio: cartItem.item.packetRatio || 0,
            packetCostPrice: cartItem.item.packetCostPrice || 0,
            packetSellingPrice: cartItem.item.packetSellingPrice || 0,
            
            ratio: cartItem.item.ratio || 1,
            cartonCostPrice: cartItem.item.cartonCostPrice || 0,
            cartonSellingPrice: cartItem.item.cartonSellingPrice || 0
          });
        }
      }

      setCart([]);
      alert('بەسەرکەوتوویی درا بە کاشڤان');
    } catch (e) {
      console.error(e);
      alert('هەڵەیەک ڕوویدا');
    }
  };

  const filteredItems = items.filter(i => 
    i.quantity > 0 && (i.name.includes(searchTerm) || (i.barcode && i.barcode.includes(searchTerm)))
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Inventory Selection */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-4">هەڵبژاردنی کاڵا بۆ کاشڤان</h2>
          
          <div className="mb-4">
            <label className="block text-sm text-slate-600 mb-1">ناوی کاشڤان</label>
            <input
              type="text"
              list="cashvan-list"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              value={selectedCashvan}
              onChange={(e) => setSelectedCashvan(e.target.value)}
              placeholder="ناوی کاشڤان بنووسە..."
            />
            <datalist id="cashvan-list">
              {cashvans.map(c => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </div>

          <div className="mb-4 relative">
            <Search className="absolute right-3 top-2.5 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="گەڕان بۆ کاڵا..."
              className="w-full pl-3 pr-10 py-2 border border-slate-200 rounded-lg outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-100 rounded-lg p-2">
            {filteredItems.map(item => (
              <div key={item.id} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded border-b border-slate-50">
                <div>
                  <div className="font-bold text-sm">{item.name}</div>
                  <div className="text-xs text-slate-500">بەردەست: {item.quantity}</div>
                </div>
                <button
                  onClick={() => addToCart(item)}
                  disabled={item.quantity <= 0}
                  className="p-1.5 bg-indigo-100 text-indigo-600 rounded hover:bg-indigo-200 disabled:opacity-50"
                >
                  <Plus size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Cart */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
          <h2 className="text-xl font-bold text-slate-800 mb-4">لیستی پێدان</h2>
          <div className="flex-1 overflow-y-auto space-y-2 min-h-[200px]">
            {cart.map(c => (
              <div key={c.item.id} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                <div className="font-bold text-sm">{c.item.name}</div>
                <div className="flex items-center gap-2">
                  <select 
                    className="px-2 py-1 border border-slate-200 rounded outline-none text-xs bg-slate-50"
                    value={c.unit || 'piece'}
                    onChange={(e) => updateQuantity(c.item.id, c.quantity, e.target.value)}
                  >
                    <option value="piece">دانە</option>
                    {(c.item.packetRatio || 0) > 0 && <option value="packet">پاکەت</option>}
                    {(c.item.ratio || 0) > 0 && <option value="carton">کارتۆن</option>}
                  </select>
                  <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-1 py-1 bg-white">
                    <button type="button" onClick={() => handleQuantityDelta(c.item.id, -1)} className="px-2 text-lg font-bold text-slate-500 hover:text-indigo-600">-</button>
                    <span className="w-8 text-center text-sm">{c.quantity}</span>
                    <button type="button" onClick={() => handleQuantityDelta(c.item.id, 1)} className="px-2 text-lg font-bold text-slate-500 hover:text-indigo-600">+</button>
                  </div>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="text-center text-slate-400 py-10 text-sm">هیچ کاڵایەک هەڵنەبژێردراوە</div>
            )}
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <span className="font-bold text-slate-600">کۆی گشتی تێچوو:</span>
              <span className="font-bold text-indigo-600 text-lg">
                {cart.reduce((acc, curr) => acc + (getPriceByUnit(curr.item, curr.unit) * curr.quantity), 0).toLocaleString()} د.ع
              </span>
            </div>
            <button
              onClick={handleTransfer}
              disabled={cart.length === 0 || !selectedCashvan}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              <Send size={20} />
              پێدان بە کاشڤان
            </button>
          </div>
        </section>

      </div>
      
      {/* Transfers History */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 mb-4">مێژووی پێدانەکان</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="p-3">کاشڤان</th>
                <th className="p-3">بەروار</th>
                <th className="p-3">بڕی کاڵاکان</th>
                <th className="p-3">کۆی تێچوو</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {transfers.map(t => (
                <tr key={t.id}>
                  <td className="p-3 font-bold">{t.cashvanName}</td>
                  <td className="p-3 text-slate-600">{format(t.date, 'yyyy/MM/dd HH:mm')}</td>
                  <td className="p-3">
                    {t.items.map(item => {
                      const unitLabel = item.unit === 'carton' ? 'کارتۆن' : (item.unit === 'packet' ? 'پاکەت' : 'دانە');
                      return `${item.quantity} ${unitLabel} ${item.name}`;
                    }).join(' + ')}
                  </td>
                  <td className="p-3 font-bold text-indigo-600" dir="ltr">{t.totalValue.toLocaleString()} د.ع</td>
                </tr>
              ))}
              {transfers.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-slate-500">هیچ پێدانێک نییە</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
INNER_EOF
sh fix_warehouse.sh
