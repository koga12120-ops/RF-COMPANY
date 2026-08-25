import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, getDoc, setDoc, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { Item, CashvanTransfer, CashvanRequisition } from '../../types';
import { Plus, Search, Check, Send, Printer, Truck, ClipboardList, CheckCircle2, Clock, Eye, X, Package, Edit2, Trash2, AlertTriangle } from 'lucide-react';
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

  // Edit & Delete State for Transfers
  const [deletingTransfer, setDeletingTransfer] = useState<CashvanTransfer | null>(null);
  const [editingTransfer, setEditingTransfer] = useState<CashvanTransfer | null>(null);
  const [editCashvanName, setEditCashvanName] = useState('');
  const [editItems, setEditItems] = useState<{ itemId: string; name: string; quantity: number; unit: 'carton' | 'packet'; price: number; barcode?: string }[]>([]);
  const [editSearchTerm, setEditSearchTerm] = useState('');

  // Edit, Delete, Print State for Requisitions (Pre-orders)
  const [editingRequisition, setEditingRequisition] = useState<CashvanRequisition | null>(null);
  const [editReqItems, setEditReqItems] = useState<{ itemId: string; name: string; quantity: number; unit: 'carton' | 'packet'; price?: number }[]>([]);
  const [editReqNotes, setEditReqNotes] = useState('');
  const [editReqCashvanName, setEditReqCashvanName] = useState('');
  const [editReqStatus, setEditReqStatus] = useState<'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled'>('pending');
  const [editReqSearchTerm, setEditReqSearchTerm] = useState('');
  const [deletingRequisition, setDeletingRequisition] = useState<CashvanRequisition | null>(null);

  // Delete State for Van Inventory Item
  const [deletingVanItem, setDeletingVanItem] = useState<any | null>(null);
  const [returnToWarehouseOnDelete, setReturnToWarehouseOnDelete] = useState<boolean>(true);


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
    const unsub = onSnapshot(
      qInv,
      (snap) => {
        const vanItems: any[] = [];
        snap.forEach(d => {
          const data = d.data();
          if (data.cashvanName === selectedCashvan && (data.quantity > 0 || data.cartonQuantity > 0 || data.packetQuantity > 0)) {
            vanItems.push({ id: d.id, ...data });
          }
        });
        setSelectedVanInventory(vanItems);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'cashvan_inventory');
      }
    );
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
    let totalUnits = 0;

    const itemsHtml = transfer.items.map((item, idx) => {
      const unitLabel = item.unit === 'packet' ? 'پاکەت' : 'کارتۆن';
      const qty = item.quantity || 0;
      totalUnits += qty;

      return `
        <tr>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px;">${idx + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">${item.name}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; font-size: 14px;">${qty}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px;">${unitLabel}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ckb">
        <head>
          <meta charset="utf-8">
          <title>وەسڵی بارکردنی کاڵا بۆ کاشڤان - ${transfer.cashvanName}</title>
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
            .total-box { margin-top: 15px; padding: 16px; background: #f8fafc; border: 2px solid #0f172a; border-radius: 10px; font-size: 15px; }
            .total-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
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
            <h2>پسوڵەی بارکردن و ڕادەستکردنی کاڵا بە کاشڤان</h2>
            <div style="font-size: 12px; color: #64748b;">پسوڵەی فەرمی دەرچوونی کاڵا لە کۆگا بۆ کاشڤان</div>
          </div>

          <div class="meta-grid">
            <div class="meta-item"><span>ناوی کاشڤان:</span> <strong>${transfer.cashvanName}</strong></div>
            <div class="meta-item"><span>ژمارەی پسوڵە:</span> <strong dir="ltr">${transfer.transferNo || ('TRF-' + transfer.date.toString().slice(-6))}</strong></div>
            <div class="meta-item"><span>بەروار و کات:</span> <span dir="ltr">${format(transfer.date, 'yyyy/MM/dd - HH:mm')}</span></div>
            <div class="meta-item"><span>کۆی جۆری کاڵاکان:</span> <strong>${transfer.items.length} جۆر</strong></div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th>ناوی کاڵا</th>
                <th style="text-align: center; width: 90px;">بڕی بارکراو</th>
                <th style="text-align: center; width: 80px;">یەکە</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="total-box">
            <div class="total-row">
              <span style="font-weight: bold; color: #334155;">کۆی گشتی ژمارەی کاڵا بارکراوەکان:</span>
              <span dir="ltr" style="color: #4338ca; font-size: 17px; font-weight: bold;">${totalUnits} دانە / کارتۆن</span>
            </div>
          </div>

          <div class="signatures">
            <div>
              <div>واژۆی بەرپرسی کۆگا (ڕادەستکار)</div>
              <div class="sig-line">ناو و واژۆ</div>
            </div>
            <div>
              <div>واژۆی شۆفێری کاشڤان (وەرگر)</div>
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
        const itemPrice = curr.unit === 'packet' 
          ? (curr.item.packetSellingPrice || curr.item.sellingPrice || curr.item.packetCostPrice || curr.item.costPrice || 0)
          : (curr.item.cartonSellingPrice || curr.item.sellingPrice || curr.item.cartonCostPrice || curr.item.costPrice || 0);
        return acc + (itemPrice * curr.quantity);
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
            ? (c.item.packetSellingPrice || c.item.sellingPrice || c.item.packetCostPrice || c.item.costPrice || 0)
            : (c.item.cartonSellingPrice || c.item.sellingPrice || c.item.cartonCostPrice || c.item.costPrice || 0),
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
        const itemPrice = rItem.unit === 'packet'
          ? (itemObj?.packetSellingPrice || itemObj?.sellingPrice || itemObj?.packetCostPrice || itemObj?.costPrice || rItem.price || 0)
          : (itemObj?.cartonSellingPrice || itemObj?.sellingPrice || itemObj?.cartonCostPrice || itemObj?.costPrice || rItem.price || 0);
        totalValue += itemPrice * rItem.quantity;

        return {
          itemId: rItem.itemId,
          name: rItem.name,
          quantity: rItem.quantity,
          unit: rItem.unit,
          price: itemPrice,
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

  // Open Edit Transfer Modal
  const openEditTransfer = (t: CashvanTransfer) => {
    setEditingTransfer(t);
    setEditCashvanName(t.cashvanName);
    setEditItems(t.items.map(it => ({ ...it })));
    setEditSearchTerm('');
  };

  // Update quantity in edit modal
  const handleUpdateEditItemQuantity = (index: number, newQty: number, newUnit?: 'carton' | 'packet') => {
    if (newQty <= 0) {
      handleRemoveEditItem(index);
      return;
    }
    setEditItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        return {
          ...item,
          quantity: newQty,
          unit: newUnit !== undefined ? newUnit : item.unit
        };
      }
      return item;
    }));
  };

  // Remove item in edit modal
  const handleRemoveEditItem = (index: number) => {
    setEditItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Add item from warehouse to edit modal
  const handleAddEditItem = (item: Item) => {
    setEditItems(prev => {
      const existingIdx = prev.findIndex(p => p.itemId === item.id);
      if (existingIdx >= 0) {
        return prev.map((p, idx) => idx === existingIdx ? { ...p, quantity: p.quantity + 1 } : p);
      }
      const unit = item.packetSellingPrice && !item.cartonSellingPrice ? 'packet' : 'carton';
      const price = unit === 'packet'
        ? (item.packetSellingPrice || item.sellingPrice || item.packetCostPrice || item.costPrice || 0)
        : (item.cartonSellingPrice || item.sellingPrice || item.cartonCostPrice || item.costPrice || 0);

      return [...prev, {
        itemId: item.id,
        name: item.name,
        quantity: 1,
        unit,
        price,
        barcode: item.barcode || ''
      }];
    });
  };

  // Save changes to edited transfer
  const handleSaveEditTransfer = async () => {
    if (!editingTransfer) return;
    if (editItems.length === 0) {
      alert('تکایە لانیکەم یەک کاڵا لە وەسڵەکەدا بهێڵەرەوە');
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Revert previous transfer items from warehouse & old cashvan
      for (const oldItem of editingTransfer.items) {
        // Return to warehouse
        const itemRef = doc(db, 'items', oldItem.itemId);
        const itemSnap = await getDoc(itemRef);
        if (itemSnap.exists()) {
          const curData = itemSnap.data();
          const curQty = curData.quantity || 0;
          const updatePayload: any = { quantity: curQty + oldItem.quantity };
          if (oldItem.unit === 'carton' && curData.cartonQuantity !== undefined) {
            updatePayload.cartonQuantity = (curData.cartonQuantity || 0) + oldItem.quantity;
          } else if (oldItem.unit === 'packet' && curData.packetQuantity !== undefined) {
            updatePayload.packetQuantity = (curData.packetQuantity || 0) + oldItem.quantity;
          }
          await updateDoc(itemRef, updatePayload);
        }

        // Deduct from old cashvan inventory
        const cInvRef = doc(db, 'cashvan_inventory', `${editingTransfer.cashvanName}_${oldItem.itemId}`);
        const cInvSnap = await getDoc(cInvRef);
        if (cInvSnap.exists()) {
          const curInv = cInvSnap.data();
          const curQty = curInv.quantity || 0;
          const newQty = Math.max(0, curQty - oldItem.quantity);
          await updateDoc(cInvRef, {
            quantity: newQty,
            lastUpdated: Date.now()
          });
        }
      }

      // 2. Apply new edited items to warehouse & cashvan
      let newTotalValue = 0;
      const targetCashvan = editCashvanName || editingTransfer.cashvanName;

      for (const newItem of editItems) {
        const itemObj = items.find(i => i.id === newItem.itemId);
        const price = newItem.unit === 'packet'
          ? (itemObj?.packetSellingPrice || itemObj?.sellingPrice || itemObj?.packetCostPrice || itemObj?.costPrice || newItem.price || 0)
          : (itemObj?.cartonSellingPrice || itemObj?.sellingPrice || itemObj?.cartonCostPrice || itemObj?.costPrice || newItem.price || 0);

        newTotalValue += price * newItem.quantity;

        // Deduct from warehouse
        const itemRef = doc(db, 'items', newItem.itemId);
        const itemSnap = await getDoc(itemRef);
        if (itemSnap.exists()) {
          const curData = itemSnap.data();
          const curQty = curData.quantity || 0;
          const updatePayload: any = { quantity: Math.max(0, curQty - newItem.quantity) };
          if (newItem.unit === 'carton' && curData.cartonQuantity !== undefined) {
            updatePayload.cartonQuantity = Math.max(0, (curData.cartonQuantity || 0) - newItem.quantity);
          } else if (newItem.unit === 'packet' && curData.packetQuantity !== undefined) {
            updatePayload.packetQuantity = Math.max(0, (curData.packetQuantity || 0) - newItem.quantity);
          }
          await updateDoc(itemRef, updatePayload);
        }

        // Add to cashvan inventory
        const cInvRef = doc(db, 'cashvan_inventory', `${targetCashvan}_${newItem.itemId}`);
        const cInvSnap = await getDoc(cInvRef);
        if (cInvSnap.exists()) {
          const curInv = cInvSnap.data();
          const curQty = curInv.quantity || 0;
          await updateDoc(cInvRef, {
            quantity: curQty + newItem.quantity,
            unit: newItem.unit,
            lastUpdated: Date.now()
          });
        } else {
          await setDoc(cInvRef, {
            cashvanName: targetCashvan,
            itemId: newItem.itemId,
            name: newItem.name,
            quantity: newItem.quantity,
            unit: newItem.unit,
            barcode: newItem.barcode || itemObj?.barcode || '',
            costPrice: newItem.unit === 'packet' ? (itemObj?.packetCostPrice || itemObj?.costPrice || 0) : (itemObj?.cartonCostPrice || itemObj?.costPrice || 0),
            sellingPrice: price,
            wholesalePrice: newItem.unit === 'packet' ? (itemObj?.packetWholesalePrice || itemObj?.wholesalePrice || 0) : (itemObj?.cartonWholesalePrice || itemObj?.wholesalePrice || 0),
            createdAt: Date.now()
          });
        }
      }

      // 3. Update the transfer document
      await updateDoc(doc(db, 'cashvan_transfers', editingTransfer.id), {
        cashvanName: targetCashvan,
        items: editItems.map(it => {
          const itemObj = items.find(i => i.id === it.itemId);
          const itemPrice = it.unit === 'packet'
            ? (itemObj?.packetSellingPrice || itemObj?.sellingPrice || itemObj?.packetCostPrice || itemObj?.costPrice || it.price || 0)
            : (itemObj?.cartonSellingPrice || itemObj?.sellingPrice || itemObj?.cartonCostPrice || itemObj?.costPrice || it.price || 0);
          return {
            ...it,
            price: itemPrice
          };
        }),
        totalValue: newTotalValue,
        lastEditedAt: Date.now()
      });

      setEditingTransfer(null);
      alert('وەسڵی بارکردن بە سەرکەوتوویی دەستکاری کرا و مەخزەنی کۆگا و کاشڤان ڕێکخرانەوە');
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە دەستکاریکردنی وەسڵ');
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete Transfer Handler
  const handleDeleteTransfer = async () => {
    if (!deletingTransfer) return;
    setIsProcessing(true);
    try {
      // 1. Revert items back to warehouse and deduct from cashvan
      for (const tItem of deletingTransfer.items) {
        // Return to warehouse
        const itemRef = doc(db, 'items', tItem.itemId);
        const itemSnap = await getDoc(itemRef);
        if (itemSnap.exists()) {
          const curData = itemSnap.data();
          const curQty = curData.quantity || 0;
          const updatePayload: any = { quantity: curQty + tItem.quantity };
          if (tItem.unit === 'carton' && curData.cartonQuantity !== undefined) {
            updatePayload.cartonQuantity = (curData.cartonQuantity || 0) + tItem.quantity;
          } else if (tItem.unit === 'packet' && curData.packetQuantity !== undefined) {
            updatePayload.packetQuantity = (curData.packetQuantity || 0) + tItem.quantity;
          }
          await updateDoc(itemRef, updatePayload);
        }

        // Deduct from cashvan inventory
        const cInvRef = doc(db, 'cashvan_inventory', `${deletingTransfer.cashvanName}_${tItem.itemId}`);
        const cInvSnap = await getDoc(cInvRef);
        if (cInvSnap.exists()) {
          const curInv = cInvSnap.data();
          const curQty = curInv.quantity || 0;
          const newQty = Math.max(0, curQty - tItem.quantity);
          await updateDoc(cInvRef, {
            quantity: newQty,
            lastUpdated: Date.now()
          });
        }
      }

      // 2. Delete the transfer record
      await deleteDoc(doc(db, 'cashvan_transfers', deletingTransfer.id));
      setDeletingTransfer(null);
      alert('وەسڵی بارکردن سڕایەوە و سەرجەم کاڵاکان گەڕێندرانەوە بۆ کۆگا');
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە سڕینەوەی وەسڵ');
    } finally {
      setIsProcessing(false);
    }
  };

  // Print Requisition (Pre-order) Receipt
  const printRequisition = (req: CashvanRequisition) => {
    let totalUnits = 0;
    const itemsHtml = req.items.map((item, idx) => {
      const unitLabel = item.unit === 'packet' ? 'پاکەت' : 'کارتۆن';
      const qty = item.quantity || 0;
      totalUnits += qty;
      return `
        <tr>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px;">${idx + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">${item.name}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; font-size: 14px;">${qty}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px;">${unitLabel}</td>
        </tr>
      `;
    }).join('');

    const statusText = req.status === 'completed' ? 'بارکراوە بۆ ڤان (تەواوکراو)' : req.status === 'preparing' ? 'لە ئامادەکردندایە' : 'چاوەڕوانی ئامادەکردنە';

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ckb">
        <head>
          <meta charset="utf-8">
          <title>وەسڵی داواکاری پێشوەختە (تەڵەبیە) - ${req.cashvanName}</title>
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
            .notes-box { margin-top: 15px; padding: 12px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; font-size: 13px; color: #92400e; }
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
            <h2>وەسڵی داواکاری پێشوەختەی کاشڤان (تەڵەبیە)</h2>
            <div style="font-size: 12px; color: #64748b;">داواکاری ئامادەکردنی باری کاشڤان لە کۆگای سەرەکی</div>
          </div>

          <div class="meta-grid">
            <div class="meta-item"><span>ناوی کاشڤان / مەندووب:</span> <strong>${req.cashvanName}</strong></div>
            <div class="meta-item"><span>ژمارەی داواکاری:</span> <strong dir="ltr">${req.requisitionNo || ('REQ-' + req.id.slice(-6))}</strong></div>
            <div class="meta-item"><span>بەروار و کات:</span> <span dir="ltr">${format(req.createdAt, 'yyyy/MM/dd - HH:mm')}</span></div>
            <div class="meta-item"><span>دۆخی داواکاری:</span> <strong>${statusText}</strong></div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th>ناوی کاڵا</th>
                <th style="text-align: center; width: 130px;">بڕی داواکراو</th>
                <th style="text-align: center; width: 110px;">یەکە</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div style="padding: 14px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; display: flex; justify-content: space-between; font-size: 15px; font-weight: bold;">
            <span>کۆی گشتی ژمارەی کاڵا داواکراوەکان:</span>
            <span dir="ltr" style="color: #4338ca;">${totalUnits} دانە / کارتۆن (${req.items.length} جۆر کاڵا)</span>
          </div>

          ${req.notes ? `
            <div class="notes-box">
              <strong>تێبینی کاشڤان:</strong> ${req.notes}
            </div>
          ` : ''}

          <div class="signatures">
            <div>
              <div>واژۆی شۆفێری کاشڤان (داواکار)</div>
              <div class="sig-line">${req.cashvanName}</div>
            </div>
            <div>
              <div>واژۆی بەرپرسی کۆگا (ئامادەکار)</div>
              <div class="sig-line">ناو و واژۆ</div>
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

  // Requisition Edit Handlers
  const openEditRequisition = (req: CashvanRequisition) => {
    setEditingRequisition(req);
    setEditReqCashvanName(req.cashvanName);
    setEditReqItems(req.items.map(it => ({ ...it })));
    setEditReqNotes(req.notes || '');
    setEditReqStatus(req.status || 'pending');
    setEditReqSearchTerm('');
  };

  const handleUpdateEditReqItemQty = (index: number, newQty: number, newUnit?: 'carton' | 'packet') => {
    if (newQty <= 0) {
      setEditReqItems(prev => prev.filter((_, idx) => idx !== index));
      return;
    }
    setEditReqItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        return {
          ...item,
          quantity: newQty,
          unit: newUnit !== undefined ? newUnit : item.unit
        };
      }
      return item;
    }));
  };

  const handleAddEditReqItem = (item: Item) => {
    setEditReqItems(prev => {
      const existingIdx = prev.findIndex(p => p.itemId === item.id);
      if (existingIdx >= 0) {
        return prev.map((p, idx) => idx === existingIdx ? { ...p, quantity: p.quantity + 1 } : p);
      }
      const unit = item.packetSellingPrice && !item.cartonSellingPrice ? 'packet' : 'carton';
      return [...prev, {
        itemId: item.id,
        name: item.name,
        quantity: 1,
        unit
      }];
    });
  };

  const handleSaveEditRequisition = async () => {
    if (!editingRequisition) return;
    if (editReqItems.length === 0) {
      alert('تکایە لانیکەم یەک کاڵا لە داواکارییەکەدا بهێڵەرەوە');
      return;
    }

    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'cashvan_requisitions', editingRequisition.id), {
        cashvanName: editReqCashvanName || editingRequisition.cashvanName,
        items: editReqItems,
        notes: editReqNotes.trim(),
        status: editReqStatus,
        lastEditedAt: Date.now()
      });
      setEditingRequisition(null);
      alert('داواکاری پێشوەختەکە (تەڵەبیە) بە سەرکەوتوویی دەستکاری کرا');
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە دەستکاریکردنی تەڵەبیە');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteRequisition = async () => {
    if (!deletingRequisition) return;
    setIsProcessing(true);
    try {
      await deleteDoc(doc(db, 'cashvan_requisitions', deletingRequisition.id));
      setDeletingRequisition(null);
      alert('تەڵەبیەی پێشوەختەکە بە سەرکەوتوویی سڕایەوە');
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە سڕینەوەی تەڵەبیە');
    } finally {
      setIsProcessing(false);
    }
  };

  // Van Inventory Item Delete Handler
  const handleDeleteVanItem = async () => {
    if (!deletingVanItem) return;
    setIsProcessing(true);
    try {
      if (returnToWarehouseOnDelete) {
        // Return quantity back to warehouse items collection
        const itemRef = doc(db, 'items', deletingVanItem.itemId);
        const itemSnap = await getDoc(itemRef);
        if (itemSnap.exists()) {
          const curData = itemSnap.data();
          const curQty = curData.quantity || 0;
          const updatePayload: any = { quantity: curQty + (deletingVanItem.quantity || 0) };
          if (deletingVanItem.unit === 'carton' && curData.cartonQuantity !== undefined) {
            updatePayload.cartonQuantity = (curData.cartonQuantity || 0) + (deletingVanItem.quantity || 0);
          } else if (deletingVanItem.unit === 'packet' && curData.packetQuantity !== undefined) {
            updatePayload.packetQuantity = (curData.packetQuantity || 0) + (deletingVanItem.quantity || 0);
          }
          await updateDoc(itemRef, updatePayload);
        }
      }

      // Delete from cashvan_inventory
      await deleteDoc(doc(db, 'cashvan_inventory', deletingVanItem.id));
      setDeletingVanItem(null);
      alert(returnToWarehouseOnDelete
        ? 'کاڵاکە لەناو ڤان سڕایەوە و سەرجەم بڕەکەی گەڕێندرایەوە بۆ کۆگای سەرەکی'
        : 'کاڵاکە لەناو مەخزەنی ڤان سڕایەوە'
      );
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە سڕینەوەی کاڵای ڤان');
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
                  <option key={`wh-transfer-cv-${c.isRep ? 'rep' : 'cv'}-${c.id || c.name}`} value={c.name}>
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
                        نرخی فرۆشتن: {(c.unit === 'packet' ? (c.item.packetSellingPrice || c.item.sellingPrice || c.item.packetCostPrice || c.item.costPrice || 0) : (c.item.cartonSellingPrice || c.item.sellingPrice || c.item.cartonCostPrice || c.item.costPrice || 0)).toLocaleString()} د.ع
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
                <span>کۆی گشتی بڕی پارەی بارکردن:</span>
                <span className="text-emerald-700 font-mono font-black" dir="ltr">
                  {cart.reduce((sum, curr) => {
                    const price = curr.unit === 'packet' ? (curr.item.packetSellingPrice || curr.item.sellingPrice || curr.item.packetCostPrice || curr.item.costPrice || 0) : (curr.item.cartonSellingPrice || curr.item.sellingPrice || curr.item.cartonCostPrice || curr.item.costPrice || 0);
                    return sum + (price * curr.quantity);
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
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setViewingRequisition(req)}
                          title="بینین و بارکردنی تەڵەبیە"
                          className="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-lg font-bold flex items-center gap-1 text-xs transition border border-indigo-200 hover:border-indigo-600"
                        >
                          <Eye size={13} />
                          <span>بینین و بارکردن</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => printRequisition(req)}
                          title="چاپکردنی وەسڵی تەڵەبیە"
                          className="px-2 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-700 hover:text-white rounded-lg font-bold flex items-center gap-1 text-xs transition border border-slate-200 hover:border-slate-700"
                        >
                          <Printer size={13} />
                          <span>چاپ</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditRequisition(req)}
                          title="دەستکاریکردنی تەڵەبیە"
                          className="px-2 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white rounded-lg font-bold flex items-center gap-1 text-xs transition border border-amber-200 hover:border-amber-600"
                        >
                          <Edit2 size={13} />
                          <span>دەستکاری</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingRequisition(req)}
                          title="سڕینەوەی تەڵەبیە"
                          className="px-2 py-1.5 bg-red-50 text-red-700 hover:bg-red-600 hover:text-white rounded-lg font-bold flex items-center gap-1 text-xs transition border border-red-200 hover:border-red-600"
                        >
                          <Trash2 size={13} />
                          <span>سڕینەوە</span>
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
                دیاریکردنی وردی ئەو کاڵایانەی لەناو ڤانی هەر کاشڤانێکدا ماونەتەوە و دەسەڵاتی سڕینەوە و گەڕاندنەوە بۆ کۆگا
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
                  <option key={`wh-inv-cv-${c.isRep ? 'rep' : 'cv'}-${c.id || c.name}`} value={c.name}>
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
                    <th className="p-3 text-center">کردارەکان</th>
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
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingVanItem(inv);
                            setReturnToWarehouseOnDelete(true);
                          }}
                          title="سڕینەوەی ئەم کاڵایە لەناو ڤان"
                          className="px-2.5 py-1.5 bg-red-50 hover:bg-red-600 hover:text-white text-red-700 font-bold rounded-lg transition text-xs flex items-center gap-1 border border-red-200 hover:border-red-600 mx-auto"
                        >
                          <Trash2 size={13} />
                          <span>سڕینەوە</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {selectedVanInventory.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-slate-400 text-xs">
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
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Printer className="text-indigo-600" size={20} />
                مێژووی وەسڵەکانی بارکردن و ڕادەستکردن
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                دەتوانیت وەسڵەکان چاپ بکەیتەوە، دەستکاریان بکەیت، یان بیسڕیتەوە
              </p>
            </div>
            <div className="text-xs text-slate-500 font-bold bg-slate-100 px-3 py-1.5 rounded-lg">
              کۆی وەسڵەکان: {transfers.length}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 text-slate-500 text-xs font-bold">
                <tr>
                  <th className="p-3">ژمارەی پسوڵە</th>
                  <th className="p-3">کاشڤان / مەندووب</th>
                  <th className="p-3">بەروار و کات</th>
                  <th className="p-3">بڕی کاڵاکان</th>
                  <th className="p-3">کۆی گشتی بڕی پارە</th>
                  <th className="p-3 text-center">کردارەکان</th>
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
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => printTransferReceipt(t)}
                          title="چاپکردنی پسوڵە"
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 font-bold rounded-lg transition text-xs flex items-center gap-1"
                        >
                          <Printer size={14} />
                          <span>چاپ</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditTransfer(t)}
                          title="دەستکاریکردنی وەسڵ"
                          className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-700 font-bold rounded-lg transition text-xs flex items-center gap-1 border border-amber-200 hover:border-amber-600"
                        >
                          <Edit2 size={14} />
                          <span>دەستکاری</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingTransfer(t)}
                          title="سڕینەوەی وەسڵ"
                          className="px-2.5 py-1.5 bg-red-50 hover:bg-red-600 hover:text-white text-red-700 font-bold rounded-lg transition text-xs flex items-center gap-1 border border-red-200 hover:border-red-600"
                        >
                          <Trash2 size={14} />
                          <span>سڕینەوە</span>
                        </button>
                      </div>
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

      {/* Modal: Edit Transfer */}
      {editingTransfer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="p-4 bg-amber-50 border-b border-amber-200 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-amber-900 text-sm flex items-center gap-2">
                  <Edit2 size={18} className="text-amber-600" />
                  دەستکاریکردنی وەسڵی بارکردن ({editingTransfer.transferNo || 'TRF'})
                </h4>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  کاشڤان: {editingTransfer.cashvanName} | بەروار: {format(editingTransfer.date, 'yyyy/MM/dd HH:mm')}
                </p>
              </div>
              <button onClick={() => setEditingTransfer(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Cashvan Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ناوی کاشڤان / مەندووب</label>
                <select
                  value={editCashvanName}
                  onChange={(e) => setEditCashvanName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  {cashvans.map((c, i) => (
                    <option key={i} value={c.name}>{c.isRep ? '👤' : '🚚'} {c.name}</option>
                  ))}
                  {editCashvanName && !cashvans.some(c => c.name === editCashvanName) && (
                    <option value={editCashvanName}>{editCashvanName}</option>
                  )}
                </select>
              </div>

              {/* Items in Current Transfer */}
              <div>
                <h5 className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                  <span>کاڵاکانی ناو وەسڵەکە ({editItems.length})</span>
                  <span className="text-amber-700">
                    کۆی گشتی: {editItems.reduce((acc, it) => acc + (it.price * it.quantity), 0).toLocaleString()} د.ع
                  </span>
                </h5>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">ناوی کاڵا</th>
                        <th className="p-2.5 text-center">یەکە</th>
                        <th className="p-2.5 text-center w-28">بڕ (دانە/کارتۆن)</th>
                        <th className="p-2.5 text-center">نرخی تاک</th>
                        <th className="p-2.5 text-center">کۆ</th>
                        <th className="p-2.5 text-center">سڕینەوە</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {editItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-2.5 font-bold text-slate-800">{item.name}</td>
                          <td className="p-2.5 text-center">
                            <select
                              value={item.unit}
                              onChange={(e) => handleUpdateEditItemQuantity(idx, item.quantity, e.target.value as 'carton' | 'packet')}
                              className="border border-slate-200 rounded-lg p-1 text-[11px] font-bold bg-white"
                            >
                              <option value="carton">کارتۆن</option>
                              <option value="packet">پاکەت</option>
                            </select>
                          </td>
                          <td className="p-2.5 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleUpdateEditItemQuantity(idx, parseInt(e.target.value) || 0)}
                              className="w-20 border border-slate-300 rounded-lg p-1.5 text-center font-bold text-slate-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                          </td>
                          <td className="p-2.5 text-center font-mono font-semibold text-slate-700" dir="ltr">
                            {item.price.toLocaleString()} د.ع
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold text-amber-800" dir="ltr">
                            {(item.price * item.quantity).toLocaleString()} د.ع
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveEditItem(idx)}
                              className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {editItems.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-slate-400 text-xs">
                            هیچ کاڵایەک لە وەسڵەکە نەماوە، دەتوانیت لە خوارەوە کاڵا زیاد بکەیت
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add More Items from Warehouse */}
              <div className="pt-3 border-t border-slate-200">
                <h5 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <Plus size={14} className="text-emerald-600" />
                  زیادکردنی کاڵای نوێ بۆ ئەم وەسڵە لە کۆگاوە
                </h5>
                <div className="relative mb-2">
                  <Search size={14} className="absolute right-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="گەڕان بەدوای کاڵای کۆگا..."
                    value={editSearchTerm}
                    onChange={(e) => setEditSearchTerm(e.target.value)}
                    className="w-full pr-8 pl-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50">
                  {items
                    .filter(i => !editSearchTerm || i.name.toLowerCase().includes(editSearchTerm.toLowerCase()) || (i.barcode && i.barcode.includes(editSearchTerm)))
                    .slice(0, 10)
                    .map((item) => (
                      <div key={item.id} className="p-2 flex items-center justify-between hover:bg-white text-xs">
                        <div>
                          <div className="font-bold text-slate-800">{item.name}</div>
                          <div className="text-[10px] text-slate-500">
                            مەخزەن: {item.quantity || 0} | بارکۆد: {item.barcode || '—'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddEditItem(item)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition"
                        >
                          <Plus size={12} />
                          زیادکردن
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div className="text-xs text-slate-600">
                ⚠️ لەکاتی پاشەکەوتکردن بڕی کۆگا و مەخزەنی کاشڤانەکە بەپێی گۆڕانکارییەکان نوێ دەکرێتەوە.
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTransfer(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition"
                >
                  پەشیمانبوونەوە
                </button>
                <button
                  type="button"
                  disabled={isProcessing || editItems.length === 0}
                  onClick={handleSaveEditTransfer}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
                >
                  <Check size={16} />
                  <span>{isProcessing ? 'خەریکی پاشەکەوتکردن...' : 'پاشەکەوتکردنی دەستکارییەکان'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Confirmation */}
      {deletingTransfer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="p-5 text-center space-y-3">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
                <AlertTriangle size={24} />
              </div>
              <h4 className="font-bold text-slate-900 text-base">
                سڕینەوەی وەسڵی بارکردن
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                ئایا دڵنیایت لە سڕینەوەی وەسڵی ژمارە <span className="font-mono font-bold text-indigo-700" dir="ltr">{deletingTransfer.transferNo || 'TRF'}</span> تایبەت بە <span className="font-bold text-slate-800">{deletingTransfer.cashvanName}</span>؟
              </p>
              <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-right text-[11px] text-red-800 font-semibold space-y-1">
                <div>• سەرجەم کاڵاکانی ئەم وەسڵە ({deletingTransfer.items.reduce((a, b) => a + b.quantity, 0)} دانە) دەگەڕێندرێنەوە سەر کۆگای سەرەکی.</div>
                <div>• لە مەخزەنی نێو ڤانی کاشڤانەکەش کەمدەکرێنەوە.</div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingTransfer(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition"
              >
                پەشیمانبوونەوە
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleDeleteTransfer}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
              >
                <Trash2 size={16} />
                <span>{isProcessing ? 'خەریکی سڕینەوە...' : 'بەڵێ، بیسڕەوە'}</span>
              </button>
            </div>
          </div>
        </div>
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

      {/* Modal: Edit Requisition (Pre-order) */}
      {editingRequisition && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="p-4 bg-amber-50 border-b border-amber-200 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-amber-900 text-sm flex items-center gap-2">
                  <Edit2 size={18} className="text-amber-600" />
                  دەستکاریکردنی تەڵەبیە و داواکاری پێشوەختە
                </h4>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  کاشڤان: {editingRequisition.cashvanName} | بەروار: {format(editingRequisition.createdAt, 'yyyy/MM/dd HH:mm')}
                </p>
              </div>
              <button onClick={() => setEditingRequisition(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Status and Cashvan Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ناوی کاشڤان / داواکار</label>
                  <select
                    value={editReqCashvanName}
                    onChange={(e) => setEditReqCashvanName(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    {cashvans.map((c, i) => (
                      <option key={i} value={c.name}>{c.isRep ? '👤' : '🚚'} {c.name}</option>
                    ))}
                    {editReqCashvanName && !cashvans.some(c => c.name === editReqCashvanName) && (
                      <option value={editReqCashvanName}>{editReqCashvanName}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">دۆخی داواکاری</label>
                  <select
                    value={editReqStatus}
                    onChange={(e) => setEditReqStatus(e.target.value as any)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    <option value="pending">⏳ چاوەڕوان (Pending)</option>
                    <option value="preparing">⚙️ لە ئامادەکردندایە (Preparing)</option>
                    <option value="completed">✅ بارکرا بۆ ڤان (Completed)</option>
                  </select>
                </div>
              </div>

              {/* Items in Current Requisition */}
              <div>
                <h5 className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                  <span>کاڵاکانی ناو داواکارییەکە ({editReqItems.length})</span>
                  <span className="text-indigo-700 font-bold">
                    کۆی بڕ: {editReqItems.reduce((acc, it) => acc + (it.quantity || 0), 0)} دانە / کارتۆن
                  </span>
                </h5>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">ناوی کاڵا</th>
                        <th className="p-2.5 text-center">یەکە</th>
                        <th className="p-2.5 text-center w-28">بڕی داواکراو</th>
                        <th className="p-2.5 text-center">سڕینەوە</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {editReqItems.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-800">{it.name}</td>
                          <td className="p-2.5 text-center">
                            <select
                              value={it.unit}
                              onChange={(e) => handleUpdateEditReqItemQty(idx, it.quantity, e.target.value as 'carton' | 'packet')}
                              className="border border-slate-200 rounded-lg p-1 text-xs font-bold bg-white outline-none"
                            >
                              <option value="carton">کارتۆن</option>
                              <option value="packet">پاکەت</option>
                            </select>
                          </td>
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleUpdateEditReqItemQty(idx, it.quantity - 1)}
                                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={it.quantity}
                                onChange={(e) => handleUpdateEditReqItemQty(idx, parseInt(e.target.value) || 1)}
                                className="w-12 text-center font-bold border border-slate-200 rounded-lg py-1 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateEditReqItemQty(idx, it.quantity + 1)}
                                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleUpdateEditReqItemQty(idx, 0)}
                              className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {editReqItems.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center py-6 text-slate-400 text-xs">
                            هیچ کاڵایەک لە داواکارییەکەدا نەماوە
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add More Items to Requisition */}
              <div className="border-t border-slate-200 pt-4">
                <label className="block text-xs font-bold text-slate-700 mb-2">زیادکردنی کاڵای تر بۆ داواکارییەکە</label>
                <div className="relative mb-2">
                  <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="گەڕان بەدوای کاڵادا بۆ زیادکردن..."
                    value={editReqSearchTerm}
                    onChange={(e) => setEditReqSearchTerm(e.target.value)}
                    className="w-full pr-9 pl-4 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {items
                    .filter(i => (i.name || '').toLowerCase().includes(editReqSearchTerm.toLowerCase()))
                    .slice(0, 8)
                    .map(it => (
                      <div key={it.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50 text-xs">
                        <div className="font-bold text-slate-800">{it.name}</div>
                        <button
                          type="button"
                          onClick={() => handleAddEditReqItem(it)}
                          className="px-3 py-1 bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-700 rounded-lg font-bold border border-amber-200 hover:border-amber-600 transition flex items-center gap-1"
                        >
                          <Plus size={14} />
                          زیادکردن
                        </button>
                      </div>
                    ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تێبینی کاشڤان / داواکاری</label>
                <textarea
                  rows={2}
                  value={editReqNotes}
                  onChange={(e) => setEditReqNotes(e.target.value)}
                  placeholder="تێبینی بنووسە..."
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingRequisition(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition"
              >
                پەشیمانبوونەوە
              </button>
              <button
                type="button"
                disabled={isProcessing || editReqItems.length === 0}
                onClick={handleSaveEditRequisition}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
              >
                <Check size={16} />
                <span>{isProcessing ? 'خەریکی پاشەکەوتکردن...' : 'پاشەکەوتکردنی دەستکارییەکان'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Requisition Confirmation */}
      {deletingRequisition && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="p-5 text-center space-y-3">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
                <AlertTriangle size={24} />
              </div>
              <h4 className="font-bold text-slate-900 text-base">
                سڕینەوەی تەڵەبیەی پێشوەختە
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                ئایا دڵنیایت لە سڕینەوەی ئەم داواکارییە پێشوەختەیە کە لەلایەن <span className="font-bold text-slate-800">{deletingRequisition.cashvanName}</span> نێردراوە؟
              </p>
              <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-right text-[11px] text-red-800 font-semibold space-y-1">
                <div>• ژمارەی کاڵاکانی داواکراو: {deletingRequisition.items.reduce((a, b) => a + b.quantity, 0)} دانە / کارتۆن ({deletingRequisition.items.length} جۆر).</div>
                <div>• ئەم کردارە ناگەڕێتەوە و داواکارییەکە لە سیستەم لادەبرێت.</div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingRequisition(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition"
              >
                پەشیمانبوونەوە
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleDeleteRequisition}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
              >
                <Trash2 size={16} />
                <span>{isProcessing ? 'خەریکی سڕینەوە...' : 'بەڵێ، بیسڕەوە'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Van Item Confirmation */}
      {deletingVanItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="p-5 text-center space-y-3">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 size={24} />
              </div>
              <h4 className="font-bold text-slate-900 text-base">
                سڕینەوەی کاڵا لەناو ڤان
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                ئایا دڵنیایت لە سڕینەوەی کاڵای <strong className="text-slate-900">{deletingVanItem.name}</strong> (بڕی {deletingVanItem.quantity} {deletingVanItem.unit === 'packet' ? 'پاکەت' : 'کارتۆن'}) لەناو ڤانی <span className="font-bold text-indigo-700">{deletingVanItem.cashvanName || selectedCashvan}</span>؟
              </p>
              
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-right">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={returnToWarehouseOnDelete}
                    onChange={(e) => setReturnToWarehouseOnDelete(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <span>بڕی ئەم کاڵایە بگەڕێنرێتەوە سەر کۆگای سەرەکی (+{deletingVanItem.quantity})</span>
                </label>
                <p className="text-[11px] text-slate-500 mt-1 mr-6">
                  ئەگەر ئەم هەڵبژاردنە چالاک بێت، مەخزەنی کۆگای سەرەکی بە بڕی ئەم کاڵایە زیاد دەکرێت.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingVanItem(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition"
              >
                پەشیمانبوونەوە
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleDeleteVanItem}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
              >
                <Trash2 size={16} />
                <span>{isProcessing ? 'خەریکی سڕینەوە...' : 'بەڵێ، بیسڕەوە'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
