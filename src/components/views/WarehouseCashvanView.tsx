import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, getDoc, setDoc, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { Item, CashvanTransfer, CashvanRequisition } from '../../types';
import { Plus, Search, Check, Send, Printer, Truck, ClipboardList, CheckCircle2, Clock, Eye, X, Package } from 'lucide-react';
import { format } from 'date-fns';

export default function WarehouseCashvanView() {
  const [items, setItems] = useState<Item[]>([]);
  const [cashvans, setCashvans] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<CashvanTransfer[]>([]);
  const [requisitions, setRequisitions] = useState<CashvanRequisition[]>([]);
  const [selectedVanInventory, setSelectedVanInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'transfer' | 'requisitions' | 'van_inventory' | 'history'>('transfer');
  const [selectedCashvan, setSelectedCashvan] = useState('');
  const [cart, setCart] = useState<{ item: Item; quantity: number; unit: 'carton' | 'packet' }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingRequisition, setViewingRequisition] = useState<CashvanRequisition | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const unsubItems = onSnapshot(
      query(collection(db, 'items')),
      (snapshot) => {
        const data: Item[] = [];
        snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Item));
        setItems(data);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'items');
      }
    );

    const unsubCashvans = onSnapshot(
      query(collection(db, 'cashvans')),
      (snapshot) => {
        const data: any[] = [];
        snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
        setCashvans(prev => {
          const reps = prev.filter(p => p.isRep);
          const combined = [...reps, ...data];
          const unique = Array.from(new Map(combined.map(item => [item.name, item])).values());
          return unique;
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'cashvans');
      }
    );

    const unsubReps = onSnapshot(
      query(collection(db, 'reps')),
      (snapshot) => {
        const data: any[] = [];
        snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data(), isRep: true }));
        setCashvans(prev => {
          const cvs = prev.filter(p => !p.isRep);
          const combined = [...cvs, ...data];
          const unique = Array.from(new Map(combined.map(item => [item.name, item])).values());
          return unique;
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'reps');
      }
    );

    const unsubTransfers = onSnapshot(
      query(collection(db, 'cashvan_transfers')),
      (snapshot) => {
        const data: CashvanTransfer[] = [];
        snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as CashvanTransfer));
        setTransfers(data.sort((a, b) => b.date - a.date));
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'cashvan_transfers');
      }
    );

    const unsubReqs = onSnapshot(
      query(collection(db, 'cashvan_requisitions')),
      (snapshot) => {
        const data: CashvanRequisition[] = [];
        snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as CashvanRequisition));
        setRequisitions(data.sort((a, b) => b.createdAt - a.createdAt));
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'cashvan_requisitions');
      }
    );

    return () => {
      unsubItems();
      unsubCashvans();
      unsubReps();
      unsubTransfers();
      unsubReqs();
    };
  }, []);

  // Listen to selected cashvan's inventory
  useEffect(() => {
    if (!selectedCashvan) {
      setSelectedVanInventory([]);
      return;
    }
    const qInv = query(collection(db, 'cashvan_inventory'));
    const unsub = onSnapshot(qInv, (snap) => {
      const vanItems: any[] = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.cashvanName === selectedCashvan && (data.quantity > 0 || data.cartonQuantity > 0 || data.packetQuantity > 0)) {
          vanItems.push({ id: d.id, ...data });
        }
      });
      setSelectedVanInventory(vanItems);
    });
    return () => unsub();
  }, [selectedCashvan]);

  const addToCart = (item: Item) => {
    setCart(prev => {
      const existing = prev.find(p => p.item.id === item.id);
      if (existing) {
        if (existing.quantity >= (item.quantity || 0)) {
          alert('بڕی زیاتر لە کۆگا بەردەست نییە');
          return prev;
        }
        return prev.map(p => p.item.id === item.id ? { ...p, quantity: p.quantity + 1 } : p);
      }
      if ((item.quantity || 0) <= 0) {
        alert('ئەم کاڵایە لە کۆگا بەردەست نییە');
        return prev;
      }
      const unit = item.packetSellingPrice && !item.cartonSellingPrice ? 'packet' : 'carton';
      return [...prev, { item, quantity: 1, unit }];
    });
  };

  const updateQuantity = (itemId: string, qty: number, unit?: 'carton' | 'packet') => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    setCart(prev => {
      if (qty < 1) {
        return prev.filter(p => p.item.id !== itemId);
      }
      if (qty > (item.quantity || 0)) {
        alert(`بڕی داواکراو لە کۆگا بەردەست نییە (تەنها ${item.quantity || 0} هەیە)`);
        return prev;
      }
      return prev.map(p => p.item.id === itemId ? { ...p, quantity: qty, unit: unit || p.unit } : p);
    });
  };

  const printTransferReceipt = (transfer: CashvanTransfer) => {
    const itemsHtml = transfer.items.map((item, idx) => {
      const unitLabel = item.unit === 'packet' ? 'پاکەت' : 'کارتۆن';
      const itemTotal = (item.price || 0) * (item.quantity || 0);
      return `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td style="font-weight: bold;">${item.name}</td>
          <td style="text-align: center;">${item.quantity} ${unitLabel}</td>
          <td style="text-align: center;" dir="ltr">${(item.price || 0).toLocaleString()} د.ع</td>
          <td style="text-align: center; font-weight: bold;" dir="ltr">${itemTotal.toLocaleString()} د.ع</td>
        </tr>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html dir="rtl">
        <head>
          <meta charset="utf-8">
          <title>وەسڵی بارکردنی کاڵا - ${transfer.cashvanName}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #1e293b; padding: 20px; line-height: 1.5; }
            .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 24px; color: #0f172a; }
            .header h2 { margin: 5px 0; font-size: 18px; color: #4338ca; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; font-size: 14px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; }
            .meta-item { display: flex; justify-content: space-between; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px 8px; text-align: right; }
            th { background-color: #f1f5f9; color: #334155; font-weight: bold; }
            .total-box { margin-top: 15px; padding: 15px; background: #f8fafc; border: 2px solid #0f172a; border-radius: 8px; text-align: left; font-size: 16px; font-weight: bold; }
            .signatures { margin-top: 50px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center; }
            .sig-line { border-top: 1px dashed #94a3b8; margin-top: 40px; padding-top: 8px; font-weight: bold; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>کۆمپانیای RF</h1>
            <h2>پسوڵەی بارکردن و ڕادەستکردنی کاڵا بە کاشڤان / مەندووب</h2>
            <div style="font-size: 12px; color: #64748b;">پسوڵەی فەرمی دەرچوونی کاڵا لە کۆگا</div>
          </div>

          <div class="meta-grid">
            <div class="meta-item"><span>ناوی کاشڤان / مەندووب:</span> <strong>${transfer.cashvanName}</strong></div>
            <div class="meta-item"><span>ژمارەی پسوڵە:</span> <strong dir="ltr">${transfer.transferNo || ('TRF-' + transfer.date.toString().slice(-6))}</strong></div>
            <div class="meta-item"><span>بەروار و کات:</span> <span dir="ltr">${format(transfer.date, 'yyyy/MM/dd - HH:mm')}</span></div>
            <div class="meta-item"><span>کۆی ژمارەی جۆری کاڵاکان:</span> <strong>${transfer.items.length} جۆر</strong></div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th>ناوی کاڵا</th>
                <th style="text-align: center; width: 120px;">بڕ و یەکە</th>
                <th style="text-align: center; width: 120px;">تێچوو</th>
                <th style="text-align: center; width: 130px;">کۆی گشتی</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="total-box">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>کۆی گشتی تێچووی کاڵا بارکراوەکان:</span>
              <span dir="ltr" style="color: #4338ca; font-size: 20px;">${transfer.totalValue.toLocaleString()} د.ع</span>
            </div>
          </div>

          <div class="signatures">
            <div>
              <div>واژۆی بەرپرسی کۆگا (ڕادەستکار)</div>
              <div class="sig-line">ناو و واژۆ</div>
            </div>
            <div>
              <div>واژۆی شۆفێری کاشڤان / مەندووب (وەرگر)</div>
              <div class="sig-line">${transfer.cashvanName}</div>
            </div>
          </div>

          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  const handleTransfer = async () => {
    if (!selectedCashvan || cart.length === 0) {
      alert('تکایە ناوی کاشڤان و لانیکەم یەک کاڵا دیاری بکە');
      return;
    }
    
    setIsProcessing(true);
    try {
      if (selectedCashvan && !cashvans.find(c => c.name === selectedCashvan)) {
        await addDoc(collection(db, 'cashvans'), { 
          name: selectedCashvan, 
          phone: '', 
          totalSales: 0, 
          totalProfit: 0, 
          createdAt: Date.now() 
        });
      }

      const totalValue = cart.reduce((acc, curr) => {
        const itemCost = curr.unit === 'packet' 
          ? (curr.item.packetCostPrice || curr.item.costPrice || 0)
          : (curr.item.cartonCostPrice || curr.item.costPrice || 0);
        return acc + (itemCost * curr.quantity);
      }, 0);

      const transferNo = `TRF-${Date.now().toString().slice(-6)}`;
      const transferData: Omit<CashvanTransfer, 'id'> = {
        transferNo,
        cashvanName: selectedCashvan,
        items: cart.map(c => ({
          itemId: c.item.id,
          name: c.item.name,
          quantity: c.quantity,
          unit: c.unit,
          price: c.unit === 'packet' 
            ? (c.item.packetCostPrice || c.item.costPrice || 0)
            : (c.item.cartonCostPrice || c.item.costPrice || 0),
          barcode: c.item.barcode || ''
        })),
        totalValue,
        date: Date.now()
      };

      const docRef = await addDoc(collection(db, 'cashvan_transfers'), transferData);

      // Deduct from warehouse stock and add to isolated cashvan inventory
      for (const cartItem of cart) {
        // 1. Deduct from warehouse
        const itemRef = doc(db, 'items', cartItem.item.id);
        const itemSnap = await getDoc(itemRef);
        if (itemSnap.exists()) {
          const curData = itemSnap.data();
          const currentTotal = curData.quantity || 0;
          const newQty = Math.max(0, currentTotal - cartItem.quantity);
          const updatePayload: any = { quantity: newQty };
          if (cartItem.unit === 'carton' && curData.cartonQuantity !== undefined) {
            updatePayload.cartonQuantity = Math.max(0, (curData.cartonQuantity || 0) - cartItem.quantity);
          } else if (cartItem.unit === 'packet' && curData.packetQuantity !== undefined) {
            updatePayload.packetQuantity = Math.max(0, (curData.packetQuantity || 0) - cartItem.quantity);
          }
          await updateDoc(itemRef, updatePayload);
        }

        // 2. Add to isolated cashvan inventory
        const cInvRef = doc(db, 'cashvan_inventory', `${selectedCashvan}_${cartItem.item.id}`);
        const cInvSnap = await getDoc(cInvRef);
        if (cInvSnap.exists()) {
          const curInv = cInvSnap.data();
          const curQty = curInv.quantity || 0;
          await updateDoc(cInvRef, {
            quantity: curQty + cartItem.quantity,
            unit: cartItem.unit,
            costPrice: cartItem.unit === 'packet' ? (cartItem.item.packetCostPrice || cartItem.item.costPrice) : (cartItem.item.cartonCostPrice || cartItem.item.costPrice),
            sellingPrice: cartItem.unit === 'packet' ? (cartItem.item.packetSellingPrice || cartItem.item.sellingPrice) : (cartItem.item.cartonSellingPrice || cartItem.item.sellingPrice),
            wholesalePrice: cartItem.unit === 'packet' ? (cartItem.item.packetWholesalePrice || cartItem.item.wholesalePrice) : (cartItem.item.cartonWholesalePrice || cartItem.item.wholesalePrice),
            lastUpdated: Date.now()
          });
        } else {
          await setDoc(cInvRef, {
            cashvanName: selectedCashvan,
            itemId: cartItem.item.id,
            name: cartItem.item.name,
            quantity: cartItem.quantity,
            unit: cartItem.unit,
            barcode: cartItem.item.barcode || '',
            costPrice: cartItem.unit === 'packet' ? (cartItem.item.packetCostPrice || cartItem.item.costPrice || 0) : (cartItem.item.cartonCostPrice || cartItem.item.costPrice || 0),
            sellingPrice: cartItem.unit === 'packet' ? (cartItem.item.packetSellingPrice || cartItem.item.sellingPrice || 0) : (cartItem.item.cartonSellingPrice || cartItem.item.sellingPrice || 0),
            wholesalePrice: cartItem.unit === 'packet' ? (cartItem.item.packetWholesalePrice || cartItem.item.wholesalePrice || 0) : (cartItem.item.cartonWholesalePrice || cartItem.item.wholesalePrice || 0),
            cartonCostPrice: cartItem.item.cartonCostPrice || 0,
            cartonSellingPrice: cartItem.item.cartonSellingPrice || 0,
            cartonWholesalePrice: cartItem.item.cartonWholesalePrice || 0,
            packetCostPrice: cartItem.item.packetCostPrice || 0,
            packetSellingPrice: cartItem.item.packetSellingPrice || 0,
            packetWholesalePrice: cartItem.item.packetWholesalePrice || 0,
            createdAt: Date.now()
          });
        }
      }

      const createdTransfer: CashvanTransfer = {
        id: docRef.id,
        ...transferData
      };

      setCart([]);
      // Open printable receipt immediately
      printTransferReceipt(createdTransfer);
      alert('بەسەرکەوتوویی کاڵاکان ڕادەستی کاشڤان کران و پسوڵەکە ئامادەی چاپکردنە');
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە کاتی پێدانی کاڵا');
    } finally {
      setIsProcessing(false);
    }
  };

  // Fulfill Pre-Order Requisition
  const handleFulfillRequisition = async (req: CashvanRequisition) => {
    setIsProcessing(true);
    try {
      const transferNo = `TRF-${Date.now().toString().slice(-6)}`;
      let totalValue = 0;

      const transferItems = req.items.map(rItem => {
        const itemObj = items.find(i => i.id === rItem.itemId);
        const costPrice = rItem.unit === 'packet'
          ? (itemObj?.packetCostPrice || itemObj?.costPrice || rItem.price || 0)
          : (itemObj?.cartonCostPrice || itemObj?.costPrice || rItem.price || 0);
        totalValue += costPrice * rItem.quantity;

        return {
          itemId: rItem.itemId,
          name: rItem.name,
          quantity: rItem.quantity,
          unit: rItem.unit,
          price: costPrice,
          barcode: itemObj?.barcode || ''
        };
      });

      // 1. Add Cashvan Transfer
      const transferData: Omit<CashvanTransfer, 'id'> = {
        transferNo,
        cashvanName: req.cashvanName,
        items: transferItems,
        totalValue,
        date: Date.now(),
        requisitionId: req.id
      };
      const transRef = await addDoc(collection(db, 'cashvan_transfers'), transferData);

      // 2. Deduct warehouse & update cashvan inventory
      for (const rItem of req.items) {
        const itemObj = items.find(i => i.id === rItem.itemId);
        if (itemObj) {
          const itemRef = doc(db, 'items', itemObj.id);
          const newQty = Math.max(0, (itemObj.quantity || 0) - rItem.quantity);
          await updateDoc(itemRef, { quantity: newQty });
        }

        const cInvRef = doc(db, 'cashvan_inventory', `${req.cashvanName}_${rItem.itemId}`);
        const cInvSnap = await getDoc(cInvRef);
        if (cInvSnap.exists()) {
          const curQty = cInvSnap.data().quantity || 0;
          await updateDoc(cInvRef, {
            quantity: curQty + rItem.quantity,
            lastUpdated: Date.now()
          });
        } else {
          await setDoc(cInvRef, {
            cashvanName: req.cashvanName,
            itemId: rItem.itemId,
            name: rItem.name,
            quantity: rItem.quantity,
            unit: rItem.unit,
            barcode: itemObj?.barcode || '',
            costPrice: rItem.unit === 'packet' ? (itemObj?.packetCostPrice || itemObj?.costPrice || 0) : (itemObj?.cartonCostPrice || itemObj?.costPrice || 0),
            sellingPrice: rItem.unit === 'packet' ? (itemObj?.packetSellingPrice || itemObj?.sellingPrice || 0) : (itemObj?.cartonSellingPrice || itemObj?.sellingPrice || 0),
            wholesalePrice: rItem.unit === 'packet' ? (itemObj?.packetWholesalePrice || itemObj?.wholesalePrice || 0) : (itemObj?.cartonWholesalePrice || itemObj?.wholesalePrice || 0),
            createdAt: Date.now()
          });
        }
      }

      // 3. Mark requisition completed
      await updateDoc(doc(db, 'cashvan_requisitions', req.id), {
        status: 'completed',
        completedAt: Date.now()
      });

      const fullTransfer: CashvanTransfer = {
        id: transRef.id,
        ...transferData
      };

      setViewingRequisition(null);
      printTransferReceipt(fullTransfer);
      alert('تەڵەبیەی پێشوەختەکە بە سەرکەوتوویی بارکرا بۆ نێو ڤانەکە و پسوڵەکە ئامادەی چاپە');
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا');
    } finally {
      setIsProcessing(false);
    }
  };

  const pendingRequisitions = requisitions.filter(r => r.status === 'pending' || r.status === 'preparing');

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.barcode && item.barcode.includes(searchTerm))
  );

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Truck className="text-indigo-600" size={24} />
            بەڕێوەبردنی بارکردن و مەخزەنی کاشڤانەکان
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            پێدانی کاڵا، وەسڵی چاپکراو، داواکاری پێشوەختە و جیاکردنەوەی باری هەر کاشڤانێک
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('transfer')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${activeTab === 'transfer' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            <Plus size={16} />
            پێدانی ڕاستەوخۆ
          </button>
          <button
            onClick={() => setActiveTab('requisitions')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 relative ${activeTab === 'requisitions' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            <ClipboardList size={16} />
            تەڵەبیەی پێشوەختەی کاشڤان
            {pendingRequisitions.length > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
                {pendingRequisitions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('van_inventory')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${activeTab === 'van_inventory' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            <Package size={16} />
            کاڵای نێو ڤانەکان
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            <Printer size={16} />
            مێژووی وەسڵەکان
          </button>
        </div>
      </div>

      {/* TAB 1: Direct Transfer */}
      {activeTab === 'transfer' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Item Selection */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
            <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Plus className="text-indigo-600" size={18} />
              هەڵبژاردنی کاڵاکان لە کۆگا
            </h3>
            
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-600 mb-1">کاشڤان / مەندووب دیاری بکە *</label>
              <select
                className="w-full px-3 py-2.5 border border-indigo-200 bg-indigo-50/20 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm text-slate-800"
                value={selectedCashvan}
                onChange={(e) => setSelectedCashvan(e.target.value)}
              >
                <option value="">-- ناوی کاشڤان هەڵبژێرە --</option>
                {cashvans.map(c => (
                  <option key={c.id || c.name} value={c.name}>
                    🚚 {c.name} {c.isRep ? '(مەندووب)' : '(کاشڤان)'}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3 relative">
              <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="گەڕان بۆ کاڵا بەپێی ناو یان بارکۆد..."
                className="w-full pl-3 pr-9 py-2 border border-slate-200 rounded-xl outline-none text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="max-h-[380px] overflow-y-auto space-y-2 border border-slate-100 rounded-xl p-2 flex-1">
              {filteredItems.map(item => (
                <div key={item.id} className="flex justify-between items-center p-2.5 hover:bg-slate-50 rounded-xl border border-slate-100 transition">
                  <div>
                    <div className="font-bold text-xs text-slate-800">{item.name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      ماوە لە کۆگا: <strong className="text-indigo-600">{item.quantity || 0} {item.packetSellingPrice && !item.cartonSellingPrice ? 'پاکەت' : 'کارتۆن'}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => addToCart(item)}
                    disabled={(item.quantity || 0) <= 0}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 font-bold rounded-lg text-xs transition disabled:opacity-40 flex items-center gap-1"
                  >
                    <Plus size={14} />
                    زیادکردن
                  </button>
                </div>
              ))}
              {filteredItems.length === 0 && (
                <div className="text-center text-slate-400 py-8 text-xs">هیچ کاڵایەک نەدۆزرایەوە</div>
              )}
            </div>
          </section>

          {/* Right: Cart / Load List */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Truck className="text-indigo-600" size={18} />
                  لیستی کاڵاکانی بارکردن بۆ {selectedCashvan || '...'}
                </h3>
                <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-bold">
                  {cart.length} جۆر کاڵا
                </span>
              </div>

              <div className="overflow-y-auto max-h-[380px] space-y-2.5">
                {cart.map(c => (
                  <div key={c.item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 flex justify-between items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs text-slate-800 truncate">{c.item.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        تێچوو: {(c.unit === 'packet' ? (c.item.packetCostPrice || c.item.costPrice || 0) : (c.item.cartonCostPrice || c.item.costPrice || 0)).toLocaleString()} د.ع
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select 
                        className="px-2 py-1 border border-slate-300 rounded-lg text-xs bg-white font-bold text-slate-700 outline-none"
                        value={c.unit}
                        onChange={(e) => updateQuantity(c.item.id, c.quantity, e.target.value as 'carton' | 'packet')}
                      >
                        <option value="carton">کارتۆن</option>
                        <option value="packet">پاکەت</option>
                      </select>

                      <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden">
                        <button 
                          type="button" 
                          onClick={() => updateQuantity(c.item.id, c.quantity - 1, c.unit)} 
                          className="px-2.5 py-1 text-base font-bold text-slate-600 hover:bg-slate-100"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          className="w-12 text-center text-xs font-bold font-mono outline-none border-none py-1"
                          value={c.quantity}
                          onChange={(e) => updateQuantity(c.item.id, parseInt(e.target.value) || 1, c.unit)}
                        />
                        <button 
                          type="button" 
                          onClick={() => updateQuantity(c.item.id, c.quantity + 1, c.unit)} 
                          className="px-2.5 py-1 text-base font-bold text-slate-600 hover:bg-slate-100"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {cart.length === 0 && (
                  <div className="text-center text-slate-400 py-16 text-xs">
                    هیچ کاڵایەک بۆ بارکردن هەڵنەبژێردراوە
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
              <div className="flex justify-between items-center text-sm font-bold text-slate-800 bg-slate-50 p-3 rounded-xl">
                <span>کۆی نرخی تێچووی بار:</span>
                <span className="text-indigo-600 font-mono" dir="ltr">
                  {cart.reduce((sum, curr) => {
                    const cost = curr.unit === 'packet' ? (curr.item.packetCostPrice || curr.item.costPrice || 0) : (curr.item.cartonCostPrice || curr.item.costPrice || 0);
                    return sum + (cost * curr.quantity);
                  }, 0).toLocaleString()} د.ع
                </span>
              </div>

              <button
                type="button"
                onClick={handleTransfer}
                disabled={cart.length === 0 || !selectedCashvan || isProcessing}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex justify-center items-center gap-2 shadow-sm disabled:opacity-50 transition text-sm"
              >
                <Printer size={18} />
                <span>{isProcessing ? 'خەریکی بارکردن و دروستکردنی وەسڵ...' : 'ڕادەستکردن و چاپکردنی وەسڵی بارکردن'}</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: Requisitions from Cashvans */}
      {activeTab === 'requisitions' && (
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <ClipboardList className="text-indigo-600" size={20} />
                تەڵەبیەی پێشوەختەی کاشڤانەکان بۆ کۆگا
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                کاشڤان لە ڕێگاوە داواکاری کاڵا دەنێرێت تا کارمەندانی کۆگا ئامادەی بکەن
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 text-slate-500 text-xs font-bold">
                <tr>
                  <th className="p-3">کاشڤان / مەندووب</th>
                  <th className="p-3">بەروار و کات</th>
                  <th className="p-3">ژمارەی کاڵاکان</th>
                  <th className="p-3">دۆخ (Status)</th>
                  <th className="p-3 text-center">کردارەکان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {requisitions.map(req => (
                  <tr key={req.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3 font-bold text-slate-800">🚚 {req.cashvanName}</td>
                    <td className="p-3 text-slate-600" dir="ltr">{format(req.createdAt, 'yyyy/MM/dd HH:mm')}</td>
                    <td className="p-3 font-semibold text-slate-700">
                      {req.items.reduce((sum, i) => sum + i.quantity, 0)} {req.items[0]?.unit === 'packet' ? 'پاکەت' : 'کارتۆن'} ({req.items.length} جۆر)
                    </td>
                    <td className="p-3">
                      {req.status === 'pending' && (
                        <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full font-bold flex items-center gap-1 w-fit">
                          <Clock size={12} />
                          چاوەڕوان
                        </span>
                      )}
                      {req.status === 'preparing' && (
                        <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full font-bold flex items-center gap-1 w-fit">
                          لە ئامادەکردندایە
                        </span>
                      )}
                      {req.status === 'completed' && (
                        <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-bold flex items-center gap-1 w-fit">
                          <CheckCircle2 size={12} />
                          بارکرا بۆ ڤان
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setViewingRequisition(req)}
                          className="px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-bold flex items-center gap-1"
                        >
                          <Eye size={14} />
                          بینین و بارکردن
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {requisitions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-slate-400 text-xs">
                      هیچ تەڵەبیەیەکی پێشوەختە بوونی نییە
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 3: Isolated Van Inventory */}
      {activeTab === 'van_inventory' && (
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Truck className="text-indigo-600" size={20} />
                مەخزەنی جیاکراوەی هەر ڤانێک (بۆ ڕێگری لە تێکەڵبوون)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                دیاریکردنی وردی ئەو کاڵایانەی لەناو ڤانی هەر کاشڤانێکدا ماونەتەوە
              </p>
            </div>

            <div className="w-full sm:w-72">
              <select
                className="w-full px-3 py-2 border border-indigo-200 bg-indigo-50/30 rounded-xl outline-none font-bold text-xs"
                value={selectedCashvan}
                onChange={(e) => setSelectedCashvan(e.target.value)}
              >
                <option value="">-- کاشڤانێک هەڵبژێرە بۆ بینینی مەخزەنەکەی --</option>
                {cashvans.map(c => (
                  <option key={c.id || c.name} value={c.name}>
                    🚚 {c.name} {c.isRep ? '(مەندووب)' : '(کاشڤان)'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedCashvan ? (
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-slate-50 text-slate-500 text-xs font-bold">
                  <tr>
                    <th className="p-3">ناوی کاڵا لەناو ڤاندا</th>
                    <th className="p-3">بارکۆد</th>
                    <th className="p-3">بڕی بەردەست لەناو ڤان</th>
                    <th className="p-3">نرخی فرۆشتن</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {selectedVanInventory.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50/60 transition">
                      <td className="p-3 font-bold text-slate-800">{inv.name}</td>
                      <td className="p-3 font-mono text-slate-400" dir="ltr">{inv.barcode || '-'}</td>
                      <td className="p-3 font-bold text-indigo-700">
                        <span className="bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                          {inv.quantity || 0} {inv.unit === 'packet' ? 'پاکەت' : 'کارتۆن'}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-800" dir="ltr">
                        {(inv.sellingPrice || 0).toLocaleString()} د.ع
                      </td>
                    </tr>
                  ))}
                  {selectedVanInventory.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-10 text-slate-400 text-xs">
                        ڤانی {selectedCashvan} لە ئێستادا هیچ کاڵایەکی تێدا نییە یان بەتاڵە
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 text-xs">
              تکایە لە لیستی سەرەوە ناوی کاشڤانێک دیاری بکە بۆ بینینی کاڵاکانی نێو ڤانەکەی
            </div>
          )}
        </section>
      )}

      {/* TAB 4: Transfers History & Printing */}
      {activeTab === 'history' && (
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Printer className="text-indigo-600" size={20} />
              مێژووی وەسڵەکانی بارکردن و ڕادەستکردن
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 text-slate-500 text-xs font-bold">
                <tr>
                  <th className="p-3">ژمارەی پسوڵە</th>
                  <th className="p-3">کاشڤان / مەندووب</th>
                  <th className="p-3">بەروار و کات</th>
                  <th className="p-3">بڕی کاڵاکان</th>
                  <th className="p-3">کۆی تێچووی بار</th>
                  <th className="p-3 text-center">چاپکردنی وەسڵ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {transfers.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3 font-mono font-bold text-indigo-700" dir="ltr">
                      {t.transferNo || ('TRF-' + t.date.toString().slice(-6))}
                    </td>
                    <td className="p-3 font-bold text-slate-800">🚚 {t.cashvanName}</td>
                    <td className="p-3 text-slate-600" dir="ltr">{format(t.date, 'yyyy/MM/dd HH:mm')}</td>
                    <td className="p-3 font-semibold text-slate-700">
                      {t.items.reduce((a, b) => a + b.quantity, 0)} {t.items[0]?.unit === 'packet' ? 'پاکەت' : 'کارتۆن'}
                    </td>
                    <td className="p-3 font-bold text-indigo-700 font-mono" dir="ltr">
                      {t.totalValue.toLocaleString()} د.ع
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => printTransferReceipt(t)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 font-bold rounded-lg transition text-xs flex items-center gap-1.5 mx-auto"
                      >
                        <Printer size={14} />
                        چاپکردنی پسوڵە
                      </button>
                    </td>
                  </tr>
                ))}
                {transfers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400 text-xs">
                      هیچ مێژوویەکی بارکردن تۆمار نەکراوە
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Modal: View & Fulfill Requisition */}
      {viewingRequisition && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200">
            <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-indigo-900 text-sm flex items-center gap-2">
                  <ClipboardList size={18} className="text-indigo-600" />
                  داواکاری پێشوەختەی {viewingRequisition.cashvanName}
                </h4>
                <p className="text-[11px] text-indigo-700 mt-0.5">
                  بەروار: {format(viewingRequisition.createdAt, 'yyyy/MM/dd HH:mm')}
                </p>
              </div>
              <button onClick={() => setViewingRequisition(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">ناوی کاڵا</th>
                      <th className="p-2.5 text-center">بڕی داواکراو</th>
                      <th className="p-2.5 text-center">بەردەست لە کۆگا</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingRequisition.items.map((rItem, i) => {
                      const warehouseItem = items.find(it => it.id === rItem.itemId);
                      const isAvailable = (warehouseItem?.quantity || 0) >= rItem.quantity;
                      return (
                        <tr key={i}>
                          <td className="p-2.5 font-bold text-slate-800">{rItem.name}</td>
                          <td className="p-2.5 text-center font-bold text-indigo-700">
                            {rItem.quantity} {rItem.unit === 'packet' ? 'پاکەت' : 'کارتۆن'}
                          </td>
                          <td className="p-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${isAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                              {warehouseItem?.quantity || 0}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {viewingRequisition.notes && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
                  <strong>تێبینی کاشڤان:</strong> {viewingRequisition.notes}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setViewingRequisition(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition"
              >
                داخستن
              </button>

              {viewingRequisition.status !== 'completed' && (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleFulfillRequisition(viewingRequisition)}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
                >
                  <Printer size={16} />
                  <span>{isProcessing ? 'خەریکی پەسەندکردن...' : 'پەسەندکردن، بارکردن بۆ ڤان و چاپکردنی وەسڵ'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
