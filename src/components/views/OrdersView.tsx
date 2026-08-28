import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, getDocs, where, addDoc, updateDoc, doc, setDoc, onSnapshot, query, orderBy, deleteDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { Order, OrderItem, Item, Role, Market, Transaction, CashvanSale } from '../../types';
import { ShoppingCart, Plus, Printer, CheckCircle, Search, X, DollarSign, CreditCard, Trash2, Edit2, User, Calendar, FileText, CheckCircle2, Truck, Send, ArrowRight, Package, Phone, MapPin, Store, Clock, Receipt, Check, Gift } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, isSameDay } from 'date-fns';
import ConfirmModal from '../common/ConfirmModal';
import SimpleMarketDebtPayModal from '../common/SimpleMarketDebtPayModal';
import MarketDailyScheduleCard from '../common/MarketDailyScheduleCard';
import { printDailyRepReceiptPopup, generateStatementHtml } from '../../lib/statementPrinter';
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
  onTabChange,
  isWarehouseMode = false
}: {
  role: Role;
  initialTab?: 'schedule' | 'info';
  onTabChange?: (tab: 'schedule' | 'info') => void;
  isWarehouseMode?: boolean;
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

  // Dedicated Page-Level Navigation View:
  // 'main' -> Main Dashboard (Schedule / Info Tabs)
  // 'market_actions' -> Full separate page for the selected market's actions
  // 'order_form' -> Full separate page for Order / Pre-order (تەڵەبییە)
  // 'cashvan_form' -> Full separate page for Cashvan Direct Sale (کاشڤان ڕاستەوخۆ)
  const [currentView, setCurrentView] = useState<'main' | 'market_actions' | 'order_form' | 'cashvan_form'>('main');
  const [activeActionMarket, setActiveActionMarket] = useState<{ market: Market; debt: number; isVisited: boolean } | null>(null);

  // Forms State
  const [activeFormMode, setActiveFormMode] = useState<'none' | 'order' | 'cashvan'>('none');
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  // Order Form State (تەڵەبییە)
  const [orderMarketName, setOrderMarketName] = useState('');
  const [orderLocation, setOrderLocation] = useState('');
  const [orderPaymentType, setOrderPaymentType] = useState<'cash' | 'debt'>('debt');
  const [orderSelectedItems, setOrderSelectedItems] = useState<{ item: Item; quantity: number; giftQuantity?: number; unit: 'carton' | 'packet' }[]>([]);
  const [orderItemSearch, setOrderItemSearch] = useState('');
  const [isOrderGiftMode, setIsOrderGiftMode] = useState(false);

  // Cashvan Direct Sale Form State (کاشڤان ڕاستەوخۆ)
  const [vanMarketName, setVanMarketName] = useState('');
  const [vanPaymentType, setVanPaymentType] = useState<'cash' | 'debt'>('cash');
  const [vanCart, setVanCart] = useState<any[]>([]);
  const [vanItemSearch, setVanItemSearch] = useState('');
  const [isVanGiftMode, setIsVanGiftMode] = useState(false);

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
    // If in warehouse mode or warehouse role, allow selecting any rep manually
    if (isWarehouseMode || role === 'warehouse') return;
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
  }, [isWarehouseMode, role]);

  // When reps are loaded in warehouse mode, auto-select the first rep if not selected yet
  useEffect(() => {
    if ((isWarehouseMode || role === 'warehouse') && !repName && reps.length > 0) {
      setRepName(reps[0].name);
    }
  }, [reps, isWarehouseMode, role, repName]);

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

  // Helper for computing weekId for visit toggles
  const getWeekId = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = day === 6 ? 0 : day + 1;
    d.setDate(d.getDate() - diff);
    return `week_${d.toISOString().split('T')[0]}`;
  };

  // --- Handlers for Dedicated Page-Level Navigation ---
  const handleOpenMarketActions = (market: Market, debt: number, isVisited: boolean) => {
    setActiveActionMarket({ market, debt, isVisited });
    setCurrentView('market_actions');
  };

  const handleSelectMarketForOrder = (market: Market) => {
    setOrderMarketName(market.name);
    setOrderLocation(market.location || '');
    setOrderSelectedItems([]);
    setEditingOrderId(null);
    setOrderItemSearch('');
    setActiveFormMode('order');
    setCurrentView('order_form');
  };

  const handleSelectMarketForCashvan = (market: Market) => {
    setVanMarketName(market.name);
    setVanCart([]);
    setVanItemSearch('');
    setActiveFormMode('cashvan');
    setCurrentView('cashvan_form');
  };

  const handleSelectMarketForDebtPay = (market: Market, debt: number) => {
    setDebtTargetMarket(market.name);
    setDebtTargetMarketObj(market);
    setDebtTargetAmount(debt);
    setIsSimpleDebtModalOpen(true);
  };

  const handleToggleMarketVisit = async (marketId: string, currentStatus: boolean) => {
    const activeId = repName || auth.currentUser?.uid;
    if (!activeId) return;
    const weekId = getWeekId();
    const visitId = `${auth.currentUser?.uid || activeId}_${weekId}_${marketId}`;
    try {
      if (currentStatus) {
        await setDoc(
          doc(db, 'schedule_visits', visitId),
          { repId: auth.currentUser?.uid || activeId, weekId, marketId, visitedAt: null, unvisited: true },
          { merge: true }
        );
        if (activeActionMarket) {
          setActiveActionMarket({ ...activeActionMarket, isVisited: false });
        }
      } else {
        await setDoc(
          doc(db, 'schedule_visits', visitId),
          { repId: auth.currentUser?.uid || activeId, weekId, marketId, visitedAt: Date.now(), unvisited: false },
          { merge: true }
        );
        if (activeActionMarket) {
          setActiveActionMarket({ ...activeActionMarket, isVisited: true });
        }
      }
    } catch (err) {
      console.error('Error toggling visit status:', err);
    }
  };

  const handlePrintMarketStatement = (marketName: string) => {
    const marketTrans = transactions.filter(t => {
      const rel = t.relatedEntityId?.trim().toLowerCase();
      return rel === marketName.trim().toLowerCase();
    });
    const html = generateStatementHtml(marketName, marketTrans, { roleTitle: 'مارکێت' });
    const printWin = window.open('', '_blank', 'width=900,height=800');
    if (printWin) {
      printWin.document.write(html);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        printWin.print();
      }, 400);
    }
  };

  // --- ORDER FORM HANDLERS ---
  const handleAddItemToOrder = (item: Item) => {
    const exists = orderSelectedItems.find(si => si.item.id === item.id);
    const defaultUnit: 'carton' | 'packet' = (item.packetSellingPrice && !item.cartonSellingPrice) ? 'packet' : 'carton';
    const stock = item.quantity || 0;

    if (isOrderGiftMode) {
      if (exists) {
        const newGiftQty = (exists.giftQuantity || 0) + 1;
        if ((exists.quantity || 0) + newGiftQty > stock) {
          alert(`بڕی داواکراو لە کۆگا بەردەست نییە. تەنها ${stock} بەردەستە.`);
          return;
        }
        setOrderSelectedItems(orderSelectedItems.map(si => 
          si.item.id === item.id ? { ...si, giftQuantity: newGiftQty } : si
        ));
      } else {
        if (stock < 1) {
          alert('بڕی داواکراو لە کۆگا بەردەست نییە');
          return;
        }
        setOrderSelectedItems([...orderSelectedItems, { item, quantity: 0, giftQuantity: 1, unit: defaultUnit }]);
      }
    } else {
      if (exists) {
        const newQty = (exists.quantity || 0) + 1;
        if (newQty + (exists.giftQuantity || 0) > stock) {
          alert(`بڕی داواکراو لە کۆگا بەردەست نییە. تەنها ${stock} بەردەستە.`);
          return;
        }
        setOrderSelectedItems(orderSelectedItems.map(si => 
          si.item.id === item.id ? { ...si, quantity: newQty } : si
        ));
      } else {
        if (stock < 1) {
          alert('بڕی داواکراو لە کۆگا بەردەست نییە');
          return;
        }
        setOrderSelectedItems([...orderSelectedItems, { item, quantity: 1, giftQuantity: 0, unit: defaultUnit }]);
      }
    }
  };

  const handleUpdateOrderItemQty = (id: string, qty: number, unit?: 'carton' | 'packet', isGiftUpdate = false) => {
    const itemObj = orderSelectedItems.find(si => si.item.id === id);
    if (!itemObj) return;

    const stock = itemObj.item.quantity || 0;
    const currentUnit = unit || itemObj.unit;

    if (isGiftUpdate || isOrderGiftMode) {
      const newGiftQty = Math.max(0, qty);
      if ((itemObj.quantity || 0) + newGiftQty > stock) {
        alert(`بڕی داواکراو لە کۆگا بەردەست نییە. تەنها ${stock} بەردەستە.`);
        return;
      }
      if ((itemObj.quantity || 0) <= 0 && newGiftQty <= 0) {
        setOrderSelectedItems(orderSelectedItems.filter(si => si.item.id !== id));
      } else {
        setOrderSelectedItems(orderSelectedItems.map(si => 
          si.item.id === id ? { ...si, giftQuantity: newGiftQty, unit: currentUnit } : si
        ));
      }
    } else {
      const newQty = Math.max(0, qty);
      if (newQty + (itemObj.giftQuantity || 0) > stock) {
        alert(`بڕی داواکراو لە کۆگا بەردەست نییە. تەنها ${stock} بەردەستە.`);
        return;
      }
      if (newQty <= 0 && (itemObj.giftQuantity || 0) <= 0) {
        setOrderSelectedItems(orderSelectedItems.filter(si => si.item.id !== id));
      } else {
        setOrderSelectedItems(orderSelectedItems.map(si => 
          si.item.id === id ? { ...si, quantity: newQty, unit: currentUnit } : si
        ));
      }
    }
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
      return acc + (price * (curr.quantity || 0));
    }, 0);

    const totalCost = orderSelectedItems.reduce((acc, curr) => {
      const cost = curr.unit === 'packet'
        ? (curr.item.packetCostPrice || curr.item.costPrice || 0)
        : (curr.item.cartonCostPrice || curr.item.costPrice || 0);
      const totalCount = (curr.quantity || 0) + (curr.giftQuantity || 0);
      return acc + (cost * totalCount);
    }, 0);

    const totalProfit = totalAmount - totalCost;

    const orderItems: OrderItem[] = [];
    orderSelectedItems.forEach(si => {
      if ((si.quantity || 0) > 0) {
        orderItems.push({
          itemId: si.item.id,
          name: si.item.name,
          price: calcPrice(si.item, si.unit, orderMarketName),
          quantity: si.quantity,
          unit: si.unit,
          isGift: false
        });
      }
      if ((si.giftQuantity || 0) > 0) {
        orderItems.push({
          itemId: si.item.id,
          name: `${si.item.name} (هەدیە)`,
          price: 0,
          quantity: si.giftQuantity || 0,
          unit: si.unit,
          isGift: true
        });
      }
    });

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
      setCurrentView('main');
      setOrderMarketName('');
      setOrderLocation('');
      setOrderSelectedItems([]);
      setIsOrderGiftMode(false);
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
      const unit = item.unit || (item.packetSellingPrice && !item.cartonSellingPrice ? 'packet' : 'carton');
      const stock = item.quantity || 0;

      if (isVanGiftMode) {
        if (existing) {
          const newGiftQty = (existing.giftQty || 0) + 1;
          if ((existing.cartQty || 0) + newGiftQty > stock) {
            alert(`بڕی زیاتر لەناو ڤاندا بەردەست نییە. تەنها ${stock} بەردەستە.`);
            return prev;
          }
          return prev.map(p => p.id === item.id ? { ...p, giftQty: newGiftQty } : p);
        }
        if (stock < 1) {
          alert('بڕی بەردەست لەناو ڤان نەماوە');
          return prev;
        }
        return [...prev, { ...item, cartQty: 0, giftQty: 1, finalPrice: calcPrice(item, unit, vanMarketName), unit }];
      } else {
        if (existing) {
          const newCartQty = (existing.cartQty || 0) + 1;
          if (newCartQty + (existing.giftQty || 0) > stock) {
            alert(`بڕی زیاتر لەناو ڤاندا بەردەست نییە. تەنها ${stock} بەردەستە.`);
            return prev;
          }
          return prev.map(p => p.id === item.id ? { ...p, cartQty: newCartQty } : p);
        }
        if (stock < 1) {
          alert('بڕی بەردەست لەناو ڤان نەماوە');
          return prev;
        }
        return [...prev, { ...item, cartQty: 1, giftQty: 0, finalPrice: calcPrice(item, unit, vanMarketName), unit }];
      }
    });
  };

  const updateVanCartQty = (id: string, qty: number, unit?: 'carton' | 'packet', isGiftUpdate = false) => {
    const item = vanInventory.find(i => i.id === id);
    if (!item) return;
    const stock = item.quantity || 0;
    
    setVanCart(prev => {
      const cartItem = prev.find(p => p.id === id);
      if (!cartItem) return prev;
      
      const newUnit = unit || cartItem.unit || 'carton';
      const price = calcPrice(item, newUnit, vanMarketName);

      if (isGiftUpdate || isVanGiftMode) {
        const newGiftQty = Math.max(0, qty);
        if ((cartItem.cartQty || 0) + newGiftQty > stock) {
          alert(`تەنها ${stock} لەناو ڤاندا بەردەستە`);
          return prev;
        }
        if ((cartItem.cartQty || 0) <= 0 && newGiftQty <= 0) {
          return prev.filter(p => p.id !== id);
        }
        return prev.map(p => p.id === id ? { ...p, giftQty: newGiftQty, unit: newUnit, finalPrice: price } : p);
      } else {
        const newCartQty = Math.max(0, qty);
        if (newCartQty + (cartItem.giftQty || 0) > stock) {
          alert(`تەنها ${stock} لەناو ڤاندا بەردەستە`);
          return prev;
        }
        if (newCartQty <= 0 && (cartItem.giftQty || 0) <= 0) {
          return prev.filter(p => p.id !== id);
        }
        return prev.map(p => p.id === id ? { ...p, cartQty: newCartQty, unit: newUnit, finalPrice: price } : p);
      }
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
      
      const totalAmount = vanCart.reduce((acc, curr) => acc + ((curr.finalPrice || 0) * (curr.cartQty || 0)), 0);
      const totalCost = vanCart.reduce((acc, curr) => { 
        const cost = curr.unit === "packet" ? (curr.packetCostPrice || curr.costPrice || 0) : (curr.cartonCostPrice || curr.costPrice || 0); 
        const totalCount = (curr.cartQty || 0) + (curr.giftQty || 0);
        return acc + (cost * totalCount); 
      }, 0);
      const totalProfit = totalAmount - totalCost;
      
      const nextInvoiceNo = await getNextInvoiceNumber();

      const saleItems: any[] = [];
      vanCart.forEach(c => {
        if ((c.cartQty || 0) > 0) {
          saleItems.push({
            itemId: c.itemId || c.id,
            name: c.name,
            quantity: c.cartQty,
            price: c.finalPrice,
            unit: c.unit || 'carton',
            barcode: c.barcode || '-',
            isGift: false
          });
        }
        if ((c.giftQty || 0) > 0) {
          saleItems.push({
            itemId: c.itemId || c.id,
            name: `${c.name} (هەدیە)`,
            quantity: c.giftQty,
            price: 0,
            unit: c.unit || 'carton',
            barcode: c.barcode || '-',
            isGift: true
          });
        }
      });

      const saleData: Omit<CashvanSale, 'id'> = {
        invoiceNo: nextInvoiceNo,
        invoiceId: nextInvoiceNo,
        cashvanName: repName || 'کاشڤان',
        marketName: vanMarketName,
        items: saleItems,
        totalAmount,
        totalProfit,
        date: Date.now(),
        status: 'pending_accounting',
        paymentType: vanPaymentType
      };

      const docRef = await addDoc(collection(db, 'cashvan_sales'), saleData);

      // Deduct from isolated cashvan_inventory (regular + gift)
      for (const cartItem of vanCart) {
        const totalDeduct = (cartItem.cartQty || 0) + (cartItem.giftQty || 0);
        if (totalDeduct > 0) {
          const itemRef = doc(db, 'cashvan_inventory', cartItem.id);
          const itemSnap = await getDoc(itemRef);
          if (itemSnap.exists()) {
            const currentQty = itemSnap.data().quantity || 0;
            const newQty = Math.max(0, currentQty - totalDeduct);
            await updateDoc(itemRef, { quantity: newQty });
          }
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
      setIsVanGiftMode(false);
      setActiveFormMode('none');
      setCurrentView('main');
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
      const isGift = item.isGift || item.price === 0 || (item.name && item.name.includes('(هەدیە)'));
      const cleanName = (item.name || '').replace('(هەدیە)', '').trim();
      const itemTotal = (item.price || 0) * (item.quantity || 0);
      return `
        <tr ${isGift ? 'style="background-color: #fefce8;"' : ''}>
          <td style="text-align: right; font-weight: bold;">
            ${cleanName}
            ${isGift ? '<span style="background: #fef08a; color: #854d0e; font-size: 10px; font-weight: 900; padding: 1px 4px; border-radius: 4px; margin-right: 4px; border: 1px solid #facc15;">(هەدیە)</span>' : ''}
          </td>
          <td style="text-align: center;">${item.quantity} ${unitLabel}</td>
          <td style="text-align: center;" dir="ltr">${isGift ? '<strong style="color: #ca8a04;">0</strong>' : (item.price || 0).toLocaleString()}</td>
          <td style="text-align: left; font-weight: bold;" dir="ltr">${isGift ? '<strong style="color: #ca8a04;">0</strong>' : itemTotal.toLocaleString()}</td>
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
      const isGift = item.isGift || item.price === 0 || (item.name && item.name.includes('(هەدیە)'));
      const cleanName = (item.name || '').replace('(هەدیە)', '').trim();
      const itemTotal = (item.price || 0) * (item.quantity || 0);
      return `
        <tr ${isGift ? 'style="background-color: #fefce8;"' : ''}>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px;">${idx + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: bold;">
            ${cleanName}
            ${isGift ? '<span style="background: #fef08a; color: #854d0e; font-size: 11px; font-weight: 900; padding: 2px 6px; border-radius: 4px; margin-right: 6px; border: 1px solid #facc15;">(هەدیە)</span>' : ''}
          </td>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px;">${item.quantity} ${unitLabel}</td>
          <td style="text-align: left; border: 1px solid #cbd5e1; padding: 6px;" dir="ltr">
            ${isGift ? '<strong style="color: #ca8a04;">0 د.ع (هەدیە)</strong>' : `${(item.price || 0).toLocaleString()} د.ع`}
          </td>
          <td style="text-align: left; border: 1px solid #cbd5e1; padding: 6px; font-weight: bold;" dir="ltr">
            ${isGift ? '<strong style="color: #ca8a04;">0 د.ع</strong>' : `${itemTotal.toLocaleString()} د.ع`}
          </td>
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

  // Render Dedicated Page: Market Action Menu Page
  if (currentView === 'market_actions' && activeActionMarket) {
    const { market, debt, isVisited } = activeActionMarket;
    return (
      <div className="space-y-5 animate-in fade-in zoom-in-98 duration-200">
        {/* Top Navigation Bar */}
        <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl shadow-xs border border-slate-200">
          <div className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
            <Store size={18} className="text-indigo-600" />
            <span>مێنیوی کارەکان: <span className="text-indigo-600">{market.name}</span></span>
          </div>
          <button
            type="button"
            onClick={() => setCurrentView('main')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition active:scale-95"
          >
            <ArrowRight size={15} />
            <span>گەڕانەوە</span>
          </button>
        </div>

        {/* Compact Action Choice Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* 1. Pre-Order (تەڵەبیە) */}
          <div
            onClick={() => handleSelectMarketForOrder(market)}
            className="p-3.5 bg-white hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-500 rounded-2xl cursor-pointer transition-all duration-150 shadow-2xs hover:shadow-xs group flex items-center gap-3"
          >
            <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl group-hover:scale-105 transition shrink-0">
              <ShoppingCart size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-indigo-700">
                  ١. تەڵەبیە
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-700">
                  داواکاری نوێ
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                تۆمارکردنی داواکاری کاڵاکانی کۆگا بە نرخ و داشکاندن
              </p>
            </div>
          </div>

          {/* 2. Direct Cashvan Sale */}
          <div
            onClick={() => handleSelectMarketForCashvan(market)}
            className="p-3.5 bg-white hover:bg-amber-50/50 border border-slate-200 hover:border-amber-500 rounded-2xl cursor-pointer transition-all duration-150 shadow-2xs hover:shadow-xs group flex items-center gap-3"
          >
            <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl group-hover:scale-105 transition shrink-0">
              <Truck size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-amber-800">
                  ٢. کاشڤان
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800">
                  فرۆشتن لە ڤان
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                فرۆشتنی دەستبەجێ لە کاڵاکانی ڤان و چاپکردنی وەسڵ
              </p>
            </div>
          </div>

          {/* 3. Pay Debt */}
          <div
            onClick={() => handleSelectMarketForDebtPay(market, debt)}
            className="p-3.5 bg-white hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-500 rounded-2xl cursor-pointer transition-all duration-150 shadow-2xs hover:shadow-xs group flex items-center gap-3"
          >
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl group-hover:scale-105 transition shrink-0">
              <CreditCard size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-emerald-700">
                  ٣. دانەوەی قەرزی مارکێت
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700">
                  وەرگرتنی پارە
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                وەرگرتنی بڕی پارەی قەرز و تۆمارکردن لە حیسابات
              </p>
            </div>
          </div>

          {/* 4. Toggle Visit Status */}
          <div
            onClick={() => handleToggleMarketVisit(market.id, isVisited)}
            className={`p-3.5 border rounded-2xl cursor-pointer transition-all duration-150 shadow-2xs hover:shadow-xs group flex items-center gap-3 ${
              isVisited
                ? 'bg-emerald-50/70 border-emerald-300 hover:border-emerald-500'
                : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-400'
            }`}
          >
            <div className={`p-2.5 rounded-xl group-hover:scale-105 transition shrink-0 ${
              isVisited ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              <CheckCircle2 size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-bold text-slate-800">
                  ٤. دۆخی سەردانیکردنی ئەمڕۆ
                </h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  isVisited ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-700'
                }`}>
                  {isVisited ? 'سەردانیکراوە' : 'سەردان نەکراوە'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                {isVisited ? 'کرتە بکە بۆ هەڵوەشاندنەوە' : 'کرتە بکە بۆ نیشانکردن وەک سەردانیکراو'}
              </p>
            </div>
          </div>
        </div>

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

  // Render Dedicated Page: Rep Order (تەڵەبییە) Page with INLINE + / - Steppers on Warehouse Items
  if (currentView === 'order_form') {
    const totalAmount = orderSelectedItems.reduce((acc, curr) => {
      const price = calcPrice(curr.item, curr.unit, orderMarketName);
      return acc + (price * (curr.quantity || 0));
    }, 0);
    const totalRegularCount = orderSelectedItems.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
    const totalGiftCount = orderSelectedItems.reduce((acc, curr) => acc + (curr.giftQuantity || 0), 0);

    const filteredWarehouseItems = items.filter(
      i => (i.quantity || 0) > 0
    );

    return (
      <div className="space-y-4 animate-in fade-in zoom-in-98 duration-200 pb-28">
        {/* Compact Integrated Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl shadow-xs border border-slate-200">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setCurrentView(activeActionMarket ? 'market_actions' : 'main')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition active:scale-95 shrink-0"
            >
              <ArrowRight size={15} />
              <span>گەڕانەوە</span>
            </button>
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} className="text-indigo-600 shrink-0" />
              <h2 className="text-sm sm:text-base font-bold text-slate-800 truncate">
                تەڵەبیە بۆ: <strong className="text-indigo-600">{orderMarketName}</strong>
              </h2>
            </div>

            {/* Rep Selector Badge in Order Form */}
            <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-xl">
              <User size={14} className="text-indigo-600 shrink-0" />
              <span className="text-xs font-bold text-indigo-900">مەندووب:</span>
              {(isWarehouseMode || role === 'warehouse' || role === 'admin') ? (
                <select
                  value={repName}
                  onChange={(e) => setRepName(e.target.value)}
                  className="bg-white border border-indigo-300 rounded-lg text-xs font-bold text-indigo-950 px-2 py-0.5 outline-none cursor-pointer focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">-- دیاریکردنی مەندووب --</option>
                  {reps.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name} {r.isCashvan ? '(کاشڤان)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs font-black text-indigo-700">{repName || 'مەندووب'}</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Payment Type Selector (نەقد / قەرز) */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setOrderPaymentType('cash')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  orderPaymentType === 'cash'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                <DollarSign size={13} />
                <span>بە نەقد</span>
              </button>
              <button
                type="button"
                onClick={() => setOrderPaymentType('debt')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  orderPaymentType === 'debt'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                <CreditCard size={13} />
                <span>بە قەرز</span>
              </button>
            </div>

            {/* Yellow Gift Mode Button */}
            <button
              type="button"
              onClick={() => setIsOrderGiftMode(!isOrderGiftMode)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-xs shrink-0 ${
                isOrderGiftMode
                  ? 'bg-yellow-400 text-yellow-950 border-yellow-500 ring-2 ring-yellow-400 font-extrabold shadow-sm'
                  : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-900 border-yellow-300'
              }`}
            >
              <Gift size={16} className={isOrderGiftMode ? 'fill-yellow-950' : ''} />
              <span>هەدیە {isOrderGiftMode ? '(چالاکە)' : ''}</span>
            </button>
          </div>
        </div>

        {/* Gift Mode Active Notice Banner */}
        {isOrderGiftMode && (
          <div className="p-3 bg-yellow-50 border-2 border-yellow-400 rounded-2xl flex items-center justify-between gap-2 text-xs font-bold text-yellow-950 animate-in fade-in">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-yellow-400 text-yellow-950 rounded-lg shrink-0">
                <Gift size={16} className="fill-yellow-950" />
              </div>
              <span>دۆخی هەدیە چالاکە: هەر کاڵایەک دابگریت بە نرخی ٠ وەک هەدیە دادەنرێت. بۆ گەڕانەوە بۆ فرۆشتنی ئاسایی دوگمەی هەدیە دابگرەوە.</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOrderGiftMode(false)}
              className="px-2.5 py-1 bg-yellow-400 hover:bg-yellow-500 text-yellow-950 rounded-lg text-xs font-bold shrink-0 transition"
            >
              کوژاندنەوە
            </button>
          </div>
        )}

        {/* Catalog of Warehouse Items with Direct Inline + / - Steppers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredWarehouseItems.map(item => {
            const selectedItem = orderSelectedItems.find(si => si.item.id === item.id);
            const currentQty = selectedItem ? (selectedItem.quantity || 0) : 0;
            const currentGiftQty = selectedItem ? (selectedItem.giftQuantity || 0) : 0;
            const totalItemCount = currentQty + currentGiftQty;
            const currentUnit = selectedItem ? selectedItem.unit : (item.packetSellingPrice && !item.cartonSellingPrice ? 'packet' : 'carton');
            const unitPrice = calcPrice(item, currentUnit, orderMarketName);
            const subtotal = currentQty * unitPrice;
            const hasMultipleUnits = item.packetSellingPrice && item.cartonSellingPrice;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl transition-all duration-200 flex flex-col justify-between ${
                  totalItemCount > 0
                    ? isOrderGiftMode
                      ? 'bg-yellow-50/60 border-2 border-yellow-400 shadow-xs'
                      : 'bg-indigo-50/70 border-2 border-indigo-500 shadow-xs'
                    : 'bg-white border border-slate-200 hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-800 line-clamp-1">{item.name}</h4>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                        <span>کۆگا: <strong className="text-slate-700 font-mono font-bold">{item.quantity}</strong></span>
                        {item.barcode && <span className="text-slate-400 font-mono">| {item.barcode}</span>}
                        {currentGiftQty > 0 && (
                          <span className="bg-yellow-200 text-yellow-900 px-1.5 py-0.5 rounded-md font-black text-[10px]">
                            {currentGiftQty} هەدیە
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-left shrink-0">
                      <div className="text-xs sm:text-sm font-bold font-mono text-indigo-700" dir="ltr">
                        {unitPrice.toLocaleString()} IQD
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold text-right">
                        نرخی یەکە
                      </div>
                    </div>
                  </div>

                  {/* Unit Selector (if product supports both carton & packet) */}
                  {hasMultipleUnits && (
                    <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-500">یەکە:</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedItem) {
                            handleUpdateOrderItemQty(item.id, currentQty, 'carton', false);
                          } else {
                            setOrderSelectedItems([...orderSelectedItems, { item, quantity: isOrderGiftMode ? 0 : 1, giftQuantity: isOrderGiftMode ? 1 : 0, unit: 'carton' }]);
                          }
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition ${
                          currentUnit === 'carton'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        کارتۆن
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedItem) {
                            handleUpdateOrderItemQty(item.id, currentQty, 'packet', false);
                          } else {
                            setOrderSelectedItems([...orderSelectedItems, { item, quantity: isOrderGiftMode ? 0 : 1, giftQuantity: isOrderGiftMode ? 1 : 0, unit: 'packet' }]);
                          }
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition ${
                          currentUnit === 'packet'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        پاکەت
                      </button>
                    </div>
                  )}
                </div>

                {/* INLINE + / - STEPPER CONTROLS */}
                <div className="mt-3.5 pt-2.5 border-t border-slate-100/80 space-y-2">
                  {totalItemCount === 0 ? (
                    <button
                      type="button"
                      onClick={() => handleAddItemToOrder(item)}
                      className={`w-full py-2 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-98 border ${
                        isOrderGiftMode
                          ? 'bg-yellow-400 hover:bg-yellow-500 text-yellow-950 border-yellow-500 shadow-xs'
                          : 'bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 border-indigo-200 hover:border-indigo-600'
                      }`}
                    >
                      {isOrderGiftMode ? <Gift size={15} /> : <Plus size={15} />}
                      <span>{isOrderGiftMode ? 'زیادکردن وەک هەدیە' : 'زیادکردن'}</span>
                    </button>
                  ) : (
                    <div>
                      {/* Active Mode Stepper */}
                      {isOrderGiftMode ? (
                        <div className="space-y-1">
                          <div className="text-[10px] font-black text-yellow-900 flex items-center justify-between">
                            <span className="flex items-center gap-1"><Gift size={12} /> بڕی هەدیە (نرخ: ٠):</span>
                            <span>{currentGiftQty} دانە</span>
                          </div>
                          <div className="flex items-center justify-between gap-1.5 bg-yellow-100/70 border border-yellow-400 rounded-xl p-1 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => handleUpdateOrderItemQty(item.id, currentGiftQty - 1, currentUnit, true)}
                              className="w-8 h-8 rounded-lg bg-yellow-200 hover:bg-yellow-300 text-yellow-950 flex items-center justify-center font-bold text-sm transition active:scale-95"
                              title="کەمکردنەوەی هەدیە"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              max={item.quantity || 999}
                              value={currentGiftQty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val)) {
                                  handleUpdateOrderItemQty(item.id, val, currentUnit, true);
                                }
                              }}
                              className="w-16 h-8 text-center font-mono font-bold text-sm text-yellow-950 outline-none bg-transparent"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateOrderItemQty(item.id, currentGiftQty + 1, currentUnit, true)}
                              className="w-8 h-8 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-yellow-950 flex items-center justify-center font-bold text-sm transition active:scale-95"
                              title="زیادکردنی هەدیە"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-1.5 bg-white border border-indigo-300 rounded-xl p-1 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => handleUpdateOrderItemQty(item.id, currentQty - 1, currentUnit, false)}
                              className="w-8 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm transition active:scale-95"
                              title="کەمکردنەوە"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              max={item.quantity || 999}
                              value={currentQty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val)) {
                                  handleUpdateOrderItemQty(item.id, val, currentUnit, false);
                                }
                              }}
                              className="w-16 h-8 text-center font-mono font-bold text-sm text-slate-800 outline-none bg-transparent"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateOrderItemQty(item.id, currentQty + 1, currentUnit, false)}
                              className="w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center font-bold text-sm transition active:scale-95"
                              title="زیادکردن"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Summary Breakdown */}
                      <div className="flex items-center justify-between text-[11px] font-bold text-indigo-900 mt-1.5 px-1">
                        <span>کۆی کاڵا:</span>
                        <div className="flex items-center gap-1.5">
                          {currentGiftQty > 0 && (
                            <span className="text-yellow-700 text-[10px]">({currentGiftQty} هەدیە)</span>
                          )}
                          <span className="font-mono text-indigo-700" dir="ltr">{subtotal.toLocaleString()} د.ع</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {filteredWarehouseItems.length === 0 && (
            <div className="col-span-full py-16 text-center text-slate-400 text-xs font-bold bg-white rounded-3xl border border-slate-200">
              هیچ کاڵایەک نەدۆزرایەوە لە کۆگا
            </div>
          )}
        </div>

        {/* Sticky Bottom Checkout Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-4 shadow-lg">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-[11px] text-slate-400 font-bold">کۆی گشتی داواکاری:</div>
                <div className="text-lg sm:text-xl font-bold font-mono text-indigo-600" dir="ltr">
                  {totalAmount.toLocaleString()} د.ع
                </div>
              </div>
              <div className="h-8 w-px bg-slate-200"></div>
              <div className="text-xs font-bold text-slate-600">
                <span>{orderSelectedItems.length} جۆر کاڵا</span>
                <span className="text-slate-400 mr-1">({totalRegularCount} فرۆشتن {totalGiftCount > 0 ? `+ ${totalGiftCount} هەدیە` : ''})</span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setCurrentView(activeActionMarket ? 'market_actions' : 'main')}
                className="flex-1 sm:flex-none px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                پاشگەزبوونەوە
              </button>
              <button
                type="button"
                onClick={submitOrder}
                disabled={orderSelectedItems.length === 0}
                className="flex-2 sm:flex-none px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm flex items-center justify-center gap-2 transition active:scale-95"
              >
                <Send size={16} />
                <span>ناردنی داواکاری بۆ کۆگا</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Dedicated Page: Cashvan Direct Sale (کاشڤان ڕاستەوخۆ) Page with INLINE + / - Steppers on Van Inventory
  if (currentView === 'cashvan_form') {
    const totalAmount = vanCart.reduce((acc, curr) => acc + ((curr.cartQty || 0) * (curr.finalPrice || 0)), 0);
    const totalRegularCount = vanCart.reduce((acc, curr) => acc + (curr.cartQty || 0), 0);
    const totalGiftCount = vanCart.reduce((acc, curr) => acc + (curr.giftQty || 0), 0);

    const filteredVanItems = vanInventory.filter(
      i => (i.quantity || 0) > 0
    );

    return (
      <div className="space-y-4 animate-in fade-in zoom-in-98 duration-200 pb-28">
        {/* Compact Integrated Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl shadow-xs border border-slate-200">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCurrentView(activeActionMarket ? 'market_actions' : 'main')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition active:scale-95 shrink-0"
            >
              <ArrowRight size={15} />
              <span>گەڕانەوە</span>
            </button>
            <div className="flex items-center gap-2">
              <Truck size={18} className="text-amber-800 shrink-0" />
              <h2 className="text-sm sm:text-base font-bold text-slate-800 truncate">
                کاشڤان: <strong className="text-amber-900">{vanMarketName}</strong>
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Payment Type Selector (نەقد / قەرز) */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setVanPaymentType('cash')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  vanPaymentType === 'cash'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                <DollarSign size={13} />
                <span>بە نەقد</span>
              </button>
              <button
                type="button"
                onClick={() => setVanPaymentType('debt')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  vanPaymentType === 'debt'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                <CreditCard size={13} />
                <span>بە قەرز</span>
              </button>
            </div>

            {/* Yellow Gift Mode Button Next to Debt/Cash */}
            <button
              type="button"
              onClick={() => setIsVanGiftMode(!isVanGiftMode)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-xs shrink-0 ${
                isVanGiftMode
                  ? 'bg-yellow-400 text-yellow-950 border-yellow-500 ring-2 ring-yellow-400 font-extrabold shadow-sm'
                  : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-900 border-yellow-300'
              }`}
            >
              <Gift size={16} className={isVanGiftMode ? 'fill-yellow-950' : ''} />
              <span>هەدیە {isVanGiftMode ? '(چالاکە)' : ''}</span>
            </button>
          </div>
        </div>

        {/* Gift Mode Active Notice Banner */}
        {isVanGiftMode && (
          <div className="p-3 bg-yellow-50 border-2 border-yellow-400 rounded-2xl flex items-center justify-between gap-2 text-xs font-bold text-yellow-950 animate-in fade-in">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-yellow-400 text-yellow-950 rounded-lg shrink-0">
                <Gift size={16} className="fill-yellow-950" />
              </div>
              <span>دۆخی هەدیە چالاکە: هەر کاڵایەک دابگریت لەمەودوا بە نرخی ٠ وەک هەدیە دادەنرێت. بۆ گەڕانەوە بۆ فرۆشتنی ئاسایی دوگمەی هەدیە دابگرەوە.</span>
            </div>
            <button
              type="button"
              onClick={() => setIsVanGiftMode(false)}
              className="px-2.5 py-1 bg-yellow-400 hover:bg-yellow-500 text-yellow-950 rounded-lg text-xs font-bold shrink-0 transition"
            >
              کوژاندنەوە
            </button>
          </div>
        )}

        {/* Debt notice if debt exists */}
        {(marketDebtMap.get(vanMarketName) || 0) > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900 font-bold">
            <div className="flex items-center gap-2">
              <CreditCard size={15} className="text-amber-700" />
              <span>قەرزی پێشووی ئەم مارکێتە:</span>
            </div>
            <span className="font-mono text-sm text-amber-900" dir="ltr">
              {(marketDebtMap.get(vanMarketName) || 0).toLocaleString()} IQD
            </span>
          </div>
        )}

        {/* Catalog of Van Inventory Items with Direct Inline + / - Steppers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredVanItems.map(item => {
            const cartItem = vanCart.find(c => c.id === item.id);
            const currentQty = cartItem ? (cartItem.cartQty || 0) : 0;
            const currentGiftQty = cartItem ? (cartItem.giftQty || 0) : 0;
            const totalItemCount = currentQty + currentGiftQty;
            const unitLabel = item.unit === 'packet' ? 'پاکەت' : 'کارتۆن';
            const unitPrice = calcPrice(item, item.unit || 'carton', vanMarketName);
            const subtotal = currentQty * unitPrice;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl transition-all duration-200 flex flex-col justify-between ${
                  totalItemCount > 0
                    ? isVanGiftMode
                      ? 'bg-yellow-50/60 border-2 border-yellow-400 shadow-xs'
                      : 'bg-amber-50/70 border-2 border-amber-500 shadow-xs'
                    : 'bg-white border border-slate-200 hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-800 line-clamp-1">{item.name}</h4>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                        <span>لە ڤان: <strong className="text-slate-700 font-mono font-bold">{item.quantity} {unitLabel}</strong></span>
                        {item.barcode && <span className="text-slate-400 font-mono">| {item.barcode}</span>}
                        {currentGiftQty > 0 && (
                          <span className="bg-yellow-200 text-yellow-900 px-1.5 py-0.5 rounded-md font-black text-[10px]">
                            {currentGiftQty} هەدیە
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-left shrink-0">
                      <div className="text-xs sm:text-sm font-bold font-mono text-emerald-700" dir="ltr">
                        {unitPrice.toLocaleString()} IQD
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold text-right">
                        نرخی یەکە
                      </div>
                    </div>
                  </div>
                </div>

                {/* INLINE + / - STEPPER CONTROLS */}
                <div className="mt-3.5 pt-2.5 border-t border-slate-100/80 space-y-2">
                  {totalItemCount === 0 ? (
                    <button
                      type="button"
                      onClick={() => addToVanCart(item)}
                      className={`w-full py-2 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-98 border ${
                        isVanGiftMode
                          ? 'bg-yellow-400 hover:bg-yellow-500 text-yellow-950 border-yellow-500 shadow-xs'
                          : 'bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-900 border-amber-200 hover:border-amber-600'
                      }`}
                    >
                      {isVanGiftMode ? <Gift size={15} /> : <Plus size={15} />}
                      <span>{isVanGiftMode ? 'زیادکردن وەک هەدیە' : 'زیادکردن'}</span>
                    </button>
                  ) : (
                    <div>
                      {/* Active Mode Stepper */}
                      {isVanGiftMode ? (
                        <div className="space-y-1">
                          <div className="text-[10px] font-black text-yellow-900 flex items-center justify-between">
                            <span className="flex items-center gap-1"><Gift size={12} /> بڕی هەدیە (نرخ: ٠):</span>
                            <span>{currentGiftQty} دانە</span>
                          </div>
                          <div className="flex items-center justify-between gap-1.5 bg-yellow-100/70 border border-yellow-400 rounded-xl p-1 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => updateVanCartQty(item.id, currentGiftQty - 1, item.unit, true)}
                              className="w-8 h-8 rounded-lg bg-yellow-200 hover:bg-yellow-300 text-yellow-950 flex items-center justify-center font-bold text-sm transition active:scale-95"
                              title="کەمکردنەوەی هەدیە"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              max={item.quantity || 999}
                              value={currentGiftQty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val)) {
                                  updateVanCartQty(item.id, val, item.unit, true);
                                }
                              }}
                              className="w-16 h-8 text-center font-mono font-bold text-sm text-yellow-950 outline-none bg-transparent"
                            />
                            <button
                              type="button"
                              onClick={() => updateVanCartQty(item.id, currentGiftQty + 1, item.unit, true)}
                              className="w-8 h-8 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-yellow-950 flex items-center justify-center font-bold text-sm transition active:scale-95"
                              title="زیادکردنی هەدیە"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-1.5 bg-white border border-amber-300 rounded-xl p-1 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => updateVanCartQty(item.id, currentQty - 1, item.unit, false)}
                              className="w-8 h-8 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-sm transition active:scale-95"
                              title="کەمکردنەوە"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              max={item.quantity || 999}
                              value={currentQty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val)) {
                                  updateVanCartQty(item.id, val, item.unit, false);
                                }
                              }}
                              className="w-16 h-8 text-center font-mono font-bold text-sm text-slate-800 outline-none bg-transparent"
                            />
                            <button
                              type="button"
                              onClick={() => updateVanCartQty(item.id, currentQty + 1, item.unit, false)}
                              className="w-8 h-8 rounded-lg bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center font-bold text-sm transition active:scale-95"
                              title="زیادکردن"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Summary Breakdown */}
                      <div className="flex items-center justify-between text-[11px] font-bold text-amber-950 mt-1.5 px-1">
                        <span>کۆی کاڵا:</span>
                        <div className="flex items-center gap-1.5">
                          {currentGiftQty > 0 && (
                            <span className="text-yellow-700 text-[10px]">({currentGiftQty} هەدیە)</span>
                          )}
                          <span className="font-mono text-emerald-700" dir="ltr">{subtotal.toLocaleString()} د.ع</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {filteredVanItems.length === 0 && (
            <div className="col-span-full py-16 text-center text-slate-400 text-xs font-bold bg-white rounded-3xl border border-slate-200">
              هیچ کاڵایەک لەناو ڤاندا بارنەکراوە یان بەردەست نییە
            </div>
          )}
        </div>

        {/* Sticky Bottom Checkout Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-4 shadow-lg">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-[11px] text-slate-400 font-bold">کۆی گشتی فرۆشتن:</div>
                <div className="text-lg sm:text-xl font-bold font-mono text-emerald-700" dir="ltr">
                  {totalAmount.toLocaleString()} د.ع
                </div>
              </div>
              <div className="h-8 w-px bg-slate-200"></div>
              <div className="text-xs font-bold text-slate-600">
                <span>{vanCart.length} جۆر کاڵا</span>
                <span className="text-slate-400 mr-1">({totalRegularCount} فرۆشتن {totalGiftCount > 0 ? `+ ${totalGiftCount} هەدیە` : ''})</span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setCurrentView(activeActionMarket ? 'market_actions' : 'main')}
                className="flex-1 sm:flex-none px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                پاشگەزبوونەوە
              </button>
              <button
                type="button"
                onClick={submitCashvanSale}
                disabled={vanCart.length === 0}
                className="flex-2 sm:flex-none px-6 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm flex items-center justify-center gap-2 transition active:scale-95"
              >
                <Printer size={16} />
                <span>تۆمارکردن و چاپکردنی وەسڵ</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {activeMainTab === 'schedule' && (
        <>
          {(isWarehouseMode || role === 'warehouse' || role === 'admin') && (
            <div className="bg-white border-2 border-indigo-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-xs shrink-0">
                  <User size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-slate-800">
                      تۆمارکردنی تەڵەبییە لەژێر ناوی مەندووب
                    </h3>
                    <span className="bg-indigo-100 text-indigo-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold border border-indigo-200">
                      کۆگا
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    مەندووبێک دیاری بکە بۆ ئەوەی خشتەی سەردان، وەسڵ و حساباتی داواکارییەکە لەسەر حسابی ئەو مەندووبە تۆمار بکرێت
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 min-w-[260px] sm:min-w-[320px]">
                <div className="w-full">
                  <label className="block text-[11px] font-bold text-indigo-900 mb-1">
                    هەڵبژاردنی مەندووب / کاشڤان:
                  </label>
                  <select
                    value={repName}
                    onChange={(e) => setRepName(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-100 border-2 border-indigo-300 text-slate-800 font-bold text-xs sm:text-sm py-2.5 px-3.5 rounded-xl outline-none focus:border-indigo-600 transition shadow-2xs cursor-pointer"
                  >
                    <option value="">-- مەندووب هەڵبژێرە --</option>
                    {reps.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name} {r.isCashvan ? '(کاشڤان)' : '(مەندووب)'} {r.phone ? `(${r.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <MarketDailyScheduleCard
            role={role}
            activeRepName={repName}
            activeCashvanName={repName}
            onSelectForOrder={handleSelectMarketForOrder}
            onSelectForCashvan={handleSelectMarketForCashvan}
            onSelectForDebtPay={handleSelectMarketForDebtPay}
            onOpenMarketActions={handleOpenMarketActions}
            marketDebtMap={marketDebtMap}
          />
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
              <span>تەڵەبیە ({salesStats.orderCount})</span>
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
