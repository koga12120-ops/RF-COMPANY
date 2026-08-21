import React, { useState, useEffect } from 'react';
import { collection, getDocs, where, addDoc, updateDoc, doc, onSnapshot, query, orderBy, deleteDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { Order, Item, Role, Market } from '../../types';
import { ShoppingCart, Plus, Printer, CheckCircle, Search, X, DollarSign, CreditCard, Trash2, Edit2, User, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import ConfirmModal from '../common/ConfirmModal';

export default function OrdersView({ role }: { role: Role }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [reps, setReps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null);

  // New Order State
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [repName, setRepName] = useState('');
  const [marketName, setMarketName] = useState('');
  const [location, setLocation] = useState('');
  const [selectedItems, setSelectedItems] = useState<{ item: Item; quantity: number; unit: 'carton' | 'packet' }[]>([]);
  
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [settlingOrder, setSettlingOrder] = useState<Order | null>(null);

  // Auto-fill rep name for sales_rep and sync live with database
  useEffect(() => {
    if (!auth.currentUser || role !== 'sales_rep') return;
    const unsubUser = onSnapshot(doc(db, 'users', auth.currentUser.uid), (docSnap) => {
      if (docSnap.exists() && docSnap.data().name) {
        setRepName(docSnap.data().name);
      } else if (auth.currentUser?.displayName) {
        setRepName(auth.currentUser.displayName);
      }
    });
    return () => unsubUser();
  }, [role]);

  useEffect(() => {
    const qOrders = query(collection(db, 'orders'), orderBy('timestamp', 'desc'));
    const unsubOrders = onSnapshot(
      qOrders,
      (snapshot) => {
        const ordersData: Order[] = [];
        snapshot.forEach((doc) => {
          ordersData.push({ id: doc.id, ...doc.data() } as Order);
        });
        setOrders(ordersData.filter(o => o.status !== 'deleted'));
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'orders');
      }
    );

    const qItems = query(collection(db, 'items'));
    const unsubItems = onSnapshot(
      qItems,
      (snapshot) => {
        const itemsData: Item[] = [];
        snapshot.forEach((doc) => {
          itemsData.push({ id: doc.id, ...doc.data() } as Item);
        });
        setItems(itemsData);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'items');
      }
    );

    const qMarkets = query(collection(db, 'markets'));
    const unsubMarkets = onSnapshot(
      qMarkets,
      (snapshot) => {
        const marketsData: Market[] = [];
        snapshot.forEach((doc) => {
          marketsData.push({ id: doc.id, ...doc.data() } as Market);
        });
        setMarkets(marketsData);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'markets');
      }
    );

    const qReps = query(collection(db, 'reps'));
    const unsubReps = onSnapshot(
      qReps,
      (snapshot) => {
        const repsData: any[] = [];
        snapshot.forEach(doc => repsData.push({ id: doc.id, ...doc.data() }));
        setReps(prev => {
          const cvs = prev.filter(p => p.isCashvan);
          return [...cvs, ...repsData];
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'reps');
      }
    );

    const qCVs = query(collection(db, 'cashvans'));
    const unsubCVs = onSnapshot(
      qCVs,
      (snapshot) => {
        const cvData: any[] = [];
        snapshot.forEach(doc => cvData.push({ id: doc.id, ...doc.data(), isCashvan: true }));
        setReps(prev => {
          const directReps = prev.filter(p => !p.isCashvan);
          return [...directReps, ...cvData];
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'cashvans');
      }
    );

    return () => {
      unsubOrders();
      unsubItems();
      unsubMarkets();
      unsubReps();
      unsubCVs();
    };
  }, []);

  const calcPrice = (item: Item, unit: 'carton' | 'packet') => {
    if (!item) return 0;
    const isWholesale = markets.find(m => m.name === marketName)?.type === 'warehouse';
    if (isWholesale) {
      if (unit === 'packet') return item.packetWholesalePrice || item.packetSellingPrice || item.wholesalePrice || item.sellingPrice || 0;
      return item.cartonWholesalePrice || item.cartonSellingPrice || item.wholesalePrice || item.sellingPrice || 0;
    } else {
      if (unit === 'packet') return item.packetSellingPrice || item.sellingPrice || 0;
      return item.cartonSellingPrice || item.sellingPrice || 0;
    }
  };

  const handleAddItemToOrder = (item: Item) => {
    const exists = selectedItems.find(si => si.item.id === item.id);
    if (exists) {
      const newQty = exists.quantity + 1;
      if (newQty > (exists.item.quantity || 0)) {
        alert('بڕی داواکراو لە کۆگا بەردەست نییە');
        return;
      }
      setSelectedItems(selectedItems.map(si => 
        si.item.id === item.id ? { ...si, quantity: newQty } : si
      ));
    } else {
      if ((item.quantity || 0) < 1) {
        alert('بڕی داواکراو لە کۆگا بەردەست نییە');
        return;
      }
      const unit: 'carton' | 'packet' = (item.packetSellingPrice && !item.cartonSellingPrice) ? 'packet' : 'carton';
      setSelectedItems([...selectedItems, { item, quantity: 1, unit }]);
    }
  };

  const handleUpdateItemQuantity = (id: string, qty: number, unit?: 'carton' | 'packet') => {
    if (qty <= 0) {
      setSelectedItems(selectedItems.filter(si => si.item.id !== id));
      return;
    }
    
    const itemObj = selectedItems.find(si => si.item.id === id);
    if (itemObj) {
      if (qty > (itemObj.item.quantity || 0)) {
        alert(`بڕی داواکراو لە کۆگا بەردەست نییە. تەنها ${itemObj.item.quantity} بەردەستە.`);
        return;
      }
    }

    setSelectedItems(selectedItems.map(si => 
      si.item.id === id ? { ...si, quantity: qty, unit: unit || si.unit } : si
    ));
  };

  const handleQuantityDelta = (id: string, delta: number) => {
    const item = selectedItems.find(si => si.item.id === id);
    if (item) {
      handleUpdateItemQuantity(id, item.quantity + delta, item.unit);
    }
  };

  const submitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repName.trim()) {
      alert('تکایە ناوی مەندووب دیاری بکە');
      return;
    }
    if (!marketName.trim()) {
      alert('تکایە ناوی مارکێت دیاری بکە');
      return;
    }
    if (selectedItems.length === 0) {
      alert('هیچ کاڵایەک هەڵنەبژێردراوە');
      return;
    }

    const totalAmount = selectedItems.reduce((acc, curr) => {
      const price = calcPrice(curr.item, curr.unit);
      return acc + (price * curr.quantity);
    }, 0);

    const totalCost = selectedItems.reduce((acc, curr) => {
      const cost = curr.unit === 'packet'
        ? (curr.item.packetCostPrice || curr.item.costPrice || 0)
        : (curr.item.cartonCostPrice || curr.item.costPrice || 0);
      return acc + (cost * curr.quantity);
    }, 0);

    const totalProfit = totalAmount - totalCost;

    const orderItems = selectedItems.map(si => ({
      itemId: si.item.id,
      name: si.item.name,
      price: calcPrice(si.item, si.unit),
      quantity: si.quantity,
      unit: si.unit
    }));

    try {
      if (repName && !reps.find(r => r.name === repName.trim())) {
        await addDoc(collection(db, 'reps'), { 
          name: repName.trim(), 
          phone: '', 
          totalSales: 0, 
          totalProfit: 0, 
          createdAt: Date.now() 
        });
      }
      if (marketName && !markets.find(m => m.name === marketName.trim())) {
        await addDoc(collection(db, 'markets'), { 
          name: marketName.trim(), 
          phone: '', 
          location: location.trim() || '', 
          type: 'market', 
          createdAt: Date.now() 
        });
      }

      if (editingOrderId) {
        await updateDoc(doc(db, 'orders', editingOrderId), {
          repName: repName.trim(),
          marketName: marketName.trim(),
          location: location.trim(),
          totalAmount,
          totalProfit,
          items: orderItems,
          status: 'pending',
          timestamp: Date.now()
        });
        setEditingOrderId(null);
      } else {
        await addDoc(collection(db, 'orders'), {
          repName: repName.trim(),
          marketName: marketName.trim(),
          location: location.trim(),
          totalAmount,
          totalProfit,
          items: orderItems,
          status: 'pending',
          timestamp: Date.now()
        });
      }
      
      setShowNewOrder(false);
      if (role !== 'sales_rep') setRepName('');
      setMarketName('');
      setLocation('');
      setSelectedItems([]);
      alert('داواکارییەکە بە سەرکەوتوویی تۆمارکرا');
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە تۆمارکردنی داواکاری');
    }
  };

  const updateOrderStatus = async (order: Order, status: Order['status']) => {
    try {
      if (status === 'completed' && order.status !== 'completed') {
        for (const item of (order.items || [])) {
          const itemRef = doc(db, 'items', item.itemId);
          const itemSnap = await getDoc(itemRef);
          if (itemSnap.exists()) {
            const data = itemSnap.data();
            const currentQty = data.quantity || 0;
            const newQty = Math.max(0, currentQty - item.quantity);
            await updateDoc(itemRef, { quantity: newQty });
          }
        }
      }
      await updateDoc(doc(db, 'orders', order.id), { status });
    } catch (error) {
      console.error(error);
    }
  };

  const settleOrder = async (type: 'cash' | 'debt') => {
    if (!settlingOrder) return;
    try {
      await addDoc(collection(db, 'transactions'), {
        type,
        amount: settlingOrder.totalAmount,
        date: Date.now(),
        description: type === 'cash' ? `نەقدی ئۆردەری مارکێتی ${settlingOrder.marketName}` : `قەرزی ئۆردەری مارکێتی ${settlingOrder.marketName}`,
        relatedEntityId: settlingOrder.marketName
      });

      if (settlingOrder.status !== 'completed') {
        await updateOrderStatus(settlingOrder, 'completed');
      }
      await updateDoc(doc(db, 'orders', settlingOrder.id), { 
        status: 'completed',
        paymentStatus: type
      });
      
      const repSnap = await getDocs(query(collection(db, 'reps'), where('name', '==', settlingOrder.repName)));
      if (!repSnap.empty) {
        const repDoc = repSnap.docs[0];
        await updateDoc(doc(db, 'reps', repDoc.id), {
          totalSales: (repDoc.data().totalSales || 0) + settlingOrder.totalAmount,
          totalProfit: (repDoc.data().totalProfit || 0) + (settlingOrder.totalProfit || 0)
        });
      }

      setSettlingOrder(null);
      alert('حیساباتی ئۆردەر بە سەرکەوتوویی تۆمارکرا');
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە کاتی تۆمارکردنی حیسابات');
    }
  };

  const handleEditOrder = (order: Order) => {
    setRepName(order.repName);
    setMarketName(order.marketName);
    setLocation(order.location);
    const mappedItems = (order.items || []).map(oi => {
      const fullItem = items.find(i => i.id === oi.itemId) || {
        id: oi.itemId,
        name: oi.name,
        quantity: 9999,
        costPrice: 0,
        sellingPrice: oi.price,
        wholesalePrice: 0,
        barcode: ''
      } as unknown as Item;
      
      return {
        item: fullItem,
        quantity: oi.quantity,
        unit: (oi.unit === 'packet' ? 'packet' : 'carton') as 'carton' | 'packet'
      };
    });
    setSelectedItems(mappedItems);
    setEditingOrderId(order.id);
    setShowNewOrder(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmDeleteOrder = async () => {
    if (!deletingOrder) return;
    try {
      const userName = auth.currentUser?.displayName || auth.currentUser?.email || 'نەزانراو';
      await updateDoc(doc(db, 'orders', deletingOrder.id), { status: 'deleted', deletedBy: userName });
      setDeletingOrder(null);
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە کاتی سڕینەوەی ئۆردەر');
    }
  };

  const printOrder = async (order: Order, invoiceId: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    let oldDebt = 0;
    try {
      const q = query(collection(db, 'transactions'), where('type', '==', 'debt'), where('relatedEntityId', '==', order.marketName));
      const snapshot = await getDocs(q);
      snapshot.forEach(doc => {
        const data = doc.data();
        if (!data.date || data.date < order.timestamp) {
          oldDebt += data.amount || 0;
        }
      });
    } catch (e) {
      console.error('Error fetching old debt', e);
    }
    
    const marketObj = markets.find(m => m.name === order.marketName);
    const marketPhone = marketObj?.phone || '-';

    const printContent = `
      <div dir="rtl" style="font-family: sans-serif; padding: 20px;">
        <div style="display: flex; align-items: flex-start; margin-bottom: 20px;">
          <div style="text-align: right; width: 250px;">
            <img src="${window.location.origin}/LOGO1.jpg" alt="Logo" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: 5px;" onerror="this.style.display='none'" />
            <h2 style="margin: 0; color: #333; font-size: 16px;">وەسڵی کۆگا</h2>
            <p style="margin: 2px 0; font-size: 12px;">ناونیشان: هەولێر-ڕێگای کەرکوک</p>
            <p style="margin: 2px 0; font-size: 12px;">مۆبایل: 07506144894</p>
          </div>
          <div style="text-align: center; flex: 1; padding-top: 20px;">
            <h1 style="margin: 0; color: #1e293b; font-size: 52px; font-weight: 900; letter-spacing: 2px; white-space: nowrap;">TAM TAM</h1>
          </div>
        </div>
        
        <hr style="border: 0; border-top: 2px solid #1e293b; margin: 15px 0;" />
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 14px;">
          <div style="text-align: right; flex: 1;">
            <p style="margin: 5px 0;"><strong>بۆ:</strong> ${order.marketName}</p>
            <p style="margin: 5px 0;"><strong>ژمارەی مۆبایل:</strong> ${marketPhone}</p>
            <p style="margin: 5px 0;"><strong>ناونیشان:</strong> ${order.location}</p>
            <p style="margin: 5px 0;"><strong>مەندووب:</strong> ${order.repName}</p>
          </div>
          <div style="text-align: left; flex: 1;">
            <p style="margin: 5px 0;"><strong>ژ.وەسڵ:</strong> ${invoiceId.padStart(6, '0')}</p>
            <p style="margin: 5px 0;"><strong>بەروار:</strong> ${format(order.timestamp, 'yyyy/MM/dd')}</p>
            <p style="margin: 5px 0;"><strong>کات:</strong> ${format(order.timestamp, 'HH:mm')}</p>
          </div>
        </div>
        
        <hr style="border: 0; border-top: 2px solid #1e293b; margin: 15px 0;" />
        
        <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 14px;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="padding: 8px; border: 1px solid #ccc;">ژ</th>
              <th style="padding: 8px; border: 1px solid #ccc;">کۆدی کاڵا</th>
              <th style="padding: 8px; border: 1px solid #ccc;">ناوی کاڵا</th>
              <th style="padding: 8px; border: 1px solid #ccc;">بڕ و یەکە</th>
              <th style="padding: 8px; border: 1px solid #ccc;">نرخ</th>
              <th style="padding: 8px; border: 1px solid #ccc;">کۆی گشتی</th>
            </tr>
          </thead>
          <tbody>
            ${(order.items || []).map((item, index) => {
              const globalItem = items.find(i => i.id === item.itemId);
              const barcode = globalItem?.barcode || '-';
              const unitLabel = item.unit === 'packet' ? 'پاکەت' : 'کارتۆن';
              return `
                <tr>
                  <td style="padding: 8px; border: 1px solid #ccc;">${index + 1}</td>
                  <td style="padding: 8px; border: 1px solid #ccc; font-family: monospace;">${barcode}</td>
                  <td style="padding: 8px; border: 1px solid #ccc; text-align: right; font-weight: bold;">${item.name}</td>
                  <td style="padding: 8px; border: 1px solid #ccc;">${item.quantity} ${unitLabel}</td>
                  <td style="padding: 8px; border: 1px solid #ccc;" dir="ltr">${item.price.toLocaleString()} د.ع</td>
                  <td style="padding: 8px; border: 1px solid #ccc; font-weight: bold;" dir="ltr">${(item.price * item.quantity).toLocaleString()} د.ع</td>
                </tr>
              `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr>
              <th colspan="5" style="padding: 10px; border: 1px solid #ccc; text-align: left; font-size: 16px;">کۆی گشتی:</th>
              <th style="padding: 10px; border: 1px solid #ccc; font-size: 16px; color: #4338ca;" dir="ltr">${order.totalAmount.toLocaleString()} د.ع</th>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Order</title>
        </head>
        <body onload="window.print();window.close()">
          ${printContent}
        </body>
      </html>
    `);
    printWindow.document.close();
    updateOrderStatus(order, 'printed');
  };

  const filteredItems = items.filter(item => {
    const nameMatch = item.name ? item.name.includes(searchTerm) : false;
    const barcodeMatch = item.barcode ? item.barcode.includes(searchTerm) : false;
    return nameMatch || barcodeMatch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            {role === 'admin' ? 'تەسفییەکردن و ئۆردەرەکان' : role === 'cashvan' ? 'کاشڤان و ئۆردەرەکان' : 'بەشی داواکاری و ئۆردەرەکان'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {role === 'warehouse' ? 'کارمەندی کۆگا دەتوانێت بە ناوی هەر مەندووبێکەوە تەڵەبیە تۆمار بکات' : 'تۆمارکردن و بەڕێوەبردنی تەڵەبیەی مارکێتەکان'}
          </p>
        </div>

        <button
          onClick={() => setShowNewOrder(!showNewOrder)}
          className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition flex items-center gap-2 font-bold text-xs shadow-sm"
        >
          <Plus size={16} />
          <span>{showNewOrder ? 'داخستنی فۆڕم' : 'تۆمارکردنی ئۆردەری نوێ'}</span>
        </button>
      </div>

      {showNewOrder && (
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
          <h3 className="text-base font-bold mb-4 text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
            <ShoppingCart className="text-indigo-600" size={18} />
            {editingOrderId ? 'دەستکاریکردنی داواکاری' : 'فۆڕمی تۆمارکردنی داواکاری نوێ'}
          </h3>
          
          <form onSubmit={submitOrder} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Rep selector: Editable/Selectable for Warehouse & Admin */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
                  <User size={14} className="text-indigo-600" />
                  ناوی مەندووب * {role === 'warehouse' && <span className="text-[10px] text-indigo-600">(هەڵبژاردنی مەندووب لە سیستەم)</span>}
                </label>
                {role === 'sales_rep' ? (
                  <input
                    type="text"
                    required
                    readOnly
                    className="w-full px-3 py-2 border border-slate-200 bg-slate-100 text-slate-600 rounded-xl outline-none text-xs font-bold"
                    value={repName}
                  />
                ) : (
                  <div>
                    <input
                      type="text"
                      list="reps-list"
                      required
                      placeholder="ناوی مەندووب بنووسە یان هەڵبژێرە..."
                      className="w-full px-3 py-2 border border-indigo-300 bg-indigo-50/20 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-bold text-slate-800"
                      value={repName}
                      onChange={(e) => setRepName(e.target.value)}
                    />
                    <datalist id="reps-list">
                      {reps.map(r => (
                        <option key={r.id || r.name} value={r.name}>
                          {r.name} {r.isCashvan ? '(کاشڤان)' : '(مەندووب)'}
                        </option>
                      ))}
                    </datalist>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">ناوی مارکێت / شوێن *</label>
                <input
                  type="text"
                  list="order-markets"
                  required
                  placeholder="ناوی مارکێت بنووسە یان هەڵبژێرە..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                  value={marketName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMarketName(val);
                    const existing = markets.find(m => m.name === val);
                    if (existing) setLocation(existing.location);
                  }}
                />
                <datalist id="order-markets">
                  {markets.map(m => <option key={m.id} value={m.name} />)}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">ناونیشان / گەڕەک</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="ناونیشان..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Items Selection */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50">
                <div className="mb-3 relative">
                  <input
                    type="text"
                    placeholder="گەڕان بۆ کاڵا لە کۆگا..."
                    className="w-full pr-9 pl-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
                </div>
                <div className="h-64 overflow-y-auto space-y-2 pr-1">
                  {filteredItems.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-2.5 bg-white rounded-xl border border-slate-200/80 shadow-xs">
                      <div>
                        <div className="font-bold text-slate-800 text-xs">{item.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          بەردەست: <strong className="text-indigo-600">{item.quantity || 0} {item.packetSellingPrice && !item.cartonSellingPrice ? 'پاکەت' : 'کارتۆن'}</strong>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddItemToOrder(item)}
                        disabled={(item.quantity || 0) <= 0}
                        className="px-2.5 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg disabled:opacity-40 transition text-xs font-bold flex items-center gap-1"
                      >
                        <Plus size={14} />
                        زیادکردن
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Selected Items */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 mb-3 text-xs flex items-center gap-2">
                    <ShoppingCart size={14} className="text-indigo-600" />
                    کاڵا هەڵبژێردراوەکانی داواکاری ({selectedItems.length})
                  </h4>
                  <div className="h-48 overflow-y-auto space-y-2 pr-1">
                    {selectedItems.map((si) => (
                      <div key={si.item.id} className="flex justify-between items-center p-2.5 bg-white rounded-xl border border-slate-200/80 text-xs">
                        <div className="font-bold text-slate-800 flex-1 truncate pr-2">{si.item.name}</div>
                        <div className="flex items-center gap-2">
                          <select 
                            className="px-2 py-1 border border-slate-300 rounded-lg text-xs bg-slate-50 font-bold"
                            value={si.unit}
                            onChange={(e) => handleUpdateItemQuantity(si.item.id, si.quantity, e.target.value as 'carton' | 'packet')}
                          >
                            <option value="carton">کارتۆن</option>
                            <option value="packet">پاکەت</option>
                          </select>

                          <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden">
                            <button type="button" onClick={() => handleQuantityDelta(si.item.id, -1)} className="px-2 py-0.5 text-xs font-bold">-</button>
                            <span className="w-8 text-center font-mono font-bold text-xs">{si.quantity}</span>
                            <button type="button" onClick={() => handleQuantityDelta(si.item.id, 1)} className="px-2 py-0.5 text-xs font-bold">+</button>
                          </div>

                          <span className="font-bold min-w-[70px] text-left text-indigo-700 font-mono text-xs" dir="ltr">
                            {(si.quantity * calcPrice(si.item, si.unit)).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                    {selectedItems.length === 0 && (
                      <div className="text-center text-slate-400 py-12 text-xs">هیچ کاڵایەک هەڵنەبژێردراوە</div>
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between items-center">
                  <div className="font-bold text-slate-800 text-xs">کۆی گشتی داواکاری:</div>
                  <div className="font-bold text-base text-indigo-600 font-mono" dir="ltr">
                    {selectedItems.reduce((acc, curr) => acc + (curr.quantity * calcPrice(curr.item, curr.unit)), 0).toLocaleString()} د.ع
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              {editingOrderId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingOrderId(null);
                    setShowNewOrder(false);
                    setSelectedItems([]);
                  }}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  پاشگەزبوونەوە
                </button>
              )}
              <button
                type="submit"
                className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-bold text-xs shadow-sm"
              >
                {editingOrderId ? 'پاشەکەوتکردنی گۆڕانکاری' : 'ناردنی داواکاری بۆ کۆگا'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Orders List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-10 text-slate-500 text-xs">خەریکی هێنانە...</div>
        ) : orders.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center text-slate-500 text-xs">
            هیچ داواکارییەک نییە
          </div>
        ) : (
          orders.map((order, index) => (
            <div key={order.id} className={`p-4 rounded-2xl shadow-sm border flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${order.status === 'pending' ? 'bg-amber-50/40 border-amber-200' : order.status === 'printed' ? 'bg-indigo-50/40 border-indigo-200' : 'bg-green-50/40 border-green-200'}`}>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-bold text-sm text-slate-800">{order.marketName}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    order.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                    order.status === 'printed' ? 'bg-indigo-100 text-indigo-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {order.status === 'pending' ? 'چاوەڕێ' : order.status === 'printed' ? 'چاپکراو' : 'تەواوکراو'}
                  </span>
                </div>
                <div className="text-xs text-slate-600 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                  <div><strong>مەندووب:</strong> {order.repName}</div>
                  <div><strong>شوێن:</strong> {order.location || '-'}</div>
                  <div><strong>بەروار:</strong> <span dir="ltr" className="font-mono">{format(order.timestamp, 'yyyy/MM/dd HH:mm')}</span></div>
                  <div><strong>ژمارەی کاڵا:</strong> {(order.items || []).reduce((acc, curr) => acc + curr.quantity, 0)} {order.items?.[0]?.unit === 'packet' ? 'پاکەت' : 'کارتۆن'}</div>
                </div>
              </div>

              <div className="flex items-center gap-4 border-t lg:border-t-0 lg:border-r border-slate-200 pt-3 lg:pt-0 lg:pr-4 justify-between lg:justify-end">
                <div className="text-left">
                  <div className="text-[11px] text-slate-500">کۆی گشتی</div>
                  <div className="font-bold text-sm text-slate-900 font-mono" dir="ltr">{order.totalAmount.toLocaleString()} د.ع</div>
                </div>
                
                <div className="flex gap-2 items-center">
                  {(role === 'admin' || role === 'warehouse') && (
                    <button
                      onClick={() => printOrder(order, String(orders.length - index).padStart(6, '0'))}
                      className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition"
                      title="چاپکردنی وەسڵ"
                    >
                      <Printer size={16} />
                    </button>
                  )}
                  {role === 'warehouse' && order.status !== 'completed' && (
                    <button
                      onClick={() => updateOrderStatus(order, 'completed')}
                      className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition"
                      title="تەواوکردن"
                    >
                      <CheckCircle size={16} />
                    </button>
                  )}
                  {role === 'admin' && (!order.paymentStatus) && (
                    <button
                      onClick={() => setSettlingOrder(order)}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-xs font-bold"
                    >
                      تەسفیەکردن
                    </button>
                  )}
                  {order.paymentStatus === 'cash' && (
                    <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-lg text-xs font-bold">نەقدە</span>
                  )}
                  {order.paymentStatus === 'debt' && (
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold">قەرزە</span>
                  )}
                  <button
                    onClick={() => handleEditOrder(order)}
                    className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                    title="دەستکاری"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => setDeletingOrder(order)}
                    className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                    title="سڕینەوە"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletingOrder}
        onClose={() => setDeletingOrder(null)}
        onConfirm={confirmDeleteOrder}
        title="سڕینەوەی ئۆردەر"
        message="ئایا دڵنیایت لە سڕینەوەی ئەم ئۆردەرە؟"
        details={deletingOrder ? [
          { label: 'ناوی مارکێت', value: deletingOrder.marketName || '-' },
          { label: 'کۆی گشتی', value: `${(deletingOrder.totalAmount || 0).toLocaleString()} د.ع` },
          { label: 'مەندووب', value: deletingOrder.repName || '-' }
        ] : []}
      />

      {/* Settlement Modal */}
      {settlingOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm">تەسفیەکردنی ئۆردەر لە حیساباتدا</h3>
              <button onClick={() => setSettlingOrder(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-slate-600 mb-5 text-center text-xs leading-relaxed">
                ئایا دەتەوێت ئۆردەری مارکێتی <strong className="text-slate-800">{settlingOrder.marketName}</strong> بە چی شێوازێک تۆمار بکەیت؟
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => settleOrder('cash')}
                  className="flex flex-col items-center gap-2 p-4 border-2 border-emerald-100 rounded-xl hover:bg-emerald-50 hover:border-emerald-300 transition group"
                >
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                    <DollarSign size={20} />
                  </div>
                  <span className="font-bold text-emerald-800 text-xs">بە نەقد</span>
                </button>
                
                <button
                  onClick={() => settleOrder('debt')}
                  className="flex flex-col items-center gap-2 p-4 border-2 border-amber-100 rounded-xl hover:bg-amber-50 hover:border-amber-300 transition group"
                >
                  <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
                    <CreditCard size={20} />
                  </div>
                  <span className="font-bold text-amber-800 text-xs">بە قەرز</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
