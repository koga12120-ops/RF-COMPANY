import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, getDocs, where, addDoc, updateDoc, doc, onSnapshot, query, orderBy, deleteDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { Order, Item, Role, Market, Transaction, CashvanSale } from '../../types';
import { ShoppingCart, Plus, Printer, CheckCircle, Search, X, DollarSign, CreditCard, Trash2, Edit2, User, Calendar, FileText, CheckCircle2, Truck, Send, ArrowRight, Package } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, isSameDay } from 'date-fns';
import ConfirmModal from '../common/ConfirmModal';
import SimpleMarketDebtPayModal from '../common/SimpleMarketDebtPayModal';
import MarketDailyScheduleCard from '../common/MarketDailyScheduleCard';
import { printDailyRepReceiptPopup } from '../../lib/statementPrinter';
import { getNextInvoiceNumber } from '../../lib/invoiceSequence';

interface ActivityItem {
  id: string;
  type: 'order' | 'cashvan_sale' | 'debt_collection';
  marketName: string;
  repName: string;
  amount: number;
  paymentType?: 'cash' | 'debt';
  status?: string;
  timestamp: number;
  items?: { name: string; quantity: number; unit?: string; price?: number }[];
  rawOrder?: Order;
  rawSale?: CashvanSale;
  rawTransaction?: Transaction;
}

export default function OrdersView({
  role,
  initialTab = 'schedule',
  onTabChange
}: {
  role: Role;
  initialTab?: 'schedule' | 'info';
  onTabChange?: (tab: 'schedule' | 'info') => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [cashvanSales, setCashvanSales] = useState<CashvanSale[]>([]);
  const [vanInventory, setVanInventory] = useState<any[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [reps, setReps] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null);
  const [deletingSale, setDeletingSale] = useState<CashvanSale | null>(null);

  // Active user / rep name
  const [repName, setRepName] = useState('');

  // Main Tabs
  const [activeMainTab, setActiveMainTab] = useState<'schedule' | 'info'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveMainTab(initialTab);
    }
  }, [initialTab]);

  const handleTabSelect = (tab: 'schedule' | 'info') => {
    setActiveMainTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  // Forms State (Opened from the Schedule Card's 3-line Menu)
  const [activeFormMode, setActiveFormMode] = useState<'none' | 'order' | 'cashvan'>('none');
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  // Order Form State (تەڵەبییە)
  const [orderMarketName, setOrderMarketName] = useState('');
  const [orderLocation, setOrderLocation] = useState('');
  const [orderPaymentType, setOrderPaymentType] = useState<'cash' | 'debt'>('debt');
  const [orderSelectedItems, setOrderSelectedItems] = useState<{ item: Item; quantity: number; unit: 'carton' | 'packet' }[]>([]);
  const [orderItemSearch, setOrderItemSearch] = useState('');

  // Cashvan Direct Sale Form State (کاشڤان ڕاستەوخۆ)
  const [vanMarketName, setVanMarketName] = useState('');
  const [vanPaymentType, setVanPaymentType] = useState<'cash' | 'debt'>('cash');
  const [vanCart, setVanCart] = useState<any[]>([]);
  const [vanItemSearch, setVanItemSearch] = useState('');

  // Simple Debt Pay Modal state
  const [isSimpleDebtModalOpen, setIsSimpleDebtModalOpen] = useState(false);
  const [debtTargetMarket, setDebtTargetMarket] = useState('');
  const [debtTargetMarketObj, setDebtTargetMarketObj] = useState<Market | null>(null);
  const [debtTargetAmount, setDebtTargetAmount] = useState(0);

  // Date Filtering State for the bottom Activity History
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'custom' | 'all'>('today');
  const [customDate, setCustomDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [activityTypeFilter, setActivityTypeFilter] = useState<'all' | 'order' | 'cashvan_sale' | 'debt_collection'>('all');
  const [historySearchTerm, setHistorySearchTerm] = useState('');

  // Admin Settlement state
  const [settlingOrder, setSettlingOrder] = useState<Order | null>(null);

  const formSectionRef = useRef<HTMLDivElement | null>(null);

  // Auto-fill rep name and sync live with users collection
  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubUser = onSnapshot(
      doc(db, 'users', auth.currentUser.uid),
      (docSnap) => {
        if (docSnap.exists() && docSnap.data().name) {
          setRepName(docSnap.data().name);
        } else if (auth.currentUser?.displayName) {
          setRepName(auth.currentUser.displayName);
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'users')
    );
    return () => unsubUser();
  }, []);

  // Listeners for Firestore Collections
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
      (error) => handleFirestoreError(error, OperationType.GET, 'orders')
    );

    const qSales = query(collection(db, 'cashvan_sales'), orderBy('date', 'desc'));
    const unsubSales = onSnapshot(
      qSales,
      (snapshot) => {
        const salesData: CashvanSale[] = [];
        snapshot.forEach((doc) => {
          salesData.push({ id: doc.id, ...doc.data() } as CashvanSale);
        });
        setCashvanSales(salesData.filter(s => s.status !== 'deleted'));
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'cashvan_sales')
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
      (error) => handleFirestoreError(error, OperationType.GET, 'items')
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
      (error) => handleFirestoreError(error, OperationType.GET, 'markets')
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
      (error) => handleFirestoreError(error, OperationType.GET, 'reps')
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
      (error) => handleFirestoreError(error, OperationType.GET, 'cashvans')
    );

    const qTrans = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const unsubTrans = onSnapshot(
      qTrans,
      (snapshot) => {
        const transData: Transaction[] = [];
        snapshot.forEach(doc => transData.push({ id: doc.id, ...doc.data() } as Transaction));
        setTransactions(transData);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'transactions')
    );

    return () => {
      unsubOrders();
      unsubSales();
      unsubItems();
      unsubMarkets();
      unsubReps();
      unsubCVs();
      unsubTrans();
    };
  }, []);

  // Listen to cashvan_inventory for the current active rep / cashvan
  useEffect(() => {
    if (!repName) return;
    const qInv = query(collection(db, 'cashvan_inventory'), where('cashvanName', '==', repName));
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
        setVanInventory(data);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'cashvan_inventory')
    );
    return () => unsubInv();
  }, [repName]);

  // Compute live market debt map
  const marketDebtMap = useMemo(() => {
    const map = new Map<string, number>();
    const debtsMap = new Map<string, number>();
    const paidsMap = new Map<string, number>();

    transactions.forEach(t => {
      const entity = t.relatedEntityId?.trim();
      if (!entity) return;
      let key = entity;
      for (const m of markets) {
        if (m.name?.trim().toLowerCase() === entity.toLowerCase()) {
          key = m.name;
          break;
        }
      }
      const amt = t.amount || 0;
      if (t.type === 'debt' || t.type === 'market_debt') {
        debtsMap.set(key, (debtsMap.get(key) || 0) + amt);
      } else if (t.type === 'paid_debt' || t.type === 'market_paid_debt') {
        paidsMap.set(key, (paidsMap.get(key) || 0) + amt);
      }
    });

    debtsMap.forEach((totalDebt, key) => {
      const totalPaid = paidsMap.get(key) || 0;
      map.set(key, Math.max(0, totalDebt - totalPaid));
    });

    markets.forEach(m => {
      if (!map.has(m.name)) {
        const totalDebt = debtsMap.get(m.name) || 0;
        const totalPaid = paidsMap.get(m.name) || 0;
        map.set(m.name, Math.max(0, totalDebt - totalPaid));
      }
    });

    return map;
  }, [transactions, markets]);

  // Price calculations
  const calcPrice = (item: any, unit: 'carton' | 'packet', currentMarketName?: string) => {
    if (!item) return 0;
    const targetM = currentMarketName || orderMarketName || vanMarketName;
    const isWholesale = markets.find(m => m.name === targetM)?.type === 'warehouse';

    const cartonPrice = Number(item.cartonSellingPrice) || Number(item.cartonPrice) || Number(item.sellingPrice) || Number(item.price) || Number(item.pieceSellingPrice) || 0;
    const packetPrice = Number(item.packetSellingPrice) || Number(item.packetPrice) || Number(item.pieceSellingPrice) || Number(item.sellingPrice) || Number(item.price) || 0;
    const cartonWS = Number(item.cartonWholesalePrice) || Number(item.wholesalePrice) || cartonPrice;
    const packetWS = Number(item.packetWholesalePrice) || Number(item.wholesalePrice) || packetPrice;

    if (isWholesale) {
      if (unit === 'packet') return packetWS || packetPrice || cartonPrice;
      return cartonWS || cartonPrice || packetPrice;
    } else {
      if (unit === 'packet') return packetPrice || cartonPrice;
      return cartonPrice || packetPrice;
    }
  };

  // --- Handlers for Menu Triggers on Schedule Cards ---
  const handleSelectMarketForOrder = (market: Market) => {
    setOrderMarketName(market.name);
    setOrderLocation(market.location || '');
    setOrderSelectedItems([]);
    setEditingOrderId(null);
    setActiveFormMode('order');
    setTimeout(() => {
      formSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSelectMarketForCashvan = (market: Market) => {
    setVanMarketName(market.name);
    setVanCart([]);
    setActiveFormMode('cashvan');
    setTimeout(() => {
      formSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSelectMarketForDebtPay = (market: Market, debt: number) => {
    setDebtTargetMarket(market.name);
    setDebtTargetMarketObj(market);
    setDebtTargetAmount(debt);
    setIsSimpleDebtModalOpen(true);
  };

  // --- ORDER FORM HANDLERS ---
  const handleAddItemToOrder = (item: Item) => {
    const exists = orderSelectedItems.find(si => si.item.id === item.id);
    if (exists) {
      const newQty = exists.quantity + 1;
      if (newQty > (exists.item.quantity || 0)) {
        alert('بڕی داواکراو لە کۆگا بەردەست نییە');
        return;
      }
      setOrderSelectedItems(orderSelectedItems.map(si => 
        si.item.id === item.id ? { ...si, quantity: newQty } : si
      ));
    } else {
      if ((item.quantity || 0) < 1) {
        alert('بڕی داواکراو لە کۆگا بەردەست نییە');
        return;
      }
      const unit: 'carton' | 'packet' = (item.packetSellingPrice && !item.cartonSellingPrice) ? 'packet' : 'carton';
      setOrderSelectedItems([...orderSelectedItems, { item, quantity: 1, unit }]);
    }
  };

  const handleUpdateOrderItemQty = (id: string, qty: number, unit?: 'carton' | 'packet') => {
    if (qty <= 0) {
      setOrderSelectedItems(orderSelectedItems.filter(si => si.item.id !== id));
      return;
    }
    const itemObj = orderSelectedItems.find(si => si.item.id === id);
    if (itemObj && qty > (itemObj.item.quantity || 0)) {
      alert(`بڕی داواکراو لە کۆگا بەردەست نییە. تەنها ${itemObj.item.quantity} بەردەستە.`);
      return;
    }
    setOrderSelectedItems(orderSelectedItems.map(si => 
      si.item.id === id ? { ...si, quantity: qty, unit: unit || si.unit } : si
    ));
  };

  const submitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repName.trim()) {
      alert('تکایە ناوی مەندووب دیاری بکە');
      return;
    }
    if (!orderMarketName.trim()) {
      alert('تکایە ناوی مارکێت دیاری بکە');
      return;
    }
    if (orderSelectedItems.length === 0) {
      alert('هیچ کاڵایەک بۆ داواکارییەکە هەڵنەبژێردراوە');
      return;
    }

    const totalAmount = orderSelectedItems.reduce((acc, curr) => {
      const price = calcPrice(curr.item, curr.unit, orderMarketName);
      return acc + (price * curr.quantity);
    }, 0);

    const totalCost = orderSelectedItems.reduce((acc, curr) => {
      const cost = curr.unit === 'packet'
        ? (curr.item.packetCostPrice || curr.item.costPrice || 0)
        : (curr.item.cartonCostPrice || curr.item.costPrice || 0);
      return acc + (cost * curr.quantity);
    }, 0);

    const totalProfit = totalAmount - totalCost;

    const orderItems = orderSelectedItems.map(si => ({
      itemId: si.item.id,
      name: si.item.name,
      price: calcPrice(si.item, si.unit, orderMarketName),
      quantity: si.quantity,
      unit: si.unit
    }));

    try {
      if (orderMarketName && !markets.find(m => m.name === orderMarketName.trim())) {
        await addDoc(collection(db, 'markets'), { 
          name: orderMarketName.trim(), 
          phone: '', 
          location: orderLocation.trim() || '', 
          type: 'market', 
          createdAt: Date.now() 
        });
      }

      if (editingOrderId) {
        await updateDoc(doc(db, 'orders', editingOrderId), {
          repName: repName.trim(),
          marketName: orderMarketName.trim(),
          location: orderLocation.trim(),
          totalAmount,
          totalProfit,
          items: orderItems,
          status: 'pending',
          paymentStatus: orderPaymentType,
          timestamp: Date.now()
        });
        setEditingOrderId(null);
      } else {
        const nextInvoiceNo = await getNextInvoiceNumber();
        const newOrderData = {
          invoiceId: nextInvoiceNo,
          invoiceNo: nextInvoiceNo,
          repName: repName.trim(),
          marketName: orderMarketName.trim(),
          location: orderLocation.trim(),
          totalAmount,
          totalProfit,
          items: orderItems,
          status: 'pending' as const,
          paymentStatus: orderPaymentType,
          timestamp: Date.now()
        };
        const orderRef = await addDoc(collection(db, 'orders'), newOrderData);
        printOrderReceipt({ ...newOrderData, id: orderRef.id }, nextInvoiceNo);
      }
      
      setActiveFormMode('none');
      setOrderMarketName('');
      setOrderLocation('');
      setOrderSelectedItems([]);
      alert('داواکارییەکە بە سەرکەوتوویی نێردرا بۆ کۆگا');
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە ناردنی داواکاری');
    }
  };

  // --- CASHVAN SALE HANDLERS ---
  const addToVanCart = (item: any) => {
    setVanCart(prev => {
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
      return [...prev, { ...item, cartQty: 1, finalPrice: calcPrice(item, unit, vanMarketName), unit }];
    });
  };

  const updateVanCartQty = (id: string, qty: number, unit?: 'carton' | 'packet') => {
    const item = vanInventory.find(i => i.id === id);
    if (!item) return;
    
    setVanCart(prev => {
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
      
      const price = calcPrice(item, newUnit, vanMarketName);
      return prev.map(p => p.id === id ? { ...p, cartQty: qty, unit: newUnit, finalPrice: price } : p);
    });
  };

  const submitCashvanSale = async () => {
    if (!vanMarketName || vanCart.length === 0) {
      alert('تکایە مارکێت و لانیکەم یەک کاڵا دیاری بکە');
      return;
    }

    try {
      if (vanMarketName && !markets.find(m => m.name === vanMarketName)) {
        await addDoc(collection(db, 'markets'), { 
          name: vanMarketName, 
          location: '', 
          phone: '', 
          type: 'market', 
          createdAt: Date.now() 
        });
      }
      
      const totalAmount = vanCart.reduce((acc, curr) => acc + (curr.finalPrice * curr.cartQty), 0);
      const totalCost = vanCart.reduce((acc, curr) => { 
        const cost = curr.unit === "packet" ? (curr.packetCostPrice || curr.costPrice || 0) : (curr.cartonCostPrice || curr.costPrice || 0); 
        return acc + (cost * curr.cartQty); 
      }, 0);
      const totalProfit = totalAmount - totalCost;
      
      const nextInvoiceNo = await getNextInvoiceNumber();

      const saleData: Omit<CashvanSale, 'id'> = {
        invoiceNo: nextInvoiceNo,
        invoiceId: nextInvoiceNo,
        cashvanName: repName || 'کاشڤان',
        marketName: vanMarketName,
        items: vanCart.map(c => ({
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
        paymentType: vanPaymentType
      };

      const docRef = await addDoc(collection(db, 'cashvan_sales'), saleData);

      // Deduct from isolated cashvan_inventory
      for (const cartItem of vanCart) {
        const itemRef = doc(db, 'cashvan_inventory', cartItem.id);
        const itemSnap = await getDoc(itemRef);
        if (itemSnap.exists()) {
          const currentQty = itemSnap.data().quantity || 0;
          const newQty = Math.max(0, currentQty - cartItem.cartQty);
          await updateDoc(itemRef, { quantity: newQty });
        }
      }

      // Add transaction for debt or cash if needed
      await addDoc(collection(db, 'transactions'), {
        type: vanPaymentType === 'cash' ? 'cash' : 'debt',
        invoiceNo: nextInvoiceNo,
        amount: totalAmount,
        date: Date.now(),
        description: vanPaymentType === 'cash' ? `فرۆشتنی نەقدی کاشڤان بۆ ${vanMarketName}` : `فرۆشتنی قەرزی کاشڤان بۆ ${vanMarketName}`,
        relatedEntityId: vanMarketName,
        cashvanName: repName || 'کاشڤان'
      });

      setVanCart([]);
      setActiveFormMode('none');
      printCashvanReceipt({ ...saleData, id: docRef.id }, nextInvoiceNo);
      alert('فرۆشتنی کاشڤان بە سەرکەوتوویی تۆمارکرا');
    } catch (e: any) {
      console.error(e);
      alert('هەڵەیەک ڕوویدا: ' + e.message);
    }
  };

  // --- PRINTING UTILITIES ---
  const printCashvanReceipt = async (sale: any, invoiceId: string) => {
    const printWindow = window.open('', '', 'width=380,height=600');
    if (!printWindow) return;

    let oldDebt = 0;
    try {
      const q = query(
        collection(db, 'transactions'),
        where('relatedEntityId', '==', sale.marketName)
      );
      const snapshot = await getDocs(q);
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.date && data.date < (sale.date || Date.now())) {
          if (data.type === 'debt' || data.type === 'market_debt') {
            oldDebt += data.amount || 0;
          } else if (data.type === 'paid_debt' || data.type === 'market_paid_debt') {
            oldDebt -= data.amount || 0;
          }
        }
      });
      oldDebt = Math.max(0, oldDebt);
    } catch (e) {
      console.error(e);
    }

    const itemsHtml = (sale.items || []).map((item: any) => {
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
            <h2 style="margin: 0; font-size: 16px;">پسوڵەی فرۆشتنی کاشڤان</h2>
            <div style="font-size: 11px; margin-top: 2px;">کاشڤان: ${sale.cashvanName}</div>
          </div>
          <hr style="border-top: 1px dashed #000; margin: 8px 0;" />
          <div><strong>مارکێت:</strong> ${sale.marketName}</div>
          <div><strong>شێوازی پارەدان:</strong> ${sale.paymentType === 'cash' ? 'نەقد' : 'قەرز'}</div>
          <div><strong>بەروار:</strong> <span dir="ltr">${format(sale.date || Date.now(), 'yyyy/MM/dd HH:mm')}</span></div>
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
            <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold;">
              <span>کۆی ئەم پسوڵەیە:</span>
              <span dir="ltr">${(sale.totalAmount || 0).toLocaleString()} د.ع</span>
            </div>
            ${sale.paymentType === 'debt' ? `
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 4px;">
                <span>قەرزی پێشوو:</span>
                <span dir="ltr">${oldDebt.toLocaleString()} د.ع</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; margin-top: 4px; border-top: 1px dashed #000; padding-top: 4px;">
                <span>کۆی گشتی قەرز:</span>
                <span dir="ltr">${(oldDebt + (sale.totalAmount || 0)).toLocaleString()} د.ع</span>
              </div>
            ` : ''}
          </div>
          <div class="center" style="margin-top: 15px; font-size: 10px;">سوپاس بۆ سەردانەکەت</div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const printOrderReceipt = async (order: Order, invoiceId: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    let oldDebt = 0;
    try {
      const q = query(
        collection(db, 'transactions'),
        where('relatedEntityId', '==', order.marketName)
      );
      const snapshot = await getDocs(q);
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.date && data.date < order.timestamp) {
          if (data.type === 'debt' || data.type === 'market_debt') {
            oldDebt += data.amount || 0;
          } else if (data.type === 'paid_debt' || data.type === 'market_paid_debt') {
            oldDebt -= data.amount || 0;
          }
        }
      });
      oldDebt = Math.max(0, oldDebt);
    } catch (e) {
      console.error(e);
    }

    const itemsHtml = (order.items || []).map((item, idx) => {
      const unitLabel = item.unit === 'packet' ? 'پاکەت' : 'کارتۆن';
      const itemTotal = (item.price || 0) * (item.quantity || 0);
      return `
        <tr>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px;">${idx + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: bold;">${item.name}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px;">${item.quantity} ${unitLabel}</td>
          <td style="text-align: left; border: 1px solid #cbd5e1; padding: 6px;" dir="ltr">${(item.price || 0).toLocaleString()} د.ع</td>
          <td style="text-align: left; border: 1px solid #cbd5e1; padding: 6px; font-weight: bold;" dir="ltr">${itemTotal.toLocaleString()} د.ع</td>
        </tr>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html dir="rtl">
        <head>
          <meta charset="utf-8">
          <title>وەسڵی داواکاری #${invoiceId}</title>
          <style>
            body { font-family: system-ui, sans-serif; direction: rtl; text-align: right; padding: 20px; color: #1e293b; }
            .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background: #f8fafc; padding: 8px; border: 1px solid #cbd5e1; text-align: right; font-size: 13px; }
            td { padding: 8px; border: 1px solid #e2e8f0; font-size: 13px; }
            .total-box { text-align: left; font-size: 16px; font-weight: bold; margin-top: 15px; background: #f1f5f9; padding: 12px; border-radius: 8px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0; font-size: 20px;">وەسڵی داواکاری (تەڵەبیە)</h1>
            <div style="font-size: 12px; color: #64748b; margin-top: 5px;">ژمارەی وەسڵ: #${invoiceId} | مەندووب: ${order.repName}</div>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 13px;">
            <div><strong>مارکێت:</strong> ${order.marketName}</div>
            <div><strong>شێوازی پارەدان:</strong> ${order.paymentStatus === 'cash' ? 'نەقد' : 'قەرز'}</div>
            <div><strong>بەروار:</strong> <span dir="ltr">${format(order.timestamp, 'yyyy/MM/dd HH:mm')}</span></div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th>ناوی کاڵا</th>
                <th style="width: 100px; text-align: center;">بڕ</th>
                <th style="width: 120px; text-align: left;">نرخی تاک</th>
                <th style="width: 140px; text-align: left;">کۆی گشتی</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div class="total-box">
            <span>کۆی گشتی: </span>
            <span dir="ltr" style="color: #4f46e5;">${(order.totalAmount || 0).toLocaleString()} د.ع</span>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // --- UNIFIED ACTIVITIES FOR BOTTOM HISTORY ---
  const allActivities = useMemo<ActivityItem[]>(() => {
    const list: ActivityItem[] = [];
    const activeRep = repName?.trim();

    // 1. Orders
    orders.forEach(o => {
      if (role === 'sales_rep' && activeRep && o.repName !== activeRep) return;
      list.push({
        id: o.id,
        type: 'order',
        marketName: o.marketName,
        repName: o.repName,
        amount: o.totalAmount,
        paymentType: o.paymentStatus || 'debt',
        status: o.status,
        timestamp: o.timestamp,
        items: (o.items || []).map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit === 'packet' ? 'پاکەت' : 'کارتۆن', price: i.price })),
        rawOrder: o
      });
    });

    // 2. Cashvan Sales
    cashvanSales.forEach(s => {
      if (role === 'sales_rep' && activeRep && s.cashvanName !== activeRep) return;
      list.push({
        id: s.id,
        type: 'cashvan_sale',
        marketName: s.marketName,
        repName: s.cashvanName,
        amount: s.totalAmount,
        paymentType: s.paymentType || 'cash',
        status: s.status,
        timestamp: s.date,
        items: (s.items || []).map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit === 'packet' ? 'پاکەت' : 'کارتۆن', price: i.price })),
        rawSale: s
      });
    });

    // 3. Debt Collections (Paid debts)
    transactions.forEach(t => {
      const isPaid = t.type === 'paid_debt' || t.type === 'market_paid_debt';
      if (!isPaid) return;
      if (role === 'sales_rep' && activeRep) {
        const matchesRep = t.collectorName === activeRep || t.repName === activeRep || (t.description && t.description.includes(activeRep));
        if (!matchesRep) return;
      }
      list.push({
        id: t.id,
        type: 'debt_collection',
        marketName: t.relatedEntityId || 'مارکێت',
        repName: t.collectorName || t.repName || 'مەندووب',
        amount: t.amount,
        paymentType: 'cash',
        timestamp: t.date,
        rawTransaction: t
      });
    });

    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [orders, cashvanSales, transactions, repName, role]);

  // Filter activities by Date & Type
  const filteredActivities = useMemo(() => {
    const today = new Date();
    const yesterday = subDays(today, 1);

    return allActivities.filter(act => {
      // Date filter
      if (dateFilter === 'today') {
        if (!isSameDay(new Date(act.timestamp), today)) return false;
      } else if (dateFilter === 'yesterday') {
        if (!isSameDay(new Date(act.timestamp), yesterday)) return false;
      } else if (dateFilter === 'custom') {
        if (!customDate) return true;
        const target = new Date(customDate);
        if (!isSameDay(new Date(act.timestamp), target)) return false;
      }

      // Type filter
      if (activityTypeFilter !== 'all' && act.type !== activityTypeFilter) {
        return false;
      }

      // Search filter
      if (historySearchTerm.trim()) {
        const term = historySearchTerm.toLowerCase();
        const mMatch = act.marketName?.toLowerCase().includes(term);
        const rMatch = act.repName?.toLowerCase().includes(term);
        const invNo = act.rawOrder?.invoiceId || act.rawOrder?.invoiceNo || act.rawSale?.invoiceNo || act.rawTransaction?.invoiceNo || '';
        const invMatch = invNo.toLowerCase().includes(term);
        if (!mMatch && !rMatch && !invMatch) return false;
      }

      return true;
    });
  }, [allActivities, dateFilter, customDate, activityTypeFilter, historySearchTerm]);

  // Statistics for sales activities: ONLY Total Cartons and Total Sales Money (as strictly requested)
  const salesStats = useMemo(() => {
    let totalCartons = 0;
    let totalPackets = 0;
    let totalUnits = 0;
    let totalSalesMoney = 0;
    let orderCount = 0;
    let vanSaleCount = 0;
    let debtCollectCount = 0;
    let debtCollectTotal = 0;

    filteredActivities.forEach(a => {
      if (a.type === 'order' || a.type === 'cashvan_sale') {
        totalSalesMoney += (a.amount || 0);
        if (a.type === 'order') orderCount++;
        if (a.type === 'cashvan_sale') vanSaleCount++;

        if (a.items && Array.isArray(a.items)) {
          a.items.forEach(item => {
            const qty = Number(item.quantity) || 0;
            if (item.unit === 'packet' || item.unit === 'پاکەت') {
              totalPackets += qty;
            } else {
              totalCartons += qty;
            }
            totalUnits += qty;
          });
        }
      } else if (a.type === 'debt_collection') {
        debtCollectCount++;
        debtCollectTotal += (a.amount || 0);
      }
    });

    return {
      totalCartons,
      totalPackets,
      totalUnits,
      totalSalesMoney,
      totalSalesCount: orderCount + vanSaleCount,
      orderCount,
      vanSaleCount,
      debtCollectCount,
      debtCollectTotal
    };
  }, [filteredActivities]);

  return (
    <div className="space-y-6">
      {/* Top Tabs */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
        <button
          onClick={() => handleTabSelect('schedule')}
          className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 ${
            activeMainTab === 'schedule'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Calendar size={16} />
          <span>فرۆشتن (خشتەی سەردان)</span>
        </button>
        <button
          onClick={() => handleTabSelect('info')}
          className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 ${
            activeMainTab === 'info'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <FileText size={16} />
          <span>زانیاری لەسەر فرۆشەکان</span>
        </button>
      </div>

      {activeMainTab === 'schedule' && (
        <>
          {/* 1. Daily Market Schedule with the 3-Options Dropdown Menu */}
          <MarketDailyScheduleCard
            role={role}
            activeRepName={repName}
            activeCashvanName={repName}
            onSelectForOrder={handleSelectMarketForOrder}
            onSelectForCashvan={handleSelectMarketForCashvan}
            onSelectForDebtPay={handleSelectMarketForDebtPay}
            marketDebtMap={marketDebtMap}
          />

      {/* 2. DYNAMIC FORM SECTION (Opened strictly when clicked from Schedule Menu) */}
      {activeFormMode !== 'none' && (
        <div ref={formSectionRef} className="animate-in fade-in zoom-in-95 duration-200">
          {/* OPTION 1 FORM: Order / Pre-order (تەڵەبییە) */}
          {activeFormMode === 'order' && (
            <section className="bg-white p-6 rounded-2xl shadow-sm border-2 border-indigo-200 mb-6">
              <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                    <ShoppingCart size={18} />
                  </div>
                  <span>فۆڕمی داواکاری (تەڵەبییە) بۆ: <strong className="text-indigo-600 font-bold">{orderMarketName || 'مارکێت'}</strong></span>
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveFormMode('none')}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
                  title="داخستن"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={submitOrder} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">ناوی مارکێت *</label>
                    <input
                      type="text"
                      list="order-markets"
                      required
                      placeholder="ناوی مارکێت بنووسە..."
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-bold text-slate-800 bg-slate-50"
                      value={orderMarketName}
                      onChange={(e) => setOrderMarketName(e.target.value)}
                    />
                    <datalist id="order-markets">
                      {markets.map(m => <option key={m.id} value={m.name} />)}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">شێوازی پارەدان</label>
                    <div className="w-full px-3.5 py-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs font-bold text-amber-900">
                      <div className="flex items-center gap-1.5">
                        <CreditCard size={15} className="text-amber-700" />
                        <span>بە قەرز (تەڵەبیە)</span>
                      </div>
                      <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md font-bold">
                        هەمووی قەرزە
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">شوێن / تێبینی</label>
                    <input
                      type="text"
                      placeholder="ناونیشان یان تێبینی بنووسە..."
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-slate-800"
                      value={orderLocation}
                      onChange={(e) => setOrderLocation(e.target.value)}
                    />
                  </div>
                </div>

                {/* Items Selector for Order */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-xs font-bold text-slate-700">کاڵاکانی بەردەست لە کۆگا</h4>
                      <div className="relative w-48">
                        <input
                          type="text"
                          placeholder="گەڕان بۆ کاڵا..."
                          className="w-full pl-3 pr-8 py-1.5 border border-slate-200 rounded-lg text-xs outline-none bg-white"
                          value={orderItemSearch}
                          onChange={(e) => setOrderItemSearch(e.target.value)}
                        />
                        <Search className="absolute right-2.5 top-2 text-slate-400" size={13} />
                      </div>
                    </div>

                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                      {items
                        .filter(i => (i.quantity || 0) > 0 && i.name.toLowerCase().includes(orderItemSearch.toLowerCase()))
                        .map(item => (
                          <div
                            key={item.id}
                            onClick={() => handleAddItemToOrder(item)}
                            className="p-2.5 bg-white border border-slate-200 hover:border-indigo-400 rounded-xl cursor-pointer transition flex justify-between items-center group shadow-2xs"
                          >
                            <div>
                              <div className="font-bold text-xs text-slate-800 group-hover:text-indigo-600">{item.name}</div>
                              <div className="text-[10px] text-slate-400">بەردەست: {item.quantity} | {item.barcode}</div>
                            </div>
                            <div className="text-left">
                              <span className="text-xs font-bold font-mono text-indigo-700" dir="ltr">
                                {calcPrice(item, 'carton', orderMarketName).toLocaleString()} د.ع
                              </span>
                              <div className="text-[10px] text-slate-500 font-bold">بۆ کارتۆن</div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Selected items list */}
                  <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center justify-between">
                        <span>کاڵا هەڵبژێردراوەکانی داواکاری</span>
                        <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          {orderSelectedItems.length} کاڵا
                        </span>
                      </h4>

                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {orderSelectedItems.map(si => (
                          <div key={si.item.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-xs text-slate-800 truncate">{si.item.name}</div>
                              <div className="text-[11px] text-slate-500 font-mono" dir="ltr">
                                {calcPrice(si.item, si.unit, orderMarketName).toLocaleString()} د.ع
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Unit switch */}
                              {si.item.packetSellingPrice && si.item.cartonSellingPrice && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateOrderItemQty(si.item.id, si.quantity, si.unit === 'carton' ? 'packet' : 'carton')}
                                  className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-indigo-600 hover:bg-indigo-50"
                                >
                                  {si.unit === 'carton' ? 'کارتۆن' : 'پاکەت'}
                                </button>
                              )}

                              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateOrderItemQty(si.item.id, si.quantity - 1, si.unit)}
                                  className="w-6 h-6 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 rounded text-xs"
                                >
                                  -
                                </button>
                                <span className="w-8 text-center text-xs font-bold font-mono">{si.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateOrderItemQty(si.item.id, si.quantity + 1, si.unit)}
                                  className="w-6 h-6 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 rounded text-xs"
                                >
                                  +
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleUpdateOrderItemQty(si.item.id, 0)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}

                        {orderSelectedItems.length === 0 && (
                          <div className="text-center py-10 text-slate-400 text-xs">
                            تکایە لە لای ڕاستەوە کاڵا زیاد بکە بۆ داواکاری
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center">
                      <div>
                        <div className="text-[11px] text-slate-500">کۆی گشتی داواکاری:</div>
                        <div className="text-base font-bold font-mono text-indigo-600" dir="ltr">
                          {orderSelectedItems.reduce((acc, curr) => acc + (curr.quantity * calcPrice(curr.item, curr.unit, orderMarketName)), 0).toLocaleString()} د.ع
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveFormMode('none')}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                        >
                          پاشگەزبوونەوە
                        </button>
                        <button
                          type="submit"
                          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
                        >
                          <Send size={14} />
                          <span>ناردنی داواکاری بۆ کۆگا</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </section>
          )}

          {/* OPTION 2 FORM: Direct Cashvan Sale (کاشڤان ڕاستەوخۆ) */}
          {activeFormMode === 'cashvan' && (
            <section className="bg-white p-6 rounded-2xl shadow-sm border-2 border-amber-200 mb-6">
              <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                    <Truck size={18} />
                  </div>
                  <span>فرۆشتنی ڕاستەوخۆ لە ڤان بۆ: <strong className="text-amber-900 font-bold">{vanMarketName || 'مارکێت'}</strong></span>
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveFormMode('none')}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
                  title="داخستن"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">ناوی مارکێت *</label>
                  <input
                    type="text"
                    list="van-markets"
                    required
                    placeholder="ناوی مارکێت..."
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-xs font-bold text-slate-800 bg-slate-50"
                    value={vanMarketName}
                    onChange={(e) => setVanMarketName(e.target.value)}
                  />
                  <datalist id="van-markets">
                    {markets.map(m => <option key={m.id} value={m.name} />)}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">شێوازی پارەدان *</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setVanPaymentType('cash')}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        vanPaymentType === 'cash'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <DollarSign size={14} />
                      <span>بە نەقد</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVanPaymentType('debt')}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        vanPaymentType === 'debt'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <CreditCard size={14} />
                      <span>بە قەرز</span>
                    </button>
                  </div>
                </div>

                <div className="p-2.5 bg-amber-50/50 border border-amber-100 rounded-xl flex items-center justify-between">
                  <div className="text-xs text-amber-900 font-bold">قەرزی ئێستای ئەم مارکێتە:</div>
                  <div className="text-sm font-bold font-mono text-amber-800" dir="ltr">
                    {(marketDebtMap.get(vanMarketName) || 0).toLocaleString()} د.ع
                  </div>
                </div>
              </div>

              {/* Items Selector from Van Inventory */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-xs font-bold text-slate-700">کاڵاکانی بەردەست لەناو ڤان ({repName})</h4>
                    <div className="relative w-48">
                      <input
                        type="text"
                        placeholder="گەڕان لەناو ڤاندا..."
                        className="w-full pl-3 pr-8 py-1.5 border border-slate-200 rounded-lg text-xs outline-none bg-white"
                        value={vanItemSearch}
                        onChange={(e) => setVanItemSearch(e.target.value)}
                      />
                      <Search className="absolute right-2.5 top-2 text-slate-400" size={13} />
                    </div>
                  </div>

                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {vanInventory
                      .filter(i => (i.quantity || 0) > 0 && i.name.toLowerCase().includes(vanItemSearch.toLowerCase()))
                      .map(item => {
                        const unitLabel = item.unit === 'packet' ? 'پاکەت' : 'کارتۆن';
                        const price = calcPrice(item, item.unit || 'carton', vanMarketName);
                        return (
                          <div
                            key={item.id}
                            onClick={() => addToVanCart(item)}
                            className="p-2.5 bg-white border border-slate-200 hover:border-amber-400 rounded-xl cursor-pointer transition flex justify-between items-center group shadow-2xs"
                          >
                            <div>
                              <div className="font-bold text-xs text-slate-800 group-hover:text-amber-800">{item.name}</div>
                              <div className="text-[10px] text-slate-400">بەردەست لە ڤان: <strong>{item.quantity} {unitLabel}</strong></div>
                            </div>
                            <div className="text-left">
                              <span className="text-xs font-bold font-mono text-emerald-700" dir="ltr">
                                {price.toLocaleString()} د.ع
                              </span>
                            </div>
                          </div>
                        );
                      })}

                    {vanInventory.length === 0 && (
                      <div className="text-center py-10 text-slate-400 text-xs">
                        هیچ کاڵایەک لەناو ڤاندا بار نەکراوە یان بەردەست نییە
                      </div>
                    )}
                  </div>
                </div>

                {/* Van Cart & Checkout */}
                <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center justify-between">
                      <span>کاڵاکانی وەسڵی فرۆشتن</span>
                      <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
                        {vanCart.length} کاڵا
                      </span>
                    </h4>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {vanCart.map(c => (
                        <div key={c.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-xs text-slate-800 truncate">{c.name}</div>
                            <div className="text-[11px] text-slate-500 font-mono" dir="ltr">
                              {c.finalPrice?.toLocaleString()} د.ع
                            </div>
                          </div>

                          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => updateVanCartQty(c.id, c.cartQty - 1, c.unit)}
                              className="w-6 h-6 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 rounded text-xs"
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-xs font-bold font-mono">{c.cartQty}</span>
                            <button
                              type="button"
                              onClick={() => updateVanCartQty(c.id, c.cartQty + 1, c.unit)}
                              className="w-6 h-6 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 rounded text-xs"
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => updateVanCartQty(c.id, 0)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}

                      {vanCart.length === 0 && (
                        <div className="text-center py-10 text-slate-400 text-xs">
                          تکایە کاڵا دیاری بکە لە لیستی بەردەستی ناو ڤان
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center">
                    <div>
                      <div className="text-[11px] text-slate-500">کۆی گشتی فرۆشتن:</div>
                      <div className="text-base font-bold font-mono text-emerald-700" dir="ltr">
                        {vanCart.reduce((acc, curr) => acc + (curr.cartQty * curr.finalPrice), 0).toLocaleString()} د.ع
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveFormMode('none')}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                      >
                        پاشگەزبوونەوە
                      </button>
                      <button
                        type="button"
                        onClick={submitCashvanSale}
                        className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
                      >
                        <Printer size={14} />
                        <span>تۆمارکردن و چاپکردنی وەسڵ</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
      </>
      )}

      {/* 3. BOTTOM SECTION: MY DAILY ACTIVITIES & HISTORY (FILTER BY DATE: TODAY, YESTERDAY, CUSTOM) */}
      {activeMainTab === 'info' && (
      <section className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
          {/* Quick Date Filters */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setDateFilter('today')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                dateFilter === 'today'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              ئەمڕۆ
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('yesterday')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                dateFilter === 'yesterday'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              دوێنێ
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('custom')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                dateFilter === 'custom'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              دیاریکردنی بەروار
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                dateFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              هەمووی
            </button>

            {dateFilter === 'custom' && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs bg-white font-mono"
              />
            )}
          </div>
        </div>

        {/* Activity Search & Quick Filter */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setActivityTypeFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition border ${
                activityTypeFilter === 'all'
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              هەموو فرۆشەکان ({salesStats.totalSalesCount})
            </button>
            <button
              type="button"
              onClick={() => setActivityTypeFilter('order')}
              className={`px-3 py-1.5 rounded-lg font-bold transition border flex items-center gap-1.5 ${
                activityTypeFilter === 'order'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-indigo-700 border-slate-200 hover:bg-indigo-50'
              }`}
            >
              <ShoppingCart size={13} />
              <span>تەڵەبییە ({salesStats.orderCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setActivityTypeFilter('cashvan_sale')}
              className={`px-3 py-1.5 rounded-lg font-bold transition border flex items-center gap-1.5 ${
                activityTypeFilter === 'cashvan_sale'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-amber-800 border-slate-200 hover:bg-amber-50'
              }`}
            >
              <Truck size={13} />
              <span>کاشڤان ({salesStats.vanSaleCount})</span>
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="گەڕان لە وەصڵ و مارکێتەکاندا..."
              className="w-full pl-3 pr-8 py-1.5 border border-slate-200 rounded-xl text-xs outline-none bg-slate-50 focus:bg-white focus:border-indigo-500 transition"
              value={historySearchTerm}
              onChange={(e) => setHistorySearchTerm(e.target.value)}
            />
            <Search className="absolute right-2.5 top-2 text-slate-400" size={14} />
          </div>
        </div>

        {/* Daily Summary Cards: STRICTLY ONLY TWO CARDS (کۆی فرۆش بە کارتۆن & بڕی فرۆشتن بە پارە) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Card 1: کۆی فرۆش بە کارتۆن */}
          <div className="p-4 sm:p-5 bg-indigo-50/70 border-2 border-indigo-200 rounded-2xl flex items-center justify-between shadow-2xs">
            <div className="space-y-1">
              <div className="text-xs text-indigo-800 font-bold flex items-center gap-1.5">
                <Package size={17} />
                <span>کۆی فرۆش بە کارتۆن</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-indigo-950 font-mono" dir="ltr">
                {salesStats.totalCartons.toLocaleString()} <span className="text-sm font-bold text-indigo-700">کارتۆن</span>
              </div>
              {salesStats.totalPackets > 0 && (
                <div className="text-xs text-indigo-600 font-bold font-mono">
                  + {salesStats.totalPackets.toLocaleString()} پاکەت
                </div>
              )}
            </div>
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xs shrink-0">
              <Package size={26} />
            </div>
          </div>

          {/* Card 2: بڕی فرۆشتن بە پارە */}
          <div className="p-4 sm:p-5 bg-emerald-50/70 border-2 border-emerald-200 rounded-2xl flex items-center justify-between shadow-2xs">
            <div className="space-y-1">
              <div className="text-xs text-emerald-800 font-bold flex items-center gap-1.5">
                <DollarSign size={17} />
                <span>بڕی فرۆشتن بە پارە</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-950 font-mono" dir="ltr">
                {salesStats.totalSalesMoney.toLocaleString()} <span className="text-sm font-bold text-emerald-700">د.ع</span>
              </div>
              <div className="text-xs text-emerald-700 font-bold">
                لە کۆی {salesStats.totalSalesCount} وەسڵی فرۆشتن
              </div>
            </div>
            <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-xs shrink-0">
              <DollarSign size={26} />
            </div>
          </div>
        </div>

        {/* Activities List */}
        <div className="space-y-2.5 pt-2">
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-xs">خەریکی هێنانە...</div>
          ) : filteredActivities.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-200">
              هیچ چالاکییەک لەم بەروارەدا تۆمار نەکراوە
            </div>
          ) : (
            filteredActivities.map((act) => {
              const isOrder = act.type === 'order';
              const isSale = act.type === 'cashvan_sale';
              const isDebtPay = act.type === 'debt_collection';

              return (
                <div
                  key={`${act.type}-${act.id}`}
                  className="p-3.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl shadow-2xs transition flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl shrink-0 ${
                      isOrder ? 'bg-indigo-100 text-indigo-700' :
                      isSale ? 'bg-amber-100 text-amber-800' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {isOrder ? <ShoppingCart size={16} /> : isSale ? <Truck size={16} /> : <CreditCard size={16} />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">{act.marketName}</span>
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md text-xs" dir="ltr">
                          #{act.rawOrder?.invoiceId || act.rawOrder?.invoiceNo || act.rawSale?.invoiceNo || act.rawTransaction?.invoiceNo || act.id.slice(-6)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isOrder ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                          isSale ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                          'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}>
                          {isOrder ? 'تەڵەبییە' : isSale ? 'کاشڤان' : 'قەرزی وەرگیراو'}
                        </span>
                        {act.paymentType && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            act.paymentType === 'cash' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {act.paymentType === 'cash' ? 'نەقد' : 'قەرز'}
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                        <span>مەندووب: <strong>{act.repName}</strong></span>
                        <span>کات: <span dir="ltr" className="font-mono">{format(act.timestamp, 'yyyy/MM/dd - HH:mm')}</span></span>
                        {act.items && act.items.length > 0 && (
                          <span className="text-slate-600">
                            کاڵاکان: {act.items.map(i => `${i.name} (${i.quantity} ${i.unit || ''})`).join('، ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <div className="text-left">
                      <div className="text-[10px] text-slate-400">بڕی پارە</div>
                      <div className="text-xs font-black font-mono text-slate-900" dir="ltr">
                        {(act.amount || 0).toLocaleString()} د.ع
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isOrder && act.rawOrder && (
                        <button
                          type="button"
                          onClick={() => printOrderReceipt(act.rawOrder!, act.rawOrder!.invoiceId || act.rawOrder!.invoiceNo || act.rawOrder!.id.slice(-6))}
                          className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition"
                          title="چاپکردنی وەسڵ"
                        >
                          <Printer size={15} />
                        </button>
                      )}

                      {isSale && act.rawSale && (
                        <button
                          type="button"
                          onClick={() => printCashvanReceipt(act.rawSale!, act.rawSale!.invoiceNo || act.rawSale!.id.slice(-6))}
                          className="p-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100 rounded-lg transition"
                          title="چاپکردنی وەسڵ"
                        >
                          <Printer size={15} />
                        </button>
                      )}

                      {isOrder && act.rawOrder && (
                        <button
                          type="button"
                          onClick={() => setDeletingOrder(act.rawOrder!)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                          title="سڕینەوە"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
      )}

      {/* Delete Order Confirm Modal */}
      <ConfirmModal
        isOpen={!!deletingOrder}
        onClose={() => setDeletingOrder(null)}
        onConfirm={async () => {
          if (!deletingOrder) return;
          try {
            await updateDoc(doc(db, 'orders', deletingOrder.id), { status: 'deleted' });
            setDeletingOrder(null);
          } catch (e) {
            console.error(e);
          }
        }}
        title="سڕینەوەی داواکاری"
        message="ئایا دڵنیایت لە سڕینەوەی ئەم داواکارییە؟"
        details={deletingOrder ? [
          { label: 'مارکێت', value: deletingOrder.marketName || '-' },
          { label: 'کۆی گشتی', value: `${(deletingOrder.totalAmount || 0).toLocaleString()} د.ع` }
        ] : []}
      />

      {/* Simple Market Debt Payment Modal for Rep / Staff */}
      <SimpleMarketDebtPayModal
        isOpen={isSimpleDebtModalOpen}
        onClose={() => {
          setIsSimpleDebtModalOpen(false);
          setDebtTargetMarket('');
          setDebtTargetMarketObj(null);
          setDebtTargetAmount(0);
        }}
        marketName={debtTargetMarket}
        market={debtTargetMarketObj}
        currentDebt={debtTargetAmount || (marketDebtMap.get(debtTargetMarket) || 0)}
        collectorName={repName || (role === 'sales_rep' ? 'مەندووب' : 'کارمەند')}
        repId={auth.currentUser?.uid}
      />
    </div>
  );
}
