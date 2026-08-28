import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, getDoc, setDoc, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { Item, CashvanTransfer, CashvanRequisition, Order } from '../../types';
import {
  Plus,
  Search,
  Check,
  Send,
  Printer,
  Truck,
  ClipboardList,
  CheckCircle2,
  Clock,
  Eye,
  X,
  Package,
  Edit2,
  Trash2,
  AlertTriangle,
  ShoppingCart,
  Store,
  User,
  Calendar,
  Gift,
  CheckCircle,
  FileText,
  Boxes,
  ArrowRight,
  Filter,
  DollarSign
} from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import ConfirmModal from '../common/ConfirmModal';

export default function WarehouseOrdersView() {
  const [items, setItems] = useState<Item[]>([]);
  const [cashvans, setCashvans] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<CashvanTransfer[]>([]);
  const [requisitions, setRequisitions] = useState<CashvanRequisition[]>([]);
  const [repOrders, setRepOrders] = useState<Order[]>([]);
  const [selectedVanInventory, setSelectedVanInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Sub-Tab:
  // 'all_feed' -> All Orders & Requisitions combined
  // 'rep_orders' -> Rep market orders (تەڵەبیەی مەندووب)
  // 'cashvan_reqs' -> Cashvan requisitions (تەڵەبیەی پێشوەختەی کاشڤان)
  // 'direct_transfer' -> Direct Van Loading (پێدانی ڕاستەوخۆ)
  // 'van_inventory' -> Van inventories (کاڵای نێو ڤانەکان)
  // 'history' -> Transfers history (مێژووی وەسڵەکان)
  const [activeTab, setActiveTab] = useState<'all_feed' | 'rep_orders' | 'cashvan_reqs' | 'direct_transfer' | 'van_inventory' | 'history'>('all_feed');

  // Direct Transfer State
  const [selectedCashvan, setSelectedCashvan] = useState('');
  const [cart, setCart] = useState<{ item: Item; quantity: number; unit: 'carton' | 'packet' }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Rep Order Details Modal & Fulfillment
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [fulfillingOrder, setFulfillingOrder] = useState<Order | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null);
  const [repOrderFilter, setRepOrderFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [repOrderSearch, setRepOrderSearch] = useState('');

  // Cashvan Requisition Details Modal & Actions
  const [viewingRequisition, setViewingRequisition] = useState<CashvanRequisition | null>(null);
  const [editingRequisition, setEditingRequisition] = useState<CashvanRequisition | null>(null);
  const [editReqItems, setEditReqItems] = useState<{ itemId: string; name: string; quantity: number; unit: 'carton' | 'packet'; price?: number }[]>([]);
  const [editReqNotes, setEditReqNotes] = useState('');
  const [editReqCashvanName, setEditReqCashvanName] = useState('');
  const [editReqStatus, setEditReqStatus] = useState<'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled'>('pending');
  const [editReqSearchTerm, setEditReqSearchTerm] = useState('');
  const [deletingRequisition, setDeletingRequisition] = useState<CashvanRequisition | null>(null);
  const [reqFilter, setReqFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [reqSearch, setReqSearch] = useState('');

  // Edit & Delete State for Transfers
  const [deletingTransfer, setDeletingTransfer] = useState<CashvanTransfer | null>(null);
  const [editingTransfer, setEditingTransfer] = useState<CashvanTransfer | null>(null);
  const [editCashvanName, setEditCashvanName] = useState('');
  const [editItems, setEditItems] = useState<{ itemId: string; name: string; quantity: number; unit: 'carton' | 'packet'; price: number; barcode?: string }[]>([]);
  const [editSearchTerm, setEditSearchTerm] = useState('');

  // Van Inventory Item Delete
  const [deletingVanItem, setDeletingVanItem] = useState<any | null>(null);
  const [returnToWarehouseOnDelete, setReturnToWarehouseOnDelete] = useState<boolean>(true);

  // Global search for feed
  const [feedSearch, setFeedSearch] = useState('');

  // 1. Fetch Items
  useEffect(() => {
    const unsubItems = onSnapshot(
      query(collection(db, 'items')),
      (snapshot) => {
        const data: Item[] = [];
        snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Item));
        setItems(data);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'items')
    );

    // 2. Fetch Cashvans & Reps
    const unsubCashvans = onSnapshot(
      query(collection(db, 'cashvans')),
      (snapshot) => {
        const data: any[] = [];
        snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
        setCashvans(prev => {
          const reps = prev.filter(p => p.isRep);
          const combined = [...reps, ...data];
          return Array.from(new Map(combined.map(item => [item.name, item])).values());
        });
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'cashvans')
    );

    const unsubReps = onSnapshot(
      query(collection(db, 'reps')),
      (snapshot) => {
        const data: any[] = [];
        snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data(), isRep: true }));
        setCashvans(prev => {
          const cvs = prev.filter(p => !p.isRep);
          const combined = [...cvs, ...data];
          return Array.from(new Map(combined.map(item => [item.name, item])).values());
        });
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'reps')
    );

    // 3. Fetch Transfers
    const unsubTransfers = onSnapshot(
      query(collection(db, 'cashvan_transfers')),
      (snapshot) => {
        const data: CashvanTransfer[] = [];
        snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as CashvanTransfer));
        setTransfers(data.sort((a, b) => b.date - a.date));
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'cashvan_transfers')
    );

    // 4. Fetch Cashvan Requisitions
    const unsubReqs = onSnapshot(
      query(collection(db, 'cashvan_requisitions')),
      (snapshot) => {
        const data: CashvanRequisition[] = [];
        snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as CashvanRequisition));
        setRequisitions(data.sort((a, b) => b.createdAt - a.createdAt));
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'cashvan_requisitions')
    );

    // 5. Fetch Rep Orders
    const unsubOrders = onSnapshot(
      query(collection(db, 'orders'), orderBy('timestamp', 'desc')),
      (snapshot) => {
        const data: Order[] = [];
        snapshot.forEach(doc => {
          const ord = { id: doc.id, ...doc.data() } as Order;
          if (ord.status !== 'deleted') {
            data.push(ord);
          }
        });
        setRepOrders(data);
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'orders')
    );

    return () => {
      unsubItems();
      unsubCashvans();
      unsubReps();
      unsubTransfers();
      unsubReqs();
      unsubOrders();
    };
  }, []);

  // Listen to selected cashvan inventory
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
      (error) => handleFirestoreError(error, OperationType.GET, 'cashvan_inventory')
    );
    return () => unsub();
  }, [selectedCashvan]);

  // Counts & Stats
  const pendingRepOrders = repOrders.filter(o => o.status === 'pending');
  const completedRepOrders = repOrders.filter(o => o.status === 'completed');

  const pendingRequisitions = requisitions.filter(r => r.status === 'pending' || r.status === 'preparing');
  const completedRequisitions = requisitions.filter(r => r.status === 'completed');

  // Combined Feed Items
  const combinedFeed = React.useMemo(() => {
    const list: {
      id: string;
      source: 'rep_order' | 'cashvan_req';
      timestamp: number;
      requesterName: string;
      targetName: string;
      status: string;
      itemCount: number;
      giftCount: number;
      totalAmount?: number;
      paymentType?: string;
      rawOrder?: Order;
      rawReq?: CashvanRequisition;
    }[] = [];

    repOrders.forEach(o => {
      const giftCount = o.items.reduce((s, it) => s + (it.giftQuantity || 0), 0);
      const regularCount = o.items.reduce((s, it) => s + (it.quantity || 0), 0);
      list.push({
        id: o.id,
        source: 'rep_order',
        timestamp: o.timestamp,
        requesterName: o.repName || 'مەندووب',
        targetName: o.marketName || 'مارکێت',
        status: o.status || 'pending',
        itemCount: regularCount,
        giftCount,
        totalAmount: o.totalAmount,
        paymentType: o.paymentType,
        rawOrder: o
      });
    });

    requisitions.forEach(r => {
      const totalUnits = r.items.reduce((s, it) => s + (it.quantity || 0), 0);
      list.push({
        id: r.id,
        source: 'cashvan_req',
        timestamp: r.createdAt,
        requesterName: r.cashvanName || 'کاشڤان',
        targetName: 'بارکردن بۆ ناو ڤان',
        status: r.status || 'pending',
        itemCount: totalUnits,
        giftCount: 0,
        rawReq: r
      });
    });

    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [repOrders, requisitions]);

  const filteredFeed = combinedFeed.filter(item => {
    if (!feedSearch.trim()) return true;
    const term = feedSearch.toLowerCase();
    return (
      item.requesterName.toLowerCase().includes(term) ||
      item.targetName.toLowerCase().includes(term) ||
      (item.rawOrder?.invoiceNo && item.rawOrder.invoiceNo.toLowerCase().includes(term)) ||
      (item.rawOrder?.items && item.rawOrder.items.some(i => i.name.toLowerCase().includes(term))) ||
      (item.rawReq?.items && item.rawReq.items.some(i => i.name.toLowerCase().includes(term)))
    );
  });

  // --- ACTIONS: REP ORDER ---

  // Fulfill / Prepare Rep Order (Deduct from warehouse stock & mark completed)
  const handleFulfillRepOrder = async (order: Order) => {
    setIsProcessing(true);
    try {
      // Deduct all items in this order from warehouse items collection
      for (const item of order.items) {
        const itemRef = doc(db, 'items', item.itemId);
        const itemSnap = await getDoc(itemRef);
        if (itemSnap.exists()) {
          const curData = itemSnap.data();
          const currentTotal = curData.quantity || 0;
          const totalOrderQty = (item.quantity || 0) + (item.giftQuantity || 0);
          const newQty = Math.max(0, currentTotal - totalOrderQty);

          const updatePayload: any = { quantity: newQty };
          if (item.unit === 'carton' && curData.cartonQuantity !== undefined) {
            updatePayload.cartonQuantity = Math.max(0, (curData.cartonQuantity || 0) - totalOrderQty);
          } else if (item.unit === 'packet' && curData.packetQuantity !== undefined) {
            updatePayload.packetQuantity = Math.max(0, (curData.packetQuantity || 0) - totalOrderQty);
          }
          await updateDoc(itemRef, updatePayload);
        }
      }

      // Mark order as completed
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'completed',
        fulfilledAt: Date.now()
      });

      setFulfillingOrder(null);
      alert('تەڵەبیەی مەندووب بە سەرکەوتوویی ئامادەکرا و لە عەدەدی کۆگای سەرەکی دابەزی');
    } catch (err) {
      console.error(err);
      alert('هەڵەیەک ڕوویدا لە ئامادەکردنی تەڵەبیە');
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete Rep Order
  const handleDeleteRepOrder = async () => {
    if (!deletingOrder) return;
    try {
      await updateDoc(doc(db, 'orders', deletingOrder.id), { status: 'deleted' });
      setDeletingOrder(null);
      alert('تەڵەبیەکە بە سەرکەوتوویی سڕایەوە');
    } catch (err) {
      console.error(err);
      alert('هەڵەیەک ڕوویدا لە سڕینەوەی تەڵەبیە');
    }
  };

  // Print Rep Order Slip
  const printRepOrderSlip = (order: Order) => {
    let totalUnits = 0;
    let totalGifts = 0;

    const itemsHtml = order.items.map((item, idx) => {
      const unitLabel = item.unit === 'packet' ? 'پاکەت' : 'کارتۆن';
      const qty = item.quantity || 0;
      const giftQty = item.giftQuantity || 0;
      totalUnits += qty;
      totalGifts += giftQty;

      return `
        <tr>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px;">${idx + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">${item.name}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; font-size: 14px;">${qty}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px; color: #b45309; font-weight: bold;">${giftQty > 0 ? giftQty + ' 🎁' : '-'}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px;">${unitLabel}</td>
          <td style="text-align: left; border: 1px solid #cbd5e1; padding: 8px; font-family: monospace;" dir="ltr">${(item.price || 0).toLocaleString()} IQD</td>
          <td style="text-align: left; border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; font-family: monospace;" dir="ltr">${(item.totalPrice || 0).toLocaleString()} IQD</td>
        </tr>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ckb">
        <head>
          <meta charset="utf-8">
          <title>وەسڵی تەڵەبیە - ${order.marketName}</title>
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
            <h2>وەسڵی تەڵەبیە و ئامادەکردنی بار بۆ مارکێت</h2>
            <div style="font-size: 12px; color: #64748b;">داواکاری مەندووب لە کۆگای سەرەکی بۆ کڕیار</div>
          </div>

          <div class="meta-grid">
            <div class="meta-item"><span>مارکێت:</span> <strong>${order.marketName}</strong></div>
            <div class="meta-item"><span>ناوی مەندووب:</span> <strong>${order.repName || 'دیارینەکراو'}</strong></div>
            <div class="meta-item"><span>ژمارەی وەسڵ:</span> <strong dir="ltr">${order.invoiceNo || order.id}</strong></div>
            <div class="meta-item"><span>بەروار و کات:</span> <span dir="ltr">${format(order.timestamp, 'yyyy/MM/dd - HH:mm')}</span></div>
            <div class="meta-item"><span>جۆری پارەدان:</span> <strong>${order.paymentType === 'cash' ? 'نەقد 💵' : 'قەرز 💳'}</strong></div>
            <div class="meta-item"><span>دۆخی داواکاری:</span> <strong>${order.status === 'completed' ? 'ئامادەکراو / تەواوکراو ✅' : 'چاوەڕوانکراو ⏳'}</strong></div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th>ناوی کاڵا</th>
                <th style="text-align: center; width: 80px;">عەدەدی فرۆش</th>
                <th style="text-align: center; width: 80px;">هەدیە 🎁</th>
                <th style="text-align: center; width: 80px;">یەکە</th>
                <th style="text-align: left; width: 100px;">نرخی دانە</th>
                <th style="text-align: left; width: 110px;">کۆی گشتی</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="total-box">
            <div class="total-row">
              <span style="font-weight: bold; color: #334155;">کۆی گشتی عەدەدی کاڵاکان:</span>
              <span dir="ltr" style="font-size: 16px; font-weight: bold;">${totalUnits} دانە ${totalGifts > 0 ? ` (+ ${totalGifts} هەدیە)` : ''}</span>
            </div>
            <div class="total-row" style="border-top: 1px solid #cbd5e1; padding-top: 8px; margin-top: 8px;">
              <span style="font-weight: bold; color: #0f172a; font-size: 16px;">کۆی گشتی بڕی پارەی وەسڵ:</span>
              <span dir="ltr" style="color: #4338ca; font-size: 20px; font-weight: bold;">${(order.totalAmount || 0).toLocaleString()} IQD</span>
            </div>
          </div>

          <div class="signatures">
            <div>
              <div>واژۆی بەرپرسی کۆگا (ئامادەکار)</div>
              <div class="sig-line">ناو و واژۆ</div>
            </div>
            <div>
              <div>واژۆی مەندووب / وەرگر</div>
              <div class="sig-line">${order.repName || 'مەندووب'}</div>
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

  // --- ACTIONS: CASHVAN REQUISITION ---

  // Fulfill Cashvan Requisition (Deduct from warehouse & add to van inventory)
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
      await addDoc(collection(db, 'cashvan_transfers'), transferData);

      // 2. Deduct warehouse & update cashvan inventory
      for (const rItem of req.items) {
        const itemObj = items.find(i => i.id === rItem.itemId);
        if (itemObj) {
          const itemRef = doc(db, 'items', itemObj.id);
          const newQty = Math.max(0, (itemObj.quantity || 0) - rItem.quantity);
          const updatePayload: any = { quantity: newQty };
          if (rItem.unit === 'carton' && itemObj.cartonQuantity !== undefined) {
            updatePayload.cartonQuantity = Math.max(0, (itemObj.cartonQuantity || 0) - rItem.quantity);
          } else if (rItem.unit === 'packet' && itemObj.packetQuantity !== undefined) {
            updatePayload.packetQuantity = Math.max(0, (itemObj.packetQuantity || 0) - rItem.quantity);
          }
          await updateDoc(itemRef, updatePayload);
        }

        // Add to isolated cashvan inventory
        const cInvRef = doc(db, 'cashvan_inventory', `${req.cashvanName}_${rItem.itemId}`);
        const cInvSnap = await getDoc(cInvRef);
        if (cInvSnap.exists()) {
          const curInv = cInvSnap.data();
          await updateDoc(cInvRef, {
            quantity: (curInv.quantity || 0) + rItem.quantity,
            unit: rItem.unit,
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
            costPrice: rItem.unit === 'packet' ? (itemObj?.packetCostPrice || 0) : (itemObj?.cartonCostPrice || 0),
            sellingPrice: rItem.unit === 'packet' ? (itemObj?.packetSellingPrice || 0) : (itemObj?.cartonSellingPrice || 0),
            wholesalePrice: rItem.unit === 'packet' ? (itemObj?.packetWholesalePrice || 0) : (itemObj?.cartonWholesalePrice || 0),
            cartonCostPrice: itemObj?.cartonCostPrice || 0,
            cartonSellingPrice: itemObj?.cartonSellingPrice || 0,
            cartonWholesalePrice: itemObj?.cartonWholesalePrice || 0,
            packetCostPrice: itemObj?.packetCostPrice || 0,
            packetSellingPrice: itemObj?.packetSellingPrice || 0,
            packetWholesalePrice: itemObj?.packetWholesalePrice || 0,
            createdAt: Date.now()
          });
        }
      }

      // 3. Mark Requisition Completed
      await updateDoc(doc(db, 'cashvan_requisitions', req.id), {
        status: 'completed',
        fulfilledAt: Date.now(),
        transferNo
      });

      setViewingRequisition(null);
      alert('تەڵەبیەی پێشوەختەکە بە سەرکەوتوویی بارکرا بۆ نێو ڤانەکە و پسوڵەکە تۆمارکرا');
    } catch (err) {
      console.error(err);
      alert('هەڵەیەک ڕوویدا لە بارکردنی تەڵەبیە');
    } finally {
      setIsProcessing(false);
    }
  };

  // Print Cashvan Requisition Slip
  const printRequisitionReceipt = (req: CashvanRequisition) => {
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

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ckb">
        <head>
          <meta charset="utf-8">
          <title>وەسڵی تەڵەبیەی کاشڤان - ${req.cashvanName}</title>
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
            <h2>وەسڵی داواکاری پێشوەختەی کاشڤان (تەڵەبیەی ڤان)</h2>
            <div style="font-size: 12px; color: #64748b;">داواکاری پێشوەختەی بارکردن لە کۆگای سەرەکی</div>
          </div>

          <div class="meta-grid">
            <div class="meta-item"><span>ناوی کاشڤان:</span> <strong>${req.cashvanName}</strong></div>
            <div class="meta-item"><span>کۆدی داواکاری:</span> <strong dir="ltr">${req.id}</strong></div>
            <div class="meta-item"><span>بەروار و کات:</span> <span dir="ltr">${format(req.createdAt, 'yyyy/MM/dd - HH:mm')}</span></div>
            <div class="meta-item"><span>دۆخی داواکاری:</span> <strong>${req.status === 'completed' ? 'بارکراوە بۆ ڤان ✅' : req.status === 'preparing' ? 'خەریکی ئامادەکردنە ⏳' : 'چاوەڕوانکراوە ⏱️'}</strong></div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th>ناوی کاڵا</th>
                <th style="text-align: center; width: 90px;">بڕی داواکراو</th>
                <th style="text-align: center; width: 80px;">یەکە</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="total-box">
            <div class="total-row">
              <span style="font-weight: bold; color: #334155;">کۆی گشتی ژمارەی کاڵاکانی داواکاری:</span>
              <span dir="ltr" style="color: #4338ca; font-size: 17px; font-weight: bold;">${totalUnits} دانە</span>
            </div>
          </div>

          <div class="signatures">
            <div>
              <div>واژۆی بەرپرسی کۆگا</div>
              <div class="sig-line">ناو و واژۆ</div>
            </div>
            <div>
              <div>واژۆی کاشڤان</div>
              <div class="sig-line">${req.cashvanName}</div>
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

  // --- ACTIONS: DIRECT VAN LOADING ---
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
      printTransferReceipt(createdTransfer);
      alert('بەسەرکەوتوویی کاڵاکان ڕادەستی کاشڤان کران و پسوڵەکە ئامادەی چاپکردنە');
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە کاتی پێدانی کاڵا');
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete Transfer Record & Revert Stock
  const handleDeleteTransfer = async () => {
    if (!deletingTransfer) return;
    setIsProcessing(true);
    try {
      for (const tItem of deletingTransfer.items) {
        // Revert warehouse
        const itemRef = doc(db, 'items', tItem.itemId);
        const itemSnap = await getDoc(itemRef);
        if (itemSnap.exists()) {
          const curData = itemSnap.data();
          const currentTotal = curData.quantity || 0;
          await updateDoc(itemRef, { quantity: currentTotal + tItem.quantity });
        }

        // Deduct from cashvan
        const cInvRef = doc(db, 'cashvan_inventory', `${deletingTransfer.cashvanName}_${tItem.itemId}`);
        const cInvSnap = await getDoc(cInvRef);
        if (cInvSnap.exists()) {
          const curInv = cInvSnap.data();
          const curQty = curInv.quantity || 0;
          const newQty = Math.max(0, curQty - tItem.quantity);
          if (newQty === 0) {
            await deleteDoc(cInvRef);
          } else {
            await updateDoc(cInvRef, { quantity: newQty, lastUpdated: Date.now() });
          }
        }
      }

      await deleteDoc(doc(db, 'cashvan_transfers', deletingTransfer.id));
      setDeletingTransfer(null);
      alert('وەسڵی بارکردنەکە بە سەرکەوتوویی سڕایەوە و عەدەدەکان گەڕانەوە شوێنی خۆیان');
    } catch (err) {
      console.error(err);
      alert('هەڵەیەک ڕوویدا لە سڕینەوەی وەسڵ');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredWarehouseItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.barcode && item.barcode.includes(searchTerm))
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2.5">
              <Boxes className="text-indigo-600" size={26} />
              بەڕێوەبردنی داواکارییەکان (کۆگا)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              تەڵەبیەی مەندووب بۆ مارکێتەکان، داواکاری پێشوەختەی کاشڤان، و بارکردن لە کۆگای سەرەکی
            </p>
          </div>

          {/* Quick Summary Badges */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl font-bold flex items-center gap-1.5 shadow-2xs">
              <ShoppingCart size={14} />
              تەڵەبیەی مەندووب: <strong>{pendingRepOrders.length} چاوەڕوانکراو</strong>
            </span>
            <span className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl font-bold flex items-center gap-1.5 shadow-2xs">
              <Truck size={14} />
              تەڵەبیەی کاشڤان: <strong>{pendingRequisitions.length} چاوەڕوانکراو</strong>
            </span>
          </div>
        </div>

        {/* Unified Sub-Tabs Navigation */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-100 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('all_feed')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'all_feed'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Boxes size={15} />
            <span>هەموو داواکارییەکان ({combinedFeed.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rep_orders')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 relative ${
              activeTab === 'rep_orders'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ShoppingCart size={15} />
            <span>تەڵەبیەی مەندووب (مارکێت)</span>
            {pendingRepOrders.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                {pendingRepOrders.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cashvan_reqs')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 relative ${
              activeTab === 'cashvan_reqs'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ClipboardList size={15} />
            <span>تەڵەبیەی پێشوەختەی کاشڤان (ڤان)</span>
            {pendingRequisitions.length > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
                {pendingRequisitions.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('direct_transfer')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'direct_transfer'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Plus size={15} />
            <span>پێدانی ڕاستەوخۆ بە کاشڤان</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('van_inventory')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'van_inventory'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Package size={15} />
            <span>کاڵای نێو ڤانەکان</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Printer size={15} />
            <span>مێژووی وەسڵەکانی بارکردن</span>
          </button>
        </div>
      </div>

      {/* ========================================================
          SUB-TAB 1: ALL ORDERS FEED (گشتی)
      ======================================================== */}
      {activeTab === 'all_feed' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="گەڕان بۆ داواکاری بەپێی ناوی مەندووب، کاشڤان، مارکێت، یان کاڵا..."
                className="w-full pl-3 pr-9 py-2 border border-slate-200 rounded-xl outline-none text-xs"
                value={feedSearch}
                onChange={(e) => setFeedSearch(e.target.value)}
              />
            </div>
            <div className="text-xs text-slate-500 font-bold">
              پیشاندانی {filteredFeed.length} داواکاری
            </div>
          </div>

          <div className="space-y-3">
            {filteredFeed.map(item => {
              const isRepOrder = item.source === 'rep_order';
              const isCompleted = item.status === 'completed';

              return (
                <div
                  key={`feed-${item.source}-${item.id}`}
                  className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-sm transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                >
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className={`p-3 rounded-2xl shrink-0 ${isRepOrder ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                      {isRepOrder ? <ShoppingCart size={22} /> : <Truck size={22} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          isRepOrder ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {isRepOrder ? '🛍️ تەڵەبیەی مەندووب' : '🚚 تەڵەبیەی کاشڤان'}
                        </span>

                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isCompleted
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'preparing'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {isCompleted ? 'تەواوکراو ✅' : item.status === 'preparing' ? 'خەریکی ئامادەکردن ⏳' : 'چاوەڕوانکراو ⏱️'}
                        </span>

                        <span className="text-slate-400 text-xs font-mono" dir="ltr">
                          {format(item.timestamp, 'yyyy/MM/dd - HH:mm')}
                        </span>
                      </div>

                      <h4 className="text-sm sm:text-base font-bold text-slate-800 mt-1.5 flex items-center gap-2">
                        <span>{item.targetName}</span>
                        <span className="text-xs text-slate-400 font-normal">| داواکار: <strong className="text-slate-700">{item.requesterName}</strong></span>
                      </h4>

                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                        <span>کۆی کاڵاکان: <strong className="text-slate-800">{item.itemCount} یەکە</strong></span>
                        {item.giftCount > 0 && (
                          <span className="text-yellow-700 font-bold bg-yellow-100 px-2 py-0.5 rounded-md">
                            🎁 {item.giftCount} هەدیە
                          </span>
                        )}
                        {item.totalAmount !== undefined && (
                          <span className="font-mono text-emerald-700 font-bold" dir="ltr">
                            کۆی پارە: {item.totalAmount.toLocaleString()} IQD
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    {isRepOrder && item.rawOrder && (
                      <>
                        <button
                          type="button"
                          onClick={() => setViewingOrder(item.rawOrder!)}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                        >
                          <Eye size={14} />
                          <span>وردەکاری</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => printRepOrderSlip(item.rawOrder!)}
                          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                          title="چاپکردنی وەسڵ"
                        >
                          <Printer size={15} />
                        </button>
                        {!isCompleted && (
                          <button
                            type="button"
                            onClick={() => setFulfillingOrder(item.rawOrder!)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 active:scale-95"
                          >
                            <Check size={14} />
                            <span>تەواوکردنی بار</span>
                          </button>
                        )}
                      </>
                    )}

                    {!isRepOrder && item.rawReq && (
                      <>
                        <button
                          type="button"
                          onClick={() => setViewingRequisition(item.rawReq!)}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                        >
                          <Eye size={14} />
                          <span>بینین و بارکردن</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => printRequisitionReceipt(item.rawReq!)}
                          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                          title="چاپکردنی وەسڵ"
                        >
                          <Printer size={15} />
                        </button>
                        {!isCompleted && (
                          <button
                            type="button"
                            onClick={() => handleFulfillRequisition(item.rawReq!)}
                            disabled={isProcessing}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 active:scale-95"
                          >
                            <Truck size={14} />
                            <span>بارکردن بۆ ڤان</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredFeed.length === 0 && (
              <div className="bg-white rounded-3xl p-12 text-center text-slate-400 border border-slate-200 font-bold text-xs">
                هیچ داواکارییەک لە سیستەمدا نییە
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          SUB-TAB 2: REP ORDERS (تەڵەبیەی مەندووب بۆ مارکێتەکان)
      ======================================================== */}
      {activeTab === 'rep_orders' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setRepOrderFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  repOrderFilter === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                هەموو ({repOrders.length})
              </button>
              <button
                type="button"
                onClick={() => setRepOrderFilter('pending')}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  repOrderFilter === 'pending' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                چاوەڕوانکراو ({pendingRepOrders.length})
              </button>
              <button
                type="button"
                onClick={() => setRepOrderFilter('completed')}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  repOrderFilter === 'completed' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                تەواوکراو ({completedRepOrders.length})
              </button>
            </div>

            <div className="relative flex-1 w-full max-w-sm">
              <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="گەڕان بۆ تەڵەبیەی مارکێت یان مەندووب..."
                className="w-full pl-3 pr-9 py-2 border border-slate-200 rounded-xl outline-none text-xs"
                value={repOrderSearch}
                onChange={(e) => setRepOrderSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Orders List */}
          <div className="space-y-3">
            {repOrders
              .filter(o => {
                if (repOrderFilter === 'pending' && o.status === 'completed') return false;
                if (repOrderFilter === 'completed' && o.status !== 'completed') return false;
                if (repOrderSearch.trim()) {
                  const term = repOrderSearch.toLowerCase();
                  return (
                    o.marketName.toLowerCase().includes(term) ||
                    (o.repName && o.repName.toLowerCase().includes(term)) ||
                    (o.invoiceNo && o.invoiceNo.toLowerCase().includes(term))
                  );
                }
                return true;
              })
              .map(order => {
                const totalUnits = order.items.reduce((s, it) => s + (it.quantity || 0), 0);
                const totalGifts = order.items.reduce((s, it) => s + (it.giftQuantity || 0), 0);
                const isCompleted = order.status === 'completed';

                return (
                  <div
                    key={order.id}
                    className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-sm transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                  >
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0 border border-indigo-100">
                        <Store size={22} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {isCompleted ? 'تەواوکراو و بارکراو ✅' : 'چاوەڕوانکراو ⏱️'}
                          </span>
                          <span className="text-xs text-slate-400 font-mono" dir="ltr">
                            {format(order.timestamp, 'yyyy/MM/dd - HH:mm')}
                          </span>
                          {order.invoiceNo && (
                            <span className="text-xs bg-slate-100 text-slate-600 font-mono px-2 py-0.5 rounded-md">
                              #{order.invoiceNo}
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-bold text-slate-900 mt-1">
                          {order.marketName}
                        </h3>

                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                          <span>مەندووب: <strong className="text-slate-800">{order.repName || 'دیارینەکراو'}</strong></span>
                          <span>بڕی کاڵا: <strong className="text-slate-800">{totalUnits} دانە</strong></span>
                          {totalGifts > 0 && (
                            <span className="text-yellow-800 font-bold bg-yellow-100 px-2 py-0.5 rounded-md">
                              🎁 {totalGifts} هەدیە
                            </span>
                          )}
                          <span className="font-mono text-emerald-700 font-bold" dir="ltr">
                            {(order.totalAmount || 0).toLocaleString()} IQD
                          </span>
                          <span>({order.paymentType === 'cash' ? 'نەقد' : 'قەرز'})</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => setViewingOrder(order)}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <Eye size={14} />
                        <span>بینینی کاڵاکان</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => printRepOrderSlip(order)}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                        title="چاپکردنی وەسڵ"
                      >
                        <Printer size={15} />
                      </button>

                      {!isCompleted && (
                        <button
                          type="button"
                          onClick={() => setFulfillingOrder(order)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 active:scale-95"
                        >
                          <Check size={14} />
                          <span>ئامادەکرا و بارکرا</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setDeletingOrder(order)}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition"
                        title="سڕینەوەی تەڵەبیە"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}

            {repOrders.length === 0 && (
              <div className="bg-white rounded-3xl p-12 text-center text-slate-400 border border-slate-200 font-bold text-xs">
                هیچ تەڵەبیەیەکی مەندووب تۆمار نەکراوە
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          SUB-TAB 3: CASHVAN REQUISITIONS (تەڵەبیەی کاشڤان)
      ======================================================== */}
      {activeTab === 'cashvan_reqs' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setReqFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  reqFilter === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                هەموو ({requisitions.length})
              </button>
              <button
                type="button"
                onClick={() => setReqFilter('pending')}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  reqFilter === 'pending' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                چاوەڕوانکراو ({pendingRequisitions.length})
              </button>
              <button
                type="button"
                onClick={() => setReqFilter('completed')}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  reqFilter === 'completed' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                بارکراو بۆ ڤان ({completedRequisitions.length})
              </button>
            </div>

            <div className="relative flex-1 w-full max-w-sm">
              <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="گەڕان بۆ تەڵەبیەی پێشوەختەی کاشڤان..."
                className="w-full pl-3 pr-9 py-2 border border-slate-200 rounded-xl outline-none text-xs"
                value={reqSearch}
                onChange={(e) => setReqSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            {requisitions
              .filter(r => {
                if (reqFilter === 'pending' && r.status === 'completed') return false;
                if (reqFilter === 'completed' && r.status !== 'completed') return false;
                if (reqSearch.trim()) {
                  const term = reqSearch.toLowerCase();
                  return (
                    r.cashvanName.toLowerCase().includes(term) ||
                    (r.items && r.items.some(it => it.name.toLowerCase().includes(term)))
                  );
                }
                return true;
              })
              .map(req => {
                const totalUnits = req.items.reduce((s, it) => s + (it.quantity || 0), 0);
                const isCompleted = req.status === 'completed';

                return (
                  <div
                    key={req.id}
                    className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-sm transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                  >
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div className="p-3 bg-amber-50 text-amber-700 rounded-2xl shrink-0 border border-amber-100">
                        <Truck size={22} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isCompleted
                              ? 'bg-emerald-100 text-emerald-800'
                              : req.status === 'preparing'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {isCompleted ? 'بارکراوە بۆ ڤان ✅' : req.status === 'preparing' ? 'خەریکی ئامادەکردنە ⏳' : 'چاوەڕوانکراوە ⏱️'}
                          </span>
                          <span className="text-xs text-slate-400 font-mono" dir="ltr">
                            {format(req.createdAt, 'yyyy/MM/dd - HH:mm')}
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-slate-900 mt-1">
                          {req.cashvanName}
                        </h3>

                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                          <span>جۆری کاڵاکان: <strong className="text-slate-800">{req.items.length} جۆر</strong></span>
                          <span>کۆی عەدەد: <strong className="text-slate-800">{totalUnits} دانە</strong></span>
                          {req.notes && <span className="text-slate-400">تێبینی: {req.notes}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => setViewingRequisition(req)}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <Eye size={14} />
                        <span>بینین و بارکردن</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => printRequisitionReceipt(req)}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                        title="چاپکردنی وەسڵ"
                      >
                        <Printer size={15} />
                      </button>

                      {!isCompleted && (
                        <button
                          type="button"
                          onClick={() => handleFulfillRequisition(req)}
                          disabled={isProcessing}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 active:scale-95"
                        >
                          <Truck size={14} />
                          <span>بارکردن بۆ ڤان</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setDeletingRequisition(req)}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition"
                        title="سڕینەوەی تەڵەبیە"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}

            {requisitions.length === 0 && (
              <div className="bg-white rounded-3xl p-12 text-center text-slate-400 border border-slate-200 font-bold text-xs">
                هیچ تەڵەبیەیەکی پێشوەختەی کاشڤان بوونی نییە
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          SUB-TAB 4: DIRECT TRANSFER (پێدانی ڕاستەوخۆ بە کاشڤان)
      ======================================================== */}
      {activeTab === 'direct_transfer' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Product Selection */}
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col">
            <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Plus className="text-indigo-600" size={18} />
              هەڵبژاردنی کاڵاکان لە کۆگای سەرەکی
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

            <div className="max-h-[380px] overflow-y-auto space-y-2 border border-slate-100 rounded-2xl p-2 flex-1">
              {filteredWarehouseItems.map(item => (
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
              {filteredWarehouseItems.length === 0 && (
                <div className="text-center text-slate-400 py-8 text-xs">هیچ کاڵایەک نەدۆزرایەوە</div>
              )}
            </div>
          </section>

          {/* Right: Transfer Cart */}
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Truck className="text-indigo-600" size={18} />
                  لیستی بارکردن بۆ: {selectedCashvan || '...'}
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
                        نرخ: {(c.unit === 'packet' ? (c.item.packetSellingPrice || c.item.sellingPrice || 0) : (c.item.cartonSellingPrice || c.item.sellingPrice || 0)).toLocaleString()} د.ع
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
                    const pr = curr.unit === 'packet'
                      ? (curr.item.packetSellingPrice || curr.item.sellingPrice || 0)
                      : (curr.item.cartonSellingPrice || curr.item.sellingPrice || 0);
                    return sum + (pr * curr.quantity);
                  }, 0).toLocaleString()} IQD
                </span>
              </div>

              <button
                type="button"
                onClick={handleTransfer}
                disabled={isProcessing || !selectedCashvan || cart.length === 0}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-md transition flex items-center justify-center gap-2 active:scale-98"
              >
                <Truck size={18} />
                <span>{isProcessing ? 'خەریکی تۆمارکردنە...' : 'بارکردن بۆ نێو ڤان و چاپکردنی پسوڵە'}</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================
          SUB-TAB 5: VAN INVENTORY (کاڵای نێو ڤانەکان)
      ======================================================== */}
      {activeTab === 'van_inventory' && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">مەخزەن و کاڵاکانی نێو ڤانەکان</h3>
              <p className="text-xs text-slate-500">بینینی بڕی مەوجودی کاڵا لەناو سەیارەی هەر کاشڤانێکدا</p>
            </div>

            <div className="w-full sm:w-64">
              <select
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                value={selectedCashvan}
                onChange={(e) => setSelectedCashvan(e.target.value)}
              >
                <option value="">-- کاشڤان هەڵبژێرە --</option>
                {cashvans.map(c => (
                  <option key={`van-inv-${c.id || c.name}`} value={c.name}>
                    🚚 {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedCashvan ? (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <th className="p-3">#</th>
                    <th className="p-3">ناوی کاڵا</th>
                    <th className="p-3">بڕی ماوە لە ڤان</th>
                    <th className="p-3">یەکە</th>
                    <th className="p-3">نرخی فرۆشتن</th>
                    <th className="p-3 text-center">کردار</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedVanInventory.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-3">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-800">{item.name}</td>
                      <td className="p-3 font-bold text-indigo-600 font-mono text-sm">{item.quantity}</td>
                      <td className="p-3 text-slate-500">{item.unit === 'packet' ? 'پاکەت' : 'کارتۆن'}</td>
                      <td className="p-3 font-mono text-emerald-700" dir="ltr">
                        {(item.sellingPrice || item.cartonSellingPrice || 0).toLocaleString()} IQD
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => setDeletingVanItem(item)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="سڕینەوە یان گەڕاندنەوە بۆ کۆگا"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {selectedVanInventory.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        هیچ کاڵایەک لەناو ڤانی ({selectedCashvan}) دا نییە
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center text-slate-400 text-xs">
              تکایە لەسەرەوە کاشڤانێک هەڵبژێرە بۆ بینینی کاڵاکانی نێو ڤانەکەی
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          SUB-TAB 6: TRANSFERS HISTORY (مێژووی وەسڵەکان)
      ======================================================== */}
      {activeTab === 'history' && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-800">مێژووی وەسڵەکانی بارکردنی کاڵا بۆ کاشڤان</h3>
            <span className="text-xs text-slate-500 font-bold">{transfers.length} وەسڵ</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="p-3">ژمارەی وەسڵ</th>
                  <th className="p-3">ناوی کاشڤان</th>
                  <th className="p-3">بەروار</th>
                  <th className="p-3">جۆری کاڵاکان</th>
                  <th className="p-3">کۆی نرخ</th>
                  <th className="p-3 text-center">کردارەکان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transfers.map(trf => (
                  <tr key={trf.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-slate-800" dir="ltr">{trf.transferNo}</td>
                    <td className="p-3 font-bold text-slate-800">{trf.cashvanName}</td>
                    <td className="p-3 text-slate-500 font-mono" dir="ltr">{format(trf.date, 'yyyy/MM/dd - HH:mm')}</td>
                    <td className="p-3 text-slate-600">{trf.items.length} جۆر ({trf.items.reduce((s, it) => s + (it.quantity || 0), 0)} دانە)</td>
                    <td className="p-3 font-mono font-bold text-emerald-700" dir="ltr">{(trf.totalValue || 0).toLocaleString()} IQD</td>
                    <td className="p-3 text-center flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => printTransferReceipt(trf)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                        title="چاپکردنەوەی پسوڵە"
                      >
                        <Printer size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingTransfer(trf)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="سڕینەوە و گەڕاندنەوەی عەدەد"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
                {transfers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      هیچ مێژوویەکی بارکردن تۆمار نەکراوە
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: VIEW & FULFILL REP ORDER
      ======================================================== */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <ShoppingCart size={18} className="text-indigo-400" />
                  وەسڵی تەڵەبیەی: {viewingOrder.marketName}
                </h3>
                <div className="text-xs text-slate-400 mt-0.5">
                  مەندووب: {viewingOrder.repName || 'دیارینەکراو'} | بەروار: {format(viewingOrder.timestamp, 'yyyy/MM/dd - HH:mm')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingOrder(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">ناوی کاڵا</th>
                      <th className="p-3 text-center">عەدەد</th>
                      <th className="p-3 text-center">هەدیە 🎁</th>
                      <th className="p-3 text-center">یەکە</th>
                      <th className="p-3 text-left">کۆی نرخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingOrder.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3 text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-800">{item.name}</td>
                        <td className="p-3 text-center font-bold text-indigo-700 font-mono text-sm">{item.quantity}</td>
                        <td className="p-3 text-center">
                          {(item.giftQuantity || 0) > 0 ? (
                            <span className="bg-yellow-100 text-yellow-900 px-2 py-0.5 rounded-md font-black text-xs">
                              {item.giftQuantity} دانە
                            </span>
                          ) : '-'}
                        </td>
                        <td className="p-3 text-center text-slate-500">{item.unit === 'packet' ? 'پاکەت' : 'کارتۆن'}</td>
                        <td className="p-3 text-left font-mono font-bold text-slate-700" dir="ltr">
                          {(item.totalPrice || 0).toLocaleString()} IQD
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex justify-between items-center text-sm font-bold">
                <span>کۆی گشتی تەڵەبیە:</span>
                <span className="text-emerald-700 font-mono text-base" dir="ltr">
                  {(viewingOrder.totalAmount || 0).toLocaleString()} IQD
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <button
                type="button"
                onClick={() => printRepOrderSlip(viewingOrder)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Printer size={15} />
                <span>چاپکردنی وەسڵ</span>
              </button>

              {viewingOrder.status !== 'completed' && (
                <button
                  type="button"
                  onClick={() => {
                    const ord = viewingOrder;
                    setViewingOrder(null);
                    setFulfillingOrder(ord);
                  }}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95"
                >
                  <Check size={16} />
                  <span>ئامادەکرا و بارکرا (دابەزین لە کۆگا)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: CONFIRM ORDER FULFILLMENT
      ======================================================== */}
      {fulfillingOrder && (
        <ConfirmModal
          isOpen={true}
          title="پەسەندکردن و بارکردنی تەڵەبیەی مەندووب"
          message={`ئایا دڵنیایت لە بارکردن و ئامادەکردنی تەڵەبیەی مارکێتی (${fulfillingOrder.marketName})؟ کاڵاکان بە عەدەدی فرۆش و هەدیە لە کۆگای سەرەکی دادەبەزن.`}
          confirmText="بەڵێ، ئامادەکرا و بارکرا"
          cancelText="پاشگەزبوونەوە"
          onConfirm={() => handleFulfillRepOrder(fulfillingOrder)}
          onClose={() => setFulfillingOrder(null)}
          confirmVariant="success"
          icon="check"
        />
      )}

      {/* ========================================================
          MODAL: CONFIRM DELETE ORDER
      ======================================================== */}
      {deletingOrder && (
        <ConfirmModal
          isOpen={true}
          title="سڕینەوەی تەڵەبیەی مەندووب"
          message={`ئایا دڵنیایت لە سڕینەوەی تەڵەبیەی (${deletingOrder.marketName}) بە بڕی ${(deletingOrder.totalAmount || 0).toLocaleString()} IQD؟`}
          confirmText="سڕینەوە"
          cancelText="پاشگەزبوونەوە"
          onConfirm={handleDeleteRepOrder}
          onClose={() => setDeletingOrder(null)}
          confirmVariant="danger"
          icon="trash"
        />
      )}

      {/* ========================================================
          MODAL: VIEW & FULFILL CASHVAN REQUISITION
      ======================================================== */}
      {viewingRequisition && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Truck size={18} className="text-amber-400" />
                  تەڵەبیەی پێشوەختەی کاشڤان: {viewingRequisition.cashvanName}
                </h3>
                <div className="text-xs text-slate-400 mt-0.5">
                  بەروار: {format(viewingRequisition.createdAt, 'yyyy/MM/dd - HH:mm')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingRequisition(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">ناوی کاڵا</th>
                      <th className="p-3 text-center">بڕی داواکراو</th>
                      <th className="p-3 text-center">یەکە</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingRequisition.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3 text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-800">{item.name}</td>
                        <td className="p-3 text-center font-bold text-amber-700 font-mono text-sm">{item.quantity}</td>
                        <td className="p-3 text-center text-slate-500">{item.unit === 'packet' ? 'پاکەت' : 'کارتۆن'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <button
                type="button"
                onClick={() => printRequisitionReceipt(viewingRequisition)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Printer size={15} />
                <span>چاپکردنی وەسڵ</span>
              </button>

              {viewingRequisition.status !== 'completed' && (
                <button
                  type="button"
                  onClick={() => handleFulfillRequisition(viewingRequisition)}
                  disabled={isProcessing}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95"
                >
                  <Truck size={16} />
                  <span>بارکردن بۆ نێو ڤان</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: DELETE CASHVAN REQUISITION
      ======================================================== */}
      {deletingRequisition && (
        <ConfirmModal
          isOpen={true}
          title="سڕینەوەی تەڵەبیەی کاشڤان"
          message={`ئایا دڵنیایت لە سڕینەوەی ئەم داواکارییە پێشوەختەیە بۆ (${deletingRequisition.cashvanName})؟`}
          confirmText="سڕینەوە"
          cancelText="پاشگەزبوونەوە"
          onConfirm={async () => {
            try {
              await deleteDoc(doc(db, 'cashvan_requisitions', deletingRequisition.id));
              setDeletingRequisition(null);
              alert('تەڵەبیەکە بە سەرکەوتوویی سڕایەوە');
            } catch (err) {
              console.error(err);
              alert('هەڵەیەک ڕوویدا لە سڕینەوە');
            }
          }}
          onClose={() => setDeletingRequisition(null)}
          confirmVariant="danger"
          icon="trash"
        />
      )}

      {/* ========================================================
          MODAL: DELETE TRANSFER
      ======================================================== */}
      {deletingTransfer && (
        <ConfirmModal
          isOpen={true}
          title="سڕینەوەی وەسڵی بارکردنی کاشڤان"
          message={`ئایا دڵنیایت لە سڕینەوەی وەسڵی (${deletingTransfer.transferNo}) بۆ (${deletingTransfer.cashvanName})؟ کاڵاکان لە ڤان کەم دەبنەوە و دەگەڕێنەوە بۆ کۆگای سەرەکی.`}
          confirmText="سڕینەوە و گەڕاندنەوە"
          cancelText="پاشگەزبوونەوە"
          onConfirm={handleDeleteTransfer}
          onClose={() => setDeletingTransfer(null)}
          confirmVariant="danger"
          icon="trash"
        />
      )}

      {/* ========================================================
          MODAL: DELETE VAN INVENTORY ITEM
      ======================================================== */}
      {deletingVanItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-800">
              سڕینەوەی کاڵا لەناو ڤانی ({selectedCashvan})
            </h3>
            <p className="text-xs text-slate-600">
              ئایا دڵنیایت لە سڕینەوەی کاڵای ({deletingVanItem.name}) بە بڕی ({deletingVanItem.quantity} {deletingVanItem.unit === 'packet' ? 'پاکەت' : 'کارتۆن'}) لە ڤانەکە؟
            </p>

            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={returnToWarehouseOnDelete}
                onChange={(e) => setReturnToWarehouseOnDelete(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600"
              />
              <span>بڕەکەی بگەڕێتەوە سەر مەوجودی کۆگای سەرەکی</span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingVanItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                پاشگەزبوونەوە
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (returnToWarehouseOnDelete) {
                      const itemRef = doc(db, 'items', deletingVanItem.itemId);
                      const itemSnap = await getDoc(itemRef);
                      if (itemSnap.exists()) {
                        const curQty = itemSnap.data().quantity || 0;
                        await updateDoc(itemRef, { quantity: curQty + (deletingVanItem.quantity || 0) });
                      }
                    }
                    await deleteDoc(doc(db, 'cashvan_inventory', deletingVanItem.id));
                    setDeletingVanItem(null);
                    alert('کاڵاکە لەناو ڤانەکە سڕایەوە');
                  } catch (err) {
                    console.error(err);
                    alert('هەڵەیەک ڕوویدا');
                  }
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold"
              >
                سڕینەوە
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
