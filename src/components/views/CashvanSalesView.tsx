import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { CashvanRequisition, Item, CashvanReturn, CashvanReturnItem } from '../../types';
import { Search, Plus, Send, Clock, CheckCircle2, Truck, ClipboardList, Package, Layers, RotateCcw, Printer, Edit2, Trash2, X, AlertTriangle, Check } from 'lucide-react';
import { format } from 'date-fns';

export default function CashvanSalesView({ onlyPreorder = false }: { onlyPreorder?: boolean }) {
  const [inventory, setInventory] = useState<any[]>([]);
  const [warehouseItems, setWarehouseItems] = useState<Item[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [myRequisitions, setMyRequisitions] = useState<CashvanRequisition[]>([]);
  const [returns, setReturns] = useState<CashvanReturn[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Active view tab: inventory vs returns vs preorder vs requisitions history
  const [activeTab, setActiveTab] = useState<'inventory' | 'returns' | 'preorder' | 'history'>(
    onlyPreorder ? 'preorder' : 'inventory'
  );

  // Pre-order state
  const [preOrderCart, setPreOrderCart] = useState<{ item: Item; quantity: number; unit: 'carton' | 'packet' }[]>([]);
  const [preOrderNotes, setPreOrderNotes] = useState('');
  const [preOrderSearch, setPreOrderSearch] = useState('');

  // Return to warehouse state
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnCart, setReturnCart] = useState<{ vanItem: any; quantity: number; unit: 'carton' | 'packet'; price: number }[]>([]);
  const [returnNotes, setReturnNotes] = useState('');
  const [returnSearch, setReturnSearch] = useState('');

  // Edit Return State
  const [editingReturn, setEditingReturn] = useState<CashvanReturn | null>(null);
  const [editReturnItems, setEditReturnItems] = useState<CashvanReturnItem[]>([]);
  const [editReturnNotes, setEditReturnNotes] = useState('');
  const [editReturnSearch, setEditReturnSearch] = useState('');

  // Delete Return State
  const [deletingReturn, setDeletingReturn] = useState<CashvanReturn | null>(null);

  // Identify driver / cashvan
  const defaultUserName = auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'کاشڤان';
  const [activeCashvanName, setActiveCashvanName] = useState<string>(defaultUserName);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubUser = onSnapshot(
      doc(db, 'users', auth.currentUser.uid),
      (docSnap) => {
        if (docSnap.exists() && docSnap.data().name) {
          setActiveCashvanName(docSnap.data().name);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'users');
      }
    );
    return () => unsubUser();
  }, []);

  useEffect(() => {
    const unsubWH = onSnapshot(
      query(collection(db, 'items')),
      (snap) => {
        const itemsData: Item[] = [];
        snap.forEach(d => itemsData.push({ id: d.id, ...d.data() } as Item));
        setWarehouseItems(itemsData);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'items');
      }
    );

    return () => {
      unsubWH();
    };
  }, []);

  useEffect(() => {
    if (!activeCashvanName) return;

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
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'cashvan_inventory');
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

    const unsubReturns = onSnapshot(
      query(collection(db, 'cashvan_returns'), where('cashvanName', '==', activeCashvanName)),
      (snapshot) => {
        const data: CashvanReturn[] = [];
        snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as CashvanReturn));
        setReturns(data.sort((a, b) => b.date - a.date));
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'cashvan_returns');
      }
    );

    return () => {
      unsubInv();
      unsubReqs();
      unsubReturns();
    };
  }, [activeCashvanName]);

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => 
      item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.barcode?.includes(searchTerm)
    );
  }, [inventory, searchTerm]);

  const filteredWarehouseItems = useMemo(() => {
    return warehouseItems.filter(item => 
      item.name?.toLowerCase().includes(preOrderSearch.toLowerCase()) ||
      item.barcode?.includes(preOrderSearch)
    );
  }, [warehouseItems, preOrderSearch]);

  const filteredVanForReturn = useMemo(() => {
    return inventory.filter(item =>
      item.name?.toLowerCase().includes(returnSearch.toLowerCase()) ||
      item.barcode?.includes(returnSearch)
    );
  }, [inventory, returnSearch]);

  // Pre-order helpers
  const addPreOrderItem = (item: Item) => {
    const existing = preOrderCart.find(c => c.item.id === item.id);
    if (existing) {
      setPreOrderCart(preOrderCart.map(c => c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      const defaultUnit = item.packetSellingPrice && !item.cartonSellingPrice ? 'packet' : 'carton';
      setPreOrderCart([...preOrderCart, { item, quantity: 1, unit: defaultUnit }]);
    }
  };

  const updatePreOrderQty = (itemId: string, quantity: number, unit?: 'carton' | 'packet') => {
    if (quantity <= 0) {
      setPreOrderCart(preOrderCart.filter(c => c.item.id !== itemId));
    } else {
      setPreOrderCart(preOrderCart.map(c => c.item.id === itemId ? { ...c, quantity, unit: unit || c.unit } : c));
    }
  };

  const handleSendPreOrder = async () => {
    if (preOrderCart.length === 0) return;
    setIsProcessing(true);
    try {
      const reqItems = preOrderCart.map(c => ({
        itemId: c.item.id,
        name: c.item.name,
        quantity: c.quantity,
        unit: c.unit,
        price: c.unit === 'packet' ? (c.item.packetSellingPrice || c.item.sellingPrice || 0) : (c.item.cartonSellingPrice || c.item.sellingPrice || 0)
      }));

      const requisitionNo = `REQ-${Date.now().toString().slice(-6)}`;

      await addDoc(collection(db, 'cashvan_requisitions'), {
        requisitionNo,
        cashvanName: activeCashvanName,
        cashvanId: auth.currentUser?.uid || '',
        items: reqItems,
        notes: preOrderNotes.trim(),
        status: 'pending',
        createdAt: Date.now()
      });

      setPreOrderCart([]);
      setPreOrderNotes('');
      setActiveTab('history');
      alert('داواکارییەکەت (تەڵەبیە) بە سەرکەوتوویی نێردرا بۆ کۆگای سەرەکی!');
    } catch (error) {
      console.error('Error creating cashvan requisition:', error);
      alert('هەڵەیەک ڕوویدا لە ناردنی داواکاری!');
    } finally {
      setIsProcessing(false);
    }
  };

  // Return to Warehouse Handlers
  const addReturnItem = (vanItem: any) => {
    const existing = returnCart.find(c => (c.vanItem.itemId || c.vanItem.id) === (vanItem.itemId || vanItem.id));
    if (existing) {
      if (existing.quantity < (vanItem.quantity || 0)) {
        setReturnCart(returnCart.map(c => (c.vanItem.itemId || c.vanItem.id) === (vanItem.itemId || vanItem.id) ? { ...c, quantity: c.quantity + 1 } : c));
      } else {
        alert('بڕی دیاریکراو ناتوانێت لە بڕی بەردەست لەناو ڤان زیاتر بێت');
      }
    } else {
      const unit = vanItem.unit || 'carton';
      const price = vanItem.sellingPrice || vanItem.price || 0;
      setReturnCart([...returnCart, { vanItem, quantity: 1, unit, price }]);
    }
  };

  const updateReturnQty = (itemId: string, quantity: number, unit?: 'carton' | 'packet') => {
    const itemInVan = inventory.find(i => (i.itemId || i.id) === itemId);
    const maxQty = itemInVan?.quantity || 9999;
    if (quantity <= 0) {
      setReturnCart(returnCart.filter(c => (c.vanItem.itemId || c.vanItem.id) !== itemId));
    } else if (quantity > maxQty) {
      alert(`بڕی بەردەست لەناو ڤان تەنها ${maxQty} دانەیە`);
      setReturnCart(returnCart.map(c => (c.vanItem.itemId || c.vanItem.id) === itemId ? { ...c, quantity: maxQty, unit: unit || c.unit } : c));
    } else {
      setReturnCart(returnCart.map(c => (c.vanItem.itemId || c.vanItem.id) === itemId ? { ...c, quantity, unit: unit || c.unit } : c));
    }
  };

  const handleProcessReturn = async () => {
    if (returnCart.length === 0) return;
    setIsProcessing(true);

    try {
      const returnNo = `RET-${Date.now().toString().slice(-6)}`;
      const returnItems: CashvanReturnItem[] = returnCart.map(c => ({
        itemId: c.vanItem.itemId || c.vanItem.id,
        name: c.vanItem.name,
        quantity: c.quantity,
        unit: c.unit,
        price: c.price,
        barcode: c.vanItem.barcode || ''
      }));

      const totalValue = returnItems.reduce((acc, it) => acc + (it.price * it.quantity), 0);

      // 1. Update Van Inventory (deduct returned quantities)
      for (const rItem of returnCart) {
        const itemId = rItem.vanItem.itemId || rItem.vanItem.id;
        const vanInvDocId = `${activeCashvanName}_${itemId}`;
        const vanDocRef = doc(db, 'cashvan_inventory', vanInvDocId);
        const vanDocSnap = await getDoc(vanDocRef);
        
        if (vanDocSnap.exists()) {
          const currentQty = vanDocSnap.data().quantity || 0;
          const newQty = Math.max(0, currentQty - rItem.quantity);
          await updateDoc(vanDocRef, {
            quantity: newQty,
            lastUpdated: Date.now()
          });
        }

        // 2. Increase Warehouse items collection
        const whItemRef = doc(db, 'items', itemId);
        const whItemSnap = await getDoc(whItemRef);
        if (whItemSnap.exists()) {
          const whData = whItemSnap.data();
          const currentWHQty = whData.quantity || 0;
          const updatePayload: any = { quantity: currentWHQty + rItem.quantity };
          if (rItem.unit === 'carton' && whData.cartonQuantity !== undefined) {
            updatePayload.cartonQuantity = (whData.cartonQuantity || 0) + rItem.quantity;
          } else if (rItem.unit === 'packet' && whData.packetQuantity !== undefined) {
            updatePayload.packetQuantity = (whData.packetQuantity || 0) + rItem.quantity;
          }
          await updateDoc(whItemRef, updatePayload);
        }
      }

      // 3. Save Cashvan Return Record
      const newReturnRecord: CashvanReturn = {
        id: '',
        returnNo,
        cashvanName: activeCashvanName,
        cashvanId: auth.currentUser?.uid || '',
        items: returnItems,
        totalValue,
        date: Date.now(),
        notes: returnNotes.trim()
      };

      const docRef = await addDoc(collection(db, 'cashvan_returns'), newReturnRecord);
      newReturnRecord.id = docRef.id;

      setReturnCart([]);
      setReturnNotes('');
      setIsReturnModalOpen(false);
      setActiveTab('returns');

      alert('کاڵاکان بە سەرکەوتوویی گەڕێندرانەوە بۆ کۆگای سەرەکی و وەسڵی گەڕانەوە تۆمار کرا!');
      printReturnReceipt(newReturnRecord);
    } catch (error) {
      console.error('Error processing return:', error);
      alert('هەڵەیەک ڕوویدا لە گەڕاندنەوەی کاڵا بۆ کۆگا');
    } finally {
      setIsProcessing(false);
    }
  };

  // Print Return Voucher
  const printReturnReceipt = (ret: CashvanReturn) => {
    let totalItemsCount = 0;
    const itemsHtml = ret.items.map((item, idx) => {
      const unitLabel = item.unit === 'packet' ? 'پاکەت' : 'کارتۆن';
      totalItemsCount += item.quantity || 0;
      return `
        <tr>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px;">${idx + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">${item.name}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; font-size: 14px;">${item.quantity}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px;">${unitLabel}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ckb">
        <head>
          <meta charset="utf-8">
          <title>وەسڵی گەڕاندنەوەی کاڵا بۆ کۆگا - ${ret.cashvanName}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #1e293b; padding: 20px; line-height: 1.5; }
            .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 24px; color: #0f172a; }
            .header h2 { margin: 5px 0; font-size: 18px; color: #be123c; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; font-size: 14px; background: #fff1f2; padding: 12px; border-radius: 8px; border: 1px solid #fecdd3; }
            .meta-item { display: flex; justify-content: space-between; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px 8px; text-align: right; }
            th { background-color: #f1f5f9; color: #334155; font-weight: bold; }
            .summary-box { padding: 14px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; display: flex; justify-content: space-between; font-size: 15px; font-weight: bold; margin-bottom: 15px; }
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
            <h2>وەسڵی گەڕاندنەوەی کاڵا لە کاشڤانەوە بۆ کۆگای سەرەکی</h2>
            <div style="font-size: 12px; color: #64748b;">پسوڵەی ڕادەستکردنەوەی کاڵای ماوەی ناو ڤان بە هەمان شێوازی وەرگیراو</div>
          </div>

          <div class="meta-grid">
            <div class="meta-item"><span>کاشڤان / ڕادەستکار:</span> <strong>${ret.cashvanName}</strong></div>
            <div class="meta-item"><span>ژمارەی پسوڵەی گەڕانەوە:</span> <strong dir="ltr">${ret.returnNo || ('RET-' + ret.id.slice(-6))}</strong></div>
            <div class="meta-item"><span>بەروار و کات:</span> <span dir="ltr">${format(ret.date, 'yyyy/MM/dd - HH:mm')}</span></div>
            <div class="meta-item"><span>جۆری پسوڵە:</span> <strong style="color: #be123c;">گەڕاندنەوە بۆ کۆگا</strong></div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th>ناوی کاڵای گەڕاوە</th>
                <th style="text-align: center; width: 110px;">بڕی گەڕاوە</th>
                <th style="text-align: center; width: 90px;">یەکە</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="summary-box">
            <span>کۆی گشتی بڕی کاڵا گەڕاوەکان:</span>
            <span dir="ltr" style="color: #be123c;">${totalItemsCount} دانە</span>
          </div>

          ${ret.notes ? `
            <div class="notes-box">
              <strong>تێبینی گەڕاندنەوە:</strong> ${ret.notes}
            </div>
          ` : ''}

          <div class="signatures">
            <div>
              <div>واژۆی کاشڤان (ڕادەستکاری کاڵا)</div>
              <div class="sig-line">${ret.cashvanName}</div>
            </div>
            <div>
              <div>واژۆی بەرپرسی کۆگا (وەرگری کاڵا)</div>
              <div class="sig-line">ناو و واژۆی کۆگادار</div>
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

  // Edit Return Handlers
  const openEditReturn = (ret: CashvanReturn) => {
    setEditingReturn(ret);
    setEditReturnItems(ret.items.map(it => ({ ...it })));
    setEditReturnNotes(ret.notes || '');
    setEditReturnSearch('');
  };

  const handleUpdateEditReturnItemQty = (index: number, newQty: number, newUnit?: 'carton' | 'packet') => {
    if (newQty <= 0) {
      setEditReturnItems(prev => prev.filter((_, idx) => idx !== index));
      return;
    }
    setEditReturnItems(prev => prev.map((item, idx) => {
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

  const handleAddEditReturnItem = (vanItem: any) => {
    setEditReturnItems(prev => {
      const itemId = vanItem.itemId || vanItem.id;
      const existingIdx = prev.findIndex(p => p.itemId === itemId);
      if (existingIdx >= 0) {
        return prev.map((p, idx) => idx === existingIdx ? { ...p, quantity: p.quantity + 1 } : p);
      }
      return [...prev, {
        itemId,
        name: vanItem.name,
        quantity: 1,
        unit: vanItem.unit || 'carton',
        price: vanItem.sellingPrice || vanItem.price || 0,
        barcode: vanItem.barcode || ''
      }];
    });
  };

  const handleSaveEditReturn = async () => {
    if (!editingReturn) return;
    if (editReturnItems.length === 0) {
      alert('تکایە لانیکەم یەک کاڵا لە وەسڵی گەڕانەوەدا بهێڵەرەوە');
      return;
    }

    setIsProcessing(true);
    try {
      // Reconcile differences with van inventory and warehouse
      const oldItemsMap = new Map<string, number>(editingReturn.items.map(i => [i.itemId, i.quantity]));
      const newItemsMap = new Map<string, number>(editReturnItems.map(i => [i.itemId, i.quantity]));
      const allItemIds: string[] = Array.from(new Set<string>([...oldItemsMap.keys(), ...newItemsMap.keys()]));

      for (const itId of allItemIds) {
        const oldQty = Number(oldItemsMap.get(itId) || 0);
        const newQty = Number(newItemsMap.get(itId) || 0);
        const diff = newQty - oldQty; // if diff > 0, more returned (deduct from van, add to warehouse). if diff < 0, less returned.

        if (diff !== 0) {
          // Van inventory adjustment
          const vanDocId = `${activeCashvanName}_${itId}`;
          const vanRef = doc(db, 'cashvan_inventory', vanDocId);
          const vanSnap = await getDoc(vanRef);
          if (vanSnap.exists()) {
            const curVanQty = vanSnap.data().quantity || 0;
            await updateDoc(vanRef, {
              quantity: Math.max(0, curVanQty - diff),
              lastUpdated: Date.now()
            });
          }

          // Warehouse items adjustment
          const whRef = doc(db, 'items', itId);
          const whSnap = await getDoc(whRef);
          if (whSnap.exists()) {
            const whData = whSnap.data();
            const curWHQty = whData.quantity || 0;
            const itemObj = editReturnItems.find(i => i.itemId === itId) || editingReturn.items.find(i => i.itemId === itId);
            const unit = itemObj?.unit || 'carton';
            const updatePayload: any = { quantity: curWHQty + diff };
            if (unit === 'carton' && whData.cartonQuantity !== undefined) {
              updatePayload.cartonQuantity = (whData.cartonQuantity || 0) + diff;
            } else if (unit === 'packet' && whData.packetQuantity !== undefined) {
              updatePayload.packetQuantity = (whData.packetQuantity || 0) + diff;
            }
            await updateDoc(whRef, updatePayload);
          }
        }
      }

      const totalValue = editReturnItems.reduce((acc, it) => acc + (it.price * it.quantity), 0);

      await updateDoc(doc(db, 'cashvan_returns', editingReturn.id), {
        items: editReturnItems,
        totalValue,
        notes: editReturnNotes.trim(),
        lastEditedAt: Date.now()
      });

      setEditingReturn(null);
      alert('وەسڵی گەڕانەوە بە سەرکەوتوویی دەستکاری کرا!');
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە دەستکاریکردنی وەسڵی گەڕانەوە');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteReturn = async () => {
    if (!deletingReturn) return;
    setIsProcessing(true);
    try {
      // Revert items: add back to van, deduct from warehouse
      for (const it of deletingReturn.items) {
        // Van inventory
        const vanDocId = `${activeCashvanName}_${it.itemId}`;
        const vanRef = doc(db, 'cashvan_inventory', vanDocId);
        const vanSnap = await getDoc(vanRef);
        if (vanSnap.exists()) {
          const curVanQty = vanSnap.data().quantity || 0;
          await updateDoc(vanRef, {
            quantity: curVanQty + it.quantity,
            lastUpdated: Date.now()
          });
        }

        // Warehouse item
        const whRef = doc(db, 'items', it.itemId);
        const whSnap = await getDoc(whRef);
        if (whSnap.exists()) {
          const whData = whSnap.data();
          const curWHQty = whData.quantity || 0;
          const updatePayload: any = { quantity: Math.max(0, curWHQty - it.quantity) };
          if (it.unit === 'carton' && whData.cartonQuantity !== undefined) {
            updatePayload.cartonQuantity = Math.max(0, (whData.cartonQuantity || 0) - it.quantity);
          } else if (it.unit === 'packet' && whData.packetQuantity !== undefined) {
            updatePayload.packetQuantity = Math.max(0, (whData.packetQuantity || 0) - it.quantity);
          }
          await updateDoc(whRef, updatePayload);
        }
      }

      await deleteDoc(doc(db, 'cashvan_returns', deletingReturn.id));
      setDeletingReturn(null);
      alert('وەسڵی گەڕانەوە بە سەرکەوتوویی سڕایەوە و کاڵاکان گەڕێندرانەوە بۆ ناو ڤان!');
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە سڕینەوەی وەسڵی گەڕانەوە');
    } finally {
      setIsProcessing(false);
    }
  };

  const totalVanPieces = inventory.reduce((a, b) => a + (b.quantity || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner & Van Profile */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Truck size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-800">
                {onlyPreorder ? 'تەڵەبیەی پێشوەختەی کاشڤان لە کۆگا' : 'کۆگای ڤان، داواکاری و گەڕاندنەوە بۆ کۆگا'}
              </h2>
              <span className="bg-indigo-100 text-indigo-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                🚚 {activeCashvanName}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {onlyPreorder 
                ? 'داواکردنی کاڵا بەشێوەی پێشوەختە لە کۆگای سەرەکی و بینینی مێژووی داواکارییەکان' 
                : `مەخزەنی ناو ڤان: ${totalVanPieces} دانە لە ${inventory.length} جۆر کاڵا`}
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 flex-wrap">
          {!onlyPreorder && (
            <>
              <button
                onClick={() => setActiveTab('inventory')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'inventory'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                <Package size={15} />
                <span>کاڵاکانی ناو ڤان</span>
                <span className="bg-indigo-100 text-indigo-900 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {inventory.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('returns')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'returns'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                <RotateCcw size={15} />
                <span>گەڕاندنەوە بۆ کۆگا</span>
                <span className="bg-rose-100 text-rose-900 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {returns.length}
                </span>
              </button>
            </>
          )}

          <button
            onClick={() => setActiveTab('preorder')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'preorder'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Send size={15} />
            <span>داواکاری لە کۆگا (تەڵەبیە)</span>
            {preOrderCart.length > 0 && (
              <span className="bg-amber-400 text-slate-900 text-[10px] px-1.5 py-0.2 rounded-full font-black">
                {preOrderCart.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <ClipboardList size={15} />
            <span>مێژووی داواکارییەکان</span>
            <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {myRequisitions.length}
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: Van Inventory List */}
      {activeTab === 'inventory' && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                <Truck className="text-indigo-600" size={18} />
                کاڵاکانی بەردەست لەناو ڤانی ({activeCashvanName})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تەواوی ئەو کاڵایانەی لە کۆگای سەرەکییەوە بارکراون بۆ ناو ڤانەکەت
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setIsReturnModalOpen(true)}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-rose-200 hover:border-rose-600 shadow-2xs whitespace-nowrap"
              >
                <RotateCcw size={15} />
                <span>گەڕاندنەوەی کاڵا بۆ کۆگا</span>
              </button>

              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="گەڕان بەپێی کاڵا یان بارکۆد..."
                  className="w-full pl-3 pr-8 py-2 border border-slate-200 bg-slate-50 focus:bg-white rounded-xl outline-none focus:border-indigo-500 text-xs transition"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search className="absolute right-2.5 top-2.5 text-slate-400" size={15} />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-400 text-xs font-bold">
              خەریکی هێنانی کاڵاکانی ناو ڤانە...
            </div>
          ) : filteredInventory.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 space-y-2">
              <Layers size={32} className="mx-auto text-slate-400" />
              <div className="font-bold text-sm">هیچ کاڵایەک لەناو ڤاندا نییە</div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                دەتوانیت لە تابی "داواکاری لە کۆگا" داوای بارکردنی کاڵا لە کۆگا بکەیت تاوەکو باری ڤانەکەت بکرێت.
              </p>
              <button
                onClick={() => setActiveTab('preorder')}
                className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
              >
                <Send size={14} />
                <span>داواکردنی کاڵا لە کۆگا</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredInventory.map(item => {
                const currentUnit = item.unit === 'packet' ? 'پاکەت' : 'کارتۆن';
                const price = item.unit === 'packet'
                  ? (item.packetSellingPrice || item.sellingPrice || item.price || 0)
                  : (item.cartonSellingPrice || item.sellingPrice || item.price || 0);

                return (
                  <div
                    key={item.id}
                    className="p-4 border border-slate-200 rounded-xl bg-white flex flex-col justify-between shadow-2xs hover:border-indigo-400 transition group"
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <div className="font-bold text-sm text-slate-800 line-clamp-1">{item.name}</div>
                        <button
                          type="button"
                          onClick={() => {
                            addReturnItem(item);
                            setIsReturnModalOpen(true);
                          }}
                          title="گەڕاندنەوەی ئەم کاڵایە بۆ کۆگا"
                          className="text-rose-600 hover:bg-rose-50 p-1 rounded-lg text-[11px] font-bold flex items-center gap-1"
                        >
                          <RotateCcw size={13} />
                          <span>گەڕاندنەوە</span>
                        </button>
                      </div>
                      {item.barcode && (
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5" dir="ltr">
                          {item.barcode}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex justify-between items-center">
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                        {item.quantity} {currentUnit}
                      </span>
                      <span className="text-xs font-bold text-emerald-700 font-mono" dir="ltr">
                        {price.toLocaleString()} د.ع
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: Returns to Warehouse History */}
      {activeTab === 'returns' && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <RotateCcw className="text-rose-600" size={18} />
                وەسڵەکانی گەڕاندنەوەی کاڵا بۆ کۆگای سەرەکی
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                مێژووی سەرجەم ئەو کاڵایانەی لە ڤانەکەتەوە گەڕاندووتنەتەوە بۆ کۆگا
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsReturnModalOpen(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition"
            >
              <Plus size={16} />
              <span>گەڕاندنەوەی کاڵای نوێ بۆ کۆگا</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                <tr>
                  <th className="p-3">ژمارەی پسوڵە</th>
                  <th className="p-3">بەروار و کات</th>
                  <th className="p-3">ژمارەی کاڵا گەڕاوەکان</th>
                  <th className="p-3">تێبینی</th>
                  <th className="p-3 text-center">کردارەکان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {returns.map(ret => (
                  <tr key={ret.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3 font-mono font-bold text-rose-700" dir="ltr">
                      {ret.returnNo || ('RET-' + ret.id.slice(-6))}
                    </td>
                    <td className="p-3 text-slate-600" dir="ltr">
                      {format(ret.date, 'yyyy/MM/dd HH:mm')}
                    </td>
                    <td className="p-3 font-bold text-slate-800">
                      {ret.items.reduce((s, i) => s + (i.quantity || 0), 0)} {ret.items[0]?.unit === 'packet' ? 'پاکەت' : 'کارتۆن'} ({ret.items.length} جۆر)
                    </td>
                    <td className="p-3 text-slate-500 truncate max-w-xs">
                      {ret.notes || '-'}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => printReturnReceipt(ret)}
                          title="چاپکردنی وەسڵ"
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-700 hover:text-white text-slate-700 rounded-lg font-bold flex items-center gap-1 transition border border-slate-200"
                        >
                          <Printer size={13} />
                          <span>چاپ</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditReturn(ret)}
                          title="دەستکاریکردنی وەسڵ"
                          className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-700 rounded-lg font-bold flex items-center gap-1 transition border border-amber-200"
                        >
                          <Edit2 size={13} />
                          <span>دەستکاری</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingReturn(ret)}
                          title="سڕینەوەی وەسڵ"
                          className="px-2.5 py-1.5 bg-red-50 hover:bg-red-600 hover:text-white text-red-700 rounded-lg font-bold flex items-center gap-1 transition border border-red-200"
                        >
                          <Trash2 size={13} />
                          <span>سڕینەوە</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {returns.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400">
                      هیچ وەسڵێکی گەڕاندنەوە بۆ کۆگا تۆمار نەکراوە
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Requisitions / Pre-Orders to Warehouse with INLINE + and - Steppers */}
      {activeTab === 'preorder' && (
        <div className="space-y-5 pb-32">
          {/* Header & Search */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
                <Send className="text-indigo-600" size={20} />
                داواکردنی کاڵا لە کۆگای سەرەکی بۆ بارکردن لە ڤان
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                ڕاستەوخۆ لە ڕێگەی نیشانەکانی <strong className="text-indigo-600 font-bold">+</strong> و <strong className="text-indigo-600 font-bold">-</strong> بڕی داواکاری دیاری بکە
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="گەڕان بەپێی ناوی کاڵا یان بارکۆد..."
                className="w-full pl-3 pr-8 py-2 border border-slate-200 bg-slate-50 focus:bg-white rounded-xl outline-none focus:border-indigo-500 text-xs transition"
                value={preOrderSearch}
                onChange={(e) => setPreOrderSearch(e.target.value)}
              />
              <Search className="absolute right-2.5 top-2.5 text-slate-400" size={15} />
            </div>
          </div>

          {/* Grid of Warehouse Items with Direct + and - Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {filteredWarehouseItems.map(item => {
              const cartEntry = preOrderCart.find(c => c.item.id === item.id);
              const currentQty = cartEntry ? cartEntry.quantity : 0;
              const currentUnit = cartEntry ? cartEntry.unit : (item.packetSellingPrice && !item.cartonSellingPrice ? 'packet' : 'carton');
              const itemPrice = currentUnit === 'packet'
                ? (item.packetSellingPrice || item.packetCostPrice || item.sellingPrice || item.price || 0)
                : (item.cartonSellingPrice || item.cartonCostPrice || item.sellingPrice || item.price || 0);
              const subtotal = currentQty * itemPrice;

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl transition-all duration-150 flex flex-col justify-between ${
                    currentQty > 0
                      ? 'bg-indigo-50/40 border-2 border-indigo-500 shadow-sm'
                      : 'bg-white border border-slate-200 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-sm text-slate-900 line-clamp-2 leading-snug">
                        {item.name}
                      </h4>
                      {currentQty > 0 && (
                        <span className="bg-indigo-600 text-white text-[11px] font-mono px-2 py-0.5 rounded-full font-bold shrink-0">
                          {currentQty} {currentUnit === 'packet' ? 'پاکەت' : 'کارتۆن'}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                      <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                        لە کۆگا: <strong className="text-emerald-700 font-mono">{item.quantity || 0}</strong>
                      </span>
                      {item.barcode && (
                        <span className="text-[10px] text-slate-400 font-mono" dir="ltr">
                          {item.barcode}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2">
                    {/* Unit Selector & Price */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[11px] font-bold">
                        <button
                          type="button"
                          onClick={() => {
                            if (currentQty > 0) {
                              updatePreOrderQty(item.id, currentQty, 'carton');
                            }
                          }}
                          className={`px-2 py-1 rounded-md transition ${currentUnit === 'carton' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500'}`}
                        >
                          کارتۆن
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (currentQty > 0) {
                              updatePreOrderQty(item.id, currentQty, 'packet');
                            }
                          }}
                          className={`px-2 py-1 rounded-md transition ${currentUnit === 'packet' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500'}`}
                        >
                          پاکەت
                        </button>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-700 font-mono" dir="ltr">
                          {itemPrice.toLocaleString()} د.ع
                        </span>
                      </div>
                    </div>

                    {/* Stepper / Add Button */}
                    {currentQty === 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          const defaultUnit = item.packetSellingPrice && !item.cartonSellingPrice ? 'packet' : 'carton';
                          setPreOrderCart([...preOrderCart, { item, quantity: 1, unit: defaultUnit }]);
                        }}
                        className="w-full py-2 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-indigo-200 shadow-2xs"
                      >
                        <Plus size={15} />
                        <span>داواکردن</span>
                      </button>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between gap-1.5 bg-white border border-indigo-300 rounded-xl p-1 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => updatePreOrderQty(item.id, currentQty - 1, currentUnit)}
                            className="w-8 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm transition active:scale-95"
                            title="کەمکردنەوە"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={currentQty}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (!isNaN(val)) {
                                updatePreOrderQty(item.id, val, currentUnit);
                              }
                            }}
                            className="w-16 h-8 text-center font-mono font-bold text-sm text-slate-800 outline-none bg-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => updatePreOrderQty(item.id, currentQty + 1, currentUnit)}
                            className="w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center font-bold text-sm transition active:scale-95"
                            title="زیادکردن"
                          >
                            +
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-bold text-indigo-900 mt-1 px-1">
                          <span>کۆی بەها:</span>
                          <span className="font-mono text-indigo-700" dir="ltr">{subtotal.toLocaleString()} د.ع</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredWarehouseItems.length === 0 && (
              <div className="col-span-full py-16 text-center text-slate-400 text-xs font-bold bg-white rounded-3xl border border-slate-200">
                هیچ کاڵایەک نەدۆزرایەوە لە کۆگای سەرەکی
              </div>
            )}
          </div>

          {/* Sticky Checkout Summary Bar */}
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 sm:p-4 shadow-xl">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center justify-between md:justify-start gap-4">
                <div>
                  <div className="text-[11px] text-slate-400 font-bold">کۆی خەمڵێنراوی داواکاری:</div>
                  <div className="text-base sm:text-lg font-bold font-mono text-indigo-600" dir="ltr">
                    {preOrderCart.reduce((acc, c) => {
                      const p = c.unit === 'packet'
                        ? (c.item.packetSellingPrice || c.item.packetCostPrice || c.item.sellingPrice || c.item.price || 0)
                        : (c.item.cartonSellingPrice || c.item.cartonCostPrice || c.item.sellingPrice || c.item.price || 0);
                      return acc + (c.quantity * p);
                    }, 0).toLocaleString()} د.ع
                  </div>
                </div>
                <div className="h-7 w-px bg-slate-200 hidden sm:block"></div>
                <div className="text-xs font-bold text-slate-600">
                  <span className="text-indigo-700">{preOrderCart.length} جۆر کاڵا</span>
                  <span className="text-slate-400 mr-1.5">
                    ({preOrderCart.reduce((acc, c) => acc + c.quantity, 0)} دانە)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-1 md:max-w-md">
                <input
                  type="text"
                  placeholder="تێبینی بۆ کۆگا (ئارەزوومەندانە)..."
                  value={preOrderNotes}
                  onChange={(e) => setPreOrderNotes(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={handleSendPreOrder}
                  disabled={preOrderCart.length === 0 || isProcessing}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50 active:scale-95 whitespace-nowrap"
                >
                  <Send size={15} />
                  <span>{isProcessing ? 'خەریکی ناردنە...' : 'ناردنی تەڵەبیە بۆ کۆگا'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Requisitions Status History */}
      {activeTab === 'history' && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-3">
          <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
            <ClipboardList className="text-indigo-600" size={18} />
            دۆخی تەڵەبیە و داواکارییەکانت بۆ کۆگای سەرەکی
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                <tr>
                  <th className="p-3">ژمارەی داواکاری</th>
                  <th className="p-3">بەروار و کات</th>
                  <th className="p-3">کۆی کاڵاکان</th>
                  <th className="p-3">تێبینی</th>
                  <th className="p-3">دۆخی ئامادەکردن</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {myRequisitions.map(req => (
                  <tr key={req.id}>
                    <td className="p-3 font-mono font-bold text-indigo-700" dir="ltr">
                      {req.requisitionNo || req.id.slice(-6)}
                    </td>
                    <td className="p-3 text-slate-600" dir="ltr">
                      {format(req.createdAt, 'yyyy/MM/dd HH:mm')}
                    </td>
                    <td className="p-3 font-bold text-slate-700">
                      {req.items.reduce((s, i) => s + i.quantity, 0)} {req.items[0]?.unit === 'packet' ? 'پاکەت' : 'کارتۆن'} ({req.items.length} جۆر)
                    </td>
                    <td className="p-3 text-slate-500 truncate max-w-xs">
                      {req.notes || '-'}
                    </td>
                    <td className="p-3">
                      {req.status === 'pending' && (
                        <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1">
                          <Clock size={12} />
                          چاوەڕوانی ئامادەکردن لە کۆگا
                        </span>
                      )}
                      {req.status === 'preparing' && (
                        <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1">
                          لە ئامادەکردندایە
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
                    <td colSpan={5} className="text-center py-8 text-slate-400">
                      هیچ داواکارییەکت بۆ کۆگا تۆمار نەکراوە
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create Return to Warehouse */}
      {isReturnModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="p-4 bg-rose-50 border-b border-rose-100 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-rose-900 text-sm flex items-center gap-2">
                  <RotateCcw size={18} className="text-rose-600" />
                  گەڕاندنەوەی کاڵا لە ڤانەوە بۆ کۆگای سەرەکی
                </h4>
                <p className="text-[11px] text-rose-700 mt-0.5">
                  کاشڤان: <strong>{activeCashvanName}</strong> (کاڵاکان وەک چۆن پێتان دراوە دەگەڕێنەوە سەر کۆگا)
                </p>
              </div>
              <button onClick={() => setIsReturnModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Van Available Items Selector */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-slate-700">هەڵبژاردنی کاڵا لە مەخزەنی ناو ڤان</label>
                  <div className="relative w-56">
                    <input
                      type="text"
                      placeholder="گەڕان لەناو کاڵاکانی ڤان..."
                      value={returnSearch}
                      onChange={(e) => setReturnSearch(e.target.value)}
                      className="w-full pl-3 pr-7 py-1 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-rose-500"
                    />
                    <Search className="absolute right-2 top-1.5 text-slate-400" size={13} />
                  </div>
                </div>

                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {filteredVanForReturn.map(it => (
                    <div key={it.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50 text-xs">
                      <div>
                        <div className="font-bold text-slate-800">{it.name}</div>
                        <div className="text-[11px] text-slate-500">
                          بەردەست لە ڤان: <strong className="text-indigo-600">{it.quantity} {it.unit === 'packet' ? 'پاکەت' : 'کارتۆن'}</strong>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addReturnItem(it)}
                        className="px-3 py-1 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 rounded-lg font-bold border border-rose-200 transition flex items-center gap-1"
                      >
                        <Plus size={13} />
                        گەڕاندنەوە
                      </button>
                    </div>
                  ))}
                  {filteredVanForReturn.length === 0 && (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      هیچ کاڵایەک لەناو ڤاندا نەدۆزرایەوە
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Return Cart Table */}
              <div>
                <h5 className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                  <span>لیستی ئەو کاڵایانەی دەگەڕێندرێنەوە بۆ کۆگا ({returnCart.length})</span>
                  <span className="text-rose-700 font-bold">
                    کۆی بڕ: {returnCart.reduce((acc, it) => acc + it.quantity, 0)} دانە
                  </span>
                </h5>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">ناوی کاڵا</th>
                        <th className="p-2.5 text-center">یەکە</th>
                        <th className="p-2.5 text-center w-28">بڕی گەڕاوە</th>
                        <th className="p-2.5 text-center">نرخی تاک</th>
                        <th className="p-2.5 text-center">کۆ</th>
                        <th className="p-2.5 text-center">سڕینەوە</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {returnCart.map((c, idx) => {
                        const maxQty = c.vanItem.quantity || 9999;
                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-800">{c.vanItem.name}</td>
                            <td className="p-2.5 text-center">
                              <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-bold text-slate-700">
                                {c.unit === 'packet' ? 'پاکەت' : 'کارتۆن'}
                              </span>
                            </td>
                            <td className="p-2.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateReturnQty(c.vanItem.itemId || c.vanItem.id, c.quantity - 1)}
                                  className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  max={maxQty}
                                  value={c.quantity}
                                  onChange={(e) => updateReturnQty(c.vanItem.itemId || c.vanItem.id, parseInt(e.target.value) || 1)}
                                  className="w-12 text-center font-bold border border-slate-200 rounded py-0.5 text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateReturnQty(c.vanItem.itemId || c.vanItem.id, c.quantity + 1)}
                                  className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="p-2.5 text-center font-mono" dir="ltr">
                              {(c.price || 0).toLocaleString()}
                            </td>
                            <td className="p-2.5 text-center font-bold text-rose-700 font-mono" dir="ltr">
                              {((c.price || 0) * c.quantity).toLocaleString()}
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => updateReturnQty(c.vanItem.itemId || c.vanItem.id, 0)}
                                className="text-red-500 hover:text-red-700 p-1"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {returnCart.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-slate-400 text-xs">
                            تکایە لە لیستی سەرەوە ئەو کاڵایانە هەڵبژێرە کە دەتەوێت بیگەڕێنیتەوە بۆ کۆگا
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تێبینی و هۆکاری گەڕاندنەوە</label>
                <textarea
                  rows={2}
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="هۆکاری گەڕاندنەوە بنووسە..."
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <div className="text-xs font-bold text-slate-700">
                کۆی بەهای گەڕاوە: <strong className="text-rose-700 font-mono text-sm" dir="ltr">{returnCart.reduce((a, b) => a + (b.price * b.quantity), 0).toLocaleString()} د.ع</strong>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition"
                >
                  داخستن
                </button>
                <button
                  type="button"
                  disabled={isProcessing || returnCart.length === 0}
                  onClick={handleProcessReturn}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
                >
                  <Printer size={16} />
                  <span>{isProcessing ? 'خەریکی تۆمارکردنە...' : 'تۆمارکردن، گەڕاندنەوە بۆ کۆگا و چاپکردنی وەسڵ'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Return Voucher */}
      {editingReturn && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="p-4 bg-amber-50 border-b border-amber-200 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-amber-900 text-sm flex items-center gap-2">
                  <Edit2 size={18} className="text-amber-600" />
                  دەستکاریکردنی وەسڵی گەڕاندنەوە ({editingReturn.returnNo || 'RET'})
                </h4>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  کاشڤان: {editingReturn.cashvanName} | بەروار: {format(editingReturn.date, 'yyyy/MM/dd HH:mm')}
                </p>
              </div>
              <button onClick={() => setEditingReturn(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <h5 className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                  <span>کاڵاکانی ناو وەسڵی گەڕاندنەوە ({editReturnItems.length})</span>
                </h5>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">ناوی کاڵا</th>
                        <th className="p-2.5 text-center">یەکە</th>
                        <th className="p-2.5 text-center w-28">بڕی گەڕاوە</th>
                        <th className="p-2.5 text-center">سڕینەوە</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {editReturnItems.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-800">{it.name}</td>
                          <td className="p-2.5 text-center">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-bold text-slate-700">
                              {it.unit === 'packet' ? 'پاکەت' : 'کارتۆن'}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleUpdateEditReturnItemQty(idx, it.quantity - 1)}
                                className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={it.quantity}
                                onChange={(e) => handleUpdateEditReturnItemQty(idx, parseInt(e.target.value) || 1)}
                                className="w-12 text-center font-bold border border-slate-200 rounded py-0.5 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateEditReturnItemQty(idx, it.quantity + 1)}
                                className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleUpdateEditReturnItemQty(idx, 0)}
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {editReturnItems.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-slate-400 text-xs">
                            هیچ کاڵایەک لە وەسڵەکەدا نەماوە
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add item to edit */}
              <div className="border-t border-slate-200 pt-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">زیادکردنی کاڵای تر لە ڤان بۆ ئەم وەسڵە</label>
                <div className="relative mb-2">
                  <Search className="absolute right-3 top-2 text-slate-400" size={14} />
                  <input
                    type="text"
                    placeholder="گەڕان لەناو کاڵاکانی ڤان..."
                    value={editReturnSearch}
                    onChange={(e) => setEditReturnSearch(e.target.value)}
                    className="w-full pr-8 pl-3 py-1.5 border border-slate-200 rounded-xl text-xs outline-none"
                  />
                </div>
                <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {inventory
                    .filter(i => (i.name || '').toLowerCase().includes(editReturnSearch.toLowerCase()))
                    .map(it => (
                      <div key={it.id} className="p-2 flex items-center justify-between hover:bg-slate-50 text-xs">
                        <div className="font-bold text-slate-800">{it.name}</div>
                        <button
                          type="button"
                          onClick={() => handleAddEditReturnItem(it)}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-700 rounded-lg font-bold border border-amber-200 transition flex items-center gap-1"
                        >
                          <Plus size={13} />
                          زیادکردن
                        </button>
                      </div>
                    ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تێبینی</label>
                <textarea
                  rows={2}
                  value={editReturnNotes}
                  onChange={(e) => setEditReturnNotes(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingReturn(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition"
              >
                پەشیمانبوونەوە
              </button>
              <button
                type="button"
                disabled={isProcessing || editReturnItems.length === 0}
                onClick={handleSaveEditReturn}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
              >
                <Check size={16} />
                <span>{isProcessing ? 'خەریکی پاشەکەوتکردن...' : 'پاشەکەوتکردنی دەستکارییەکان'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Return Voucher Confirmation */}
      {deletingReturn && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="p-5 text-center space-y-3">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
                <AlertTriangle size={24} />
              </div>
              <h4 className="font-bold text-slate-900 text-base">
                سڕینەوەی وەسڵی گەڕاندنەوە
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                ئایا دڵنیایت لە سڕینەوەی وەسڵی گەڕانەوەی ژمارە <strong className="text-rose-700 font-mono" dir="ltr">{deletingReturn.returnNo || 'RET'}</strong>؟
              </p>
              <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-right text-[11px] text-red-800 font-semibold space-y-1">
                <div>• سەرجەم کاڵاکانی ئەم وەسڵە ({deletingReturn.items.reduce((a, b) => a + b.quantity, 0)} دانە) دەگەڕێندرێنەوە ناو ڤانی کاشڤان.</div>
                <div>• لە مەخزەنی کۆگای سەرەکیش کەم دەکرێنەوە.</div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingReturn(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition"
              >
                پەشیمانبوونەوە
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleDeleteReturn}
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
