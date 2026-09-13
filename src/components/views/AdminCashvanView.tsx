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
  getDoc,
  setDoc
} from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { renameRepOrCashvan, syncAllRepsAndCashvans } from '../../lib/syncHelper';
import { CashvanSale, CashvanTransfer, Order, Transaction, Market, Item, SalesRep } from '../../types';
import { 
  Plus,
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
  Gift,
  Copy,
  BarChart3,
  TrendingUp,
  Package,
  Clock,
  Eye,
  ChevronDown,
  ChevronUp,
  Phone,
  ArrowUpDown
} from 'lucide-react';
import { 
  format, 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  subDays,
  subWeeks,
  subMonths 
} from 'date-fns';
import { printDailyRepReceiptPopup, printStatementPopup, renderReceiptHeaderHtml } from '../../lib/statementPrinter';
import ConfirmModal from '../common/ConfirmModal';
import { getCompanySettings } from '../../lib/companySettings';

export default function AdminCashvanView() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'rep_sales' | 'cashvan_sales' | 'period_stats' | 'transfers' | 'daily_statement'>('rep_sales');

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

  // Cashvan Accounts Management States
  const [showAddCVModal, setShowAddCVModal] = useState(false);
  const [newCVName, setNewCVName] = useState('');
  const [newCVUsername, setNewCVUsername] = useState('');
  const [newCVPassword, setNewCVPassword] = useState('');
  const [newCVPhone, setNewCVPhone] = useState('');
  const [newCVVehicleNumber, setNewCVVehicleNumber] = useState('');

  const [editingCVItem, setEditingCVItem] = useState<any | null>(null);
  const [editCVName, setEditCVName] = useState('');
  const [editCVUsername, setEditCVUsername] = useState('');
  const [editCVPassword, setEditCVPassword] = useState('');
  const [editCVPhone, setEditCVPhone] = useState('');
  const [editCVStatus, setEditCVStatus] = useState<'active' | 'disabled'>('active');

  const [codeCVModalItem, setCodeCVModalItem] = useState<any | null>(null);
  const [inputCVCode, setInputCVCode] = useState('');
  const [inputCVUsername, setInputCVUsername] = useState('');

  const [deletingCVItem, setDeletingCVItem] = useState<any | null>(null);
  const [copiedCVId, setCopiedCVId] = useState<string | null>(null);

  // Search & Sub-Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRepFilter, setSelectedRepFilter] = useState('all');
  const [selectedCashvanFilter, setSelectedCashvanFilter] = useState('all');
  const [repStatusFilter, setRepStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [cashvanStatusFilter, setCashvanStatusFilter] = useState<'all' | 'pending_accounting' | 'accounted'>('all');

  // Quick Time Filters for Rep & Cashvan tabs
  const [repTimeFilter, setRepTimeFilter] = useState<'all' | 'today' | 'this_week' | 'this_month'>('all');
  const [cvTimeFilter, setCvTimeFilter] = useState<'all' | 'today' | 'this_week' | 'this_month'>('all');

  // Period Analytics States (داتای مانگانە، هەفتانە، ڕۆژانە)
  const [periodType, setPeriodType] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('monthly');
  const [analyticsDate, setAnalyticsDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [analyticsMonth, setAnalyticsMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [customStartDate, setCustomStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [analyticsRoleFilter, setAnalyticsRoleFilter] = useState<'all' | 'rep' | 'cashvan'>('all');
  const [analyticsPersonFilter, setAnalyticsPersonFilter] = useState<string>('all');
  const [analyticsSearchTerm, setAnalyticsSearchTerm] = useState('');

  // Drilldown modal states
  const [inspectingPerson, setInspectingPerson] = useState<any | null>(null);
  const [detailSubTab, setDetailSubTab] = useState<'items' | 'invoices'>('items');

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
    syncAllRepsAndCashvans();

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

  // Unified list of all registered users (since cashvan and sales rep are the same person/system)
  const unifiedUsers = useMemo(() => {
    const map = new Map<string, {
      id: string;
      repId?: string;
      cvId?: string;
      name: string;
      username: string;
      phone: string;
      accessCode: string;
      password?: string;
      vehicleNumber?: string;
      status: 'active' | 'disabled' | 'deleted';
      isDeleted?: boolean;
    }>();

    // 1. Add all reps
    reps.forEach(r => {
      const name = (r.name || '').trim();
      if (!name) return;
      const isDel = !!r.isDeleted || r.status === 'deleted';
      map.set(name.toLowerCase(), {
        id: r.id,
        repId: r.id,
        name: r.name.trim(),
        username: (r.username || r.name).trim(),
        phone: r.phone || '',
        accessCode: r.accessCode || r.password || '',
        password: r.password || r.accessCode || '',
        vehicleNumber: '',
        status: isDel ? 'deleted' : (r.status === 'disabled' ? 'disabled' : 'active'),
        isDeleted: isDel,
      });
    });

    // 2. Add / merge all cashvans
    cashvans.forEach(c => {
      const name = (c.name || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      const existing = map.get(key);
      const isDel = !!c.isDeleted || c.status === 'deleted';
      if (existing) {
        existing.cvId = c.id;
        if (!existing.phone && c.phone) existing.phone = c.phone;
        if (!existing.accessCode && (c.accessCode || c.password)) {
          existing.accessCode = c.accessCode || c.password;
          existing.password = c.password || c.accessCode;
        }
        if (c.vehicleNumber) existing.vehicleNumber = c.vehicleNumber;
        if (isDel && existing.status !== 'active') {
          existing.status = 'deleted';
          existing.isDeleted = true;
        } else if (c.status === 'disabled' && existing.status !== 'deleted') {
          existing.status = 'disabled';
        }
      } else {
        map.set(key, {
          id: c.id,
          cvId: c.id,
          name: c.name.trim(),
          username: (c.username || c.name).trim(),
          phone: c.phone || '',
          accessCode: c.accessCode || c.password || '',
          password: c.password || c.accessCode || '',
          vehicleNumber: c.vehicleNumber || '',
          status: isDel ? 'deleted' : (c.status === 'disabled' ? 'disabled' : 'active'),
          isDeleted: isDel,
        });
      }
    });

    // 3. Fallback: also include names that appeared in historical orders or sales
    orders.forEach(o => {
      const name = (o.repName || '').trim();
      if (name && !map.has(name.toLowerCase())) {
        map.set(name.toLowerCase(), {
          id: `order_${name}`,
          name,
          username: name,
          phone: '',
          accessCode: '',
          vehicleNumber: '',
          status: 'active'
        });
      }
    });
    sales.forEach(s => {
      const name = (s.cashvanName || '').trim();
      if (name && !map.has(name.toLowerCase())) {
        map.set(name.toLowerCase(), {
          id: `sale_${name}`,
          name,
          username: name,
          phone: '',
          accessCode: '',
          vehicleNumber: '',
          status: 'active'
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [reps, cashvans, orders, sales]);

  // User stats for Mandoob (from orders)
  const repUsersSummary = useMemo(() => {
    return unifiedUsers.map(user => {
      const userOrders = orders.filter(o => o.repName === user.name && o.status !== 'deleted');
      const totalAmount = userOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
      const pendingOrders = userOrders.filter(o => o.status !== 'completed');
      const pendingAmount = pendingOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
      const completedOrders = userOrders.filter(o => o.status === 'completed');
      const completedAmount = completedOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
      
      let cartons = 0;
      let packets = 0;
      let gifts = 0;
      userOrders.forEach(o => {
        (o.items || []).forEach(it => {
          const qty = Number(it.quantity) || 0;
          if (it.unit === 'packet') packets += qty;
          else cartons += qty;
          gifts += Number(it.giftQuantity) || (it.isGift ? qty : 0);
        });
      });

      return {
        ...user,
        totalAmount,
        pendingAmount,
        completedAmount,
        ordersCount: userOrders.length,
        pendingCount: pendingOrders.length,
        completedCount: completedOrders.length,
        cartons,
        packets,
        gifts
      };
    });
  }, [unifiedUsers, orders]);

  // User stats for Cashvan (from sales)
  const cashvanUsersSummary = useMemo(() => {
    return unifiedUsers.map(user => {
      const userSales = sales.filter(s => s.cashvanName === user.name && s.status !== 'deleted');
      const totalAmount = userSales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
      const pendingSales = userSales.filter(s => s.status === 'pending_accounting');
      const pendingAmount = pendingSales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
      const accountedSales = userSales.filter(s => s.status === 'accounted');
      const accountedAmount = accountedSales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
      
      let cartons = 0;
      let packets = 0;
      let gifts = 0;
      userSales.forEach(s => {
        (s.items || []).forEach(it => {
          const qty = Number(it.quantity) || 0;
          if (it.unit === 'packet') packets += qty;
          else cartons += qty;
          gifts += Number(it.giftQuantity) || (it.isGift ? qty : 0);
        });
      });

      return {
        ...user,
        totalAmount,
        pendingAmount,
        accountedAmount,
        salesCount: userSales.length,
        pendingCount: pendingSales.length,
        accountedCount: accountedSales.length,
        cartons,
        packets,
        gifts
      };
    });
  }, [unifiedUsers, sales]);

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
      
      let matchTime = true;
      if (repTimeFilter === 'today') {
        const s = startOfDay(new Date()).getTime();
        const e = endOfDay(new Date()).getTime();
        matchTime = order.timestamp >= s && order.timestamp <= e;
      } else if (repTimeFilter === 'this_week') {
        const s = startOfWeek(new Date(), { weekStartsOn: 6 }).getTime();
        const e = endOfWeek(new Date(), { weekStartsOn: 6 }).getTime();
        matchTime = order.timestamp >= s && order.timestamp <= e;
      } else if (repTimeFilter === 'this_month') {
        const s = startOfMonth(new Date()).getTime();
        const e = endOfMonth(new Date()).getTime();
        matchTime = order.timestamp >= s && order.timestamp <= e;
      }

      return matchRep && matchStatus && matchSearch && matchTime;
    });
  }, [orders, selectedRepFilter, repStatusFilter, searchTerm, repTimeFilter]);

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

      let matchTime = true;
      if (cvTimeFilter === 'today') {
        const s = startOfDay(new Date()).getTime();
        const e = endOfDay(new Date()).getTime();
        matchTime = sale.date >= s && sale.date <= e;
      } else if (cvTimeFilter === 'this_week') {
        const s = startOfWeek(new Date(), { weekStartsOn: 6 }).getTime();
        const e = endOfWeek(new Date(), { weekStartsOn: 6 }).getTime();
        matchTime = sale.date >= s && sale.date <= e;
      } else if (cvTimeFilter === 'this_month') {
        const s = startOfMonth(new Date()).getTime();
        const e = endOfMonth(new Date()).getTime();
        matchTime = sale.date >= s && sale.date <= e;
      }

      return matchCV && matchStatus && matchSearch && matchTime;
    });
  }, [sales, selectedCashvanFilter, cashvanStatusFilter, searchTerm, cvTimeFilter]);

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

  // --- Cashvan & Reps Unified CRUD Handlers ---
  const handleAddNewCashvan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCVName.trim()) return;
    setIsProcessing(true);
    try {
      const nameTrimmed = newCVName.trim();
      const userTrimmed = newCVUsername.trim() || nameTrimmed;
      const passTrimmed = newCVPassword.trim() || Math.floor(10000 + Math.random() * 90000).toString();
      const phoneTrimmed = newCVPhone.trim();
      const vehicleTrimmed = newCVVehicleNumber.trim();

      // 1. Create in cashvans
      const cvSnap = await getDocs(query(collection(db, 'cashvans'), where('name', '==', nameTrimmed)));
      let cvDocId = '';
      if (cvSnap.empty) {
        const docRef = await addDoc(collection(db, 'cashvans'), {
          name: nameTrimmed,
          username: userTrimmed,
          accessCode: passTrimmed,
          password: passTrimmed,
          phone: phoneTrimmed,
          vehicleNumber: vehicleTrimmed,
          status: 'active',
          createdAt: Date.now()
        });
        cvDocId = docRef.id;
        await updateDoc(doc(db, 'cashvans', docRef.id), { id: docRef.id });
      } else {
        cvDocId = cvSnap.docs[0].id;
        await updateDoc(doc(db, 'cashvans', cvDocId), {
          username: userTrimmed,
          accessCode: passTrimmed,
          password: passTrimmed,
          phone: phoneTrimmed,
          vehicleNumber: vehicleTrimmed,
          status: 'active'
        });
      }

      // 2. Also create/sync in reps (Mandoub) because they are the same person/system
      const repSnap = await getDocs(query(collection(db, 'reps'), where('name', '==', nameTrimmed)));
      let repDocId = '';
      if (repSnap.empty) {
        const repDoc = await addDoc(collection(db, 'reps'), {
          name: nameTrimmed,
          username: userTrimmed,
          phone: phoneTrimmed,
          accessCode: passTrimmed,
          password: passTrimmed,
          status: 'active',
          totalSales: 0,
          totalProfit: 0,
          createdAt: Date.now()
        });
        repDocId = repDoc.id;
      } else {
        repDocId = repSnap.docs[0].id;
        await updateDoc(doc(db, 'reps', repDocId), {
          username: userTrimmed,
          accessCode: passTrimmed,
          password: passTrimmed,
          phone: phoneTrimmed,
          status: 'active'
        });
      }

      // 3. Sync to users collection for auth
      const authId = repDocId || cvDocId;
      if (authId) {
        await setDoc(doc(db, 'users', authId), {
          role: 'sales_rep',
          username: userTrimmed,
          accessCode: passTrimmed,
          status: 'active',
          name: nameTrimmed,
          phone: phoneTrimmed,
          repId: repDocId,
          isDeleted: false
        }, { merge: true });
      }

      setShowAddCVModal(false);
      setNewCVName('');
      setNewCVUsername('');
      setNewCVPassword('');
      setNewCVPhone('');
      setNewCVVehicleNumber('');
      alert(`بەکارهێنەر (${nameTrimmed}) بە سەرکەوتوویی وەک مەندووب و کاشڤان بە یوزەری [${userTrimmed}] و تێپەڕەوشەی [${passTrimmed}] زیادکرا.`);
    } catch (e) {
      console.error(e);
      alert('هەڵەیەک ڕوویدا لە زیادکردنی بەکارهێنەر');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveEditCashvan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCVItem || !editCVName.trim()) return;
    setIsProcessing(true);
    try {
      const oldName = editingCVItem.name.trim();
      const nameTrimmed = editCVName.trim();
      const userTrimmed = editCVUsername.trim() || nameTrimmed;
      const phoneTrimmed = editCVPhone.trim();
      const passTrimmed = editCVPassword.trim();

      // 1. If name changed, rename globally across system
      if (oldName !== nameTrimmed) {
        await renameRepOrCashvan(oldName, nameTrimmed, { 
          phone: phoneTrimmed,
          isRep: true,
          isCashvan: true 
        });
      }

      const updateData: any = {
        name: nameTrimmed,
        username: userTrimmed,
        phone: phoneTrimmed,
        status: editCVStatus
      };
      if (passTrimmed) {
        updateData.accessCode = passTrimmed;
        updateData.password = passTrimmed;
      }

      // 2. Update cashvans collection
      const cvSnap = await getDocs(query(collection(db, 'cashvans'), where('name', 'in', [oldName, nameTrimmed])));
      if (!cvSnap.empty) {
        for (const d of cvSnap.docs) {
          await updateDoc(doc(db, 'cashvans', d.id), updateData);
        }
      } else {
        await addDoc(collection(db, 'cashvans'), {
          ...updateData,
          createdAt: Date.now()
        });
      }

      // 3. Update reps collection
      const repSnap = await getDocs(query(collection(db, 'reps'), where('name', 'in', [oldName, nameTrimmed])));
      if (!repSnap.empty) {
        for (const d of repSnap.docs) {
          await updateDoc(doc(db, 'reps', d.id), updateData);
        }
      } else {
        await addDoc(collection(db, 'reps'), {
          ...updateData,
          totalSales: 0,
          totalProfit: 0,
          createdAt: Date.now()
        });
      }

      // 4. Update users collection
      const usersSnap = await getDocs(query(collection(db, 'users'), where('name', 'in', [oldName, nameTrimmed])));
      for (const d of usersSnap.docs) {
        await updateDoc(doc(db, 'users', d.id), updateData);
      }

      setEditingCVItem(null);
      alert(`زانیارییەکانی بەکارهێنەر (${nameTrimmed}) بۆ کاشڤان و مەندووب نوێکرایەوە.`);
    } catch (e) {
      console.error(e);
      alert('هەڵەیەک ڕوویدا');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveCVCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeCVModalItem || !inputCVCode.trim()) return;
    setIsProcessing(true);
    try {
      const codeTrimmed = inputCVCode.trim();
      const userTrimmed = inputCVUsername.trim() || codeCVModalItem.name;
      const personName = codeCVModalItem.name.trim();

      const patch = {
        username: userTrimmed,
        accessCode: codeTrimmed,
        password: codeTrimmed,
        forceReauth: true
      };

      // 1. Update in cashvans
      const cvSnap = await getDocs(query(collection(db, 'cashvans'), where('name', '==', personName)));
      for (const d of cvSnap.docs) {
        await updateDoc(doc(db, 'cashvans', d.id), patch);
      }

      // 2. Update in reps
      const repSnap = await getDocs(query(collection(db, 'reps'), where('name', '==', personName)));
      for (const d of repSnap.docs) {
        await updateDoc(doc(db, 'reps', d.id), patch);
      }

      // 3. Update in users
      const usersSnap = await getDocs(query(collection(db, 'users'), where('name', '==', personName)));
      for (const d of usersSnap.docs) {
        await updateDoc(doc(db, 'users', d.id), patch);
      }

      setCodeCVModalItem(null);
      alert(`تێپەڕەوشەی چوونەژوورەوەی (${personName}) نوێکرایەوە بۆ: [${codeTrimmed}]`);
    } catch (e) {
      console.error(e);
      alert('هەڵەیەک ڕوویدا');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleCVStatus = async (item: any) => {
    const nextStatus = item.status === 'disabled' ? 'active' : 'disabled';
    const personName = item.name.trim();
    try {
      // 1. Update cashvans
      const cvSnap = await getDocs(query(collection(db, 'cashvans'), where('name', '==', personName)));
      for (const d of cvSnap.docs) {
        await updateDoc(doc(db, 'cashvans', d.id), {
          status: nextStatus,
          forceReauth: nextStatus === 'disabled'
        });
      }

      // 2. Update reps
      const repSnap = await getDocs(query(collection(db, 'reps'), where('name', '==', personName)));
      for (const d of repSnap.docs) {
        await updateDoc(doc(db, 'reps', d.id), {
          status: nextStatus,
          forceReauth: nextStatus === 'disabled'
        });
      }

      // 3. Update users
      const usersSnap = await getDocs(query(collection(db, 'users'), where('name', '==', personName)));
      for (const d of usersSnap.docs) {
        await updateDoc(doc(db, 'users', d.id), {
          status: nextStatus,
          forceReauth: nextStatus === 'disabled'
        });
      }

      alert(`دۆخی هەژماری (${personName}) گۆڕدرا بۆ: ${nextStatus === 'active' ? 'چالاک' : 'ڕاگیراو'}`);
    } catch (e) {
      console.error(e);
      alert('هەڵەیەک ڕوویدا');
    }
  };

  const confirmDeleteCashvan = async () => {
    if (!deletingCVItem) return;
    const personName = deletingCVItem.name.trim();
    try {
      const now = Date.now();
      // 1. Soft delete in cashvans - preserve accounting & transaction integrity
      const cvSnap = await getDocs(query(collection(db, 'cashvans'), where('name', '==', personName)));
      for (const d of cvSnap.docs) {
        await setDoc(doc(db, 'cashvans', d.id), {
          isDeleted: true,
          status: 'deleted',
          deletedAt: now,
          forceReauth: true
        }, { merge: true });
      }

      // 2. Soft delete in reps
      const repSnap = await getDocs(query(collection(db, 'reps'), where('name', '==', personName)));
      for (const d of repSnap.docs) {
        await setDoc(doc(db, 'reps', d.id), {
          isDeleted: true,
          status: 'deleted',
          deletedAt: now,
          forceReauth: true
        }, { merge: true });
      }

      // 3. Disable user login in users collection
      const usersSnap = await getDocs(query(collection(db, 'users'), where('name', '==', personName)));
      for (const d of usersSnap.docs) {
        await setDoc(doc(db, 'users', d.id), {
          status: 'banned',
          isDeleted: true,
          deletedAt: now,
          forceReauth: true
        }, { merge: true });
      }

      setDeletingCVItem(null);
      alert(`هەژماری (${personName}) سڕدرایەوە و دەستڕاگەیشتنی داخرا.\nتەواوی حیسابات، وەسڵەکان و مامەڵەکانی بە تەواوی پارێزراون و لە دەفتەری حیساباتدا دەمێننەوە.`);
    } catch (e) {
      console.error(e);
      alert('هەڵەیەک ڕوویدا لە سڕینەوە');
    }
  };

  const handleCopyCVCredentials = (cv: any) => {
    const text = `زانیاری چوونەژوورەوە بۆ کاشڤان و مەندووب: ${cv.name}\nیوزەرنەیم: ${cv.username || cv.name}\nتێپەڕەوشە: ${cv.accessCode || cv.password || '47953'}`;
    navigator.clipboard.writeText(text);
    setCopiedCVId(cv.id);
    setTimeout(() => setCopiedCVId(null), 2000);
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
    const repPhone = reps.find(r => r.name === order.repName)?.phone || (order as any).repPhone || '';

    const printContent = `
      <div dir="rtl" style="font-family: sans-serif; padding: 20px;">
        ${renderReceiptHeaderHtml({
          isSale: true,
          repName: order.repName,
          repPhone: repPhone,
          invoiceNo: invoiceNum,
          customerName: order.marketName,
          date: order.timestamp
        })}

        <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 12px; margin-bottom: 12px; font-size: 12px;">
          <div>
            <span style="color: #64748b; font-weight: 600;">ژمارەی کڕیار:</span>
            <strong dir="ltr" style="margin-right: 4px;">${marketPhone || '-'}</strong>
            ${order.location ? `<span style="margin-right: 12px; color: #64748b;">ناونیشان: <strong>${order.location}</strong></span>` : ''}
          </div>
          <div>
            <span style="color: #64748b; font-weight: 600;">بەروار و کات:</span>
            <span dir="ltr" style="font-weight: 700; color: #0f172a; margin-right: 4px;">
              ${format(order.timestamp, 'yyyy/MM/dd HH:mm')}
            </span>
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
            <p style="margin-bottom: 40px;">واژووی مارکێت</p>
            <p>.......................................</p>
          </div>
        </div>
      </div>
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title></title>
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
    const cashvanPhone = cashvans.find(c => c.name === sale.cashvanName)?.phone || reps.find(r => r.name === sale.cashvanName)?.phone || '';

    const printContent = `
      <div dir="rtl" style="font-family: sans-serif; padding: 20px;">
        ${renderReceiptHeaderHtml({
          isSale: true,
          repName: sale.cashvanName,
          repPhone: cashvanPhone,
          invoiceNo: invoiceNum,
          customerName: sale.marketName,
          date: sale.date
        })}

        <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 12px; margin-bottom: 12px; font-size: 12px;">
          <div>
            <span style="color: #64748b; font-weight: 600;">ژمارەی کڕیار:</span>
            <strong dir="ltr" style="margin-right: 4px;">${marketPhone || '-'}</strong>
            <span style="margin-right: 12px; color: #64748b;">شێوازی پارەدان:</span>
            <strong style="color: ${sale.paymentType === 'cash' ? '#166534' : '#b45309'}; margin-right: 4px;">
              ${sale.paymentType === 'cash' ? 'نەقد 💵' : 'قەرز 💳'}
            </strong>
          </div>
          <div>
            <span style="color: #64748b; font-weight: 600;">بەروار و کات:</span>
            <span dir="ltr" style="font-weight: 700; color: #0f172a; margin-right: 4px;">
              ${format(sale.date, 'yyyy/MM/dd HH:mm')}
            </span>
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
            <p style="margin-bottom: 40px;">واژووی مارکێت</p>
            <p>.......................................</p>
          </div>
        </div>
      </div>
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title></title>
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

  // =========================================================================
  // PERIOD ANALYTICS CALCULATIONS (ڕۆژانە، هەفتانە، مانگانە بۆ فلان مەندووب)
  // =========================================================================
  const periodRange = useMemo(() => {
    if (periodType === 'daily') {
      const d = analyticsDate ? new Date(analyticsDate) : new Date();
      return {
        start: startOfDay(d).getTime(),
        end: endOfDay(d).getTime(),
        title: 'ڕاپۆرتی ڕۆژانە',
        subtitle: format(d, 'yyyy/MM/dd'),
        type: 'daily'
      };
    } else if (periodType === 'weekly') {
      const d = analyticsDate ? new Date(analyticsDate) : new Date();
      const s = startOfWeek(d, { weekStartsOn: 6 });
      const e = endOfWeek(d, { weekStartsOn: 6 });
      return {
        start: s.getTime(),
        end: e.getTime(),
        title: 'ڕاپۆرتی هەفتانە',
        subtitle: `لە ${format(s, 'yyyy/MM/dd')} تا ${format(e, 'yyyy/MM/dd')}`,
        type: 'weekly'
      };
    } else if (periodType === 'monthly') {
      const parts = (analyticsMonth || format(new Date(), 'yyyy-MM')).split('-');
      const year = Number(parts[0]) || 2026;
      const month = Number(parts[1]) || 9;
      const d = new Date(year, month - 1, 1);
      const s = startOfMonth(d);
      const e = endOfMonth(d);
      return {
        start: s.getTime(),
        end: e.getTime(),
        title: 'ڕاپۆرتی مانگانە',
        subtitle: `مانگی ${format(d, 'yyyy/MM')}`,
        type: 'monthly'
      };
    } else {
      const s = customStartDate ? new Date(customStartDate) : new Date();
      const e = customEndDate ? new Date(customEndDate) : new Date();
      return {
        start: startOfDay(s).getTime(),
        end: endOfDay(e).getTime(),
        title: 'ڕاپۆرتی مەودای دیاریکراو',
        subtitle: `لە ${format(s, 'yyyy/MM/dd')} تا ${format(e, 'yyyy/MM/dd')}`,
        type: 'custom'
      };
    }
  }, [periodType, analyticsDate, analyticsMonth, customStartDate, customEndDate]);

  // Aggregated data for the selected period
  const analyticsData = useMemo(() => {
    const { start, end } = periodRange;

    // 1. Filter orders in range
    const periodOrders = orders.filter(o => {
      if (o.status === 'deleted') return false;
      return o.timestamp >= start && o.timestamp <= end;
    });

    // 2. Filter cashvan sales in range
    const periodSales = sales.filter(s => {
      if (s.status === 'deleted') return false;
      return s.date >= start && s.date <= end;
    });

    interface RepPersonStats {
      id: string;
      name: string;
      role: 'rep' | 'cashvan';
      phone?: string;
      totalCartons: number;
      totalPackets: number;
      totalGifts: number;
      totalAmount: number;
      cashAmount: number;
      debtAmount: number;
      cartons: number;
      packets: number;
      gifts: number;
      amount: number;
      cash: number;
      debt: number;
      itemsBreakdown: Array<{
        itemId: string;
        name: string;
        cartons: number;
        packets: number;
        gifts: number;
        totalPrice: number;
        totalAmount?: number;
      }>;
      invoicesCount: number;
      itemsMap: Record<string, {
        itemId: string;
        name: string;
        cartons: number;
        packets: number;
        gifts: number;
        totalPrice: number;
      }>;
      invoices: Array<{
        id: string;
        invoiceNo: string;
        invoiceNumber?: string;
        marketName: string;
        date: number;
        amount: number;
        paymentType: 'cash' | 'debt';
        cartons: number;
        packets: number;
        gifts: number;
        type: 'order' | 'sale';
        itemsCount: number;
        status: string;
      }>;
    }

    const peopleMap: Record<string, RepPersonStats> = {};

    const getOrCreatePerson = (name: string, role: 'rep' | 'cashvan') => {
      const key = `${role}_${name}`;
      if (!peopleMap[key]) {
        let phone = '';
        if (role === 'rep') {
          phone = reps.find(r => r.name === name)?.phone || '';
        } else {
          phone = cashvans.find(c => c.name === name)?.phone || '';
        }
        peopleMap[key] = {
          id: key,
          name,
          role,
          phone,
          totalCartons: 0,
          totalPackets: 0,
          totalGifts: 0,
          totalAmount: 0,
          cashAmount: 0,
          debtAmount: 0,
          cartons: 0,
          packets: 0,
          gifts: 0,
          amount: 0,
          cash: 0,
          debt: 0,
          itemsBreakdown: [],
          invoicesCount: 0,
          itemsMap: {},
          invoices: []
        };
      }
      return peopleMap[key];
    };

    // Process Orders (Reps)
    periodOrders.forEach(order => {
      const repName = order.repName || 'مەندووبی نادیار';
      const p = getOrCreatePerson(repName, 'rep');

      let orderCartons = 0;
      let orderPackets = 0;
      let orderGifts = 0;

      (order.items || []).forEach(item => {
        const qty = Number(item.quantity) || 0;
        const giftQty = Number(item.giftQuantity) || (item.isGift ? qty : 0);
        const isPacket = item.unit === 'packet';
        const itemCartons = isPacket ? 0 : qty;
        const itemPackets = isPacket ? qty : 0;
        const itemPrice = Number(item.price) || 0;
        const itemTotal = Number(item.totalPrice) || (qty * itemPrice);

        orderCartons += itemCartons;
        orderPackets += itemPackets;
        orderGifts += giftQty;

        const itemKey = item.itemId || item.name;
        if (!p.itemsMap[itemKey]) {
          p.itemsMap[itemKey] = {
            itemId: item.itemId || '',
            name: item.name,
            cartons: 0,
            packets: 0,
            gifts: 0,
            totalPrice: 0
          };
        }
        p.itemsMap[itemKey].cartons += itemCartons;
        p.itemsMap[itemKey].packets += itemPackets;
        p.itemsMap[itemKey].gifts += giftQty;
        p.itemsMap[itemKey].totalPrice += itemTotal;
      });

      const isDebt = order.paymentStatus === 'debt' || order.paymentType === 'debt';
      const amount = Number(order.totalAmount) || 0;

      p.totalCartons += orderCartons;
      p.totalPackets += orderPackets;
      p.totalGifts += orderGifts;
      p.totalAmount += amount;
      if (isDebt) {
        p.debtAmount += amount;
      } else {
        p.cashAmount += amount;
      }
      p.invoicesCount += 1;

      p.invoices.push({
        id: order.id,
        invoiceNo: order.invoiceNo || order.invoiceId || order.id.slice(-6),
        marketName: order.marketName || 'مارکێت',
        date: order.timestamp,
        amount,
        paymentType: isDebt ? 'debt' : 'cash',
        cartons: orderCartons,
        packets: orderPackets,
        gifts: orderGifts,
        type: 'order',
        itemsCount: order.items?.length || 0,
        status: order.status
      });
    });

    // Process Sales (Cashvans)
    periodSales.forEach(sale => {
      const cvName = sale.cashvanName || 'کاشڤانی نادیار';
      const p = getOrCreatePerson(cvName, 'cashvan');

      let saleCartons = 0;
      let salePackets = 0;
      let saleGifts = 0;

      (sale.items || []).forEach(item => {
        const qty = Number(item.quantity) || 0;
        const isGift = item.isGift || (item.name && item.name.includes('(هەدیە)')) || item.price === 0;
        const giftQty = isGift ? qty : 0;
        const isPacket = item.unit === 'packet';
        const itemCartons = isPacket ? 0 : qty;
        const itemPackets = isPacket ? qty : 0;
        const itemPrice = Number(item.price) || 0;
        const itemTotal = isGift ? 0 : (qty * itemPrice);

        saleCartons += itemCartons;
        salePackets += itemPackets;
        saleGifts += giftQty;

        const itemKey = item.itemId || item.name;
        if (!p.itemsMap[itemKey]) {
          p.itemsMap[itemKey] = {
            itemId: item.itemId || '',
            name: item.name,
            cartons: 0,
            packets: 0,
            gifts: 0,
            totalPrice: 0
          };
        }
        p.itemsMap[itemKey].cartons += itemCartons;
        p.itemsMap[itemKey].packets += itemPackets;
        p.itemsMap[itemKey].gifts += giftQty;
        p.itemsMap[itemKey].totalPrice += itemTotal;
      });

      const isDebt = sale.paymentType === 'debt';
      const amount = Number(sale.totalAmount) || 0;

      p.totalCartons += saleCartons;
      p.totalPackets += salePackets;
      p.totalGifts += saleGifts;
      p.totalAmount += amount;
      if (isDebt) {
        p.debtAmount += amount;
      } else {
        p.cashAmount += amount;
      }
      p.invoicesCount += 1;

      p.invoices.push({
        id: sale.id,
        invoiceNo: sale.invoiceNo || sale.invoiceId || sale.id.slice(-6),
        marketName: sale.marketName || 'مارکێت',
        date: sale.date,
        amount,
        paymentType: isDebt ? 'debt' : 'cash',
        cartons: saleCartons,
        packets: salePackets,
        gifts: saleGifts,
        type: 'sale',
        itemsCount: sale.items?.length || 0,
        status: sale.status
      });
    });

    let list = Object.values(peopleMap);

    if (analyticsRoleFilter !== 'all') {
      list = list.filter(p => p.role === analyticsRoleFilter);
    }

    if (analyticsPersonFilter !== 'all') {
      list = list.filter(p => p.name === analyticsPersonFilter);
    }

    if (analyticsSearchTerm.trim()) {
      const s = analyticsSearchTerm.trim().toLowerCase();
      list = list.filter(p => 
        p.name.toLowerCase().includes(s) || 
        (p.phone && p.phone.toLowerCase().includes(s)) ||
        Object.values(p.itemsMap).some(it => it.name.toLowerCase().includes(s))
      );
    }

    list.forEach(p => {
      p.cartons = p.totalCartons;
      p.packets = p.totalPackets;
      p.gifts = p.totalGifts;
      p.amount = p.totalAmount;
      p.cash = p.cashAmount;
      p.debt = p.debtAmount;
      p.itemsBreakdown = Object.values(p.itemsMap).map(it => ({
        ...it,
        totalAmount: it.totalPrice
      }));
      p.invoices.forEach(inv => {
        inv.invoiceNumber = inv.invoiceNo;
      });
    });

    list.sort((a, b) => (b.totalCartons - a.totalCartons) || (b.totalAmount - a.totalAmount));

    const overall = list.reduce((acc, p) => {
      acc.cartons += p.totalCartons;
      acc.packets += p.totalPackets;
      acc.gifts += p.totalGifts;
      acc.amount += p.totalAmount;
      acc.cash += p.cashAmount;
      acc.debt += p.debtAmount;
      acc.invoices += p.invoicesCount;
      return acc;
    }, {
      cartons: 0,
      packets: 0,
      gifts: 0,
      amount: 0,
      cash: 0,
      debt: 0,
      invoices: 0
    });

    const consolidatedItems: Record<string, { name: string; cartons: number; packets: number; gifts: number; amount: number; totalAmount: number }> = {};
    list.forEach(p => {
      Object.values(p.itemsMap).forEach(it => {
        if (!consolidatedItems[it.name]) {
          consolidatedItems[it.name] = {
            name: it.name,
            cartons: 0,
            packets: 0,
            gifts: 0,
            amount: 0,
            totalAmount: 0
          };
        }
        consolidatedItems[it.name].cartons += it.cartons;
        consolidatedItems[it.name].packets += it.packets;
        consolidatedItems[it.name].gifts += it.gifts;
        consolidatedItems[it.name].amount += it.totalPrice;
        consolidatedItems[it.name].totalAmount += it.totalPrice;
      });
    });

    const sortedConsolidatedItems = Object.values(consolidatedItems).sort((a, b) => (b.cartons - a.cartons) || (b.amount - a.amount));

    return {
      peopleList: list,
      overall,
      consolidatedItems: sortedConsolidatedItems,
      productsBreakdown: sortedConsolidatedItems,
      periodOrdersCount: periodOrders.length,
      periodSalesCount: periodSales.length
    };
  }, [orders, sales, periodRange, reps, cashvans, analyticsRoleFilter, analyticsPersonFilter, analyticsSearchTerm]);

  // Print Comprehensive Period Report
  const handlePrintPeriodReport = () => {
    const companySettings = getCompanySettings();
    const repPhone = analyticsPersonFilter !== 'all' ? (
      reps.find(r => r.name === analyticsPersonFilter)?.phone || 
      cashvans.find(c => c.name === analyticsPersonFilter)?.phone || ''
    ) : '';

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ckb">
        <head>
          <meta charset="utf-8" />
          <title>ڕاپۆرتی فرۆش و حسابات - ${periodRange.title}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; color: #0f172a; margin: 0; padding: 10px; font-size: 12px; }
            .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 15px; }
            .brand-title { margin: 0; font-size: 26px; font-weight: 900; color: #0f172a; }
            .brand-sub { font-size: 13px; font-weight: 800; color: #0284c7; margin-top: 2px; }
            .report-badge { display: inline-block; padding: 4px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 800; font-size: 12px; margin-top: 5px; }
            .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
            .kpi-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; text-align: center; }
            .kpi-val { font-size: 16px; font-weight: 900; color: #0f172a; font-family: monospace; }
            .kpi-lbl { font-size: 11px; font-weight: 700; color: #64748b; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px 6px; font-size: 11px; font-weight: 800; color: #334155; }
            td { border: 1px solid #cbd5e1; padding: 7px 6px; font-size: 11px; text-align: center; }
            .td-right { text-align: right; font-weight: bold; }
            .highlight { background: #eff6ff; font-weight: 900; }
            .signatures { display: flex; justify-content: space-between; margin-top: 30px; padding: 0 30px; page-break-inside: avoid; }
            .sig-box { text-align: center; font-weight: bold; font-size: 12px; }
            .sig-line { width: 150px; border-bottom: 1px dashed #64748b; margin-top: 45px; }
            @media print {
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div style="width: 140px; text-align: right;">
              <img src="${window.location.origin}/LOGO1.jpg" alt="Logo" style="height: 60px; max-width: 120px; object-fit: contain;" onerror="this.style.display='none'" />
            </div>
            <div style="flex: 1; text-align: center;">
              <h1 class="brand-title">کۆمپانیای RF</h1>
              <div class="brand-sub">بریکاری فەرمی TAM TAM</div>
              <div style="font-size: 14px; font-weight: 900; color: #0f172a; margin-top: 4px;">ڕاپۆرتی فرۆش و حساباتی مەندووب و کاشڤان</div>
              <div class="report-badge">${periodRange.title}: ${periodRange.subtitle}</div>
              ${analyticsPersonFilter !== 'all' ? `<div style="font-weight: 800; color: #4338ca; margin-top: 3px;">ناوی دەستنیشانکراو: ${analyticsPersonFilter} ${repPhone ? `(${repPhone})` : ''}</div>` : ''}
            </div>
            <div style="width: 140px; text-align: left; font-size: 11px; color: #64748b; font-weight: 700;">
              <div>ژ. کۆمپانیا: <span dir="ltr">${companySettings.phone}</span></div>
              <div style="margin-top: 3px;">بەرواری چاپ: <span dir="ltr">${format(new Date(), 'yyyy/MM/dd HH:mm')}</span></div>
            </div>
          </div>

          <div class="kpi-grid">
            <div class="kpi-box" style="border-top: 3px solid #4f46e5;">
              <div class="kpi-val" style="color: #4338ca;">${analyticsData.overall.cartons.toLocaleString()} کارتۆن</div>
              <div class="kpi-lbl">کۆی کارتۆنی فرۆشراو</div>
            </div>
            <div class="kpi-box" style="border-top: 3px solid #16a34a;">
              <div class="kpi-val" style="color: #15803d;" dir="ltr">${analyticsData.overall.amount.toLocaleString()} د.ع</div>
              <div class="kpi-lbl">کۆی بڕ بە پارە</div>
            </div>
            <div class="kpi-box" style="border-top: 3px solid #0284c7;">
              <div class="kpi-val" style="color: #0369a1;" dir="ltr">${analyticsData.overall.cash.toLocaleString()} د.ع</div>
              <div class="kpi-lbl">کۆی نەقد</div>
            </div>
            <div class="kpi-box" style="border-top: 3px solid #d97706;">
              <div class="kpi-val" style="color: #b45309;" dir="ltr">${analyticsData.overall.debt.toLocaleString()} د.ع</div>
              <div class="kpi-lbl">کۆی قەرز</div>
            </div>
          </div>

          <div style="font-size: 13px; font-weight: 900; margin-bottom: 6px; color: #1e293b;">
            خشتەی ئاماری فرۆشی مەندووب و کاشڤانەکان (${analyticsData.peopleList.length} کەس)
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                <th>ناو</th>
                <th>ڕۆڵ</th>
                <th>کارتۆنی فرۆشراو</th>
                <th>پاکەت</th>
                <th>هەدیە</th>
                <th>فرۆشی نەقد</th>
                <th>فرۆشی قەرز</th>
                <th>کۆی بڕ بە پارە</th>
                <th>ژ. وەسڵ</th>
              </tr>
            </thead>
            <tbody>
              ${analyticsData.peopleList.map((p, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td class="td-right">${p.name}</td>
                  <td>${p.role === 'rep' ? 'مەندووب' : 'کاشڤان'}</td>
                  <td class="highlight" style="font-weight: 900; color: #4338ca;">${p.totalCartons.toLocaleString()} کارتۆن</td>
                  <td>${p.totalPackets > 0 ? `${p.totalPackets.toLocaleString()} پاکەت` : '-'}</td>
                  <td>${p.totalGifts > 0 ? p.totalGifts : '-'}</td>
                  <td dir="ltr" style="font-family: monospace;">${p.cashAmount.toLocaleString()} د.ع</td>
                  <td dir="ltr" style="font-family: monospace;">${p.debtAmount.toLocaleString()} د.ع</td>
                  <td class="highlight" dir="ltr" style="font-weight: 900; font-family: monospace; color: #15803d;">${p.totalAmount.toLocaleString()} د.ع</td>
                  <td>${p.invoicesCount}</td>
                </tr>
              `).join('')}
              <tr style="background: #e2e8f0; font-weight: 900;">
                <td colspan="3">کۆی گشتی</td>
                <td style="color: #4338ca;">${analyticsData.overall.cartons.toLocaleString()} کارتۆن</td>
                <td>${analyticsData.overall.packets > 0 ? `${analyticsData.overall.packets.toLocaleString()} پاکەت` : '-'}</td>
                <td>${analyticsData.overall.gifts}</td>
                <td dir="ltr" style="font-family: monospace;">${analyticsData.overall.cash.toLocaleString()} د.ع</td>
                <td dir="ltr" style="font-family: monospace;">${analyticsData.overall.debt.toLocaleString()} د.ع</td>
                <td dir="ltr" style="font-family: monospace; color: #15803d;">${analyticsData.overall.amount.toLocaleString()} د.ع</td>
                <td>${analyticsData.overall.invoices}</td>
              </tr>
            </tbody>
          </table>

          ${analyticsData.consolidatedItems.length > 0 ? `
            <div style="font-size: 13px; font-weight: 900; margin: 15px 0 6px 0; color: #1e293b;">
              کۆی کاڵا فرۆشراوەکان بەپێی کارتۆن لەم مەودایەدا (${analyticsData.consolidatedItems.length} کاڵا)
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 30px;">#</th>
                  <th>ناوی کاڵا</th>
                  <th>کارتۆنی فرۆشراو</th>
                  <th>پاکەت</th>
                  <th>هەدیە</th>
                  <th>کۆی بڕ بە پارە</th>
                </tr>
              </thead>
              <tbody>
                ${analyticsData.consolidatedItems.slice(0, 40).map((it, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td class="td-right">${it.name}</td>
                    <td style="font-weight: bold; color: #4338ca;">${it.cartons.toLocaleString()} کارتۆن</td>
                    <td>${it.packets > 0 ? `${it.packets.toLocaleString()} پاکەت` : '-'}</td>
                    <td>${it.gifts > 0 ? it.gifts : '-'}</td>
                    <td dir="ltr" style="font-weight: bold; font-family: monospace;">${it.amount.toLocaleString()} د.ع</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}

          <div class="signatures">
            <div class="sig-box">
              <div>لێپرسراوی ژمێریاری</div>
              <div class="sig-line"></div>
            </div>
            <div class="sig-box">
              <div>بەڕێوەبەری فرۆش</div>
              <div class="sig-line"></div>
            </div>
            ${analyticsPersonFilter !== 'all' ? `
              <div class="sig-box">
                <div>واژووی ${analyticsPersonFilter}</div>
                <div class="sig-line"></div>
              </div>
            ` : ''}
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

  // Print Single Person Report
  const handlePrintSinglePersonReport = (person: any) => {
    const companySettings = getCompanySettings();
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ckb">
        <head>
          <meta charset="utf-8" />
          <title>ڕاپۆرتی فرۆشی ${person.name} - ${periodRange.title}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; color: #0f172a; margin: 0; padding: 10px; font-size: 12px; }
            .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 15px; }
            .brand-title { margin: 0; font-size: 26px; font-weight: 900; color: #0f172a; }
            .brand-sub { font-size: 13px; font-weight: 800; color: #0284c7; margin-top: 2px; }
            .report-badge { display: inline-block; padding: 4px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 800; font-size: 12px; margin-top: 5px; }
            .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
            .kpi-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; text-align: center; }
            .kpi-val { font-size: 16px; font-weight: 900; color: #0f172a; font-family: monospace; }
            .kpi-lbl { font-size: 11px; font-weight: 700; color: #64748b; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px 6px; font-size: 11px; font-weight: 800; color: #334155; }
            td { border: 1px solid #cbd5e1; padding: 7px 6px; font-size: 11px; text-align: center; }
            .td-right { text-align: right; font-weight: bold; }
            .signatures { display: flex; justify-content: space-between; margin-top: 30px; padding: 0 30px; page-break-inside: avoid; }
            .sig-box { text-align: center; font-weight: bold; font-size: 12px; }
            .sig-line { width: 150px; border-bottom: 1px dashed #64748b; margin-top: 45px; }
            @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div style="width: 140px; text-align: right;">
              <img src="${window.location.origin}/LOGO1.jpg" alt="Logo" style="height: 60px; max-width: 120px; object-fit: contain;" onerror="this.style.display='none'" />
            </div>
            <div style="flex: 1; text-align: center;">
              <h1 class="brand-title">کۆمپانیای RF</h1>
              <div class="brand-sub">بریکاری فەرمی TAM TAM</div>
              <div style="font-size: 15px; font-weight: 900; color: #0f172a; margin-top: 4px;">
                ڕاپۆرتی فرۆش و حساباتی ${person.role === 'rep' ? 'مەندووب' : 'کاشڤان'}: ${person.name}
              </div>
              <div class="report-badge">${periodRange.title}: ${periodRange.subtitle}</div>
              ${person.phone ? `<div style="font-size: 11px; color: #475569; margin-top: 2px;">ژمارەی پەیوەندی: <span dir="ltr">${person.phone}</span></div>` : ''}
            </div>
            <div style="width: 140px; text-align: left; font-size: 11px; color: #64748b; font-weight: 700;">
              <div>ژ. کۆمپانیا: <span dir="ltr">${companySettings.phone}</span></div>
              <div style="margin-top: 3px;">بەروار: <span dir="ltr">${format(new Date(), 'yyyy/MM/dd HH:mm')}</span></div>
            </div>
          </div>

          <div class="kpi-grid">
            <div class="kpi-box" style="border-top: 3px solid #4f46e5;">
              <div class="kpi-val" style="color: #4338ca;">${person.totalCartons.toLocaleString()} کارتۆن</div>
              <div class="kpi-lbl">کۆی کارتۆنی فرۆشراو</div>
            </div>
            <div class="kpi-box" style="border-top: 3px solid #16a34a;">
              <div class="kpi-val" style="color: #15803d;" dir="ltr">${person.totalAmount.toLocaleString()} د.ع</div>
              <div class="kpi-lbl">کۆی بڕ بە پارە</div>
            </div>
            <div class="kpi-box" style="border-top: 3px solid #0284c7;">
              <div class="kpi-val" style="color: #0369a1;" dir="ltr">${person.cashAmount.toLocaleString()} د.ع</div>
              <div class="kpi-lbl">فرۆشی نەقد</div>
            </div>
            <div class="kpi-box" style="border-top: 3px solid #d97706;">
              <div class="kpi-val" style="color: #b45309;" dir="ltr">${person.debtAmount.toLocaleString()} د.ع</div>
              <div class="kpi-lbl">فرۆشی قەرز</div>
            </div>
          </div>

          <div style="font-size: 13px; font-weight: 900; margin-bottom: 6px; color: #1e293b;">
            لیستی کاڵا فرۆشراوەکان بەپێی کارتۆن
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                <th>ناوی کاڵا</th>
                <th>کارتۆنی فرۆشراو</th>
                <th>پاکەت</th>
                <th>هەدیە</th>
                <th>کۆی پارە</th>
              </tr>
            </thead>
            <tbody>
              ${Object.values(person.itemsMap).map((it: any, idx: number) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td class="td-right">${it.name}</td>
                  <td style="font-weight: bold; color: #4338ca;">${it.cartons.toLocaleString()} کارتۆن</td>
                  <td>${it.packets > 0 ? `${it.packets.toLocaleString()} پاکەت` : '-'}</td>
                  <td>${it.gifts > 0 ? it.gifts : '-'}</td>
                  <td dir="ltr" style="font-weight: bold; font-family: monospace;">${it.totalPrice.toLocaleString()} د.ع</td>
                </tr>
              `).join('')}
              <tr style="background: #f1f5f9; font-weight: 900;">
                <td colspan="2">کۆی گشتی کاڵاکان</td>
                <td style="color: #4338ca;">${person.totalCartons.toLocaleString()} کارتۆن</td>
                <td>${person.totalPackets > 0 ? `${person.totalPackets.toLocaleString()} پاکەت` : '-'}</td>
                <td>${person.totalGifts}</td>
                <td dir="ltr" style="font-family: monospace; color: #15803d;">${person.totalAmount.toLocaleString()} د.ع</td>
              </tr>
            </tbody>
          </table>

          <div style="font-size: 13px; font-weight: 900; margin: 15px 0 6px 0; color: #1e293b;">
            لیستی وەسڵەکان (${person.invoices.length} وەسڵ)
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                <th>ژ. وەسڵ</th>
                <th>مارکێت</th>
                <th>بەروار و کات</th>
                <th>کارتۆن</th>
                <th>جۆری پارەدان</th>
                <th>بڕی پارە</th>
              </tr>
            </thead>
            <tbody>
              ${person.invoices.map((inv: any, idx: number) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td dir="ltr" style="font-family: monospace; font-weight: bold;">#${inv.invoiceNo}</td>
                  <td class="td-right">${inv.marketName}</td>
                  <td dir="ltr" style="font-size: 10px;">${format(inv.date, 'yyyy/MM/dd HH:mm')}</td>
                  <td style="font-weight: bold; color: #4338ca;">${inv.cartons} کارتۆن</td>
                  <td>${inv.paymentType === 'debt' ? '<span style="color: #b45309; font-weight: bold;">قەرز</span>' : '<span style="color: #0369a1; font-weight: bold;">نەقد</span>'}</td>
                  <td dir="ltr" style="font-family: monospace; font-weight: bold;">${inv.amount.toLocaleString()} د.ع</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="signatures">
            <div class="sig-box">
              <div>لێپرسراوی ژمێریاری</div>
              <div class="sig-line"></div>
            </div>
            <div class="sig-box">
              <div>واژووی ${person.name}</div>
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
          onClick={() => setActiveTab('period_stats')}
          className={`py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 ${
            activeTab === 'period_stats' 
              ? 'bg-indigo-600 text-white shadow-sm' 
              : 'text-slate-700 bg-indigo-50/50 hover:bg-indigo-100/70 hover:text-indigo-900'
          }`}
        >
          <BarChart3 size={18} className="text-indigo-600" />
          <span>ئاماری فرۆش (ڕۆژانە، هەفتانە، مانگانە)</span>
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

          {/* Registered Users as Mandoob Overview */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <User size={18} className="text-indigo-600" />
                  <span>بەکارهێنەرانی سیستەم وەک مەندووب ({unifiedUsers.length} بەکارهێنەر)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  هەموو بەکارهێنەرێک کە تۆمار کراوە لەم لیستەیە. کلیک لەسەر هەر کەسێک بکە بۆ فلتەرکردنی ئۆردەرەکانی.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedRepFilter !== 'all' && (
                  <button
                    onClick={() => setSelectedRepFilter('all')}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-xl transition"
                  >
                    پیشاندانی سەرجەمیان
                  </button>
                )}
                <button
                  onClick={() => setShowAddCVModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
                >
                  <Plus size={15} />
                  <span>زیادکردنی بەکارهێنەری نوێ</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {repUsersSummary.map((u) => {
                const isSelected = selectedRepFilter === u.name;
                return (
                  <div
                    key={`rep-user-card-${u.name}`}
                    onClick={() => setSelectedRepFilter(isSelected ? 'all' : u.name)}
                    className={`cursor-pointer p-4 rounded-xl border transition relative flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/30 shadow-sm'
                        : 'bg-slate-50/70 hover:bg-slate-100/70 border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                          isSelected ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
                        }`}>
                          <User size={18} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{u.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono" dir="ltr">{u.phone || u.username || 'بێ ژمارە'}</div>
                        </div>
                      </div>
                      {u.status === 'deleted' ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">سڕاوەتەوە (حسابات پارێزراوە)</span>
                      ) : u.status === 'disabled' ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">ڕاگیراوە</span>
                      ) : isSelected ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-600 text-white">دیاریکراو</span>
                      ) : null}
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">فرۆشی مەندووب:</span>
                        <span className="font-black text-indigo-700 font-mono" dir="ltr">{(u.totalAmount || 0).toLocaleString()} د.ع</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">کارتۆن و ئۆردەر:</span>
                        <span className="font-bold text-slate-700 font-mono">{u.cartons} کارتۆن ({u.ordersCount} ئۆردەر)</span>
                      </div>
                      {u.pendingCount > 0 && (
                        <div className="flex items-center justify-between text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                          <span>چاوەڕێی تەسفییە:</span>
                          <span className="font-bold font-mono" dir="ltr">{(u.pendingAmount || 0).toLocaleString()} د.ع ({u.pendingCount})</span>
                        </div>
                      )}
                    </div>

                    <div className="text-center text-[11px] font-bold text-indigo-600">
                      {isSelected ? '✓ هەڵبژێردراوە (کلیک بکە بۆ لابردن)' : 'کلیک بکە بۆ فلتەرکردن'}
                    </div>
                  </div>
                );
              })}
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
                    <option value="all">سەرجەم مەندووبەکان ({unifiedUsers.length})</option>
                    {unifiedUsers.map(r => (
                      <option key={`rep-filter-${r.name}`} value={r.name}>
                        {r.name} {r.status === 'deleted' ? ' (سڕاوەتەوە - حساباتی پارێزراوە)' : r.status === 'disabled' ? ' (ڕاگیراوە)' : ''}
                      </option>
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

                {/* Period Filter for Reps */}
                <div className="flex items-center gap-1 bg-indigo-50/80 p-1 rounded-xl border border-indigo-100">
                  <button
                    onClick={() => setRepTimeFilter('all')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                      repTimeFilter === 'all' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-indigo-700 hover:bg-indigo-100/60'
                    }`}
                  >
                    هەموو کات
                  </button>
                  <button
                    onClick={() => setRepTimeFilter('today')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                      repTimeFilter === 'today' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-indigo-700 hover:bg-indigo-100/60'
                    }`}
                  >
                    ئەمڕۆ
                  </button>
                  <button
                    onClick={() => setRepTimeFilter('this_week')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                      repTimeFilter === 'this_week' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-indigo-700 hover:bg-indigo-100/60'
                    }`}
                  >
                    ئەم هەفتەیە
                  </button>
                  <button
                    onClick={() => setRepTimeFilter('this_month')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                      repTimeFilter === 'this_month' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-indigo-700 hover:bg-indigo-100/60'
                    }`}
                  >
                    ئەم مانگە
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
                          <div className="text-[11px] font-bold text-slate-500 mt-0.5 flex items-center gap-1">
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                              {(order.items || []).reduce((s, it) => s + (it.unit === 'packet' ? 0 : (Number(it.quantity) || 0)), 0)} کارتۆن
                            </span>
                            {(order.items || []).some(it => it.unit === 'packet') && (
                              <span className="bg-slate-100 text-slate-600 px-1 py-0.5 rounded text-[10px]">
                                + {(order.items || []).reduce((s, it) => s + (it.unit === 'packet' ? (Number(it.quantity) || 0) : 0), 0)} پاکەت
                              </span>
                            )}
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

          {/* Registered Users as Cashvan Overview */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <Truck size={18} className="text-blue-600" />
                  <span>بەکارهێنەرانی سیستەم وەک کاشڤان ({unifiedUsers.length} بەکارهێنەر)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  هەمان ئەو بەکارهێنەرانەی تۆمارکراون لەگەڵ فرۆشەکانیان وەک کاشڤان. کلیک لەسەر هەر کەسێک بکە بۆ فلتەرکردنی وەسڵەکانی.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedCashvanFilter !== 'all' && (
                  <button
                    onClick={() => setSelectedCashvanFilter('all')}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-xl transition"
                  >
                    پیشاندانی سەرجەمیان
                  </button>
                )}
                <button
                  onClick={() => setShowAddCVModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
                >
                  <Plus size={15} />
                  <span>زیادکردنی بەکارهێنەری نوێ</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {cashvanUsersSummary.map((u) => {
                const isSelected = selectedCashvanFilter === u.name;
                return (
                  <div
                    key={`cv-user-card-${u.name}`}
                    onClick={() => setSelectedCashvanFilter(isSelected ? 'all' : u.name)}
                    className={`cursor-pointer p-4 rounded-xl border transition relative flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/30 shadow-sm'
                        : 'bg-slate-50/70 hover:bg-slate-100/70 border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                          isSelected ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
                        }`}>
                          <Truck size={18} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{u.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono" dir="ltr">{u.phone || u.username || 'بێ ژمارە'}</div>
                        </div>
                      </div>
                      {u.status === 'deleted' ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">سڕاوەتەوە (حسابات پارێزراوە)</span>
                      ) : u.status === 'disabled' ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">ڕاگیراوە</span>
                      ) : isSelected ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-600 text-white">دیاریکراو</span>
                      ) : null}
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">فرۆشی کاشڤان:</span>
                        <span className="font-black text-blue-700 font-mono" dir="ltr">{(u.totalAmount || 0).toLocaleString()} د.ع</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">کارتۆن و وەسڵ:</span>
                        <span className="font-bold text-slate-700 font-mono">{u.cartons} کارتۆن ({u.salesCount} وەسڵ)</span>
                      </div>
                      {u.pendingCount > 0 && (
                        <div className="flex items-center justify-between text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                          <span>چاوەڕێی حیسابات:</span>
                          <span className="font-bold font-mono" dir="ltr">{(u.pendingAmount || 0).toLocaleString()} د.ع ({u.pendingCount})</span>
                        </div>
                      )}
                    </div>

                    <div className="text-center text-[11px] font-bold text-blue-600">
                      {isSelected ? '✓ هەڵبژێردراوە (کلیک بکە بۆ لابردن)' : 'کلیک بکە بۆ فلتەرکردن'}
                    </div>
                  </div>
                );
              })}
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
                    <option value="all">سەرجەم کاشڤانەکان ({unifiedUsers.length})</option>
                    {unifiedUsers.map(c => (
                      <option key={`cv-filter-${c.name}`} value={c.name}>
                        {c.name} {c.status === 'deleted' ? ' (سڕاوەتەوە - حساباتی پارێزراوە)' : c.status === 'disabled' ? ' (ڕاگیراوە)' : ''}
                      </option>
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

                {/* Period Filter for Cashvans */}
                <div className="flex items-center gap-1 bg-indigo-50/80 p-1 rounded-xl border border-indigo-100">
                  <button
                    onClick={() => setCvTimeFilter('all')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                      cvTimeFilter === 'all' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-indigo-700 hover:bg-indigo-100/60'
                    }`}
                  >
                    هەموو کات
                  </button>
                  <button
                    onClick={() => setCvTimeFilter('today')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                      cvTimeFilter === 'today' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-indigo-700 hover:bg-indigo-100/60'
                    }`}
                  >
                    ئەمڕۆ
                  </button>
                  <button
                    onClick={() => setCvTimeFilter('this_week')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                      cvTimeFilter === 'this_week' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-indigo-700 hover:bg-indigo-100/60'
                    }`}
                  >
                    ئەم هەفتەیە
                  </button>
                  <button
                    onClick={() => setCvTimeFilter('this_month')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                      cvTimeFilter === 'this_month' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-indigo-700 hover:bg-indigo-100/60'
                    }`}
                  >
                    ئەم مانگە
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
                            {(sale.totalAmount || 0).toLocaleString()} د.ع
                          </div>
                          <div className="text-[11px] font-bold text-slate-500 mt-0.5 flex items-center gap-1">
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                              {(sale.items || []).reduce((s, it) => s + (it.unit === 'packet' ? 0 : (Number(it.quantity) || 0)), 0)} کارتۆن
                            </span>
                            {(sale.items || []).some(it => it.unit === 'packet') && (
                              <span className="bg-slate-100 text-slate-600 px-1 py-0.5 rounded text-[10px]">
                                + {(sale.items || []).reduce((s, it) => s + (it.unit === 'packet' ? (Number(it.quantity) || 0) : 0), 0)} پاکەت
                              </span>
                            )}
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
      {/* TAB: PERIOD ANALYTICS FOR SALES REPS & CASHVANS                           */}
      {/* ========================================================================= */}
      {activeTab === 'period_stats' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <BarChart3 size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    ئامار و حساباتی فرۆش (ڕۆژانە، هەفتانە، مانگانە)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    بەپێی مەودای کات فلان مەندووب یان کاشڤان چەند کارتۆن و بڕی چەندی بە پارە فرۆشتووە
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handlePrintPeriodReport}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-sm transition self-stretch md:self-auto justify-center"
            >
              <Printer size={16} />
              <span>چاپکردنی تەواوی ڕاپۆرت (PDF)</span>
            </button>
          </div>

          {/* Period Selector & Controls Card */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            {/* Top Period Selector Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl">
                <button
                  onClick={() => setPeriodType('daily')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    periodType === 'daily'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Calendar size={14} />
                  <span>ڕۆژانە (Daily)</span>
                </button>
                <button
                  onClick={() => setPeriodType('weekly')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    periodType === 'weekly'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <TrendingUp size={14} />
                  <span>هەفتانە (Weekly)</span>
                </button>
                <button
                  onClick={() => setPeriodType('monthly')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    periodType === 'monthly'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BarChart3 size={14} />
                  <span>مانگانە (Monthly)</span>
                </button>
                <button
                  onClick={() => setPeriodType('custom')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    periodType === 'custom'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Clock size={14} />
                  <span>دیاریکراو (Custom)</span>
                </button>
              </div>

              {/* Range Active Indicator Badge */}
              <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3.5 py-1.5 rounded-xl border border-indigo-100 text-xs font-bold">
                <Calendar size={14} className="text-indigo-500" />
                <span>{periodRange.title}:</span>
                <span className="font-mono text-indigo-900" dir="ltr">{periodRange.subtitle}</span>
              </div>
            </div>

            {/* Date Inputs based on Period */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1 items-end">
              {periodType === 'daily' && (
                <div className="md:col-span-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">هەڵبژاردنی بەرواری ڕۆژ *</label>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setAnalyticsDate(format(new Date(), 'yyyy-MM-dd'))}
                        className="text-[11px] font-bold text-indigo-600 hover:underline px-1.5 py-0.5 bg-indigo-50 rounded"
                      >
                        ئەمڕۆ
                      </button>
                      <button
                        onClick={() => setAnalyticsDate(format(subDays(new Date(), 1), 'yyyy-MM-dd'))}
                        className="text-[11px] font-bold text-slate-600 hover:underline px-1.5 py-0.5 bg-slate-100 rounded"
                      >
                        دوێنێ
                      </button>
                    </div>
                  </div>
                  <input
                    type="date"
                    value={analyticsDate}
                    onChange={(e) => setAnalyticsDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              )}

              {periodType === 'weekly' && (
                <div className="md:col-span-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">هەڵبژاردنی هەفتە (ڕۆژێک لە هەفتەکە دیاری بکە) *</label>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setAnalyticsDate(format(new Date(), 'yyyy-MM-dd'))}
                        className="text-[11px] font-bold text-indigo-600 hover:underline px-1.5 py-0.5 bg-indigo-50 rounded"
                      >
                        ئەم هەفتەیە
                      </button>
                      <button
                        onClick={() => setAnalyticsDate(format(subWeeks(new Date(), 1), 'yyyy-MM-dd'))}
                        className="text-[11px] font-bold text-slate-600 hover:underline px-1.5 py-0.5 bg-slate-100 rounded"
                      >
                        هەفتەی پێشوو
                      </button>
                    </div>
                  </div>
                  <input
                    type="date"
                    value={analyticsDate}
                    onChange={(e) => setAnalyticsDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              )}

              {periodType === 'monthly' && (
                <div className="md:col-span-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">هەڵبژاردنی مانگ *</label>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setAnalyticsMonth(format(new Date(), 'yyyy-MM'))}
                        className="text-[11px] font-bold text-indigo-600 hover:underline px-1.5 py-0.5 bg-indigo-50 rounded"
                      >
                        ئەم مانگە
                      </button>
                      <button
                        onClick={() => setAnalyticsMonth(format(subMonths(new Date(), 1), 'yyyy-MM'))}
                        className="text-[11px] font-bold text-slate-600 hover:underline px-1.5 py-0.5 bg-slate-100 rounded"
                      >
                        مانگی پێشوو
                      </button>
                    </div>
                  </div>
                  <input
                    type="month"
                    value={analyticsMonth}
                    onChange={(e) => setAnalyticsMonth(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              )}

              {periodType === 'custom' && (
                <div className="md:col-span-2 grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">لە بەرواری (From) *</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">تا بەرواری (To) *</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Person & Role Filter */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  دیاریکردنی کەس (فلان مەندووب / کاشڤان)
                </label>
                <select
                  value={analyticsPersonFilter}
                  onChange={(e) => setAnalyticsPersonFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="all">سەرجەم مەندووب و کاشڤانەکان ({unifiedUsers.length})</option>
                  {unifiedUsers.map(u => (
                    <option key={`analytics-user-${u.name}`} value={u.name}>👤 {u.name}</option>
                  ))}
                </select>
              </div>

              {/* Role Quick Filter and Search */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">جۆری ڕۆڵ</label>
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => setAnalyticsRoleFilter('all')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                        analyticsRoleFilter === 'all' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      هەموو
                    </button>
                    <button
                      onClick={() => setAnalyticsRoleFilter('rep')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                        analyticsRoleFilter === 'rep' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      مەندووب
                    </button>
                    <button
                      onClick={() => setAnalyticsRoleFilter('cashvan')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                        analyticsRoleFilter === 'cashvan' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      کاشڤان
                    </button>
                  </div>
                </div>

                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">گەڕان</label>
                  <div className="relative">
                    <Search className="absolute right-2.5 top-2.5 text-slate-400" size={14} />
                    <input
                      type="text"
                      placeholder="گەڕان..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-2.5 pr-8 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4 Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Cartons */}
            <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-700">کۆی کارتۆنی فرۆشراو</span>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Package size={20} />
                </div>
              </div>
              <div className="text-2xl font-black text-indigo-900 font-mono" dir="ltr">
                {(analyticsData.overall.cartons || 0).toLocaleString()}
                <span className="text-xs font-sans mr-1 font-bold text-indigo-600"> کارتۆن</span>
              </div>
              <div className="text-[11px] font-bold text-indigo-600/80 mt-1 flex items-center justify-between">
                <span>
                  {(analyticsData.overall.packets || 0) > 0 ? `+ ${(analyticsData.overall.packets || 0).toLocaleString()} پاکەت` : 'سەرجەم بەرهەمەکان'}
                </span>
                {(analyticsData.overall.gifts || 0) > 0 && (
                  <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-bold">
                    {analyticsData.overall.gifts} هەدیە
                  </span>
                )}
              </div>
            </div>

            {/* Card 2: Total IQD */}
            <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-700">کۆی گشتی فرۆش بە پارە</span>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <DollarSign size={20} />
                </div>
              </div>
              <div className="text-2xl font-black text-emerald-700 font-mono" dir="ltr">
                {(analyticsData.overall.amount || 0).toLocaleString()}
                <span className="text-xs font-sans mr-1 font-bold text-emerald-600"> د.ع</span>
              </div>
              <div className="text-[11px] font-bold text-emerald-600/80 mt-1">
                کۆی نەقد و قەرزی {periodRange.title}
              </div>
            </div>

            {/* Card 3: Cash */}
            <div className="bg-white p-5 rounded-2xl border border-sky-100 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-sky-700">فرۆشی نەقد (کاش)</span>
                <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
                  <CheckCircle2 size={20} />
                </div>
              </div>
              <div className="text-2xl font-black text-sky-700 font-mono" dir="ltr">
                {(analyticsData.overall.cash || 0).toLocaleString()}
                <span className="text-xs font-sans mr-1 font-bold text-sky-600"> د.ع</span>
              </div>
              <div className="text-[11px] font-bold text-sky-600/80 mt-1">
                پارەی نەقدی ڕادەستکراو
              </div>
            </div>

            {/* Card 4: Debt */}
            <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-amber-700">فرۆشی بە قەرز</span>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Clock size={20} />
                </div>
              </div>
              <div className="text-2xl font-black text-amber-700 font-mono" dir="ltr">
                {(analyticsData.overall.debt || 0).toLocaleString()}
                <span className="text-xs font-sans mr-1 font-bold text-amber-600"> د.ع</span>
              </div>
              <div className="text-[11px] font-bold text-amber-600/80 mt-1">
                قەرزی نوێی ئەم مەودایە
              </div>
            </div>
          </div>

          {/* Main Comparison Table: Performance of Sales Reps and Cashvans */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Users size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">
                    خشتەی فرۆشی فلان مەندووب و کاشڤان بەپێی کارتۆن و بڕی پارە
                  </h3>
                  <div className="text-xs text-slate-500">
                    مەودای کات: <span className="font-bold text-slate-700">{periodRange.title}</span> ({periodRange.subtitle})
                  </div>
                </div>
              </div>

              <div className="text-xs font-bold text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                ژمارەی کارمەندان: {analyticsData.peopleList.length} کەس
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-100">
                  <tr>
                    <th className="p-4 text-center w-12">#</th>
                    <th className="p-4">ناوی مەندووب / کاشڤان</th>
                    <th className="p-4">ڕۆڵ</th>
                    <th className="p-4 bg-indigo-50/50 text-indigo-950">ژمارەی کارتۆنی فرۆشراو</th>
                    <th className="p-4 bg-emerald-50/50 text-emerald-950">کۆی بڕ بە پارە (د.ع)</th>
                    <th className="p-4">فرۆشی نەقد</th>
                    <th className="p-4">فرۆشی قەرز</th>
                    <th className="p-4 text-center">وەسڵەکان</th>
                    <th className="p-4 text-center">کردارەکان</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-bold">
                  {analyticsData.peopleList.map((person, idx) => (
                    <tr key={`person-stat-${person.id}-${idx}`} className="hover:bg-slate-50/80 transition">
                      <td className="p-4 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-xl ${
                            person.role === 'rep' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {person.role === 'rep' ? <ShoppingCart size={16} /> : <Truck size={16} />}
                          </div>
                          <div>
                            <div className="text-slate-900 font-black text-sm">{person.name}</div>
                            {person.phone && (
                              <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5" dir="ltr">
                                <Phone size={10} />
                                <span>{person.phone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                          person.role === 'rep' 
                            ? 'bg-indigo-100 text-indigo-800' 
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {person.role === 'rep' ? 'مەندووب (تەڵەبیە)' : 'کاشڤان (ڕاستەوخۆ)'}
                        </span>
                      </td>
                      {/* Cartons Sold */}
                      <td className="p-4 bg-indigo-50/30">
                        <div className="inline-flex items-baseline gap-1.5 bg-indigo-100/70 text-indigo-900 px-3 py-1.5 rounded-xl border border-indigo-200">
                          <span className="text-base font-black font-mono">
                            {((person.totalCartons ?? person.cartons) || 0).toLocaleString()}
                          </span>
                          <span className="text-xs font-bold text-indigo-700">کارتۆن</span>
                        </div>
                        {(person.totalPackets ?? person.packets ?? 0) > 0 && (
                          <div className="text-[11px] text-slate-500 font-mono mt-1">
                            + {(person.totalPackets ?? person.packets ?? 0).toLocaleString()} پاکەت
                          </div>
                        )}
                        {(person.totalGifts ?? person.gifts ?? 0) > 0 && (
                          <div className="text-[11px] text-amber-700 font-bold mt-0.5">
                            🎁 {person.totalGifts ?? person.gifts} هەدیە
                          </div>
                        )}
                      </td>
                      {/* Total Amount IQD */}
                      <td className="p-4 bg-emerald-50/30">
                        <div className="text-base font-black text-emerald-700 font-mono" dir="ltr">
                          {((person.totalAmount ?? person.amount) || 0).toLocaleString()} د.ع
                        </div>
                      </td>
                      {/* Cash Amount */}
                      <td className="p-4 text-sky-700 font-mono" dir="ltr">
                        {((person.cashAmount ?? person.cash) || 0).toLocaleString()} د.ع
                      </td>
                      {/* Debt Amount */}
                      <td className="p-4 text-amber-700 font-mono" dir="ltr">
                        {((person.debtAmount ?? person.debt) || 0).toLocaleString()} د.ع
                      </td>
                      {/* Invoices */}
                      <td className="p-4 text-center">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg font-mono text-xs font-bold">
                          {person.invoicesCount} وەسڵ
                        </span>
                      </td>
                      {/* Actions */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setInspectingPerson(person)}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition flex items-center gap-1 text-xs"
                            title="بینینی وردەکاری بەرهەمە فرۆشراوەکان"
                          >
                            <Eye size={14} />
                            <span>وردەکاری بەرهەم</span>
                          </button>
                          <button
                            onClick={() => handlePrintSinglePersonReport(person)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition"
                            title="چاپکردنی کەشفی ئەم کەسە"
                          >
                            <Printer size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {analyticsData.peopleList.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <BarChart3 size={36} className="text-slate-300" />
                          <span className="font-bold">هیچ داتایەکی فرۆشتن لەم مەودایەدا ({periodRange.title}) نەدۆزرایەوە</span>
                          <span className="text-xs text-slate-400">دەتوانیت بەروار یان کەسی هەڵبژێردراو بگۆڕیت</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Consolidated Products Breakdown in Selected Period */}
          {analyticsData.productsBreakdown.length > 0 && (
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <Package size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">
                      کۆی کاڵا فرۆشراوەکان بەپێی کارتۆن لەم مەودایەدا ({periodRange.title})
                    </h3>
                    <div className="text-xs text-slate-500">
                      پوختەی سەرجەم بەرهەمەکانی فرۆشراون لەلایەن مەندووب و کاشڤانەکان لەم ماوەیەدا
                    </div>
                  </div>
                </div>

                <div className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                  کۆی جۆری کاڵاکان: {analyticsData.productsBreakdown.length} جۆر
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-100">
                    <tr>
                      <th className="p-4 text-center w-12">#</th>
                      <th className="p-4">ناوی کاڵا / بەرهەم</th>
                      <th className="p-4 bg-indigo-50/50 text-indigo-950">ژمارەی کارتۆنی فرۆشراو</th>
                      <th className="p-4">پاکەت (ئەگەر هەبێت)</th>
                      <th className="p-4">هەدیە</th>
                      <th className="p-4 bg-emerald-50/50 text-emerald-950">کۆی بەها بە پارە (د.ع)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-bold">
                    {analyticsData.productsBreakdown.map((item, idx) => (
                      <tr key={`prod-breakdown-${idx}`} className="hover:bg-slate-50/80 transition">
                        <td className="p-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-4 text-slate-900 font-bold text-sm">
                          {item.name}
                        </td>
                        <td className="p-4 bg-indigo-50/30">
                          <span className="font-mono text-base font-black text-indigo-800 bg-indigo-100/80 px-3 py-1 rounded-lg">
                            {(item.cartons || 0).toLocaleString()} کارتۆن
                          </span>
                        </td>
                        <td className="p-4 text-slate-600 font-mono">
                          {(item.packets || 0) > 0 ? `${(item.packets || 0).toLocaleString()} پاکەت` : '-'}
                        </td>
                        <td className="p-4">
                          {(item.gifts || 0) > 0 ? (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded font-bold border border-amber-200">
                              🎁 {item.gifts} هەدیە
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-4 bg-emerald-50/30 text-emerald-700 font-mono font-black text-sm" dir="ltr">
                          {((item.totalAmount ?? item.amount) || 0).toLocaleString()} د.ع
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
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
                  <option value="all">سەرجەم کاشڤانەکان ({unifiedUsers.length})</option>
                  {unifiedUsers.map(c => (
                    <option key={`transfer-cv-${c.name}`} value={c.name}>{c.name}</option>
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
                      <option value="all">سەرجەم مەندووب و کاشڤانەکان ({unifiedUsers.length})</option>
                      {unifiedUsers.map(u => (
                        <option key={`daily-user-${u.name}`} value={u.name}>👤 {u.name}</option>
                      ))}
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

      {/* TAB 5: CASHVAN ACCOUNTS & AUTHENTICATION MANAGEMENT (REMOVED - UNIFIED IN REPS & CASHVANS VIEW) */}
      {false && (
        <div className="space-y-6" dir="rtl">
          {/* Header Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50">
            <div>
              <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Truck className="text-indigo-600" size={20} />
                <span>هەژمار و تێپەڕەوشەی چوونەژوورەوەی بەکارهێنەران (کاشڤان و مەندووب) ({unifiedUsers.length})</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                لێرە سەرجەم ئەو بەکارهێنەرانە دەبینیت کە تۆمارکراون؛ هەم وەک مەندووب و هەم وەک کاشڤان لە سیستەمەکە کار دەکەن بە هەمان ناوی بەکارهێنەر و تێپەڕەوشە
              </p>
            </div>

            <button
              onClick={() => {
                setNewCVName('');
                setNewCVUsername('');
                setNewCVPassword(Math.floor(10000 + Math.random() * 90000).toString());
                setNewCVPhone('');
                setNewCVVehicleNumber('');
                setShowAddCVModal(true);
              }}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shrink-0 shadow-sm"
            >
              <Truck size={16} />
              <span>دروستکردنی بەکارهێنەری نوێ</span>
            </button>
          </div>

          {/* Cashvans Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3.5">ناوی کەس / بەکارهێنەر</th>
                    <th className="px-5 py-3.5">ناوی بەکارهێنەر (Username)</th>
                    <th className="px-5 py-3.5">تێپەڕەوشە / پاسوۆرد</th>
                    <th className="px-5 py-3.5">تەلەفۆن</th>
                    <th className="px-5 py-3.5">ژمارەی ئۆتۆمبێل</th>
                    <th className="px-5 py-3.5">دۆخی هەژمار</th>
                    <th className="px-5 py-3.5 text-center">کردارەکان</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-slate-100">
                  {unifiedUsers.map((cv: any) => {
                    const pass = cv.accessCode || cv.password || '47953';
                    const isDisabled = cv.status === 'disabled';

                    return (
                      <tr key={cv.id} className={`hover:bg-slate-50/80 transition ${isDisabled ? 'bg-red-50/30 opacity-70' : ''}`}>
                        <td className="px-5 py-4">
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <Truck size={16} className={isDisabled ? 'text-slate-400' : 'text-indigo-600'} />
                            <span>{cv.name}</span>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg text-xs font-mono font-bold">
                            {cv.username || cv.name}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-slate-900 text-amber-400 font-mono font-bold tracking-widest text-xs rounded-lg shadow-2xs">
                              {pass}
                            </span>
                            <button
                              onClick={() => handleCopyCVCredentials(cv)}
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
                              title="کۆپیکردنی یوزەر و پاسوۆرد"
                            >
                              {copiedCVId === cv.id ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
                            </button>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-slate-600 font-mono text-xs" dir="ltr">
                          {cv.phone || '-'}
                        </td>

                        <td className="px-5 py-4 text-slate-600 text-xs">
                          {cv.vehicleNumber || '-'}
                        </td>

                        <td className="px-5 py-4">
                          {isDisabled ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 flex items-center gap-1 w-fit">
                              <AlertTriangle size={12} />
                              ڕاگیراوە
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 flex items-center gap-1 w-fit">
                              <CheckCircle2 size={12} />
                              چالاکە
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setCodeCVModalItem(cv);
                                setInputCVCode(cv.accessCode || cv.password || '');
                                setInputCVUsername(cv.username || cv.name);
                              }}
                              className="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs rounded-lg transition flex items-center gap-1"
                              title="گۆڕینی پاسوۆرد"
                            >
                              <span>گۆڕینی پاسوۆرد</span>
                            </button>

                            <button
                              onClick={() => handleToggleCVStatus(cv)}
                              className={`p-1.5 rounded-lg transition ${
                                isDisabled
                                  ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                              }`}
                              title={isDisabled ? 'چالاککردنەوە' : 'ڕاگرتن'}
                            >
                              <CheckCircle2 size={15} />
                            </button>

                            <button
                              onClick={() => {
                                setEditingCVItem(cv);
                                setEditCVName(cv.name);
                                setEditCVUsername(cv.username || cv.name);
                                setEditCVPhone(cv.phone || '');
                                setEditCVPassword(cv.accessCode || cv.password || '');
                                setEditCVStatus(cv.status || 'active');
                              }}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition"
                              title="دەستکاری زانیاری"
                            >
                              <Edit2 size={15} />
                            </button>

                            <button
                              onClick={() => setDeletingCVItem(cv)}
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="سڕینەوە"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {unifiedUsers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-500">
                        <Truck size={32} className="mx-auto text-slate-300 mb-2" />
                        <p className="font-bold text-sm">هیچ بەکارهێنەرێک تۆمار نەکراوە</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW CASHVAN */}
      {showAddCVModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200" dir="rtl">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
              <h3 className="font-bold text-indigo-900 text-base flex items-center gap-2">
                <Truck className="text-indigo-600" size={20} />
                دروستکردنی هەژماری کاشڤانی نوێ
              </h3>
              <button onClick={() => setShowAddCVModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddNewCashvan} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ناوی کاشڤان *</label>
                <input
                  type="text"
                  required
                  placeholder="بۆ نموونە: کاشڤان ئارام"
                  value={newCVName}
                  onChange={(e) => {
                    setNewCVName(e.target.value);
                    if (!newCVUsername) setNewCVUsername(e.target.value.toLowerCase().replace(/\s+/g, '_'));
                  }}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold text-slate-900"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ناوی بەکارهێنەر (Username)</label>
                <input
                  type="text"
                  placeholder="aram_cashvan"
                  value={newCVUsername}
                  onChange={(e) => setNewCVUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تێپەڕەوشە / پاسوۆرد</label>
                <input
                  type="text"
                  placeholder="12345"
                  value={newCVPassword}
                  onChange={(e) => setNewCVPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold font-mono tracking-widest bg-slate-50"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ژمارەی تەلەفۆن</label>
                <input
                  type="tel"
                  placeholder="0750XXXXXXX"
                  value={newCVPhone}
                  onChange={(e) => setNewCVPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ژمارەی ئۆتۆمبێل (ئارەزوومەندانە)</label>
                <input
                  type="text"
                  placeholder="هەولێر 12345"
                  value={newCVVehicleNumber}
                  onChange={(e) => setNewCVVehicleNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-medium"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isProcessing || !newCVName.trim()}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <Truck size={16} />
                  <span>دروستکردنی هەژمار</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCVModal(false)}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                >
                  پاشگەزبوونەوە
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT CASHVAN */}
      {editingCVItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200" dir="rtl">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
              <h3 className="font-bold text-indigo-900 text-base flex items-center gap-2">
                <Edit2 className="text-indigo-600" size={18} />
                دەستکاری زانیاری کاشڤان
              </h3>
              <button onClick={() => setEditingCVItem(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditCashvan} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ناوی کاشڤان *</label>
                <input
                  type="text"
                  required
                  value={editCVName}
                  onChange={(e) => setEditCVName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-indigo-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold text-slate-900"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">یوزەرنەیم (Username)</label>
                <input
                  type="text"
                  value={editCVUsername}
                  onChange={(e) => setEditCVUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-mono font-bold"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تێپەڕەوشە / پاسوۆرد</label>
                <input
                  type="text"
                  value={editCVPassword}
                  onChange={(e) => setEditCVPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-mono font-bold tracking-wider"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ژمارەی تەلەفۆن</label>
                <input
                  type="tel"
                  value={editCVPhone}
                  onChange={(e) => setEditCVPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">دۆخی هەژمار</label>
                <select
                  value={editCVStatus}
                  onChange={(e) => setEditCVStatus(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold bg-white"
                >
                  <option value="active">چالاک (دەتوانێت بچێتە ژوورەوە)</option>
                  <option value="disabled">ڕاگیراو (ناتوانێت بچێتە ژوورەوە)</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isProcessing || !editCVName.trim()}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition shadow-sm disabled:opacity-50"
                >
                  پاشەکەوتکردنی گۆڕانکارییەکان
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCVItem(null)}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                >
                  پاشگەزبوونەوە
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CHANGE CASHVAN PASSWORD */}
      {codeCVModalItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200" dir="rtl">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
              <h3 className="font-bold text-indigo-900 text-base flex items-center gap-2">
                <Truck className="text-indigo-600" size={20} />
                گۆڕینی تێپەڕەوشەی کاشڤان
              </h3>
              <button onClick={() => setCodeCVModalItem(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCVCode} className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">کاشڤان:</span>
                  <span className="font-bold text-slate-800">{codeCVModalItem.name}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ناوی بەکارهێنەر (Username)</label>
                <input
                  type="text"
                  value={inputCVUsername}
                  onChange={(e) => setInputCVUsername(e.target.value)}
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تێپەڕەوشە / پاسوۆردی نوێ</label>
                <input
                  type="text"
                  required
                  value={inputCVCode}
                  onChange={(e) => setInputCVCode(e.target.value)}
                  className="w-full px-4 py-3 text-center tracking-[0.4em] text-xl border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono font-bold text-slate-800 bg-white"
                  dir="ltr"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isProcessing || !inputCVCode.trim()}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition text-xs shadow-sm disabled:opacity-50"
                >
                  پاشەکەوتکردنی پاسوۆرد
                </button>
                <button
                  type="button"
                  onClick={() => setCodeCVModalItem(null)}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-xs"
                >
                  پاشگەزبوونەوە
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE CASHVAN MODAL */}
      <ConfirmModal
        isOpen={!!deletingCVItem}
        onClose={() => setDeletingCVItem(null)}
        onConfirm={confirmDeleteCashvan}
        title="سڕینەوە و ڕاگرتنی کاشڤان / مەندووب"
        message={`ئایا دڵنیایت لە سڕینەوەی ئەم کارمەندە (${deletingCVItem?.name})؟ تێبینی: بە سڕینەوەی ئەم هەژمارە تەنها دەستڕاگەیشتنی دادەخرێت؛ تەواوی حیسابات، وەسڵەکان، قەرزەکان و مامەڵەکانی بە پارێزراوی لە دەفتەری حیساباتدا دەمێننەوە و ناسڕێنەوە.`}
        itemName={deletingCVItem?.name}
        details={deletingCVItem ? [
          { label: 'ناوی کارمەند', value: deletingCVItem.name },
          { label: 'تەلەفۆن', value: deletingCVItem.phone || '-' },
          { label: 'پاسوۆرد', value: deletingCVItem.accessCode || deletingCVItem.password || 'دیاری نەکراوە' },
          { label: 'دۆخی حیسابات', value: 'پارێزراوە لە دەفتەری حیسابات (ناسڕێتەوە)' }
        ] : []}
      />

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
      {/* DRILLDOWN MODAL: DETAILED PRODUCTS & INVOICES FOR A SINGLE PERSON         */}
      {/* ========================================================================= */}
      {inspectingPerson && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-2xl ${
                  inspectingPerson.role === 'rep' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {inspectingPerson.role === 'rep' ? <ShoppingCart size={22} /> : <Truck size={22} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900">{inspectingPerson.name}</h3>
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                      inspectingPerson.role === 'rep' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {inspectingPerson.role === 'rep' ? 'مەندووب' : 'کاشڤان'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 font-mono" dir="ltr">
                    <span>{periodRange.title}: {periodRange.subtitle}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setInspectingPerson(null)}
                className="p-2 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-xl transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5">
              {/* Summary Stats Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-indigo-50/80 p-3 rounded-2xl border border-indigo-100 text-center">
                  <div className="text-[11px] font-bold text-indigo-700">کۆی کارتۆن</div>
                  <div className="text-lg font-black text-indigo-900 font-mono mt-0.5">
                    {((inspectingPerson.totalCartons ?? inspectingPerson.cartons) || 0).toLocaleString()}
                    <span className="text-xs font-normal"> کارتۆن</span>
                  </div>
                  {((inspectingPerson.totalPackets ?? inspectingPerson.packets) || 0) > 0 && (
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      + {(inspectingPerson.totalPackets ?? inspectingPerson.packets).toLocaleString()} پاکەت
                    </div>
                  )}
                </div>

                <div className="bg-emerald-50/80 p-3 rounded-2xl border border-emerald-100 text-center">
                  <div className="text-[11px] font-bold text-emerald-700">کۆی گشتی بە پارە</div>
                  <div className="text-lg font-black text-emerald-700 font-mono mt-0.5" dir="ltr">
                    {((inspectingPerson.totalAmount ?? inspectingPerson.amount) || 0).toLocaleString()} د.ع
                  </div>
                </div>

                <div className="bg-sky-50/80 p-3 rounded-2xl border border-sky-100 text-center">
                  <div className="text-[11px] font-bold text-sky-700">فرۆشی نەقد</div>
                  <div className="text-lg font-black text-sky-700 font-mono mt-0.5" dir="ltr">
                    {((inspectingPerson.cashAmount ?? inspectingPerson.cash) || 0).toLocaleString()} د.ع
                  </div>
                </div>

                <div className="bg-amber-50/80 p-3 rounded-2xl border border-amber-100 text-center">
                  <div className="text-[11px] font-bold text-amber-700">فرۆشی قەرز</div>
                  <div className="text-lg font-black text-amber-700 font-mono mt-0.5" dir="ltr">
                    {((inspectingPerson.debtAmount ?? inspectingPerson.debt) || 0).toLocaleString()} د.ع
                  </div>
                </div>
              </div>

              {/* Items Breakdown Table */}
              {(() => {
                const breakdown = inspectingPerson.itemsBreakdown || Object.values(inspectingPerson.itemsMap || {});
                return (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="bg-slate-50 p-3 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <Package size={15} className="text-indigo-600" />
                        وردەکاری کاڵا فرۆشراوەکان بەپێی کارتۆن
                      </span>
                      <span className="text-xs font-bold text-slate-500 font-mono">
                        {breakdown.length} جۆر کاڵا
                      </span>
                    </div>

                    <div className="overflow-x-auto max-h-60 overflow-y-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100/70 text-slate-600 uppercase border-b border-slate-200 font-bold sticky top-0">
                          <tr>
                            <th className="p-3">ناوی کاڵا</th>
                            <th className="p-3 bg-indigo-50/50 text-indigo-950">کارتۆنی فرۆشراو</th>
                            <th className="p-3">پاکەت</th>
                            <th className="p-3">هەدیە</th>
                            <th className="p-3 bg-emerald-50/50 text-emerald-950">کۆی بڕ (د.ع)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-bold">
                          {breakdown.map((item: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50/70">
                              <td className="p-3 text-slate-900">{item.name}</td>
                              <td className="p-3 bg-indigo-50/30">
                                <span className="font-mono text-sm font-black text-indigo-800 bg-indigo-100/70 px-2 py-0.5 rounded">
                                  {(item.cartons || 0).toLocaleString()} کارتۆن
                                </span>
                              </td>
                              <td className="p-3 text-slate-600 font-mono">
                                {(item.packets || 0) > 0 ? `${item.packets} پاکەت` : '-'}
                              </td>
                              <td className="p-3">
                                {(item.gifts || 0) > 0 ? (
                                  <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded font-bold">
                                    🎁 {item.gifts} هەدیە
                                  </span>
                                ) : '-'}
                              </td>
                              <td className="p-3 bg-emerald-50/30 text-emerald-700 font-mono" dir="ltr">
                                {((item.totalPrice ?? item.totalAmount ?? item.amount) || 0).toLocaleString()} د.ع
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* Invoices List */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="bg-slate-50 p-3 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Receipt size={15} className="text-indigo-600" />
                    لیستی وەسڵەکان لەم ماوەیەدا
                  </span>
                  <span className="text-xs font-bold text-slate-500 font-mono">
                    {(inspectingPerson.invoices || []).length} وەسڵ
                  </span>
                </div>

                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100/70 text-slate-600 uppercase border-b border-slate-200 font-bold sticky top-0">
                      <tr>
                        <th className="p-3">ژ.وەسڵ</th>
                        <th className="p-3">مارکێت</th>
                        <th className="p-3">بەروار و کات</th>
                        <th className="p-3">بڕی کارتۆن</th>
                        <th className="p-3">بڕی پارە</th>
                        <th className="p-3">شێوازی پارەدان</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold">
                      {(inspectingPerson.invoices || []).map((inv: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50/70">
                          <td className="p-3 text-slate-600 font-mono">#{inv.invoiceNumber || inv.invoiceNo || inv.id?.slice(-6)}</td>
                          <td className="p-3 text-slate-900">{inv.marketName}</td>
                          <td className="p-3 text-slate-500 font-mono" dir="ltr">
                            {inv.date ? format(inv.date, 'yyyy/MM/dd HH:mm') : '-'}
                          </td>
                          <td className="p-3">
                            <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-mono">
                              {(inv.cartons || 0).toLocaleString()} کارتۆن
                            </span>
                          </td>
                          <td className="p-3 text-indigo-700 font-mono" dir="ltr">
                            {(inv.amount || 0).toLocaleString()} د.ع
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-md text-[11px] ${
                              inv.paymentType === 'cash'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {inv.paymentType === 'cash' ? 'نەقد' : 'قەرز'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <button
                onClick={() => handlePrintSinglePersonReport(inspectingPerson)}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
              >
                <Printer size={16} />
                <span>چاپکردنی ڕاپۆرتی تەواوی ئەم کەسە (PDF)</span>
              </button>

              <button
                onClick={() => setInspectingPerson(null)}
                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                داخستن
              </button>
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
