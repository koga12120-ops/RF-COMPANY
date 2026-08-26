import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, getDocs, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { Transaction } from '../../types';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { Plus, TrendingUp, TrendingDown, DollarSign, Trash2, Calendar, Archive, Clock, ShoppingBag, Printer, FileText, PackagePlus, PackageMinus, Receipt, Building2, Store, CreditCard } from 'lucide-react';
import ConfirmModal from '../common/ConfirmModal';
import { printStatementPopup } from '../../lib/statementPrinter';

export default function LedgerView() {
  const [activeTab, setActiveTab] = useState<'current' | 'archive'>('current');
  const [timeFilter, setTimeFilter] = useState<'all' | 'day' | 'week' | 'month'>('day');
  
  const [archiveYear, setArchiveYear] = useState(new Date().getFullYear().toString());
  const [archiveMonth, setArchiveMonth] = useState((new Date().getMonth() + 1).toString());
  const [archiveDay, setArchiveDay] = useState('all');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [cashvanSales, setCashvanSales] = useState<any[]>([]);
  const [deletingDeal, setDeletingDeal] = useState<any | null>(null);
  
  const [loading, setLoading] = useState(true);
  
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [dealFilterType, setDealFilterType] = useState<'all' | 'company' | 'market' | 'warehouse'>('all');
  const [dealFilterName, setDealFilterName] = useState('all');
  const [dealFilterRep, setDealFilterRep] = useState('all');

  useEffect(() => {
    const qTrans = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const unsubTrans = onSnapshot(
      qTrans,
      (snapshot) => {
        const transData: Transaction[] = [];
        snapshot.forEach((doc) => {
          transData.push({ id: doc.id, ...doc.data() } as Transaction);
        });
        setTransactions(transData);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'transactions');
      }
    );
    
    const unsubOrders = onSnapshot(
      collection(db, 'orders'),
      (snapshot) => {
        const ords: any[] = [];
        snapshot.forEach(doc => {
          ords.push({ id: doc.id, ...doc.data() });
        });
        setOrders(ords);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'orders');
      }
    );
    
    const unsubCashvan = onSnapshot(
      collection(db, 'cashvan_sales'),
      (snapshot) => {
        const cvs: any[] = [];
        snapshot.forEach(doc => {
          cvs.push({ id: doc.id, ...doc.data() });
        });
        setCashvanSales(cvs);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'cashvan_sales');
      }
    );

    return () => {
      unsubTrans();
      unsubOrders();
      unsubCashvan();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description) return;
    try {
      await addDoc(collection(db, 'transactions'), {
        type,
        amount: Number(amount),
        description,
        date: Date.now()
      });
      setAmount('');
      setDescription('');
    } catch (error) {
      console.error(error);
    }
  };

    const filteredData = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date;
    let isAll = false;

    if (activeTab === 'current') {
      if (timeFilter === 'all') {
        isAll = true;
      } else if (timeFilter === 'day') {
        start = startOfDay(now);
        end = endOfDay(now);
      } else if (timeFilter === 'week') {
        start = startOfWeek(now, { weekStartsOn: 6 });
        end = endOfWeek(now, { weekStartsOn: 6 });
      } else {
        start = startOfMonth(now);
        end = endOfMonth(now);
      }
    } else {
      const y = parseInt(archiveYear);
      const m = parseInt(archiveMonth) - 1;
      if (archiveDay === 'all') {
        start = startOfMonth(new Date(y, m, 1));
        end = endOfMonth(new Date(y, m, 1));
      } else {
        const d = parseInt(archiveDay);
        start = startOfDay(new Date(y, m, d));
        end = endOfDay(new Date(y, m, d));
      }
    }

        const t = transactions.filter(tr => isAll ? true : isWithinInterval(tr.date, { start: start!, end: end! }));
    const o = orders.filter(ord => (ord.status === 'completed' || ord.status === 'deleted') && (isAll ? true : isWithinInterval(ord.timestamp, { start: start!, end: end! })));
    const c = cashvanSales.filter(cv => (cv.status === 'accounted' || cv.status === 'deleted') && (isAll ? true : isWithinInterval(cv.date || cv.timestamp, { start: start!, end: end! })));

    return { t, o, c };
  }, [activeTab, timeFilter, archiveYear, archiveMonth, archiveDay, transactions, orders, cashvanSales]);

  const { t: fTrans, o: fOrders, c: fCashvan } = filteredData;

  const deals = useMemo(() => {
    let list: any[] = [];
    fTrans.forEach(t => {
      list.push({
        id: t.id,
        type: t.type === 'company_paid_debt' ? 'پاردانەوەی کۆمپانیا' : (t.type === 'company_cash' || t.type === 'company_debt' ? 'وەرگرتنی کاڵا' : (t.type === 'income' ? 'داهاتی دەستی' : (t.type === 'expense' ? 'خەرجی دەستی' : 'پاردانەوە/قەرز'))),
        entityType: ['company_paid_debt', 'company_cash', 'company_debt'].includes(t.type) ? 'company' : 'market',
        entityName: t.relatedEntityId || t.description,
        personName: ['company_paid_debt', 'company_cash', 'company_debt'].includes(t.type) ? 'کۆمپانیا' : 'بەڕێوەبەر',
        amount: t.amount,
        date: t.date,
        invoiceNumber: t.invoiceNo ? `#${t.invoiceNo}` : ((['company_paid_debt', 'company_cash', 'company_debt'].includes(t.type) ? 'COMP-' : 'TRN-') + t.id.slice(-4).toUpperCase()),
        invoiceNo: t.invoiceNo,
        isDeleted: false,
        deletedBy: ''
      });
    });
    fOrders.forEach(o => {
      const inv = o.invoiceId || o.invoiceNo;
      list.push({
        id: o.id,
        type: 'فرۆشتنی مەندووب',
        entityType: 'market',
        entityName: o.marketName,
        personName: o.repName,
        amount: o.totalAmount,
        date: o.timestamp,
        invoiceNumber: inv ? `#${inv}` : ('ORD-' + o.id.slice(-4).toUpperCase()),
        invoiceNo: inv,
        isDeleted: o.status === 'deleted',
        deletedBy: o.deletedBy || ''
      });
    });
    fCashvan.forEach(c => {
      const inv = c.invoiceNo || c.invoiceId;
      list.push({
        id: c.id,
        type: 'فرۆشتنی کاشڤان',
        entityType: 'market',
        entityName: c.marketName,
        personName: c.cashvanName,
        amount: c.totalAmount,
        date: c.date || c.timestamp,
        invoiceNumber: inv ? `#${inv}` : ('CASH-' + c.id.slice(-4).toUpperCase()),
        invoiceNo: inv,
        isDeleted: c.status === 'deleted',
        deletedBy: c.deletedBy || ''
      });
    });
    
    // Filtering
    if (dealFilterType !== 'all') {
       list = list.filter(d => d.entityType === dealFilterType || d.type.includes(dealFilterType === 'company' ? 'کۆمپانیا' : ''));
    }
    
    if (dealFilterName !== 'all' && dealFilterName.trim() !== '') {
       list = list.filter(d => d.entityName?.includes(dealFilterName));
    }

    if (dealFilterRep !== 'all' && dealFilterRep.trim() !== '') {
       list = list.filter(d => d.personName === dealFilterRep || d.entityName === dealFilterRep);
    }

    list.sort((a, b) => b.date - a.date);
    return list;
  }, [fTrans, fOrders, fCashvan, dealFilterType, dealFilterName, dealFilterRep]);
  
  // Get unique reps and cashvans for classification
  const uniqueReps = useMemo(() => {
    const repsSet = new Set<string>();
    fOrders.forEach(o => { if (o.repName) repsSet.add(o.repName.trim()); });
    fCashvan.forEach(c => { if (c.cashvanName) repsSet.add(c.cashvanName.trim()); });
    return Array.from(repsSet).filter(Boolean).sort();
  }, [fOrders, fCashvan]);

  // Get unique entities for the name dropdown
  const uniqueEntities = useMemo(() => {
    const entities = new Map<string, string>();
    fTrans.forEach(t => {
      const isCompany = ['company_paid_debt', 'company_cash', 'company_debt'].includes(t.type);
      const name = t.relatedEntityId || t.description;
      if (name) entities.set(name, isCompany ? 'company' : 'market');
    });
    fOrders.forEach(o => { if (o.marketName) entities.set(o.marketName, 'market'); });
    fCashvan.forEach(c => { if (c.marketName) entities.set(c.marketName, 'market'); });
    
    let list = Array.from(entities.entries()).map(([name, type]) => ({ name, type }));
    if (dealFilterType !== 'all') {
      list = list.filter(e => e.type === dealFilterType);
    }
    return list.map(e => e.name).filter(n => n && n.trim() !== '').sort();
  }, [fTrans, fOrders, fCashvan, dealFilterType]);


  const printStatement = async (entityName: string) => {
    if (!entityName || entityName === 'نەزانراو' || entityName === '') {
      alert('ناوی مارکێت یان کۆمپانیا دیاری نەکراوە بۆ چاپکردنی کەشف حیساب');
      return;
    }
    const q = query(collection(db, 'transactions'), where('relatedEntityId', '==', entityName));
    const snap = await getDocs(q);
    const allTrans: Transaction[] = [];
    snap.forEach(d => allTrans.push({ id: d.id, ...d.data() } as Transaction));
    printStatementPopup(entityName, allTrans);
  };

  const confirmDeleteDeal = async () => {
    if (!deletingDeal) return;
    try {
      if (deletingDeal.invoiceNumber?.startsWith('COMP-') || deletingDeal.invoiceNumber?.startsWith('TRN-')) {
        await deleteDoc(doc(db, 'transactions', deletingDeal.id));
      } else if (deletingDeal.invoiceNumber?.startsWith('ORD-')) {
        await deleteDoc(doc(db, 'orders', deletingDeal.id));
      } else if (deletingDeal.invoiceNumber?.startsWith('CASH-')) {
        await deleteDoc(doc(db, 'cashvan_sales', deletingDeal.id));
      }
      setDeletingDeal(null);
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە کاتی سڕینەوەی مامەڵە');
    }
  };

  const calculateTotal = (data: Transaction[], filterType: string[]) => {
    return data
      .filter(tr => filterType.includes(tr.type))
      .reduce((acc, curr) => acc + (curr.amount || 0), 0);
  };

  const totalIncome = calculateTotal(fTrans, ['income', 'cash', 'cash_sale', 'cash_in', 'paid_debt', 'market_paid_debt']);
  const manualExpenses = calculateTotal(fTrans, ['expense']);
  const returnProfitsLost = fTrans.filter(tr => tr.type === 'return_expense').reduce((acc, tr) => acc + (tr.profitReversal || 0), 0);

  const ordersProfit = fOrders.filter(o => o.status === 'completed').reduce((acc, ord) => acc + (ord.totalProfit || 0), 0);
  const ordersTotal = fOrders.filter(o => o.status === 'completed').reduce((acc, ord) => acc + (ord.totalAmount || 0), 0);
  const ordersCost = ordersTotal - ordersProfit;

  const cashvanProfit = fCashvan.filter(c => c.status === 'accounted').reduce((acc, cv) => acc + (cv.totalProfit || 0), 0);
  const cashvanTotal = fCashvan.filter(c => c.status === 'accounted').reduce((acc, cv) => acc + (cv.totalAmount || 0), 0);
  const cashvanCost = cashvanTotal - cashvanProfit;

  // 1. کۆی تێچوو: تێچووی کاڵای فرۆشراو لەڕێگەی مەندووب یان کاشڤانەوە
  const totalCost = ordersCost + cashvanCost;

  // 2. کۆی کڕین: کاتێک شتێک دەکڕم یان داخڵ دەکەم لە کۆگا
  const totalPurchases = calculateTotal(fTrans, ['company_cash', 'company_debt']);

  // 3. کۆی فرۆش: (کۆی قازانج + کۆی تێچوو)
  const totalSalesVolume = ordersTotal + cashvanTotal;

  // 4. کۆی خەرجی: تەنها بۆ خەرجییەکان بێت کە بەدەست دەینوسم لە زیاد کردنی تۆمار
  const totalExpense = manualExpenses;

  // 5. کۆی قەرزەکانم (ئەوانەی لە کۆمپانیاکان بەقەرز هێنراون)
  const totalCompanyDebt = calculateTotal(fTrans, ['company_debt']);
  const totalCompanyPaid = calculateTotal(fTrans, ['company_paid_debt']);
  const remainingCompanyDebt = Math.max(0, totalCompanyDebt - totalCompanyPaid);

  // 6. کۆی بە قەرز براوەکانم (ئەو مارکێت و کۆگایانەی بە قەرز شتیان بردووە)
  const totalMarketDebt = calculateTotal(fTrans, ['debt', 'market_debt']);
  const totalMarketPaid = calculateTotal(fTrans, ['paid_debt', 'market_paid_debt']);
  const remainingMarketDebt = Math.max(0, totalMarketDebt - totalMarketPaid);

  // 7. قازانجی سافی
  const netProfit = totalIncome - calculateTotal(fTrans, ['expense', 'company_cash', 'company_paid_debt', 'return_expense']);
  const realProfit = (ordersProfit + cashvanProfit) - manualExpenses - returnProfitsLost;

  // Generate years from 2024 to 2035
  const years = Array.from({ length: 12 }, (_, i) => 2024 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);


  const printDeal = (d: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html dir="rtl">
        <head>
          <title>پسوڵەی دەفتەر حسابات - ${d.invoiceNumber}</title>
          <style>
            body { font-family: Tahoma, Arial, sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 10px; }
            .title { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
            .subtitle { color: #666; font-size: 14px; }
            .details { margin-bottom: 30px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 10px; padding: 5px 0; border-bottom: 1px dashed #eee; }
            .label { font-weight: bold; }
            .amount { font-size: 20px; font-weight: bold; text-align: center; margin: 30px 0; padding: 15px; border: 2px solid #333; border-radius: 8px; }
            .footer { text-align: center; margin-top: 50px; font-size: 12px; color: #888; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">کۆمپانیای RF</div>
            <div class="subtitle">پسوڵەی دەفتەر حسابات</div>
          </div>
          
          <div class="details">
            <div class="row">
              <span class="label">جۆر:</span>
              <span>${d.isDeleted ? 'سڕاوەتەوە' : d.type}</span>
            </div>
            <div class="row">
              <span class="label">ناوی لایەن:</span>
              <span>${d.entityName}</span>
            </div>
            <div class="row">
              <span class="label">کەس:</span>
              <span>${d.personName}</span>
            </div>
            <div class="row">
              <span class="label">بەروار:</span>
              <span dir="ltr">${format(d.date, 'yyyy-MM-dd HH:mm')}</span>
            </div>
            <div class="row">
              <span class="label">ژمارەی فاتیرە:</span>
              <span dir="ltr">${d.invoiceNumber}</span>
            </div>
          </div>
          
          <div class="amount" dir="ltr">
            ${(d.amount || 0).toLocaleString()} د.ع
          </div>
          
          <div style="display: flex; justify-content: space-between; margin-top: 50px;">
            <div style="text-align: center;">
              <div>واژووی پێدەر</div>
              <div style="margin-top: 30px; border-top: 1px solid #333; width: 150px;"></div>
            </div>
            <div style="text-align: center;">
              <div>واژووی وەرگر</div>
              <div style="margin-top: 30px; border-top: 1px solid #333; width: 150px;"></div>
            </div>
          </div>
          
          <div class="footer">
            کات و بەرواری چاپ: <span dir="ltr">${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</span>
          </div>
          <script>
            window.onload = () => window.print();
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };
  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('current')}
          className={`px-4 py-3 font-bold text-sm flex items-center gap-2 border-b-2 transition ${
            activeTab === 'current' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Clock size={18} />
          حساباتی هەنووکەیی
        </button>
        <button
          onClick={() => setActiveTab('archive')}
          className={`px-4 py-3 font-bold text-sm flex items-center gap-2 border-b-2 transition ${
            activeTab === 'archive' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Archive size={18} />
          حساباتی کۆن
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                {activeTab === 'current' ? (
          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={() => setTimeFilter('all')}
              className={`px-4 py-2 rounded-lg font-bold text-sm flex-1 md:flex-none transition ${timeFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              هەمووی
            </button>
            <button
              onClick={() => setTimeFilter('day')}
              className={`px-4 py-2 rounded-lg font-bold text-sm flex-1 md:flex-none transition ${timeFilter === 'day' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              ئەمڕۆ
            </button>
            <button
              onClick={() => setTimeFilter('week')}
              className={`px-4 py-2 rounded-lg font-bold text-sm flex-1 md:flex-none transition ${timeFilter === 'week' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              ئەم هەفتەیە
            </button>
            <button
              onClick={() => setTimeFilter('month')}
              className={`px-4 py-2 rounded-lg font-bold text-sm flex-1 md:flex-none transition ${timeFilter === 'month' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              ئەم مانگە
            </button>
          </div>
                ) : (
          <div className="flex gap-4 w-full md:w-auto">
            <div className="flex-1 md:flex-none">
              <label className="block text-xs text-slate-500 mb-1">ساڵ</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                value={archiveYear}
                onChange={(e) => setArchiveYear(e.target.value)}
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 md:flex-none">
              <label className="block text-xs text-slate-500 mb-1">مانگ</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                value={archiveMonth}
                onChange={(e) => setArchiveMonth(e.target.value)}
              >
                {months.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 md:flex-none">
              <label className="block text-xs text-slate-500 mb-1">ڕۆژ</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                value={archiveDay}
                onChange={(e) => setArchiveDay(e.target.value)}
              >
                <option value="all">هەمووی</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {/* قازانجی سافی */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5 hover:shadow-md transition">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl shrink-0">
            <TrendingUp size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500 mb-0.5 font-medium truncate">قازانجی سافی</div>
            <div className="text-lg font-bold text-indigo-600 tracking-tight" dir="ltr">{realProfit.toLocaleString()}</div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">کۆی قازانج - خەرجی</div>
          </div>
        </div>

        {/* کۆی فرۆش */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5 hover:shadow-md transition">
          <div className="p-3 bg-green-100 text-green-600 rounded-xl shrink-0">
            <ShoppingBag size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500 mb-0.5 font-medium truncate">کۆی فرۆش</div>
            <div className="text-lg font-bold text-green-700 tracking-tight" dir="ltr">{totalSalesVolume.toLocaleString()}</div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">قازانج + تێچوو</div>
          </div>
        </div>

        {/* کۆی تێچوو */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5 hover:shadow-md transition">
          <div className="p-3 bg-amber-100 text-amber-600 rounded-xl shrink-0">
            <PackageMinus size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500 mb-0.5 font-medium truncate">کۆی تێچوو</div>
            <div className="text-lg font-bold text-amber-700 tracking-tight" dir="ltr">{totalCost.toLocaleString()}</div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">تێچووی فرۆشراو</div>
          </div>
        </div>

        {/* کۆی کڕین */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5 hover:shadow-md transition">
          <div className="p-3 bg-sky-100 text-sky-600 rounded-xl shrink-0">
            <PackagePlus size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500 mb-0.5 font-medium truncate">کۆی کڕین</div>
            <div className="text-lg font-bold text-sky-700 tracking-tight" dir="ltr">{totalPurchases.toLocaleString()}</div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">داخڵکراو لە کۆگا</div>
          </div>
        </div>

        {/* کۆی خەرجی */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5 hover:shadow-md transition">
          <div className="p-3 bg-rose-100 text-rose-600 rounded-xl shrink-0">
            <Receipt size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500 mb-0.5 font-medium truncate">کۆی خەرجی</div>
            <div className="text-lg font-bold text-rose-600 tracking-tight" dir="ltr">{totalExpense.toLocaleString()}</div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">خەرجی دەستی</div>
          </div>
        </div>

        {/* کۆی قەرزەکانم (کۆمپانیاکان) */}
        <div className="bg-white p-4 rounded-2xl border border-orange-200/80 shadow-sm flex items-center gap-3.5 hover:shadow-md transition">
          <div className="p-3 bg-orange-100 text-orange-600 rounded-xl shrink-0">
            <Building2 size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500 mb-0.5 font-medium truncate">قەرزەکانم (کۆمپانیا)</div>
            <div className="text-lg font-bold text-orange-600 tracking-tight" dir="ltr">{totalCompanyDebt.toLocaleString()}</div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate" dir="ltr">ماوە: {remainingCompanyDebt.toLocaleString()}</div>
          </div>
        </div>

        {/* کۆی بە قەرز براوەکانم (مارکێت و کۆگاکان) */}
        <div className="bg-white p-4 rounded-2xl border border-purple-200/80 shadow-sm flex items-center gap-3.5 hover:shadow-md transition">
          <div className="p-3 bg-purple-100 text-purple-600 rounded-xl shrink-0">
            <Store size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500 mb-0.5 font-medium truncate">بە قەرز براوە (مارکێت)</div>
            <div className="text-lg font-bold text-purple-600 tracking-tight" dir="ltr">{totalMarketDebt.toLocaleString()}</div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate" dir="ltr">ماوە: {remainingMarketDebt.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entry Form - Only show in current tab */}
        {activeTab === 'current' && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 lg:col-span-1 h-fit flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h4 className="font-bold text-slate-700 flex items-center gap-2">زیادکردنی تۆمار</h4>
            </div>
            <div className="p-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">جۆر</label>
                  <select
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    value={type}
                    onChange={(e) => setType(e.target.value as 'income' | 'expense')}
                  >
                    <option value="income">داهات</option>
                    <option value="expense">خەرجی</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">بڕی پارە</label>
                  <input
                    type="number"
                    required
                    min="0"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">وردەکاری</label>
                  <textarea
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 font-medium text-sm"
                >
                  <Plus size={18} />
                  <span>پاشەکەوتکردن</span>
                </button>
              </form>
            </div>
          </section>
        )}

        {/* Transactions List */}
        <section className={`bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden ${activeTab === 'archive' ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
          <div className="border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 gap-4">
            <h4 className="font-bold text-slate-700 flex items-center gap-2">
              <ShoppingBag size={18} />
              مامەڵەکان
            </h4>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <select
                className="px-3 py-1.5 border border-indigo-200 bg-indigo-50/40 font-bold text-indigo-900 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-xs flex-1 sm:flex-none"
                value={dealFilterRep}
                onChange={(e) => setDealFilterRep(e.target.value)}
                title="پۆلێنکردن بەپێی مەندووب / کاشڤان"
              >
                <option value="all">هەموو مەندووبەکان</option>
                {uniqueReps.map(rep => (
                  <option key={rep} value={rep}>{rep}</option>
                ))}
              </select>
              <select
                className="px-3 py-1.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-xs flex-1 sm:flex-none"
                value={dealFilterType}
                onChange={(e) => {
                  setDealFilterType(e.target.value as any);
                  setDealFilterName('all');
                }}
              >
                <option value="all">جۆری لایەن</option>
                <option value="company">کۆمپانیاکان</option>
                <option value="market">مارکێت/کۆگا</option>
              </select>
              <select
                className="px-3 py-1.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-xs flex-1 sm:flex-none"
                value={dealFilterName}
                onChange={(e) => setDealFilterName(e.target.value)}
              >
                <option value="all">هەموو ناوەکان</option>
                {uniqueEntities.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>
          {loading ? (
            <div className="text-center py-10 text-slate-500">خەریکی هێنانە...</div>
          ) : (
            <div className="flex-1 overflow-x-auto">
                <table className="w-full text-right">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 font-semibold">بەروار</th>
                      <th className="px-4 py-3 font-semibold">جۆر</th>
                      <th className="px-4 py-3 font-semibold">ژمارە</th>
                      <th className="px-4 py-3 font-semibold">ناوی کۆمپانیا/مارکێت</th>
                      <th className="px-4 py-3 font-semibold">ئەنجامدەر</th>
                      <th className="px-4 py-3 font-semibold">بڕی پارە</th>
                      <th className="px-4 py-3 font-semibold w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-slate-50">
                    {deals.map((d, i) => (
                      <tr key={d.id + i} className="hover:bg-slate-50/50 transition">
                        <td className="px-4 py-4 text-slate-500 text-xs font-mono" dir="ltr">{format(d.date, 'yyyy-MM-dd HH:mm')}</td>
                        <td className="px-4 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            d.isDeleted ? 'bg-red-100 text-red-700' :
                            d.type.includes('مەندووب') ? 'bg-indigo-100 text-indigo-700' :
                            d.type.includes('کاشڤان') ? 'bg-sky-100 text-sky-700' :
                            d.type.includes('کۆمپانیا') ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {d.isDeleted ? 'سڕاوەتەوە' : d.type}
                          </span>
                          {d.isDeleted && <div className="text-[10px] text-red-500 mt-1">لە لایەن: {d.deletedBy}</div>}
                        </td>
                        <td className={`px-4 py-4 font-mono text-xs ${d.isDeleted ? 'text-slate-400 line-through' : 'text-slate-500'}`}>{d.invoiceNumber}</td>
                        <td className={`px-4 py-4 font-bold ${d.isDeleted ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{d.entityName}</td>
                        <td className={`px-4 py-4 ${d.isDeleted ? 'text-slate-400 line-through' : 'text-slate-600'}`}>{d.personName}</td>
                        <td className={`px-4 py-4 font-bold ${d.isDeleted ? 'text-slate-400 line-through' : 'text-emerald-600'}`} dir="ltr">{d.amount.toLocaleString()}</td>
                        <td className="px-4 py-4">
                                                  <div className="flex items-center gap-2">
                            <button
                              onClick={() => printDeal(d)}
                              className="text-blue-600 hover:bg-blue-50 p-1.5 rounded transition"
                              title="چاپکردنی تەنها ئەمە"
                            >
                              <Printer size={16} />
                            </button>
                            <button
                              onClick={() => printStatement(d.entityName)}
                              className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded transition"
                              title="کەشف حیساب"
                            >
                              <FileText size={16} />
                            </button>
                            <button
                              onClick={() => setDeletingDeal(d)}
                              className="text-red-600 hover:bg-red-50 p-1.5 rounded transition"
                              title="سڕینەوە"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {deals.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-slate-500">
                          هیچ مامەڵەیەک نییە
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
            </div>
          )}
        </section>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletingDeal}
        onClose={() => setDeletingDeal(null)}
        onConfirm={confirmDeleteDeal}
        title="سڕینەوەی مامەڵە لە حسابات"
        message="ئایا دڵنیایت لە سڕینەوەی ئەم مامەڵەیە لە سیستەمدا؟"
        details={deletingDeal ? [
          { label: 'ژمارەی وەسڵ', value: deletingDeal.invoiceNumber || '-' },
          { label: 'لایەن / ناو', value: deletingDeal.entityName || '-' },
          { label: 'بڕی پارە', value: `${(deletingDeal.amount || 0).toLocaleString()} د.ع` },
          { label: 'جۆر', value: deletingDeal.typeName || '-' }
        ] : []}
      />
    </div>
  );
}
