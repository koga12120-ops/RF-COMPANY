import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  updateDoc, 
  doc, 
  addDoc, 
  getDocs, 
  where, 
  deleteDoc, 
  orderBy,
  getDoc
} from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { CashvanSale, CashvanTransfer, Order, Transaction, Market, Item, SalesRep } from '../../types';
import { 
  Truck, 
  CheckCircle2, 
  DollarSign, 
  History, 
  Trash2, 
  Edit2, 
  Printer, 
  FileText, 
  X, 
  AlertTriangle, 
  Check, 
  Calendar, 
  User, 
  Users, 
  ShoppingCart, 
  Search, 
  ArrowDownLeft, 
  Layers, 
  CreditCard,
  Building2,
  Receipt,
  Store,
  Filter,
  Gift
} from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { printDailyRepReceiptPopup, printStatementPopup } from '../../lib/statementPrinter';
import ConfirmModal from '../common/ConfirmModal';

export default function AdminCashvanView() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'rep_sales' | 'cashvan_sales' | 'transfers' | 'daily_statement'>('rep_sales');

  // Core Data
  const [orders, setOrders] = useState<Order[]>([]);
  const [sales, setSales] = useState<CashvanSale[]>([]);
  const [transfers, setTransfers] = useState<CashvanTransfer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [reps, setReps] = useState<SalesRep[]>([]);
  const [cashvans, setCashvans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Sub-Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRepFilter, setSelectedRepFilter] = useState('all');
  const [selectedCashvanFilter, setSelectedCashvanFilter] = useState('all');
  const [repStatusFilter, setRepStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [cashvanStatusFilter, setCashvanStatusFilter] = useState<'all' | 'pending_accounting' | 'accounted'>('all');

  // Daily Statement Tool State
  const [dailyDate, setDailyDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dailySelectedPerson, setDailySelectedPerson] = useState('all');
  const [dailyPersonType, setDailyPersonType] = useState<'all' | 'rep' | 'cashvan'>('all');

  // Settlement States
  const [settlingOrder, setSettlingOrder] = useState<Order | null>(null);
  const [settlingSale, setSettlingSale] = useState<CashvanSale | null>(null);

  // Editing & Deleting
  const [editingSale, setEditingSale] = useState<CashvanSale | null>(null);
  const [editSaleAmount, setEditSaleAmount] = useState<string>('');
  const [deletingSale, setDeletingSale] = useState<CashvanSale | null>(null);

  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null);

  const [editingTransfer, setEditingTransfer] = useState<CashvanTransfer | null>(null);
  const [editTransferValue, setEditTransferValue] = useState<string>('');
  const [deletingTransfer, setDeletingTransfer] = useState<CashvanTransfer | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // 1. Orders (Reps)
    const unsubOrders = onSnapshot(
      query(collection(db, 'orders'), orderBy('timestamp', 'desc')),
      (snapshot) => {
        const data: Order[] = [];
        snapshot.forEach(docSnap => data.push({ id: docSnap.id, ...docSnap.data() } as Order));
        setOrders(data.filter(o => o.status !== 'deleted'));
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'orders')
    );

    // 2. Direct Sales (Cashvans)
    const unsubSales = onSnapshot(
      query(collection(db, 'cashvan_sales'), orderBy('date', 'desc')),
      (snapshot) => {
        const data: CashvanSale[] = [];
        snapshot.forEach(docSnap => data.push({ id: docSnap.id, ...docSnap.data() } as CashvanSale));
        setSales(data);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'cashvan_sales')
    );

    // 3. Stock Transfers (Cashvans)
    const unsubTransfers = onSnapshot(
      query(collection(db, 'cashvan_transfers'), orderBy('date', 'desc')),
      (snapshot) => {
        const data: CashvanTransfer[] = [];
        snapshot.forEach(docSnap => data.push({ id: docSnap.id, ...docSnap.data() } as CashvanTransfer));
        setTransfers(data);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'cashvan_transfers')
    );

    // 4. Transactions (Ledger)
    const unsubTrans = onSnapshot(
      query(collection(db, 'transactions')),
      (snapshot) => {
        const data: Transaction[] = [];
        snapshot.forEach(docSnap => data.push({ id: docSnap.id, ...docSnap.data() } as Transaction));
        setTransactions(data);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'transactions')
    );

    // 5. Markets
    const unsubMarkets = onSnapshot(
      query(collection(db, 'markets')),
      (snapshot) => {
        const data: Market[] = [];
        snapshot.forEach(docSnap => data.push({ id: docSnap.id, ...docSnap.data() } as Market));
        setMarkets(data);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'markets')
    );

    // 6. Items
    const unsubItems = onSnapshot(
      query(collection(db, 'items')),
      (snapshot) => {
        const data: Item[] = [];
        snapshot.forEach(docSnap => data.push({ id: docSnap.id, ...docSnap.data() } as Item));
        setItems(data);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'items')
    );

    // 7. Reps
    const unsubReps = onSnapshot(
      query(collection(db, 'reps')),
      (snapshot) => {
        const data: SalesRep[] = [];
        snapshot.forEach(docSnap => data.push({ id: docSnap.id, ...docSnap.data() } as SalesRep));
        setReps(data);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'reps')
    );

    // 8. Cashvans
    const unsubCV = onSnapshot(
      query(collection(db, 'cashvans')),
      (snapshot) => {
        const data: any[] = [];
        snapshot.forEach(docSnap => data.push({ id: docSnap.id, ...docSnap.data() }));
        setCashvans(data);
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'cashvans')
    );

    return () => {
      unsubOrders();
      unsubSales();
      unsubTransfers();
      unsubTrans();
      unsubMarkets();
      unsubItems();
      unsubReps();
      unsubCV();
    };
  }, []);

  // Filtered Orders (Reps)
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchRep = selectedRepFilter === 'all' || order.repName === selectedRepFilter;
      const matchStatus = repStatusFilter === 'all' 
        ? true 
        : repStatusFilter === 'pending' 
          ? order.status !== 'completed' 
          : order.status === 'completed';
      const matchSearch = (order.marketName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (order.repName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (order.invoiceId || '').includes(searchTerm) ||
                          (order.invoiceNo || '').includes(searchTerm);
      return matchRep && matchStatus && matchSearch;
    });
  }, [orders, selectedRepFilter, repStatusFilter, searchTerm]);

  // Filtered Sales (Cashvans)
  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      if (sale.status === 'deleted') return false;
      const matchCV = selectedCashvanFilter === 'all' || sale.cashvanName === selectedCashvanFilter;
      const matchStatus = cashvanStatusFilter === 'all' 
        ? true 
        : cashvanStatusFilter === 'pending_accounting' 
          ? sale.status === 'pending_accounting' 
          : sale.status === 'accounted';
      const matchSearch = (sale.marketName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (sale.cashvanName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (sale.invoiceNo || '').includes(searchTerm) ||
                          (sale.invoiceId || '').includes(searchTerm);
      return matchCV && matchStatus && matchSearch;
    });
  }, [sales, selectedCashvanFilter, cashvanStatusFilter, searchTerm]);

  // Filtered Transfers
  const filteredTransfers = useMemo(() => {
    return transfers.filter(transfer => {
      const matchCV = selectedCashvanFilter === 'all' || transfer.cashvanName === selectedCashvanFilter;
      const matchSearch = (transfer.cashvanName || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchCV && matchSearch;
    });
  }, [transfers, selectedCashvanFilter, searchTerm]);

  // Gift extraction helpers
  const extractGiftsFromItems = (itemList: any[]) => {
    return (itemList || []).filter(i => i.isGift || (i.name && i.name.includes('(هەدیە)')) || i.price === 0);
  };

  const getGiftTotalCount = (itemList: any[]) => {
    const giftItems = extractGiftsFromItems(itemList);
    return giftItems.reduce((sum, g) => sum + (g.quantity || 0), 0);
  };

  // KPI Calculations
  const repPendingOrders = orders.filter(o => o.status !== 'completed');
  const repPendingTotal = repPendingOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const repCompletedOrders = orders.filter(o => o.status === 'completed');
  const repCompletedTotal = repCompletedOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  const repTotalGifts = orders.reduce((sum, o) => sum + getGiftTotalCount(o.items), 0);
  const repPendingGifts = repPendingOrders.reduce((sum, o) => sum + getGiftTotalCount(o.items), 0);

  const cvPendingSales = sales.filter(s => s.status === 'pending_accounting');
  const cvPendingTotal = cvPendingSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const cvAccountedSales = sales.filter(s => s.status === 'accounted');
  const cvAccountedTotal = cvAccountedSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);

  const cvTotalGifts = sales.filter(s => s.status !== 'deleted').reduce((sum, s) => sum + getGiftTotalCount(s.items), 0);
  const cvPendingGifts = cvPendingSales.reduce((sum, s) => sum + getGiftTotalCount(s.items), 0);

  // Print market statement
  const printStatement = (marketName: string) => {
    const marketTrans = transactions.filter(t => t.relatedEntityId === marketName);
    printStatementPopup(marketName, marketTrans, { isCompany: false, roleTitle: 'مارکێت' });
  };

  // --- Settle Rep Order ---
  const handleSettleOrder = async (type: 'cash' | 'debt') => {
    if (!settlingOrder) return;
    setIsProcessing(true);
    try {
      const invoiceKey = settlingOrder.invoiceId || settlingOrder.id;
      // 1. Check if transaction already exists for this order to avoid duplicate accounting
      const qExisting = query(
        collection(db, 'transactions'),
        where('invoiceNo', '==', invoiceKey)
      );
      const existingSnap = await getDocs(qExisting);

      if (!existingSnap.empty) {
        const transDoc = existingSnap.docs[0];
        await updateDoc(doc(db, 'transactions', transDoc.id), {
          type: type === 'cash' ? 'cash' : 'debt',
          amount: settlingOrder.totalAmount,
          description: type === 'cash' 
            ? `نەقدی ئۆردەری مەندووب (${settlingOrder.repName}) بۆ (${settlingOrder.marketName})` 
            : `قەرزی ئۆردەری مەندووب (${settlingOrder.repName}) بۆ (${settlingOrder.marketName})`,
          relatedEntityId: settlingOrder.marketName
        });
      } else {
        await addDoc(collection(db, 'transactions'), {
          type: type === 'cash' ? 'cash' : 'debt',
          invoiceNo: invoiceKey,
          amount: settlingOrder.totalAmount,
          date: Date.now(),
          description: type === 'cash' 
            ? `نەقدی ئۆردەری مەندووب (${settlingOrder.repName}) بۆ (${settlingOrder.marketName})` 
            : `قەرزی ئۆردەری مەندووب (${settlingOrder.repName}) بۆ (${settlingOrder.marketName})`,
          relatedEntityId: settlingOrder.marketName
        });
      }

      // 2. Update order document
      await updateDoc(doc(db, 'orders', settlingOrder.id), { 
        status: 'completed',
        paymentStatus: type
      });
      
      // 3. Update rep stats
      const repSnap = await getDocs(query(collection(db, 'reps'), where('name', '==', settlingOrder.repName)));
      if (!repSnap.empty) {
        const repDoc = repSnap.docs[0];
        await updateDoc(doc(db, 'reps', repDoc.id), {
          totalSales: (repDoc.data().totalSales || 0) + settlingOrder.totalAmount,
          totalProfit: (repDoc.data().totalProfit || 0) + (settlingOrder.totalProfit || 0)
        });
      }

      setSettlingOrder(null);
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە کاتی تۆمارکردنی تەسفییەی ئۆردەر');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Settle Cashvan Sale ---
  const handleSettleCashvanSale = async (type: 'cash' | 'debt') => {
    if (!settlingSale) return;
    setIsProcessing(true);
    try {
      const invoiceKey = settlingSale.invoiceNo || settlingSale.id;
      // 1. Check if transaction already exists for this sale to avoid duplicates
      const qExisting = query(
        collection(db, 'transactions'),
        where('invoiceNo', '==', invoiceKey)
      );
      const existingSnap = await getDocs(qExisting);

      if (!existingSnap.empty) {
        const transDoc = existingSnap.docs[0];
        await updateDoc(doc(db, 'transactions', transDoc.id), {
          type: type === 'cash' ? 'cash' : 'debt',
          amount: settlingSale.totalAmount,
          description: type === 'cash' 
            ? `نەقدی فرۆشتنی کاشڤان (${settlingSale.cashvanName}) بۆ (${settlingSale.marketName})` 
            : `قەرزی فرۆشتنی کاشڤان (${settlingSale.cashvanName}) بۆ (${settlingSale.marketName})`,
          relatedEntityId: settlingSale.marketName
        });
      } else {
        await addDoc(collection(db, 'transactions'), {
          type: type === 'cash' ? 'cash' : 'debt',
          invoiceNo: invoiceKey,
          amount: settlingSale.totalAmount,
          date: Date.now(),
          description: type === 'cash' 
            ? `نەقدی فرۆشتنی کاشڤان (${settlingSale.cashvanName}) بۆ (${settlingSale.marketName})` 
            : `قەرزی فرۆشتنی کاشڤان (${settlingSale.cashvanName}) بۆ (${settlingSale.marketName})`,
          relatedEntityId: settlingSale.marketName
        });
      }

      // 2. Update sale status
      await updateDoc(doc(db, 'cashvan_sales', settlingSale.id), {
        status: 'accounted',
        paymentType: type
      });
      
      // 3. Update cashvan stats
      const cvSnap = await getDocs(query(collection(db, 'cashvans'), where('name', '==', settlingSale.cashvanName)));
      if (!cvSnap.empty) {
        const cvDoc = cvSnap.docs[0];
        await updateDoc(doc(db, 'cashvans', cvDoc.id), {
          totalSales: (cvDoc.data().totalSales || 0) + settlingSale.totalAmount,
          totalProfit: (cvDoc.data().totalProfit || 0) + (settlingSale.totalProfit || 0)
        });
      }

      setSettlingSale(null);
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە کاتی تۆمارکردنی تەسفییەی فرۆشتنی کاشڤان');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Delete Rep Order Safely ---
  const confirmDeleteOrder = async () => {
    if (!deletingOrder) return;
    try {
      const userName = auth.currentUser?.displayName || auth.currentUser?.email || 'بەڕێوەبەر';
      await updateDoc(doc(db, 'orders', deletingOrder.id), { 
        status: 'deleted', 
        deletedBy: userName,
        deletedAt: Date.now()
      });

      // Also clean up any associated transaction in ledger so debt/sales aren't inflated
      const invoiceKey = deletingOrder.invoiceId || deletingOrder.id;
      const qExisting = query(
        collection(db, 'transactions'),
        where('invoiceNo', '==', invoiceKey)
      );
      const existingSnap = await getDocs(qExisting);
      existingSnap.forEach(async (tDoc) => {
        await deleteDoc(doc(db, 'transactions', tDoc.id));
      });

      setDeletingOrder(null);
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە کاتی سڕینەوەی ئۆردەر');
    }
  };

  // --- Delete Cashvan Sale & Return Items to Cashvan Van ---
  const confirmDeleteCashvanSale = async () => {
    if (!deletingSale) return;
    setIsProcessing(true);
    try {
      const cvSnap = await getDocs(query(collection(db, 'cashvans'), where('name', '==', deletingSale.cashvanName)));
      if (!cvSnap.empty) {
        const cvDoc = cvSnap.docs[0];
        const cvData = cvDoc.data();
        let cvInventory = cvData.inventory || [];

        for (const saleItem of deletingSale.items) {
          const itemDocSnap = await getDoc(doc(db, 'items', saleItem.itemId));
          const conversionFactor = itemDocSnap.exists() && itemDocSnap.data().conversionFactor ? itemDocSnap.data().conversionFactor : 1;
          const returnedPackets = saleItem.unit === 'packet' ? saleItem.quantity : saleItem.quantity * conversionFactor;

          const invIndex = cvInventory.findIndex((i: any) => i.itemId === saleItem.itemId);
          if (invIndex > -1) {
            cvInventory[invIndex].quantity = (cvInventory[invIndex].quantity || 0) + returnedPackets;
          } else {
            cvInventory.push({
              itemId: saleItem.itemId,
              name: saleItem.name,
              quantity: returnedPackets,
              unit: 'packet'
            });
          }
        }

        await updateDoc(doc(db, 'cashvans', cvDoc.id), {
          inventory: cvInventory
        });
      }

      await updateDoc(doc(db, 'cashvan_sales', deletingSale.id), {
        status: 'deleted',
        deletedAt: Date.now(),
        deletedBy: auth.currentUser?.displayName || 'بەڕێوەبەر'
      });

      // Also remove associated transaction from ledger
      const invoiceKey = deletingSale.invoiceNo || deletingSale.id;
      const qExisting = query(
        collection(db, 'transactions'),
        where('invoiceNo', '==', invoiceKey)
      );
      const existingSnap = await getDocs(qExisting);
      existingSnap.forEach(async (tDoc) => {
        await deleteDoc(doc(db, 'transactions', tDoc.id));
      });

      setDeletingSale(null);
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە کاتی سڕینەوەی فرۆشتن');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Edit Cashvan Sale Amount ---
  const handleSaveEditSale = async () => {
    if (!editingSale) return;
    const newAmt = parseFloat(editSaleAmount);
    if (isNaN(newAmt) || newAmt <= 0) {
      alert('تکایە بڕی پارەی دروست بنووسە');
      return;
    }
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'cashvan_sales', editingSale.id), {
        totalAmount: newAmt
      });
      setEditingSale(null);
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە دەستکاریکردنی بڕی پارە');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Print Rep Order Voucher ---
  const printRepOrder = async (order: Order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    let oldDebt = 0;
    try {
      const q = query(
        collection(db, 'transactions'), 
        where('relatedEntityId', '==', order.marketName)
      );
      const snapshot = await getDocs(q);
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.date && data.date < order.timestamp) {
          if (data.type === 'debt' || data.type === 'market_debt') {
            oldDebt += data.amount || 0;
          } else if (data.type === 'paid_debt' || data.type === 'market_paid_debt') {
            oldDebt -= data.amount || 0;
          }
        }
      });
    } catch (e) {
      console.error('Error fetching old debt', e);
    }
    
    const marketObj = markets.find(m => m.name === order.marketName);
    const marketPhone = marketObj?.phone || '-';
    const invoiceNum = order.invoiceId || order.invoiceNo || (order.id || '0').slice(-6);

    const itemsHtml = (order.items || []).map((item, idx) => {
      const isGift = item.isGift || (item.name && item.name.includes('(هەدیە)')) || item.price === 0;
      const unitLabel = item.unit === 'packet' ? 'پاکەت' : 'کارتۆن';
      const total = isGift ? 0 : (item.quantity * item.price);
      return `
        <tr style="${isGift ? 'background-color: #fef9c3;' : ''}">
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px;">${idx + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; ${isGift ? 'color: #854d0e;' : ''}">
            ${item.name} ${isGift ? '<span style="background: #fef08a; color: #713f12; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-right: 4px;">🎁 دیاری / هەدیە</span>' : ''}
          </td>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px;">${unitLabel}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">${item.quantity}</td>
          <td style="text-align: left; border: 1px solid #cbd5e1; padding: 8px;" dir="ltr">
            ${isGift ? '<span style="color: #854d0e; font-weight: bold;">٠ د.ع (هەدیە)</span>' : `${(item.price || 0).toLocaleString()} د.ع`}
          </td>
          <td style="text-align: left; border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;" dir="ltr">
            ${isGift ? '<span style="color: #854d0e; font-weight: bold;">٠ د.ع</span>' : `${total.toLocaleString()} د.ع`}
          </td>
        </tr>
      `;
    }).join('');

    const newTotalDebt = oldDebt + order.totalAmount;

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
            <p style="margin: 5px 0;"><strong>ناونیشان:</strong> ${order.location || '-'}</p>
            <p style="margin: 5px 0;"><strong>مەندووب:</strong> ${order.repName}</p>
          </div>
          <div style="text-align: left; flex: 1;">
            <p style="margin: 5px 0;"><strong>ژ.وەسڵ:</strong> #${invoiceNum}</p>
            <p style="margin: 5px 0;"><strong>بەروار:</strong> ${format(order.timestamp, 'yyyy/MM/dd')}</p>
            <p style="margin: 5px 0;"><strong>کات:</strong> ${format(order.timestamp, 'HH:mm')}</p>
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
          <thead>
            <tr style="background-color: #f1f5f9;">
              <th style="border: 1px solid #cbd5e1; padding: 8px; width: 40px;">#</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">ناوی کاڵا</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; width: 80px;">یەکە</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; width: 80px;">بڕ</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; width: 110px; text-align: left;">نرخ</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; width: 130px; text-align: left;">کۆی گشتی</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <div style="display: flex; justify-content: flex-end; margin-bottom: 30px;">
          <div style="width: 320px; font-size: 14px;">
            <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #cbd5e1;">
              <span>کۆی ئەم وەسڵە:</span>
              <strong dir="ltr">${order.totalAmount.toLocaleString()} د.ع</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #cbd5e1;">
              <span>قەرزی پێشوو:</span>
              <strong dir="ltr" style="color: #d97706;">${oldDebt.toLocaleString()} د.ع</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 16px; border-bottom: 2px solid #1e293b; background: #f8fafc;">
              <span>کۆی گشتی ماوە:</span>
              <strong dir="ltr" style="color: #dc2626;">${newTotalDebt.toLocaleString()} د.ع</strong>
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; margin-top: 50px; font-size: 14px; text-align: center;">
          <div>
            <p style="margin-bottom: 40px;">واژووی مەندووب</p>
            <p>.......................................</p>
          </div>
          <div>
            <p style="margin-bottom: 40px;">واژووی وەرگر (مارکێت)</p>
            <p>.......................................</p>
          </div>
        </div>
      </div>
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>وەسڵی ئۆردەر - #${invoiceNum}</title>
          <style>
            @media print {
              body { margin: 0; padding: 0; }
              @page { margin: 10mm; }
            }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            window.onload = () => {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // --- Print Cashvan Sale Voucher ---
  const printCashvanSale = async (sale: CashvanSale) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    let oldDebt = 0;
    try {
      const q = query(
        collection(db, 'transactions'), 
        where('relatedEntityId', '==', sale.marketName)
      );
      const snapshot = await getDocs(q);
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.date && data.date < sale.date) {
          if (data.type === 'debt' || data.type === 'market_debt') {
            oldDebt += data.amount || 0;
          } else if (data.type === 'paid_debt' || data.type === 'market_paid_debt') {
            oldDebt -= data.amount || 0;
          }
        }
      });
    } catch (e) {
      console.error('Error fetching old debt', e);
    }
    
    const marketObj = markets.find(m => m.name === sale.marketName);
    const marketPhone = marketObj?.phone || '-';
    const invoiceNum = sale.invoiceNo || sale.invoiceId || (sale.id || '0').slice(-6);

    const itemsHtml = (sale.items || []).map((item, idx) => {
      const isGift = item.isGift || (item.name && item.name.includes('(هەدیە)')) || item.price === 0;
      const unitLabel = item.unit === 'packet' ? 'پاکەت' : 'کارتۆن';
      const total = isGift ? 0 : (item.quantity * item.price);
      return `
        <tr style="${isGift ? 'background-color: #fef9c3;' : ''}">
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px;">${idx + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; ${isGift ? 'color: #854d0e;' : ''}">
            ${item.name} ${isGift ? '<span style="background: #fef08a; color: #713f12; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-right: 4px;">🎁 دیاری / هەدیە</span>' : ''}
          </td>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px;">${unitLabel}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">${item.quantity}</td>
          <td style="text-align: left; border: 1px solid #cbd5e1; padding: 8px;" dir="ltr">
            ${isGift ? '<span style="color: #854d0e; font-weight: bold;">٠ د.ع (هەدیە)</span>' : `${(item.price || 0).toLocaleString()} د.ع`}
          </td>
          <td style="text-align: left; border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;" dir="ltr">
            ${isGift ? '<span style="color: #854d0e; font-weight: bold;">٠ د.ع</span>' : `${total.toLocaleString()} د.ع`}
          </td>
        </tr>
      `;
    }).join('');

    const newTotalDebt = oldDebt + sale.totalAmount;

    const printContent = `
      <div dir="rtl" style="font-family: sans-serif; padding: 20px;">
        <div style="display: flex; align-items: flex-start; margin-bottom: 20px;">
          <div style="text-align: right; width: 250px;">
            <img src="${window.location.origin}/LOGO1.jpg" alt="Logo" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: 5px;" onerror="this.style.display='none'" />
            <h2 style="margin: 0; color: #333; font-size: 16px;">وەسڵی فرۆشتنی کاشڤان</h2>
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
            <p style="margin: 5px 0;"><strong>بۆ:</strong> ${sale.marketName}</p>
            <p style="margin: 5px 0;"><strong>ژمارەی مۆبایل:</strong> ${marketPhone}</p>
            <p style="margin: 5px 0;"><strong>کاشڤان:</strong> ${sale.cashvanName}</p>
            <p style="margin: 5px 0;"><strong>شێوازی پارەدان:</strong> ${sale.paymentType === 'cash' ? 'نەقد' : 'قەرز'}</p>
          </div>
          <div style="text-align: left; flex: 1;">
            <p style="margin: 5px 0;"><strong>ژ.وەسڵ:</strong> #${invoiceNum}</p>
            <p style="margin: 5px 0;"><strong>بەروار:</strong> ${format(sale.date, 'yyyy/MM/dd')}</p>
            <p style="margin: 5px 0;"><strong>کات:</strong> ${format(sale.date, 'HH:mm')}</p>
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
          <thead>
            <tr style="background-color: #f1f5f9;">
              <th style="border: 1px solid #cbd5e1; padding: 8px; width: 40px;">#</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">ناوی کاڵا</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; width: 80px;">یەکە</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; width: 80px;">بڕ</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; width: 110px; text-align: left;">نرخ</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px; width: 130px; text-align: left;">کۆی گشتی</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <div style="display: flex; justify-content: flex-end; margin-bottom: 30px;">
          <div style="width: 320px; font-size: 14px;">
            <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #cbd5e1;">
              <span>کۆی ئەم وەسڵە:</span>
              <strong dir="ltr">${sale.totalAmount.toLocaleString()} د.ع</strong>
            </div>
            ${sale.paymentType === 'debt' ? `
              <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #cbd5e1;">
                <span>قەرزی پێشوو:</span>
                <strong dir="ltr" style="color: #d97706;">${oldDebt.toLocaleString()} د.ع</strong>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 16px; border-bottom: 2px solid #1e293b; background: #f8fafc;">
                <span>کۆی گشتی ماوە:</span>
                <strong dir="ltr" style="color: #dc2626;">${newTotalDebt.toLocaleString()} د.ع</strong>
              </div>
            ` : ''}
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; margin-top: 50px; font-size: 14px; text-align: center;">
          <div>
            <p style="margin-bottom: 40px;">واژووی کاشڤان</p>
            <p>.......................................</p>
          </div>
          <div>
            <p style="margin-bottom: 40px;">واژووی وەرگر (مارکێت)</p>
            <p>.......................................</p>
          </div>
        </div>
      </div>
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>وەسڵی کاشڤان - #${invoiceNum}</title>
          <style>
            @media print {
              body { margin: 0; padding: 0; }
              @page { margin: 10mm; }
            }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            window.onload = () => {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // --- Print Transfer Receipt (Stock to Cashvan) ---
  const printTransferReceipt = (transfer: CashvanTransfer) => {
    let totalUnits = 0;
    let totalGrossAmount = 0;

    const itemsHtml = (transfer.items || []).map((item, idx) => {
      const unitLabel = item.unit === 'packet' ? 'پاکەت' : 'کارتۆن';
      const qty = item.quantity || 0;
      const price = item.price || 0;
      const rowTotal = qty * price;
      totalUnits += qty;
      totalGrossAmount += rowTotal;

      return `
        <tr>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px;">${idx + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">${item.name}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; font-size: 14px;">${qty}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px;">${unitLabel}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px; font-family: monospace;" dir="ltr">${price > 0 ? price.toLocaleString() + ' د.ع' : '-'}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; font-family: monospace;" dir="ltr">${rowTotal > 0 ? rowTotal.toLocaleString() + ' د.ع' : '-'}</td>
        </tr>
      `;
    }).join('');

    const finalTotalValue = totalGrossAmount > 0 ? totalGrossAmount : (transfer.totalValue || 0);

    const html = `
      <html dir="rtl" lang="ckb">
        <head>
          <title>پسوڵەی بارکردن بۆ کاشڤان - ${transfer.cashvanName}</title>
          <meta charset="utf-8" />
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: Tahoma, Arial, sans-serif; padding: 24px; color: #1e293b; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #4f46e5; padding-bottom: 12px; }
            .header h2 { margin: 0; color: #3730a3; font-size: 20px; }
            .header p { margin: 4px 0 0 0; font-size: 13px; color: #64748b; }
            .meta { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 14px; background: #f8fafc; padding: 12px; border-radius: 8px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background: #f1f5f9; padding: 10px; border: 1px solid #cbd5e1; text-align: right; font-size: 13px; }
            td { padding: 10px; border: 1px solid #e2e8f0; font-size: 13px; }
            .total-box { font-size: 15px; margin-top: 15px; background: #f8fafc; padding: 14px; border-radius: 8px; border: 2px solid #cbd5e1; }
            .total-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
            .total-row:last-child { margin-bottom: 0; padding-top: 8px; border-top: 1px dashed #cbd5e1; }
            .signatures { display: flex; justify-content: space-between; margin-top: 45px; }
            .sig-line { margin-top: 35px; border-top: 1px dashed #64748b; width: 160px; }
            @media print {
              body { padding: 10px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>پسوڵەی بارکردن و ڕادەستکردنی کاڵا بە کاشڤان</h2>
            <p>بەروار: <span dir="ltr">${format(transfer.date, 'yyyy-MM-dd HH:mm')}</span></p>
          </div>
          <div class="meta">
            <div><span>کاشڤان:</span> <strong>${transfer.cashvanName}</strong></div>
            <div><span>ژمارەی تۆمار:</span> <strong dir="ltr">#${(transfer.id || '').slice(-6)}</strong></div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th>ناوی کاڵا</th>
                <th style="width: 90px; text-align: center;">بڕی بارکراو</th>
                <th style="width: 80px; text-align: center;">یەکە</th>
                <th style="width: 110px; text-align: center;">نرخی تاک</th>
                <th style="width: 130px; text-align: center;">کۆی گشتی بڕی پارە</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml || '<tr><td colspan="6" style="text-align:center;padding:15px;color:#94a3b8;">کاڵا دیاری نەکراوە</td></tr>'}
            </tbody>
          </table>
          <div class="total-box">
            <div class="total-row">
              <span style="font-weight: bold; color: #334155;">کۆی گشتی ژمارەی کاڵا بارکراوەکان:</span>
              <span dir="ltr" style="color: #4f46e5; font-size: 17px; font-weight: bold;">${totalUnits} دانە / کارتۆن</span>
            </div>
            <div class="total-row">
              <span style="font-weight: 900; color: #0f172a; font-size: 16px;">کۆی گشتی بڕی پارەی بارکراو:</span>
              <span dir="ltr" style="color: #15803d; font-size: 20px; font-weight: 900; font-family: monospace;">${finalTotalValue.toLocaleString()} د.ع</span>
            </div>
          </div>
          <div class="signatures">
            <div style="text-align: center;">
              <span>ڕادەستکار (لێپرسراوی کۆگا)</span>
              <div class="sig-line"></div>
            </div>
            <div style="text-align: center;">
              <span>وەرگر (کاشڤان)</span>
              <div class="sig-line"></div>
            </div>
          </div>
          <script>
            window.onload = () => window.print();
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

  // --- Print Comprehensive Daily Work Statement ---
  const handlePrintDailyReport = () => {
    const targetDate = dailyDate ? new Date(dailyDate) : new Date();
    const dayStart = startOfDay(targetDate).getTime();
    const dayEnd = endOfDay(targetDate).getTime();

    // 1. Filter Sales
    const daySales = sales.filter(s => {
      const isDate = s.date >= dayStart && s.date <= dayEnd;
      const isPerson = dailySelectedPerson === 'all' || s.cashvanName === dailySelectedPerson;
      return isDate && isPerson && s.status !== 'deleted';
    });

    // 2. Filter Rep Orders
    const dayOrders = orders.filter(o => {
      const isDate = o.timestamp >= dayStart && o.timestamp <= dayEnd;
      const isPerson = dailySelectedPerson === 'all' || o.repName === dailySelectedPerson;
      return isDate && isPerson && o.status !== 'deleted';
    });

    // Collections from transactions (market paid debts)
    const dayCollections = transactions.filter(t => {
      const isDate = t.date >= dayStart && t.date <= dayEnd;
      const isPaid = t.type === 'paid_debt' || t.type === 'market_paid_debt';
      if (!isDate || !isPaid) return false;

      if (dailySelectedPerson === 'all') return true;

      return t.collectorName === dailySelectedPerson ||
             t.repName === dailySelectedPerson ||
             t.cashvanName === dailySelectedPerson ||
             (t.description && t.description.includes(dailySelectedPerson));
    }).map(t => ({
      id: t.id,
      marketName: t.relatedEntityId || 'مارکێت',
      invoiceNo: t.invoiceNo,
      amount: t.amount || 0,
      notes: t.description || 'وەرگرتنەوەی قەرز'
    }));

    const isRepSelected = reps.some(r => r.name === dailySelectedPerson);
    const roleTitle = isRepSelected ? 'مەندووب' : 'کاشڤان';

    const formattedSales = [
      ...daySales.map(s => ({
        id: s.id,
        marketName: s.marketName,
        invoiceNo: s.invoiceNo,
        amount: s.totalAmount || 0,
        paymentType: s.paymentType === 'debt' ? 'قەرز' : 'نەقد'
      })),
      ...dayOrders.map(o => ({
        id: o.id,
        marketName: o.marketName,
        invoiceNo: o.invoiceId || o.id.slice(-6),
        amount: o.totalAmount || 0,
        paymentType: o.paymentStatus === 'debt' ? 'قەرز' : 'نەقد'
      }))
    ];

    const dayGifts: {
      id?: string;
      marketName: string;
      invoiceNo?: string;
      name: string;
      quantity: number;
      unit?: string;
    }[] = [];

    daySales.forEach(s => {
      (s.items || []).forEach(item => {
        const isGift = item.isGift || (item.name && item.name.includes('(هەدیە)')) || item.price === 0;
        if (isGift && (item.quantity || 0) > 0) {
          dayGifts.push({
            id: s.id,
            marketName: s.marketName,
            invoiceNo: s.invoiceNo,
            name: item.name.replace(' (هەدیە)', ''),
            quantity: item.quantity,
            unit: item.unit
          });
        }
      });
    });

    dayOrders.forEach(o => {
      (o.items || []).forEach(item => {
        const isGift = item.isGift || (item.name && item.name.includes('(هەدیە)')) || item.price === 0;
        if (isGift && (item.quantity || 0) > 0) {
          dayGifts.push({
            id: o.id,
            marketName: o.marketName,
            invoiceNo: o.invoiceId || o.invoiceNo || o.id.slice(-6),
            name: item.name.replace(' (هەدیە)', ''),
            quantity: item.quantity,
            unit: item.unit
          });
        }
      });
    });

    printDailyRepReceiptPopup({
      repName: dailySelectedPerson === 'all' ? 'سەرجەم مەندووب و کاشڤانەکان' : dailySelectedPerson,
      roleTitle: dailySelectedPerson === 'all' ? 'مەندووب و کاشڤان' : roleTitle,
      date: targetDate.getTime(),
      sales: formattedSales,
      collections: dayCollections,
      gifts: dayGifts
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Overview Bar */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Truck size={24} />
            </div>
            <span>حساباتی مەندووب و کاشڤان</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            بەڕێوەبردنی گشتگیر بۆ تەسفییەی فرۆشتنی مەندووبەکان، فرۆشتنی کاشڤانەکان، بارکردنی کاڵا لە کۆگا، و وەسڵی ڕۆژانە.
          </p>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex flex-col sm:flex-row gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
        <button
          onClick={() => setActiveTab('rep_sales')}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 ${
            activeTab === 'rep_sales' 
              ? 'bg-indigo-600 text-white shadow-sm' 
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <ShoppingCart size={18} />
          <span>تەڵەبیە</span>
          {repPendingOrders.length > 0 && (
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono ${
              activeTab === 'rep_sales' ? 'bg-indigo-800 text-indigo-100' : 'bg-amber-100 text-amber-800'
            }`}>
              {repPendingOrders.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('cashvan_sales')}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 ${
            activeTab === 'cashvan_sales' 
              ? 'bg-indigo-600 text-white shadow-sm' 
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Truck size={18} />
          <span>کاشڤان</span>
          {cvPendingSales.length > 0 && (
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono ${
              activeTab === 'cashvan_sales' ? 'bg-indigo-800 text-indigo-100' : 'bg-amber-100 text-amber-800'
            }`}>
              {cvPendingSales.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('transfers')}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 ${
            activeTab === 'transfers' 
              ? 'bg-indigo-600 text-white shadow-sm' 
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Layers size={18} />
          <span>بارکردنی کاڵا بۆ کاشڤان</span>
        </button>

        <button
          onClick={() => setActiveTab('daily_statement')}
          className={`py-3 px-5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 ${
            activeTab === 'daily_statement' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
          }`}
        >
          <FileText size={18} />
          <span>وەسڵی ڕۆژانە و ژمێریاری</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SALES REPS (MANDOUB) ORDERS & SETTLEMENTS                          */}
      {/* ========================================================================= */}
      {activeTab === 'rep_sales' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-bold">کۆی ئۆردەرەکانی مەندووب</div>
                <div className="text-2xl font-black text-slate-900 font-mono mt-1">{orders.length}</div>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <ShoppingCart size={24} />
              </div>
            </div>

            <div className="bg-amber-50/70 p-5 rounded-2xl border border-amber-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-amber-800 font-bold">چاوەڕێی تەسفییە و حیسابات</div>
                <div className="text-2xl font-black text-amber-700 font-mono mt-1" dir="ltr">
                  {repPendingTotal.toLocaleString()} د.ع
                </div>
                <div className="text-[11px] text-amber-600 mt-0.5">({repPendingOrders.length} ئۆردەری تەسفییەنەکراو)</div>
              </div>
              <div className="p-3 bg-amber-100 text-amber-700 rounded-xl">
                <History size={24} />
              </div>
            </div>

            <div className="bg-emerald-50/70 p-5 rounded-2xl border border-emerald-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-emerald-800 font-bold">تەسفییەکراو (چووەتە حیسابات)</div>
                <div className="text-2xl font-black text-emerald-700 font-mono mt-1" dir="ltr">
                  {repCompletedTotal.toLocaleString()} د.ع
                </div>
                <div className="text-[11px] text-emerald-600 mt-0.5">({repCompletedOrders.length} ئۆردەری تەسفییەکراو)</div>
              </div>
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
                <CheckCircle2 size={24} />
              </div>
            </div>

            <div className="bg-yellow-50/80 p-5 rounded-2xl border border-yellow-300 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-yellow-900 font-bold">کۆی هەدیەکان (مەندووب)</div>
                <div className="text-2xl font-black text-yellow-800 font-mono mt-1">
                  {repTotalGifts} <span className="text-sm font-bold">دانە</span>
                </div>
                <div className="text-[11px] text-yellow-700 mt-0.5">({repPendingGifts} دانە چاوەڕێی تەسفییە)</div>
              </div>
              <div className="p-3 bg-yellow-200 text-yellow-800 rounded-xl">
                <Gift size={24} />
              </div>
            </div>
          </div>

          {/* Table Container & Filter Bar */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                {/* Rep Filter Dropdown */}
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                  <User size={16} className="text-indigo-600 shrink-0" />
                  <select
                    value={selectedRepFilter}
                    onChange={(e) => setSelectedRepFilter(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="all">سەرجەم مەندووبەکان ({reps.length})</option>
                    {reps.map(r => (
                      <option key={`rep-filter-${r.id}`} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl">
                  <button
                    onClick={() => setRepStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      repStatusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    هەموو ({orders.length})
                  </button>
                  <button
                    onClick={() => setRepStatusFilter('pending')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      repStatusFilter === 'pending' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    چاوەڕێی تەسفییە ({repPendingOrders.length})
                  </button>
                  <button
                    onClick={() => setRepStatusFilter('completed')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      repStatusFilter === 'completed' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    تەسفییەکراو ({repCompletedOrders.length})
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-72">
                <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="گەڕان بەپێی مارکێت، مەندووب، ژ.وەسڵ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Orders Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-100">
                  <tr>
                    <th className="p-4">ژ.وەسڵ</th>
                    <th className="p-4">مەندووب</th>
                    <th className="p-4">مارکێت</th>
                    <th className="p-4">بەروار و کات</th>
                    <th className="p-4">کۆی بڕ و هەدیە</th>
                    <th className="p-4">دۆخی تەسفییە</th>
                    <th className="p-4 text-center">کردارەکان</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredOrders.map(order => {
                    const isCompleted = order.status === 'completed';
                    const invNo = order.invoiceId || order.id.slice(-6);
                    const giftCount = getGiftTotalCount(order.items);

                    return (
                      <tr key={order.id} className="hover:bg-slate-50/70 transition">
                        <td className="p-4 font-mono font-bold text-slate-700 text-xs" dir="ltr">
                          #{invNo}
                        </td>
                        <td className="p-4 font-bold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <User size={15} className="text-indigo-600" />
                            <span>{order.repName}</span>
                          </div>
                        </td>
                        <td className="p-4 font-medium text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <Store size={15} className="text-slate-400" />
                            <span>{order.marketName}</span>
                          </div>
                        </td>
                        <td className="p-4 text-slate-500 text-xs font-mono" dir="ltr">
                          {format(order.timestamp, 'yyyy/MM/dd HH:mm')}
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-indigo-600 font-mono" dir="ltr">
                            {(order.totalAmount || 0).toLocaleString()} د.ع
                          </div>
                          {giftCount > 0 && (
                            <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 border border-yellow-300 text-[11px] font-bold px-2 py-0.5 rounded-md mt-1">
                              <Gift size={12} className="text-yellow-700 fill-yellow-400" />
                              {giftCount} هەدیە
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          {isCompleted ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 w-fit">
                              <CheckCircle2 size={13} />
                              تەسفییەکراوە ({order.paymentStatus === 'cash' ? 'نەقد' : 'قەرز'})
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 flex items-center gap-1 w-fit">
                              <History size={13} />
                              چاوەڕێی تەسفییەیە
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {!isCompleted ? (
                              <button
                                onClick={() => setSettlingOrder(order)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition flex items-center gap-1 text-xs shadow-2xs"
                                title="تەسفییەکردنی ئۆردەر"
                              >
                                <CheckCircle2 size={14} />
                                <span>تەسفییە</span>
                              </button>
                            ) : (
                              <span className="text-xs text-emerald-600 font-bold px-2 py-1 bg-emerald-50 rounded-lg">
                                تەواوکراوە
                              </span>
                            )}

                            <button
                              onClick={() => printRepOrder(order)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                              title="چاپکردنی پسوڵەی ئۆردەر"
                            >
                              <Printer size={16} />
                            </button>

                            <button
                              onClick={() => printStatement(order.marketName)}
                              className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition"
                              title="کەشف حیسابی مارکێت"
                            >
                              <FileText size={16} />
                            </button>

                            <button
                              onClick={() => setDeletingOrder(order)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition"
                              title="سڕینەوەی ئۆردەر"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <ShoppingCart size={32} className="text-slate-300" />
                          <span>هیچ ئۆردەرێک نەدۆزرایەوە</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CASHVAN DIRECT SALES & SETTLEMENTS                                  */}
      {/* ========================================================================= */}
      {activeTab === 'cashvan_sales' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-bold">کۆی فرۆشتنەکانی کاشڤان</div>
                <div className="text-2xl font-black text-slate-900 font-mono mt-1">{sales.length}</div>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <Truck size={24} />
              </div>
            </div>

            <div className="bg-amber-50/70 p-5 rounded-2xl border border-amber-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-amber-800 font-bold">چاوەڕێی حیسابات</div>
                <div className="text-2xl font-black text-amber-700 font-mono mt-1" dir="ltr">
                  {cvPendingTotal.toLocaleString()} د.ع
                </div>
                <div className="text-[11px] text-amber-600 mt-0.5">({cvPendingSales.length} فرۆشتنی چاوەڕوانکراو)</div>
              </div>
              <div className="p-3 bg-amber-100 text-amber-700 rounded-xl">
                <History size={24} />
              </div>
            </div>

            <div className="bg-emerald-50/70 p-5 rounded-2xl border border-emerald-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-emerald-800 font-bold">چووەتە حیسابات (تەسفییەکراو)</div>
                <div className="text-2xl font-black text-emerald-700 font-mono mt-1" dir="ltr">
                  {cvAccountedTotal.toLocaleString()} د.ع
                </div>
                <div className="text-[11px] text-emerald-600 mt-0.5">({cvAccountedSales.length} فرۆشتنی حیسابکراو)</div>
              </div>
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
                <CheckCircle2 size={24} />
              </div>
            </div>

            <div className="bg-yellow-50/80 p-5 rounded-2xl border border-yellow-300 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-yellow-900 font-bold">کۆی هەدیەکان (کاشڤان)</div>
                <div className="text-2xl font-black text-yellow-800 font-mono mt-1">
                  {cvTotalGifts} <span className="text-sm font-bold">دانە</span>
                </div>
                <div className="text-[11px] text-yellow-700 mt-0.5">({cvPendingGifts} دانە چاوەڕێی حیسابات)</div>
              </div>
              <div className="p-3 bg-yellow-200 text-yellow-800 rounded-xl">
                <Gift size={24} />
              </div>
            </div>
          </div>

          {/* Table Container & Filter Bar */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                {/* Cashvan Filter Dropdown */}
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                  <Truck size={16} className="text-indigo-600 shrink-0" />
                  <select
                    value={selectedCashvanFilter}
                    onChange={(e) => setSelectedCashvanFilter(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="all">سەرجەم کاشڤانەکان ({cashvans.length})</option>
                    {cashvans.map(c => (
                      <option key={`cv-filter-${c.id}`} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl">
                  <button
                    onClick={() => setCashvanStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      cashvanStatusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    هەموو ({sales.length})
                  </button>
                  <button
                    onClick={() => setCashvanStatusFilter('pending_accounting')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      cashvanStatusFilter === 'pending_accounting' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    چاوەڕێی حیسابات ({cvPendingSales.length})
                  </button>
                  <button
                    onClick={() => setCashvanStatusFilter('accounted')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      cashvanStatusFilter === 'accounted' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    چووەتە حیسابات ({cvAccountedSales.length})
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-72">
                <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="گەڕان بەپێی مارکێت، کاشڤان، ژ.وەسڵ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Sales Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-100">
                  <tr>
                    <th className="p-4">ژ.وەسڵ</th>
                    <th className="p-4">کاشڤان</th>
                    <th className="p-4">مارکێت</th>
                    <th className="p-4">بەروار و کات</th>
                    <th className="p-4">بڕی فرۆشراو و هەدیە</th>
                    <th className="p-4">دۆخی حیسابات</th>
                    <th className="p-4 text-center">کردارەکان</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredSales.map(sale => {
                    const isAccounted = sale.status === 'accounted';
                    const invNo = sale.invoiceNo || sale.invoiceId || sale.id.slice(-6);
                    const giftCount = getGiftTotalCount(sale.items);

                    return (
                      <tr key={sale.id} className="hover:bg-slate-50/70 transition">
                        <td className="p-4 font-mono font-bold text-slate-700 text-xs" dir="ltr">
                          #{invNo}
                        </td>
                        <td className="p-4 font-bold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <Truck size={15} className="text-blue-600" />
                            <span>{sale.cashvanName}</span>
                          </div>
                        </td>
                        <td className="p-4 font-medium text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <Store size={15} className="text-slate-400" />
                            <span>{sale.marketName}</span>
                          </div>
                        </td>
                        <td className="p-4 text-slate-500 text-xs font-mono" dir="ltr">
                          {format(sale.date, 'yyyy/MM/dd HH:mm')}
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-indigo-600 font-mono" dir="ltr">
                            {sale.totalAmount.toLocaleString()} د.ع
                          </div>
                          {giftCount > 0 && (
                            <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 border border-yellow-300 text-[11px] font-bold px-2 py-0.5 rounded-md mt-1">
                              <Gift size={12} className="text-yellow-700 fill-yellow-400" />
                              {giftCount} هەدیە
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          {isAccounted ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 w-fit">
                              <CheckCircle2 size={13} />
                              چووەتە حیسابات ({sale.paymentType === 'cash' ? 'نەقد' : 'قەرز'})
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 flex items-center gap-1 w-fit">
                              <History size={13} />
                              چاوەڕێی حیسابات
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {!isAccounted ? (
                              <button
                                onClick={() => setSettlingSale(sale)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition flex items-center gap-1 text-xs shadow-2xs"
                                title="تەسفییە و حیساباتی فرۆشتن"
                              >
                                <CheckCircle2 size={14} />
                                <span>تەسفییە</span>
                              </button>
                            ) : (
                              <span className="text-xs text-emerald-600 font-bold px-2 py-1 bg-emerald-50 rounded-lg">
                                حیسابکراوە
                              </span>
                            )}

                            <button
                              onClick={() => printCashvanSale(sale)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                              title="چاپکردنی پسوڵەی کاشڤان"
                            >
                              <Printer size={16} />
                            </button>

                            <button
                              onClick={() => printStatement(sale.marketName)}
                              className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition"
                              title="کەشف حیسابی مارکێت"
                            >
                              <FileText size={16} />
                            </button>

                            <button
                              onClick={() => {
                                setEditingSale(sale);
                                setEditSaleAmount(sale.totalAmount.toString());
                              }}
                              className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition"
                              title="دەستکاری بڕی پارە"
                            >
                              <Edit2 size={16} />
                            </button>

                            <button
                              onClick={() => setDeletingSale(sale)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition"
                              title="سڕینەوەی وەسڵ (کاڵاکان دەگەڕێنەوە ڤان)"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredSales.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Truck size={32} className="text-slate-300" />
                          <span>هیچ فرۆشتنێکی کاشڤان نەدۆزرایەوە</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: WAREHOUSE TRANSFERS TO CASHVAN                                     */}
      {/* ========================================================================= */}
      {activeTab === 'transfers' && (
        <div className="space-y-6">
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Layers size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">مێژووی بارکردنی کاڵا بۆ کاشڤان لە کۆگاوە</h3>
                  <div className="text-xs text-slate-500">کۆی تۆمارەکانی پێدانی کاڵا بە کاشڤانەکان</div>
                </div>
              </div>

              {/* Cashvan Filter Dropdown */}
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                <Truck size={16} className="text-indigo-600 shrink-0" />
                <select
                  value={selectedCashvanFilter}
                  onChange={(e) => setSelectedCashvanFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
                >
                  <option value="all">سەرجەم کاشڤانەکان ({cashvans.length})</option>
                  {cashvans.map(c => (
                    <option key={`transfer-cv-${c.id}`} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-100">
                  <tr>
                    <th className="p-4">کاشڤان</th>
                    <th className="p-4">بەروار</th>
                    <th className="p-4">کاڵا بارکراوەکان</th>
                    <th className="p-4">کۆی بەها</th>
                    <th className="p-4 text-center">کردارەکان</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredTransfers.map(transfer => {
                    return (
                      <tr key={transfer.id} className="hover:bg-slate-50/70 transition">
                        <td className="p-4 font-bold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <Truck size={15} className="text-indigo-600" />
                            <span>{transfer.cashvanName}</span>
                          </div>
                        </td>
                        <td className="p-4 text-slate-500 text-xs font-mono" dir="ltr">
                          {format(transfer.date, 'yyyy/MM/dd HH:mm')}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1.5 max-w-md">
                            {(transfer.items || []).map((item, idx) => (
                              <span key={idx} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-xs font-medium">
                                {item.name}: <strong>{item.quantity}</strong> {item.unit === 'packet' ? 'پاکەت' : 'کارتۆن'}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-4 font-bold text-indigo-600 font-mono" dir="ltr">
                          {(transfer.totalValue || 0).toLocaleString()} د.ع
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => printTransferReceipt(transfer)}
                              className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition"
                              title="چاپکردنی پسوڵەی بارکردن"
                            >
                              <Printer size={16} />
                            </button>
                            <button
                              onClick={() => setDeletingTransfer(transfer)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition"
                              title="سڕینەوە"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredTransfers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-slate-400">
                        هیچ تۆمارێکی بارکردنی کاڵا نەدۆزرایەوە
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: DAILY COMPREHENSIVE ACTIVITY STATEMENTS & RECEIPTS                */}
      {/* ========================================================================= */}
      {activeTab === 'daily_statement' && (
        <div className="space-y-6">
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex p-3 bg-blue-50 text-blue-600 rounded-2xl mb-1">
                  <FileText size={32} />
                </div>
                <h2 className="text-lg font-black text-slate-900">چاپکردنی وەسڵی ڕۆژانەی مەندووب و کاشڤان</h2>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  ئەم وەسڵە کۆی فرۆشراوەکان (نەقد و قەرز)، قەرزە وەرگیراوەکانی مارکێتەکان، و کۆی گشتی پارەی نەقدی ڕادەستکراو دەردەخات.
                </p>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">بەرواری کارکردن *</label>
                    <div className="relative">
                      <Calendar className="absolute right-3 top-2.5 text-slate-400" size={16} />
                      <input
                        type="date"
                        value={dailyDate}
                        onChange={(e) => setDailyDate(e.target.value)}
                        className="w-full pl-3 pr-9 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">هەڵبژاردنی کەسی دیاریکراو *</label>
                    <select
                      value={dailySelectedPerson}
                      onChange={(e) => setDailySelectedPerson(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="all">سەرجەم مەندووب و کاشڤانەکان</option>
                      <optgroup label="مەندووبەکان">
                        {reps.map(r => (
                          <option key={`daily-rep-${r.id}`} value={r.name}>👤 مەندووب: {r.name}</option>
                        ))}
                      </optgroup>
                      <optgroup label="کاشڤانەکان">
                        {cashvans.map(c => (
                          <option key={`daily-cv-${c.id}`} value={c.name}>🚚 کاشڤان: {c.name}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handlePrintDailyReport}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-sm text-sm"
                  >
                    <Printer size={18} />
                    <span>چاپکردن و دەرکردنی پسوڵەی ڕۆژانە</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SETTLE REP ORDER                                                    */}
      {/* ========================================================================= */}
      {settlingOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200" dir="rtl">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
              <h3 className="font-bold text-indigo-900 text-base flex items-center gap-2">
                <CheckCircle2 className="text-indigo-600" size={20} />
                تەسفییە و حیساباتی ئۆردەری مەندووب
              </h3>
              <button 
                onClick={() => setSettlingOrder(null)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
                disabled={isProcessing}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">مەندووب:</span>
                  <span className="font-bold text-slate-800">{settlingOrder.repName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">مارکێت:</span>
                  <span className="font-bold text-slate-800">{settlingOrder.marketName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">کۆی بڕی پارە:</span>
                  <span className="font-bold text-indigo-600 font-mono" dir="ltr">
                    {(settlingOrder.totalAmount || 0).toLocaleString()} د.ع
                  </span>
                </div>
              </div>

              {extractGiftsFromItems(settlingOrder.items).length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-yellow-900">
                    <Gift size={15} className="text-yellow-700 fill-yellow-400" />
                    <span>کاڵای هەدیە / بێ بەرامبەر لەم وەسڵەدا:</span>
                  </div>
                  <div className="space-y-1 pt-1">
                    {extractGiftsFromItems(settlingOrder.items).map((g, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-yellow-800 font-medium">
                        <span>🎁 {g.name}</span>
                        <span className="font-bold">{g.quantity} {g.unit === 'packet' ? 'پاکەت' : 'کارتۆن'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-600 text-center font-medium">
                تکایە جۆری تەسفییەکردنی ئەم وەسڵە دیاری بکە:
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => handleSettleOrder('cash')}
                  disabled={isProcessing}
                  className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition flex flex-col items-center justify-center gap-1 shadow-sm"
                >
                  <DollarSign size={20} />
                  <span>تەسفییە بە نەقد</span>
                  <span className="text-[10px] opacity-80">(دەچێتە قاصەی نەقد)</span>
                </button>

                <button
                  onClick={() => handleSettleOrder('debt')}
                  disabled={isProcessing}
                  className="py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition flex flex-col items-center justify-center gap-1 shadow-sm"
                >
                  <CreditCard size={20} />
                  <span>تەسفییە بە قەرز</span>
                  <span className="text-[10px] opacity-80">(دەچێتە قەرزی مارکێت)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SETTLE CASHVAN SALE                                                */}
      {/* ========================================================================= */}
      {settlingSale && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200" dir="rtl">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
              <h3 className="font-bold text-indigo-900 text-base flex items-center gap-2">
                <CheckCircle2 className="text-indigo-600" size={20} />
                تەسفییە و حیساباتی فرۆشتنی کاشڤان
              </h3>
              <button 
                onClick={() => setSettlingSale(null)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
                disabled={isProcessing}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">کاشڤان:</span>
                  <span className="font-bold text-slate-800">{settlingSale.cashvanName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">مارکێت:</span>
                  <span className="font-bold text-slate-800">{settlingSale.marketName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">کۆی بڕی پارە:</span>
                  <span className="font-bold text-indigo-600 font-mono" dir="ltr">
                    {(settlingSale.totalAmount || 0).toLocaleString()} د.ع
                  </span>
                </div>
              </div>

              {extractGiftsFromItems(settlingSale.items).length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-yellow-900">
                    <Gift size={15} className="text-yellow-700 fill-yellow-400" />
                    <span>کاڵای هەدیە / بێ بەرامبەر لەم وەسڵەدا:</span>
                  </div>
                  <div className="space-y-1 pt-1">
                    {extractGiftsFromItems(settlingSale.items).map((g, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-yellow-800 font-medium">
                        <span>🎁 {g.name}</span>
                        <span className="font-bold">{g.quantity} {g.unit === 'packet' ? 'پاکەت' : 'کارتۆن'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-600 text-center font-medium">
                تکایە جۆری تەسفییەکردنی ئەم وەسڵە دیاری بکە:
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => handleSettleCashvanSale('cash')}
                  disabled={isProcessing}
                  className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition flex flex-col items-center justify-center gap-1 shadow-sm"
                >
                  <DollarSign size={20} />
                  <span>تەسفییە بە نەقد</span>
                  <span className="text-[10px] opacity-80">(دەچێتە قاصەی نەقد)</span>
                </button>

                <button
                  onClick={() => handleSettleCashvanSale('debt')}
                  disabled={isProcessing}
                  className="py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition flex flex-col items-center justify-center gap-1 shadow-sm"
                >
                  <CreditCard size={20} />
                  <span>تەسفییە بە قەرز</span>
                  <span className="text-[10px] opacity-80">(دەچێتە قەرزی مارکێت)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT CASHVAN SALE AMOUNT                                           */}
      {/* ========================================================================= */}
      {editingSale && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200" dir="rtl">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-blue-50">
              <h3 className="font-bold text-blue-900 text-base flex items-center gap-2">
                <Edit2 className="text-blue-600" size={18} />
                دەستکاری بڕی پارەی فرۆشتنی کاشڤان
              </h3>
              <button 
                onClick={() => setEditingSale(null)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
                disabled={isProcessing}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">بڕی نوێی پارە (د.ع) *</label>
                <input
                  type="number"
                  value={editSaleAmount}
                  onChange={(e) => setEditSaleAmount(e.target.value)}
                  dir="ltr"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono font-bold"
                  autoFocus
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  onClick={handleSaveEditSale}
                  disabled={isProcessing}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition text-sm flex items-center justify-center gap-2 shadow-sm"
                >
                  <Check size={18} />
                  <span>پاشەکەوتکردن</span>
                </button>
                <button
                  onClick={() => setEditingSale(null)}
                  disabled={isProcessing}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-sm"
                >
                  پاشگەزبوونەوە
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONFIRM DELETE MODALS                                                     */}
      {/* ========================================================================= */}
      <ConfirmModal
        isOpen={!!deletingOrder}
        onClose={() => setDeletingOrder(null)}
        onConfirm={confirmDeleteOrder}
        title="سڕینەوەی ئۆردەری مەندووب"
        message={`ئایا دڵنیایت لە سڕینەوەی ئەم ئۆردەرەی مەندووب (${deletingOrder?.repName}) بۆ (${deletingOrder?.marketName})؟`}
        itemName={deletingOrder?.marketName}
        details={deletingOrder ? [
          { label: 'مەندووب', value: deletingOrder.repName },
          { label: 'مارکێت', value: deletingOrder.marketName },
          { label: 'بڕی پارە', value: `${(deletingOrder.totalAmount || 0).toLocaleString()} د.ع` }
        ] : []}
      />

      <ConfirmModal
        isOpen={!!deletingSale}
        onClose={() => setDeletingSale(null)}
        onConfirm={confirmDeleteCashvanSale}
        title="سڕینەوەی وەسڵی فرۆشتنی کاشڤان"
        message="ئایا دڵنیایت لە سڕینەوەی ئەم وەسڵە؟ کاڵاکان بە شێوەی ئۆتۆماتیکی دەگەڕێنەوە ناو ڤانی کاشڤانەکە."
        itemName={deletingSale?.marketName}
        details={deletingSale ? [
          { label: 'کاشڤان', value: deletingSale.cashvanName },
          { label: 'مارکێت', value: deletingSale.marketName },
          { label: 'بڕی پارە', value: `${(deletingSale.totalAmount || 0).toLocaleString()} د.ع` }
        ] : []}
      />

      <ConfirmModal
        isOpen={!!deletingTransfer}
        onClose={() => setDeletingTransfer(null)}
        onConfirm={async () => {
          if (!deletingTransfer) return;
          try {
            await deleteDoc(doc(db, 'cashvan_transfers', deletingTransfer.id));
            setDeletingTransfer(null);
          } catch (e) {
            console.error(e);
            alert('هەڵەیەک ڕوویدا لە سڕینەوەی بارکردن');
          }
        }}
        title="سڕینەوەی تۆماری بارکردنی کاڵا"
        message={`ئایا دڵنیایت لە سڕینەوەی ئەم تۆمارەی کاڵا بارکردن بۆ (${deletingTransfer?.cashvanName})؟`}
        itemName={deletingTransfer?.cashvanName}
        details={deletingTransfer ? [
          { label: 'کاشڤان', value: deletingTransfer.cashvanName },
          { label: 'کۆی بەها', value: `${(deletingTransfer.totalValue || 0).toLocaleString()} د.ع` }
        ] : []}
      />
    </div>
  );
}
