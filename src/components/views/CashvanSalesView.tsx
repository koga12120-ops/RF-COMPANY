import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, onSnapshot, addDoc, doc, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { CashvanSale, CashvanRequisition, Item } from '../../types';
import { Search, Plus, Printer, Trash2, CheckCircle2, FileText, Edit2, AlertTriangle, X, ClipboardList, Truck, Send, Clock, UserCheck } from 'lucide-react';
import { format } from 'date-fns';

export default function CashvanSalesView() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [warehouseItems, setWarehouseItems] = useState<Item[]>([]);
  const [markets, setMarkets] = useState<any[]>([]);
  const [cashvanList, setCashvanList] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [paymentType, setPaymentType] = useState<'cash' | 'debt'>('cash');
  
  const [selectedMarket, setSelectedMarket] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<CashvanSale[]>([]);
  const [myRequisitions, setMyRequisitions] = useState<CashvanRequisition[]>([]);
  const [deletingSale, setDeletingSale] = useState<CashvanSale | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Active view tab: sales vs pre-order
  const [activeTab, setActiveTab] = useState<'sales' | 'preorder' | 'history'>('sales');

  // Pre-order state
  const [preOrderCart, setPreOrderCart] = useState<{ item: Item; quantity: number; unit: 'carton' | 'packet' }[]>([]);
  const [preOrderNotes, setPreOrderNotes] = useState('');
  const [preOrderSearch, setPreOrderSearch] = useState('');

  // Identify driver / cashvan
  const defaultUserName = auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'کاشڤان';
  const [activeCashvanName, setActiveCashvanName] = useState<string>(defaultUserName);

  // Sync active cashvan name live with user doc in case admin renames
  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubUser = onSnapshot(doc(db, 'users', auth.currentUser.uid), (docSnap) => {
      if (docSnap.exists() && docSnap.data().name) {
        setActiveCashvanName(docSnap.data().name);
      }
    });
    return () => unsubUser();
  }, []);

  useEffect(() => {
    // Load list of cashvans / reps
    const unsubCV = onSnapshot(query(collection(db, 'cashvans')), (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setCashvanList(prev => {
        const reps = prev.filter(p => p.isRep);
        return [...reps, ...list];
      });
    });

    const unsubReps = onSnapshot(query(collection(db, 'reps')), (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data(), isRep: true }));
      setCashvanList(prev => {
        const cvs = prev.filter(p => !p.isRep);
        return [...cvs, ...list];
      });
    });

    // Load warehouse items for pre-orders
    const unsubWH = onSnapshot(query(collection(db, 'items')), (snap) => {
      const itemsData: Item[] = [];
      snap.forEach(d => itemsData.push({ id: d.id, ...d.data() } as Item));
      setWarehouseItems(itemsData);
    });

    return () => {
      unsubCV();
      unsubReps();
      unsubWH();
    };
  }, []);

  useEffect(() => {
    if (!activeCashvanName) return;

    // Get strictly this Cashvan's inventory to prevent mixing
    const qInv = query(collection(db, 'cashvan_inventory'), where('cashvanName', '==', activeCashvanName));
    const unsubInv = onSnapshot(
      qInv,
      (snapshot) => {
        const data: any[] = [];
        snapshot.forEach(doc => {
          const invData = doc.data();
          if ((invData.quantity || 0) > 0) {
            data.push({ id: doc.id, ...invData });
          }
        });
        setInventory(data);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'cashvan_inventory');
      }
    );

    const unsubMarkets = onSnapshot(
      query(collection(db, 'markets')),
      (snapshot) => {
        const data: any[] = [];
        snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
        setMarkets(data);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'markets');
      }
    );
    
    const unsubSales = onSnapshot(
      query(collection(db, 'cashvan_sales'), where('cashvanName', '==', activeCashvanName)),
      (snapshot) => {
        const data: CashvanSale[] = [];
        snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as CashvanSale));
        setSales(data.filter(s => s.status !== 'deleted').sort((a, b) => b.date - a.date));
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'cashvan_sales');
      }
    );

    const unsubReqs = onSnapshot(
      query(collection(db, 'cashvan_requisitions'), where('cashvanName', '==', activeCashvanName)),
      (snapshot) => {
        const data: CashvanRequisition[] = [];
        snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as CashvanRequisition));
        setMyRequisitions(data.sort((a, b) => b.createdAt - a.createdAt));
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'cashvan_requisitions');
      }
    );

    return () => {
      unsubInv();
      unsubMarkets();
      unsubSales();
      unsubReqs();
    };
  }, [activeCashvanName]);

  const calcPrice = (item: any, unit: string, marketName: string) => {
    if (!item) return 0;
    // Also lookup from warehouseItems if prices are missing in cashvan_inventory
    const whItem = warehouseItems.find(w => w.id === item.itemId || w.id === item.id);

    const cartonPrice = Number(item.cartonSellingPrice) || Number(item.sellingPrice) || Number(item.cartonPrice) || Number(item.price) || Number(whItem?.cartonSellingPrice) || Number(whItem?.sellingPrice) || Number(whItem?.pieceSellingPrice) || 0;
    const packetPrice = Number(item.packetSellingPrice) || Number(item.packetPrice) || Number(item.sellingPrice) || Number(item.price) || Number(whItem?.packetSellingPrice) || Number(whItem?.sellingPrice) || 0;

    const isWholesale = markets.find(m => m.name === marketName)?.type === 'warehouse';
    if (isWholesale) {
      const cartonWS = Number(item.cartonWholesalePrice) || Number(item.wholesalePrice) || Number(whItem?.cartonWholesalePrice) || Number(whItem?.wholesalePrice) || cartonPrice;
      const packetWS = Number(item.packetWholesalePrice) || Number(item.wholesalePrice) || Number(whItem?.packetWholesalePrice) || Number(whItem?.wholesalePrice) || packetPrice;
      if (unit === 'packet') return packetWS || packetPrice || cartonPrice;
      return cartonWS || cartonPrice || packetPrice;
    } else {
      if (unit === 'packet') return packetPrice || cartonPrice;
      return cartonPrice || packetPrice;
    }
  };

  useEffect(() => {
    setCart(prev => prev.map(p => ({ ...p, finalPrice: calcPrice(p, p.unit || 'carton', selectedMarket) })));
  }, [selectedMarket, markets]);

  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(p => p.id === item.id);
      if (existing) {
        if (existing.cartQty >= item.quantity) {
          alert('بڕی زیاتر لەناو ڤاندا بەردەست نییە');
          return prev;
        }
        return prev.map(p => p.id === item.id ? { ...p, cartQty: p.cartQty + 1 } : p);
      }
      if (item.quantity < 1) {
        alert('بڕی بەردەست لەناو ڤان نەماوە');
        return prev;
      }
      const unit = item.unit || (item.packetSellingPrice && !item.cartonSellingPrice ? 'packet' : 'carton');
      return [...prev, { ...item, cartQty: 1, finalPrice: calcPrice(item, unit, selectedMarket), unit }];
    });
  };

  const updateCartQty = (id: string, qty: number, unit?: 'carton' | 'packet') => {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    
    setCart(prev => {
      const cartItem = prev.find(p => p.id === id);
      if (!cartItem) return prev;
      
      const newUnit = unit || cartItem.unit || 'carton';
      if (qty > item.quantity) {
        alert(`تەنها ${item.quantity} لەناو ڤاندا بەردەستە`);
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
    if (!selectedMarket || cart.length === 0) {
      alert('تکایە مارکێت و لانیکەم یەک کاڵا دیاری بکە');
      return;
    }

    try {
      if (selectedMarket && !markets.find(m => m.name === selectedMarket)) {
        await addDoc(collection(db, 'markets'), { 
          name: selectedMarket, 
          location: '', 
          phone: '', 
          type: 'market', 
          createdAt: Date.now() 
        });
      }
      
      const totalAmount = cart.reduce((acc, curr) => acc + (curr.finalPrice * curr.cartQty), 0);
      const totalCost = cart.reduce((acc, curr) => { 
        const cost = curr.unit === "packet" ? (curr.packetCostPrice || curr.costPrice || 0) : (curr.cartonCostPrice || curr.costPrice || 0); 
        return acc + (cost * curr.cartQty); 
      }, 0);
      const totalProfit = totalAmount - totalCost;
      
      const saleData: Omit<CashvanSale, 'id'> = {
        cashvanName: activeCashvanName,
        marketName: selectedMarket,
        items: cart.map(c => ({
          itemId: c.itemId || c.id,
          name: c.name,
          quantity: c.cartQty,
          price: c.finalPrice,
          unit: c.unit || 'carton',
          barcode: c.barcode || '-'
        })),
        totalAmount,
        totalProfit,
        date: Date.now(),
        status: 'pending_accounting',
        paymentType
      };

      const docRef = await addDoc(collection(db, 'cashvan_sales'), saleData);

      // Deduct from isolated cashvan_inventory
      for (const cartItem of cart) {
        const itemRef = doc(db, 'cashvan_inventory', cartItem.id);
        const itemSnap = await getDoc(itemRef);
        if (itemSnap.exists()) {
          const currentQty = itemSnap.data().quantity || 0;
          const newQty = Math.max(0, currentQty - cartItem.cartQty);
          await updateDoc(itemRef, { quantity: newQty });
        }
      }

      setCart([]);
      printReceipt({ ...saleData, id: docRef.id }, docRef.id.slice(-6));
      alert('فرۆشتن بە سەرکەوتوویی تۆمارکرا');
    } catch (e: any) {
      console.error(e);
      alert('هەڵەیەک ڕوویدا: ' + e.message);
    }
  };

  // Pre-Order Handlers
  const addPreOrderItem = (item: Item) => {
    setPreOrderCart(prev => {
      const existing = prev.find(p => p.item.id === item.id);
      if (existing) {
        return prev.map(p => p.item.id === item.id ? { ...p, quantity: p.quantity + 1 } : p);
      }
      const unit = item.packetSellingPrice && !item.cartonSellingPrice ? 'packet' : 'carton';
      return [...prev, { item, quantity: 1, unit }];
    });
  };

  const updatePreOrderQty = (itemId: string, qty: number, unit?: 'carton' | 'packet') => {
    setPreOrderCart(prev => {
      if (qty < 1) return prev.filter(p => p.item.id !== itemId);
      return prev.map(p => p.item.id === itemId ? { ...p, quantity: qty, unit: unit || p.unit } : p);
    });
  };

  const handleSendPreOrder = async () => {
    if (preOrderCart.length === 0) {
      alert('تکایە لانیکەم یەک کاڵا بۆ تەڵەبیە دیاری بکە');
      return;
    }
    setIsProcessing(true);
    try {
      const reqNo = `REQ-${Date.now().toString().slice(-6)}`;
      const reqData: Omit<CashvanRequisition, 'id'> = {
        requisitionNo: reqNo,
        cashvanName: activeCashvanName,
        items: preOrderCart.map(c => ({
          itemId: c.item.id,
          name: c.item.name,
          quantity: c.quantity,
          unit: c.unit,
          price: c.unit === 'packet' ? (c.item.packetCostPrice || c.item.costPrice || 0) : (c.item.cartonCostPrice || c.item.costPrice || 0)
        })),
        notes: preOrderNotes.trim(),
        status: 'pending',
        createdAt: Date.now()
      };

      await addDoc(collection(db, 'cashvan_requisitions'), reqData);
      setPreOrderCart([]);
      setPreOrderNotes('');
      alert('تەڵەبیەی پێشوەختە بەسەرکەوتوویی نێردرا بۆ کۆگا. کارمەندانی کۆگا خەریکی ئامادەکردنی دەبن.');
      setActiveTab('history');
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە ناردنی تەڵەبیە');
    } finally {
      setIsProcessing(false);
    }
  };

  const printReceipt = async (sale: any, invoiceId: string) => {
    const printWindow = window.open('', '', 'width=380,height=600');
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
      console.error(e);
    }

    const itemsHtml = sale.items.map((item: any, idx: number) => {
      const unitLabel = item.unit === 'packet' ? 'پاکەت' : 'کارتۆن';
      const itemTotal = (item.price || 0) * (item.quantity || 0);
      return `
        <tr>
          <td style="text-align: right; font-weight: bold;">${item.name}</td>
          <td style="text-align: center;">${item.quantity} ${unitLabel}</td>
          <td style="text-align: center;" dir="ltr">${(item.price || 0).toLocaleString()}</td>
          <td style="text-align: left; font-weight: bold;" dir="ltr">${itemTotal.toLocaleString()}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html dir="rtl">
        <head>
          <meta charset="utf-8">
          <title>پسوڵەی فرۆشتن #${invoiceId}</title>
          <style>
            @media print { @page { margin: 4mm; } body { margin: 0; font-family: monospace; font-size: 12px; } }
            body { font-family: monospace; font-size: 12px; direction: rtl; text-align: right; padding: 10px; color: #000; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
            th, td { padding: 4px 2px; border-bottom: 1px dashed #999; }
            .summary { margin-top: 10px; border-top: 2px solid #000; padding-top: 6px; }
          </style>
        </head>
        <body>
          <div class="center">
            <h2 style="margin: 0; font-size: 16px;">کۆمپانیای RF</h2>
            <div style="font-size: 11px; margin-top: 2px;">پسوڵەی فرۆشتنی کاشڤان</div>
          </div>
          <hr style="border: none; border-top: 1px dashed #000; margin: 8px 0;" />
          <div><strong>مارکێت:</strong> ${sale.marketName}</div>
          <div><strong>کاشڤان:</strong> ${sale.cashvanName}</div>
          <div><strong>ژمارەی پسوڵە:</strong> #${invoiceId}</div>
          <div><strong>بەروار:</strong> <span dir="ltr">${format(sale.date, 'yyyy/MM/dd HH:mm')}</span></div>
          <div><strong>جۆری پارەدان:</strong> ${sale.paymentType === 'debt' ? 'قەرز' : 'نەقد'}</div>

          <table>
            <thead>
              <tr>
                <th style="text-align: right;">کاڵا</th>
                <th style="text-align: center;">بڕ</th>
                <th style="text-align: center;">نرخ</th>
                <th style="text-align: left;">کۆ</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="summary">
            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: bold;">
              <span>کۆی پسوڵە:</span>
              <span dir="ltr">${sale.totalAmount.toLocaleString()} د.ع</span>
            </div>
            ${sale.paymentType === 'debt' ? `
              <div style="display: flex; justify-content: space-between; font-size: 11px; margin-top: 4px;">
                <span>قەرزی پێشوو:</span>
                <span dir="ltr">${oldDebt.toLocaleString()} د.ع</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; margin-top: 4px; border-top: 1px solid #000; padding-top: 4px;">
                <span>کۆی گشتی قەرز:</span>
                <span dir="ltr">${(oldDebt + sale.totalAmount).toLocaleString()} د.ع</span>
              </div>
            ` : ''}
          </div>

          <div class="center" style="margin-top: 20px; font-size: 10px;">
            سوپاس بۆ مامەڵەکەتان
          </div>

          <script>
            window.onload = () => { window.print(); };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const confirmDeleteSale = async () => {
    if (!deletingSale) return;
    setIsProcessing(true);
    try {
      await deleteDoc(doc(db, 'cashvan_sales', deletingSale.id));
      for (const item of (deletingSale.items || [])) {
        try {
          const q = query(
            collection(db, 'cashvan_inventory'), 
            where('itemId', '==', item.itemId), 
            where('cashvanName', '==', deletingSale.cashvanName)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            const itemDoc = snap.docs[0];
            await updateDoc(doc(db, 'cashvan_inventory', itemDoc.id), {
              quantity: (itemDoc.data().quantity || 0) + item.quantity
            });
          }
        } catch (itemErr) {
          console.warn(itemErr);
        }
      }
      setDeletingSale(null);
    } catch (e: any) {
      console.error(e);
      alert('هەڵەیەک ڕوویدا لە سڕینەوە');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredInventory = inventory.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.barcode && item.barcode.includes(searchTerm))
  );

  const filteredWarehouseItems = warehouseItems.filter(item =>
    item.name.toLowerCase().includes(preOrderSearch.toLowerCase()) ||
    (item.barcode && item.barcode.includes(preOrderSearch))
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Van Profile Selector */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Truck size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-800">بەشی فرۆشتن و داواکاری کاشڤان</h2>
              <span className="bg-indigo-100 text-indigo-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                🚚 {activeCashvanName}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              مەخزەنی ناو ڤان: {inventory.reduce((a, b) => a + (b.quantity || 0), 0)} دانە لە {inventory.length} جۆر کاڵا
            </p>
          </div>
        </div>

        {/* Change / Verify Profile */}
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          {cashvanList.length > 0 && (
            <select
              className="px-3 py-1.5 border border-indigo-200 bg-indigo-50/40 rounded-xl text-xs font-bold text-slate-800 outline-none"
              value={activeCashvanName}
              onChange={(e) => setActiveCashvanName(e.target.value)}
            >
              {cashvanList.map(c => (
                <option key={c.id || c.name} value={c.name}>
                  🚚 {c.name} {c.isRep ? '(مەندووب)' : '(کاشڤان)'}
                </option>
              ))}
            </select>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-2xs">
            <button
              onClick={() => setActiveTab('sales')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'sales' ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300' : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'}`}
            >
              <Truck size={16} />
              <span>فرۆشتن بە مارکێت</span>
              {cart.length > 0 && (
                <span className="bg-amber-400 text-slate-900 text-[10px] px-1.5 py-0.2 rounded-full font-black">
                  {cart.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('preorder')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'preorder' ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300' : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'}`}
            >
              <Send size={16} />
              <span>تەڵەبیە بۆ کۆگا</span>
              {preOrderCart.length > 0 && (
                <span className="bg-amber-400 text-slate-900 text-[10px] px-1.5 py-0.2 rounded-full font-black">
                  {preOrderCart.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300' : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'}`}
            >
              <FileText size={16} />
              <span>مێژووی فرۆشتن</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: Direct Sales to Markets */}
      {activeTab === 'sales' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Van Inventory Grid */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                <Truck className="text-indigo-600" size={18} />
                کاڵاکانی بەردەست لەناو ڤانی ({activeCashvanName})
              </h3>
              <div className="relative w-60">
                <input
                  type="text"
                  placeholder="گەڕان لەناو ڤاندا..."
                  className="w-full pl-3 pr-8 py-1.5 border border-slate-200 rounded-xl outline-none text-xs"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search className="absolute right-2.5 top-2 text-slate-400" size={14} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[480px] overflow-y-auto p-1">
              {filteredInventory.map(item => {
                const currentUnit = item.unit === 'packet' ? 'پاکەت' : 'کارتۆن';
                const unitKey = item.unit === 'packet' ? 'packet' : 'carton';
                const displayPrice = calcPrice(item, unitKey, selectedMarket);
                return (
                  <div
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className="p-3.5 border border-slate-200 hover:border-indigo-500 rounded-xl cursor-pointer transition bg-white hover:bg-indigo-50/20 flex flex-col justify-between shadow-xs group"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-800 line-clamp-1 group-hover:text-indigo-600 transition">{item.name}</div>
                      {item.barcode && <div className="text-[10px] text-slate-400 font-mono mt-0.5" dir="ltr">{item.barcode}</div>}
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex justify-between items-center">
                      <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {item.quantity} {currentUnit}
                      </span>
                      <span className="text-xs font-bold text-emerald-700 font-mono" dir="ltr">
                        {displayPrice.toLocaleString()} د.ع
                      </span>
                    </div>
                  </div>
                );
              })}

              {filteredInventory.length === 0 && (
                <div className="col-span-full text-center py-16 text-slate-400 text-xs">
                  هیچ کاڵایەک لەناو ڤاندا نەدۆزرایەوە
                </div>
              )}
            </div>
          </div>

          {/* Cart & Checkout */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
                <Printer className="text-indigo-600" size={18} />
                وەسڵی فرۆشتن بۆ مارکێت
              </h3>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">مارکێت هەڵبژێرە *</label>
                <input
                  type="text"
                  list="cashvan-markets"
                  placeholder="ناوی مارکێت بنووسە یان هەڵبژێرە..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  value={selectedMarket}
                  onChange={(e) => setSelectedMarket(e.target.value)}
                />
                <datalist id="cashvan-markets">
                  {markets.map(m => <option key={m.id} value={m.name} />)}
                </datalist>
              </div>

              <div className="flex gap-4 items-center bg-slate-50 p-2 rounded-xl">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                  <input type="radio" checked={paymentType === 'cash'} onChange={() => setPaymentType('cash')} />
                  <span>نەقد</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                  <input type="radio" checked={paymentType === 'debt'} onChange={() => setPaymentType('debt')} />
                  <span>قەرز</span>
                </label>
              </div>

              {/* Cart items */}
              <div className="max-h-[220px] overflow-y-auto space-y-2">
                {cart.map(c => (
                  <div key={c.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="font-bold text-slate-800 truncate">{c.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {c.finalPrice?.toLocaleString()} د.ع × {c.cartQty} {c.unit === 'packet' ? 'پاکەت' : 'کارتۆن'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateCartQty(c.id, c.cartQty - 1)} className="w-6 h-6 bg-white border border-slate-300 rounded flex items-center justify-center font-bold text-slate-600">-</button>
                      <span className="w-6 text-center font-bold font-mono">{c.cartQty}</span>
                      <button onClick={() => updateCartQty(c.id, c.cartQty + 1)} className="w-6 h-6 bg-white border border-slate-300 rounded flex items-center justify-center font-bold text-slate-600">+</button>
                    </div>
                  </div>
                ))}

                {cart.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-xs">سەبەتە بەتاڵە</div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex justify-between items-center text-sm font-bold bg-slate-50 p-2.5 rounded-xl">
                <span>کۆی گشتی:</span>
                <span className="text-indigo-600 font-mono" dir="ltr">
                  {cart.reduce((sum, curr) => sum + ((curr.finalPrice || 0) * curr.cartQty), 0).toLocaleString()} د.ع
                </span>
              </div>

              <button
                type="button"
                onClick={handleSale}
                disabled={cart.length === 0 || !selectedMarket}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition"
              >
                <Printer size={16} />
                تەواوکردنی فرۆشتن و چاپکردن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Pre-Order Requisitions to Warehouse */}
      {activeTab === 'preorder' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Warehouse Items List */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Send className="text-indigo-600" size={18} />
                کاڵاکانی کۆگای سەرەکی (داواکردنی پێشوەختە)
              </h3>
              <div className="relative w-52">
                <input
                  type="text"
                  placeholder="گەڕان بۆ کاڵا..."
                  className="w-full pl-3 pr-8 py-1.5 border border-slate-200 rounded-xl outline-none text-xs"
                  value={preOrderSearch}
                  onChange={(e) => setPreOrderSearch(e.target.value)}
                />
                <Search className="absolute right-2.5 top-2 text-slate-400" size={14} />
              </div>
            </div>

            <div className="max-h-[380px] overflow-y-auto space-y-2 flex-1">
              {filteredWarehouseItems.map(item => {
                const defaultUnit = item.packetSellingPrice && !item.cartonSellingPrice ? 'packet' : 'carton';
                const itemPrice = defaultUnit === 'packet' 
                  ? (item.packetSellingPrice || item.packetCostPrice || item.sellingPrice || item.price || 0)
                  : (item.cartonSellingPrice || item.cartonCostPrice || item.sellingPrice || item.price || 0);
                return (
                  <div key={item.id} className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200/70 flex justify-between items-center transition">
                    <div>
                      <div className="font-bold text-xs text-slate-800">{item.name}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>لە کۆگا: <strong className="text-emerald-700">{item.quantity || 0} {defaultUnit === 'packet' ? 'پاکەت' : 'کارتۆن'}</strong></span>
                        <span className="text-slate-300">•</span>
                        <span>نرخ: <strong className="text-indigo-600 font-mono" dir="ltr">{itemPrice.toLocaleString()} د.ع</strong></span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => addPreOrderItem(item)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 rounded-lg text-xs font-bold transition flex items-center gap-1"
                    >
                      <Plus size={14} />
                      داواکردن
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pre-Order Cart */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
                <ClipboardList className="text-indigo-600" size={18} />
                لیستی تەڵەبیەی پێشوەختە بۆ کۆگا
              </h3>

              <div className="max-h-[260px] overflow-y-auto space-y-2">
                {preOrderCart.map(c => (
                  <div key={c.item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                    <div className="font-bold text-slate-800 flex-1 truncate pr-2">{c.item.name}</div>
                    <div className="flex items-center gap-2">
                      <select
                        className="px-2 py-1 border border-slate-300 rounded-lg text-xs bg-white font-bold text-slate-700 outline-none"
                        value={c.unit}
                        onChange={(e) => updatePreOrderQty(c.item.id, c.quantity, e.target.value as 'carton' | 'packet')}
                      >
                        <option value="carton">کارتۆن</option>
                        <option value="packet">پاکەت</option>
                      </select>
                      <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden">
                        <button onClick={() => updatePreOrderQty(c.item.id, c.quantity - 1)} className="px-2 py-0.5 text-xs font-bold">-</button>
                        <span className="w-8 text-center font-bold font-mono text-xs">{c.quantity}</span>
                        <button onClick={() => updatePreOrderQty(c.item.id, c.quantity + 1)} className="px-2 py-0.5 text-xs font-bold">+</button>
                      </div>
                    </div>
                  </div>
                ))}

                {preOrderCart.length === 0 && (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    هیچ کاڵایەک بۆ تەڵەبیەی پێشوەختە دیاری نەکراوە
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">تێبینی بۆ کۆگا (ئارەزوومەندانە)</label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="بۆ نموونە: کاتژمێر ٢ دەگەمە کۆگا..."
                  value={preOrderNotes}
                  onChange={(e) => setPreOrderNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleSendPreOrder}
                disabled={preOrderCart.length === 0 || isProcessing}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50"
              >
                <Send size={16} />
                <span>{isProcessing ? 'خەریکی ناردنە...' : 'ناردنی تەڵەبیە بۆ ئامادەکردن لە کۆگا'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Sales History & Requisitions Status */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Active Pre-orders sent by this Cashvan */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
              <ClipboardList className="text-indigo-600" size={18} />
              دۆخی تەڵەبیە پێشوەختەکانت بۆ کۆگا
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                  <tr>
                    <th className="p-3">ژمارەی تەڵەبیە</th>
                    <th className="p-3">بەروار و کات</th>
                    <th className="p-3">کۆی کاڵاکان</th>
                    <th className="p-3">دۆخی ئامادەکردن</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myRequisitions.map(req => (
                    <tr key={req.id}>
                      <td className="p-3 font-mono font-bold text-indigo-700" dir="ltr">{req.requisitionNo || req.id.slice(-6)}</td>
                      <td className="p-3 text-slate-600" dir="ltr">{format(req.createdAt, 'yyyy/MM/dd HH:mm')}</td>
                      <td className="p-3 font-bold text-slate-700">
                        {req.items.reduce((s, i) => s + i.quantity, 0)} {req.items[0]?.unit === 'packet' ? 'پاکەت' : 'کارتۆن'} ({req.items.length} جۆر)
                      </td>
                      <td className="p-3">
                        {req.status === 'pending' && (
                          <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1">
                            <Clock size={12} />
                            چاوەڕوانی ئامادەکردن لە کۆگا
                          </span>
                        )}
                        {req.status === 'completed' && (
                          <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1">
                            <CheckCircle2 size={12} />
                            ئامادەکراوە و بارکراوە بۆ ڤانەکەت
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {myRequisitions.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-6 text-slate-400">هیچ تەڵەبیەیەکی پێشوەختەت نەبووە</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sales List */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
              <FileText className="text-indigo-600" size={18} />
              مێژووی وەسڵەکانی فرۆشتن بە مارکێتەکان
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                  <tr>
                    <th className="p-3">ژمارەی وەسڵ</th>
                    <th className="p-3">مارکێت</th>
                    <th className="p-3">بەروار</th>
                    <th className="p-3">بڕی پارە</th>
                    <th className="p-3">جۆری پارەدان</th>
                    <th className="p-3 text-center">کردارەکان</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sales.map((sale, idx) => (
                    <tr key={sale.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-mono font-bold" dir="ltr">#{sale.id.slice(-6)}</td>
                      <td className="p-3 font-bold text-slate-800">{sale.marketName}</td>
                      <td className="p-3 text-slate-600" dir="ltr">{format(sale.date, 'yyyy/MM/dd HH:mm')}</td>
                      <td className="p-3 font-bold text-indigo-700 font-mono" dir="ltr">{sale.totalAmount.toLocaleString()} د.ع</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${sale.paymentType === 'debt' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                          {sale.paymentType === 'debt' ? 'قەرز' : 'نەقد'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => printReceipt(sale, sale.id.slice(-6))}
                            className="p-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition"
                            title="چاپکردنی پسوڵە"
                          >
                            <Printer size={14} />
                          </button>
                          <button
                            onClick={() => setDeletingSale(sale)}
                            className="p-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg transition"
                            title="سڕینەوە"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {sales.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400">هیچ وەسڵێکی فرۆشتن تۆمار نەکراوە</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingSale && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-red-50">
              <h3 className="font-bold text-red-800 text-sm flex items-center gap-2">
                <AlertTriangle className="text-red-600" size={18} />
                سڕینەوەی وەسڵی فرۆشتن
              </h3>
              <button onClick={() => setDeletingSale(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-700">
                ئایا دڵنیایت لە سڕینەوەی وەسڵی مارکێتی (<strong className="text-slate-900">{deletingSale.marketName}</strong>)؟ بڕی کاڵاکان دەگەڕێنەوە ناو ڤانەکەت.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={confirmDeleteSale}
                  disabled={isProcessing}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition disabled:opacity-50"
                >
                  {isProcessing ? 'دەسڕێتەوە...' : 'بەڵێ، بسڕەوە'}
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingSale(null)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  پاشگەزبوونەوە
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
