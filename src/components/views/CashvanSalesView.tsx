import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, where, onSnapshot, addDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { CashvanSale } from '../../types';
import { Search, Plus, Printer, Trash2, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

export default function CashvanSalesView() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [markets, setMarkets] = useState<any[]>([]);
  const [cart, setCart] = useState<(any & {unit?: 'piece'|'carton'})[]>([]);
  
  const [selectedMarket, setSelectedMarket] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<CashvanSale[]>([]);

  const userName = auth.currentUser?.displayName || auth.currentUser?.email || 'نەزانراو';
  
  useEffect(() => {
    if (!userName) return;

    // Get Cashvan's inventory
    const qInv = query(collection(db, 'cashvan_inventory'), where('cashvanName', '==', userName));
    const unsubInv = onSnapshot(qInv, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setInventory(data);
    });

    const unsubMarkets = onSnapshot(query(collection(db, 'markets')), (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setMarkets(data);
    });
    
    const unsubSales = onSnapshot(query(collection(db, 'cashvan_sales'), where('cashvanName', '==', userName)), (snapshot) => {
      const data: CashvanSale[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as CashvanSale));
      setSales(data.sort((a,b) => b.date - a.date));
      setLoading(false);
    });

    return () => {
      unsubInv();
      unsubMarkets();
      unsubSales();
    };
  }, [userName]);


  const calcPrice = (item: any, unit: string, marketName: string) => {
    const isWholesale = markets.find(m => m.name === marketName)?.type === 'warehouse';
    if (isWholesale) {
      if (unit === 'carton') return item.cartonWholesalePrice || item.cartonSellingPrice || ((item.wholesalePrice || item.sellingPrice) * (item.ratio || 1));
      if (unit === 'packet') return item.packetWholesalePrice || item.packetSellingPrice || ((item.wholesalePrice || item.sellingPrice) * (item.packetRatio || 1));
      return item.wholesalePrice || item.sellingPrice || 0;
    } else {
      if (unit === 'carton') return item.cartonSellingPrice || (item.sellingPrice * (item.ratio || 1));
      if (unit === 'packet') return item.packetSellingPrice || (item.sellingPrice * (item.packetRatio || 1));
      return item.sellingPrice || 0;
    }
  };

  useEffect(() => {
    setCart(prev => prev.map(p => ({ ...p, finalPrice: calcPrice(p, p.unit || 'piece', selectedMarket) })));
  }, [selectedMarket, markets]);
  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(p => p.id === item.id);
      if (existing) {
        const newQty = existing.cartQty + 1;
        const totalPieces = existing.unit === 'carton' ? newQty * (item.ratio || 1) : (existing.unit === 'packet' ? newQty * (item.packetRatio || 1) : newQty);
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
      return [...prev, { ...item, cartQty: 1, finalPrice: calcPrice(item, 'piece', selectedMarket), unit: 'piece' }];
    });
  };

  const updateCartQty = (id: string, qty: number, unit?: 'piece'|'packet'|'carton') => {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    
    setCart(prev => {
      const cartItem = prev.find(p => p.id === id);
      if (!cartItem) return prev;
      
      const newUnit = unit || cartItem.unit || 'piece';
      const totalPieces = newUnit === 'carton' ? qty * (item.ratio || 1) : (newUnit === 'packet' ? qty * (item.packetRatio || 1) : qty);
      
      if (totalPieces > item.quantity) {
        alert('بڕی داواکراو بەردەست نییە');
        return prev;
      }
      
      if (qty < 1) {
        return prev.filter(p => p.id !== id);
      }
      
      const price = calcPrice(item, newUnit, selectedMarket);
      
      return prev.map(p => p.id === id ? { ...p, cartQty: qty, unit: newUnit, finalPrice: price } : p);
    });
  };
  
  const updateCartPrice = (id: string, price: number) => {
    setCart(prev => prev.map(p => p.id === id ? { ...p, finalPrice: price } : p));
  };

  const handleSale = async () => {
    if (!selectedMarket || cart.length === 0) return;

    try {
      if (selectedMarket && !markets.find(m => m.name === selectedMarket)) {
        await addDoc(collection(db, 'markets'), { name: selectedMarket, location: '', phone: '', type: 'market', createdAt: Date.now() });
      }
      
      const totalAmount = cart.reduce((acc, curr) => acc + (curr.finalPrice * curr.cartQty), 0);
      const totalCost = cart.reduce((acc, curr) => { const cost = curr.unit === "carton" ? (curr.cartonCostPrice || (curr.costPrice * (curr.ratio || 1))) : (curr.unit === "packet" ? (curr.packetCostPrice || (curr.costPrice * (curr.packetRatio || 1))) : curr.costPrice); return acc + (cost * curr.cartQty); }, 0);
      const totalProfit = totalAmount - totalCost;
      
      const saleData: Omit<CashvanSale, 'id'> = {
        cashvanName: userName,
        marketName: selectedMarket,
        items: cart.map(c => ({
          itemId: c.itemId,
          name: c.name,
          quantity: c.cartQty,
          price: c.finalPrice,
          unit: c.unit,
          ratio: c.ratio || 1,
          barcode: c.barcode || '-'
        })),
        totalAmount,
        totalProfit,
        date: Date.now(),
        status: 'pending_accounting'
      };

      const docRef = await addDoc(collection(db, 'cashvan_sales'), saleData);

      // Deduct from cashvan_inventory
      for (const cartItem of cart) {
        const itemRef = doc(db, 'cashvan_inventory', cartItem.id);
        const itemSnap = await getDoc(itemRef);
        if (itemSnap.exists()) {
          const currentQty = itemSnap.data().quantity || 0;
          const totalPieces = cartItem.unit === 'carton' ? cartItem.cartQty * (cartItem.ratio || 1) : (cartItem.unit === 'packet' ? cartItem.cartQty * (cartItem.packetRatio || 1) : cartItem.cartQty);
          const newQty = currentQty - totalPieces;
          await updateDoc(itemRef, { quantity: newQty });
        }
      }

      printReceipt(saleData, docRef.id);
      setCart([]);
      setSelectedMarket('');
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا');
    }
  };

  const printReceipt = async (sale: any, invoiceId: string, providedWindow?: Window | null) => {
    const printWindow = providedWindow || window.open('', '', 'width=300,height=600');
    if (!printWindow) return;
    
    let oldDebt = 0;
    try {
      const q = query(collection(db, 'transactions'), where('type', '==', 'debt'), where('relatedEntityId', '==', sale.marketName));
      const snapshot = await getDocs(q);
      snapshot.forEach(doc => {
        const data = doc.data();
        if (!data.date || data.date < sale.date) {
          oldDebt += data.amount || 0;
        }
      });
    } catch (e) {
      console.error('Error fetching old debt', e);
    }
    
    // Minimal style for 58/80mm thermal printers
    const html = `
      <html>
        <head>
          <title>فاتیرە</title>
          <style>
            @media print {
              @page { margin: 0; }
              body { margin: 10px; font-family: monospace; font-size: 12px; }
            }
            body { font-family: monospace; font-size: 12px; direction: rtl; text-align: right; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { padding: 4px 0; border-bottom: 1px dashed #ccc; }
          </style>
        </head>
        <body>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
            <div style="text-align: right; width: 100px;">
              <img src="${window.location.origin}/LOGO1.jpg" alt="Logo" style="width: 50px; height: 50px; object-fit: contain; margin-bottom: 5px;" onerror="this.style.display='none'" />
              <div class="bold" style="font-size:12px;">کۆمپانیای RF</div>
              <div style="font-size:10px;">07506144894</div>
            </div>
            <div style="text-align: center; flex: 1; padding-top: 10px;">
              <h1 style="margin: 0; color: #1e293b; font-size: 28px; font-weight: 900; white-space: nowrap;">TAM TAM</h1>
            </div>
          </div>
          <hr style="border:0; border-top:1px dashed #ccc; margin:5px 0;" />
          <div class="center">کاشڤان: ${sale.cashvanName}</div>
          <div style="margin-top:5px;">فاتیرەی ژمارە: ${invoiceId.slice(-6).toUpperCase()}</div>
          <div>کڕیار: ${sale.marketName}</div>
          <div>بەروار: ${format(sale.date, 'yyyy/MM/dd HH:mm')}</div>
          
          <table>
            <thead>
              <tr>
                <th style="text-align:right">کاڵا</th>
                <th>دانە</th>
                <th>نرخ</th>
                <th style="text-align:left">کۆی نرخ</th>
              </tr>
            </thead>
            <tbody>
              ${sale.items.map((item: any) => {
                const unitLabel = item.unit === 'carton' ? 'کار' : (item.unit === 'packet' ? 'پاک' : 'دان');
                return `
                <tr>
                  <td>${item.name}</td>
                  <td class="center">${item.quantity}/${unitLabel}</td>
                  <td class="center">${item.price}</td>
                  <td style="text-align:left">${item.quantity * item.price}</td>
                </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          
          <div class="bold" style="margin-top:10px; text-align:left; font-size:14px;">
            کۆی گشتی: ${sale.totalAmount.toLocaleString()} د.ع
          </div>
          
          <div class="center" style="margin-top:20px; font-size:10px;">
            سوپاس بۆ مامەڵەکردن لەگەڵمان
          </div>
          
          <script>
            window.onload = () => { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const filteredInv = inventory.filter(i => {
    if (i.quantity <= 0) return false;
    const nameMatch = i.name ? i.name.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    const barcodeMatch = i.barcode ? i.barcode.includes(searchTerm) : false;
    return nameMatch || barcodeMatch;
  });

  return (
    <div className="space-y-6" onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') handleSale(); }}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Inventory Selection */}
        <section className="lg:col-span-5 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-4">کاڵاکانی ناو ئۆتۆمبێل</h2>
          
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

          <div className="h-[400px] overflow-y-auto space-y-2 pr-2">
            {filteredInv.map(item => (
              <div key={item.id} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl border border-slate-100 shadow-sm transition">
                <div>
                  <div className="font-bold text-slate-800">{item.name}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    نرخ: {calcPrice(item, 'piece', selectedMarket).toLocaleString()} | بەردەست: <span className="font-bold text-indigo-600">{item.quantity}</span>
                  </div>
                </div>
                <button
                  onClick={() => addToCart(item)}
                  disabled={item.quantity <= 0}
                  className="w-10 h-10 flex justify-center items-center bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition"
                >
                  <Plus size={20} />
                </button>
              </div>
            ))}
            {filteredInv.length === 0 && (
              <div className="text-center py-10 text-slate-400">کاڵا نەدۆزرایەوە</div>
            )}
          </div>
        </section>

        {/* Cart & Sale */}
        <section className="lg:col-span-7 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[520px]">
          <h2 className="text-xl font-bold text-slate-800 mb-4">فرۆشتنی نەقدی (فاتیرە)</h2>
          
          <div className="mb-4">
            <label className="block text-sm text-slate-600 mb-1">کڕیار / مارکێت هەڵبژێرە</label>
            <input
              type="text"
              list="markets-list"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition"
              value={selectedMarket}
              onChange={(e) => setSelectedMarket(e.target.value)}
              placeholder="ناوی مارکێت بنووسە..."
            />
            <datalist id="markets-list">
              {markets.map(m => (
                <option key={m.id} value={m.name} />
              ))}
            </datalist>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-auto mb-4 pr-2 border border-slate-200 rounded-lg">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col justify-center items-center text-slate-400 space-y-2 py-10">
                <Search size={40} className="text-slate-200" />
                <p>هیچ کاڵایەک لە فاتیرەدا نییە</p>
              </div>
            ) : (
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-100 text-slate-600 sticky top-0">
                  <tr>
                    <th className="p-2 border-b">ژ</th>
                    <th className="p-2 border-b">کۆدی کاڵا</th>
                    <th className="p-2 border-b">ناوی کاڵا</th>
                    <th className="p-2 border-b text-center">عددی مەواد</th>
                    <th className="p-2 border-b text-center">کۆی کارتۆن</th>
                    <th className="p-2 border-b text-center">نرخی تاک</th>
                    <th className="p-2 border-b text-center">نرخی کارتۆن</th>
                    <th className="p-2 border-b text-center">کۆی گشتی</th>
                    <th className="p-2 border-b text-center">سڕینەوە</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {cart.map((c, index) => {
                    const barcode = c.barcode || '-';
                    const ratio = c.ratio || 1;
                    const totalPieces = c.unit === 'carton' ? c.cartQty * ratio : (c.unit === 'packet' ? c.cartQty * (c.packetRatio || 1) : c.cartQty);
                    const cartonQty = (totalPieces / ratio).toFixed(2);
                    const piecePrice = c.unit === 'carton' ? c.finalPrice / ratio : (c.unit === 'packet' ? c.finalPrice / (c.packetRatio || 1) : c.finalPrice);
                    const cartonPrice = (piecePrice * ratio).toLocaleString();
                    const total = (c.finalPrice * c.cartQty).toLocaleString();
                    return (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="p-2">{index + 1}</td>
                        <td className="p-2 font-mono text-xs" dir="ltr">{barcode}</td>
                        <td className="p-2 font-medium text-slate-800">{c.name}</td>
                        <td className="p-2 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <select
                              className="px-2 py-1 border border-slate-200 rounded outline-none text-xs bg-slate-50 w-full"
                              value={c.unit || 'piece'}
                              onChange={(e) => updateCartQty(c.id, c.cartQty, e.target.value as any)}
                            >
                              <option value="piece">دانە</option>
                              {c.packetRatio > 0 && <option value="packet">پاکەت</option>}
                              {c.ratio > 0 && <option value="carton">کارتۆن</option>}
                            </select>
                            <div className="flex items-center gap-1 border border-slate-200 rounded px-1 bg-white">
                              <button type="button" onClick={() => updateCartQty(c.id, c.cartQty - 1, c.unit)} className="px-1 text-lg font-bold text-slate-500 hover:text-indigo-600 focus:outline-none">-</button>
                              <input 
                                type="number" 
                                min="1"
                                className="w-12 outline-none text-center p-1"
                                value={c.cartQty}
                                onChange={(e) => updateCartQty(c.id, parseInt(e.target.value) || 0, c.unit)}
                                dir="ltr"
                              />
                              <button type="button" onClick={() => updateCartQty(c.id, c.cartQty + 1, c.unit)} className="px-1 text-lg font-bold text-slate-500 hover:text-indigo-600 focus:outline-none">+</button>
                            </div>
                          </div>
                        </td>
                        <td className="p-2 text-center">{cartonQty}</td>
                        <td className="p-2 text-center">
                          <input 
                            type="number" 
                            min="0"
                            className="w-20 outline-none text-center border border-slate-200 rounded p-1 font-mono"
                            value={c.finalPrice}
                            onChange={(e) => updateCartPrice(c.id, parseInt(e.target.value) || 0)}
                            dir="ltr"
                          />
                        </td>
                        <td className="p-2 text-center font-mono" dir="ltr">{cartonPrice}</td>
                        <td className="p-2 text-center font-bold text-indigo-600 font-mono" dir="ltr">{total}</td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => updateCartQty(c.id, 0)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded transition"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          
          <div className="pt-4 border-t border-slate-100 mt-auto">
            <div className="flex justify-between items-center mb-4">
              <span className="font-medium text-slate-600">کۆی گشتی فاتیرە:</span>
              <span className="text-xl font-bold text-indigo-600" dir="ltr">
                {cart.reduce((a, c) => a + (c.finalPrice * c.cartQty), 0).toLocaleString()} د.ع
              </span>
            </div>
            <button
              onClick={handleSale}
              disabled={cart.length === 0 || !selectedMarket}
              className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
            >
              <Printer size={20} />
              چاپکردنی فاتیرە و پاشەکەوتکردن
            </button>
          </div>
        </section>
      </div>
      
      {/* Sales History for the Cashvan */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <CheckCircle2 className="text-green-500" /> مێژووی فرۆشتنەکانی ئەمڕۆ
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="p-3">ژمارەی فاتیرە</th>
                <th className="p-3">مارکێت</th>
                <th className="p-3">بەروار</th>
                <th className="p-3">بڕی پارە</th>
                <th className="p-3">دۆخی حیسابات</th>
                <th className="p-3">کردارەکان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {sales.map(sale => (
                <tr key={sale.id} className="hover:bg-slate-50/50 transition">
                  <td className="p-3 font-mono text-xs">{sale.id.slice(-6).toUpperCase()}</td>
                  <td className="p-3 font-medium text-slate-800">{sale.marketName}</td>
                  <td className="p-3 text-slate-500">{format(sale.date, 'HH:mm - yyyy/MM/dd')}</td>
                  <td className="p-3 font-bold text-indigo-600" dir="ltr">{sale.totalAmount.toLocaleString()}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                      sale.status === 'accounted' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {sale.status === 'accounted' ? 'چووەتە حیسابات' : 'چاوەڕێی حیسابات'}
                    </span>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => printReceipt(sale, sale.id)}
                      className="text-blue-600 hover:bg-blue-50 p-1.5 rounded transition"
                    >
                      <Printer size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr><td colSpan={6} className="text-center py-6 text-slate-400">هیچ فرۆشتنێک نییە</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
