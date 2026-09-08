import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, getDocs, where, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { Transaction } from '../../types';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { Plus, TrendingUp, TrendingDown, DollarSign, Trash2, Calendar, Archive, Clock, ShoppingBag, Printer, FileText, PackagePlus, PackageMinus, Receipt, Building2, Store, CreditCard, Edit2, X, Search, CheckCircle, Tag, Wallet, Sparkles } from 'lucide-react';
import ConfirmModal from '../common/ConfirmModal';
import { printStatementPopup, renderReceiptHeaderHtml, printExpenseVoucherPopup, printExpensesListReportPopup } from '../../lib/statementPrinter';
import { getCompanySettings } from '../../lib/companySettings';

export const PRESET_EXPENSE_CATEGORIES = [
  'بەنزین و سووتەمەنی',
  'خواردن و میوانداری',
  'کرێی شوێن و کۆگا',
  'چاککردنەوە و سێرڤیس',
  'مووچە و دەستکەوت',
  'پێداویستی و پاککەرەوە',
  'گواستنەوە و بارکردن',
  'جۆراوجۆر'
];

export default function LedgerView() {
  const [activeTab, setActiveTab] = useState<'current' | 'expenses' | 'archive'>('current');
  const [timeFilter, setTimeFilter] = useState<'all' | 'day' | 'week' | 'month'>('day');
  
  const [archiveYear, setArchiveYear] = useState(new Date().getFullYear().toString());
  const [archiveMonth, setArchiveMonth] = useState((new Date().getMonth() + 1).toString());
  const [archiveDay, setArchiveDay] = useState('all');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [cashvanSales, setCashvanSales] = useState<any[]>([]);
  const [deletingDeal, setDeletingDeal] = useState<any | null>(null);
  const [editingDeal, setEditingDeal] = useState<any | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editEntityName, setEditEntityName] = useState('');
  const [editInvoiceNo, setEditInvoiceNo] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editReceivedBy, setEditReceivedBy] = useState('');
  
  const [loading, setLoading] = useState(true);
  
  // Expenses Tab specific state
  const [expenseFilterTime, setExpenseFilterTime] = useState<'day' | 'week' | 'month' | 'custom' | 'all'>('day');
  const [expenseCustomDate, setExpenseCustomDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [expenseSearch, setExpenseSearch] = useState('');

  // Expense entry form state
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const [expenseSuccessMsg, setExpenseSuccessMsg] = useState('');

  const [dealFilterType, setDealFilterType] = useState<'all' | 'company' | 'market' | 'warehouse' | 'expense'>('all');
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

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(expenseAmount);
    if (!expenseAmount || isNaN(num) || num <= 0) {
      alert('تکایە بڕێکی دروست بۆ خەرجی بنووسە');
      return;
    }
    if (!expenseDescription.trim()) {
      alert('تکایە هۆکاری خەرجی بنووسە');
      return;
    }

    try {
      setIsSubmittingExpense(true);
      let targetTimestamp = Date.now();
      if (expenseDate) {
        const [y, m, d] = expenseDate.split('-').map(Number);
        const now = new Date();
        const customD = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
        targetTimestamp = customD.getTime();
      }

      await addDoc(collection(db, 'transactions'), {
        type: 'expense',
        amount: num,
        description: expenseDescription.trim(),
        date: targetTimestamp,
        createdAt: Date.now()
      });

      setExpenseAmount('');
      setExpenseDescription('');
      setExpenseSuccessMsg('خەرجییەکە بە سەرکەوتوویی تۆمارکرا و یەکسەر چووە نێو دەفتەری سەرەکی');
      setTimeout(() => setExpenseSuccessMsg(''), 4000);
    } catch (error: any) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە کاتی تۆمارکردنی خەرجی: ' + error.message);
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  const expenseTransactions = useMemo(() => {
    return transactions.filter(t => t.type === 'expense');
  }, [transactions]);

  const filteredExpenses = useMemo(() => {
    const now = new Date();
    let list = expenseTransactions;

    if (expenseFilterTime === 'day') {
      const start = startOfDay(now).getTime();
      const end = endOfDay(now).getTime();
      list = list.filter(t => t.date >= start && t.date <= end);
    } else if (expenseFilterTime === 'week') {
      const start = startOfWeek(now, { weekStartsOn: 6 }).getTime();
      const end = endOfWeek(now, { weekStartsOn: 6 }).getTime();
      list = list.filter(t => t.date >= start && t.date <= end);
    } else if (expenseFilterTime === 'month') {
      const start = startOfMonth(now).getTime();
      const end = endOfMonth(now).getTime();
      list = list.filter(t => t.date >= start && t.date <= end);
    } else if (expenseFilterTime === 'custom' && expenseCustomDate) {
      const targetDate = new Date(expenseCustomDate);
      const start = startOfDay(targetDate).getTime();
      const end = endOfDay(targetDate).getTime();
      list = list.filter(t => t.date >= start && t.date <= end);
    }

    if (expenseSearch.trim()) {
      const q = expenseSearch.trim().toLowerCase();
      list = list.filter(t => 
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.amount && t.amount.toString().includes(q))
      );
    }

    return list.sort((a, b) => b.date - a.date);
  }, [expenseTransactions, expenseFilterTime, expenseCustomDate, expenseSearch]);

  const totalFilteredExpenseAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, item) => sum + (item.amount || 0), 0);
  }, [filteredExpenses]);

  const expensePeriodLabel = useMemo(() => {
    if (expenseFilterTime === 'day') return `ئەمڕۆ (${format(new Date(), 'yyyy/MM/dd')})`;
    if (expenseFilterTime === 'week') return 'ئەم هەفتەیە';
    if (expenseFilterTime === 'month') return `ئەم مانگە (${format(new Date(), 'yyyy/MM')})`;
    if (expenseFilterTime === 'custom') return `بەرواری ${expenseCustomDate}`;
    return 'هەموو کاتەکان';
  }, [expenseFilterTime, expenseCustomDate]);

  const filteredData = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date;
    let isAll = false;

    if (activeTab === 'current' || activeTab === 'expenses') {
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
      const isExp = t.type === 'expense';
      list.push({
        id: t.id,
        sourceCollection: 'transactions',
        rawItem: t,
        type: isExp ? 'خەرجی' : (t.type === 'company_paid_debt' ? 'پاردانەوەی کۆمپانیا' : (t.type === 'company_cash' || t.type === 'company_debt' ? 'وەرگرتنی کاڵا' : (t.type === 'income' ? 'داهاتی دەستی' : 'پاردانەوە/قەرز'))),
        entityType: isExp ? 'expense' : (['company_paid_debt', 'company_cash', 'company_debt'].includes(t.type) ? 'company' : 'market'),
        entityName: isExp ? (t.description || t.category || 'خەرجی') : (t.relatedEntityId || t.description),
        personName: isExp ? (t.receivedBy || 'بەڕێوەبەر') : (['company_paid_debt', 'company_cash', 'company_debt'].includes(t.type) ? 'کۆمپانیا' : 'بەڕێوەبەر'),
        amount: t.amount,
        date: t.date,
        invoiceNumber: t.invoiceNo ? `#${t.invoiceNo}` : (isExp ? `EXP-${t.id.slice(-4).toUpperCase()}` : ((['company_paid_debt', 'company_cash', 'company_debt'].includes(t.type) ? 'COMP-' : 'TRN-') + t.id.slice(-4).toUpperCase())),
        invoiceNo: t.invoiceNo,
        isDeleted: false,
        deletedBy: ''
      });
    });
    fOrders.forEach(o => {
      const inv = o.invoiceId || o.invoiceNo;
      list.push({
        id: o.id,
        sourceCollection: 'orders',
        rawItem: o,
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
        sourceCollection: 'cashvan_sales',
        rawItem: c,
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
      if (dealFilterType === 'expense') {
        list = list.filter(d => d.entityType === 'expense' || d.type === 'خەرجی');
      } else {
        list = list.filter(d => d.entityType === dealFilterType || d.type.includes(dealFilterType === 'company' ? 'کۆمپانیا' : ''));
      }
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

  const handleStartEditDeal = (deal: any) => {
    setEditingDeal(deal);
    setEditAmount((deal.amount || 0).toString());
    setEditEntityName(deal.entityName || '');
    setEditInvoiceNo(deal.invoiceNo || '');
    setEditDescription(deal.rawItem?.description || deal.rawItem?.notes || '');
    setEditCategory(deal.rawItem?.category || 'جۆراوجۆر');
    setEditReceivedBy(deal.rawItem?.receivedBy || deal.personName || '');
  };

  const handleSaveEditDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDeal) return;
    try {
      const numAmount = Number(editAmount) || 0;
      const { id, sourceCollection, invoiceNo } = editingDeal;

      if (sourceCollection === 'orders') {
        await updateDoc(doc(db, 'orders', id), {
          totalAmount: numAmount,
          marketName: editEntityName,
          invoiceNo: editInvoiceNo,
          invoiceId: editInvoiceNo,
          notes: editDescription
        });
        if (invoiceNo) {
          const qTr = query(collection(db, 'transactions'), where('invoiceNo', '==', invoiceNo));
          const snapTr = await getDocs(qTr);
          for (const d of snapTr.docs) {
            await updateDoc(doc(db, 'transactions', d.id), {
              amount: numAmount,
              relatedEntityId: editEntityName,
              invoiceNo: editInvoiceNo
            });
          }
        }
      } else if (sourceCollection === 'cashvan_sales') {
        await updateDoc(doc(db, 'cashvan_sales', id), {
          totalAmount: numAmount,
          marketName: editEntityName,
          invoiceNo: editInvoiceNo,
          invoiceId: editInvoiceNo,
          notes: editDescription
        });
        if (invoiceNo) {
          const qTr = query(collection(db, 'transactions'), where('invoiceNo', '==', invoiceNo));
          const snapTr = await getDocs(qTr);
          for (const d of snapTr.docs) {
            await updateDoc(doc(db, 'transactions', d.id), {
              amount: numAmount,
              relatedEntityId: editEntityName,
              invoiceNo: editInvoiceNo
            });
          }
        }
      } else {
        await updateDoc(doc(db, 'transactions', id), {
          amount: numAmount,
          relatedEntityId: editEntityName,
          invoiceNo: editInvoiceNo,
          description: editDescription,
          category: editCategory || (editingDeal.rawItem?.category || 'جۆراوجۆر'),
          receivedBy: editReceivedBy || (editingDeal.rawItem?.receivedBy || 'بەڕێوەبەر')
        });
      }

      setEditingDeal(null);
      alert('مامەڵەکە بە سەرکەوتوویی نوێکرایەوە');
    } catch (err: any) {
      console.error(err);
      alert('هەڵەیەک ڕوویدا لە کاتی پاشەکەوتکردنی دەستکاری: ' + err.message);
    }
  };

  const confirmDeleteDeal = async () => {
    if (!deletingDeal) return;
    try {
      const { id, sourceCollection, invoiceNo } = deletingDeal;

      if (sourceCollection === 'orders') {
        await deleteDoc(doc(db, 'orders', id));
        if (invoiceNo) {
          const qTr = query(collection(db, 'transactions'), where('invoiceNo', '==', invoiceNo));
          const snapTr = await getDocs(qTr);
          for (const d of snapTr.docs) {
            await deleteDoc(doc(db, 'transactions', d.id));
          }
        }
      } else if (sourceCollection === 'cashvan_sales') {
        await deleteDoc(doc(db, 'cashvan_sales', id));
        if (invoiceNo) {
          const qTr = query(collection(db, 'transactions'), where('invoiceNo', '==', invoiceNo));
          const snapTr = await getDocs(qTr);
          for (const d of snapTr.docs) {
            await deleteDoc(doc(db, 'transactions', d.id));
          }
        }
      } else {
        await deleteDoc(doc(db, 'transactions', id));
      }
      setDeletingDeal(null);
      alert('مامەڵەکە بە سەرکەوتوویی سڕایەوە');
    } catch (error: any) {
      console.error('Delete error in ledger:', error);
      alert('هەڵەیەک ڕوویدا لە کاتی سڕینەوەی مامەڵە: ' + error.message);
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
    if (d.rawItem?.type === 'expense' || d.type === 'خەرجی' || d.type === 'خەرجی دەستی') {
      printExpenseVoucherPopup(d.rawItem);
      return;
    }

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
          ${renderReceiptHeaderHtml({
            title: 'پسوڵەی دەفتەر حسابات',
            invoiceNo: d.invoiceNumber,
            date: d.date
          })}
          
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
          onClick={() => setActiveTab('expenses')}
          className={`px-4 py-3 font-bold text-sm flex items-center gap-2 border-b-2 transition ${
            activeTab === 'expenses' ? 'border-rose-600 text-rose-600 bg-rose-50/60 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Receipt size={18} />
          <span>خەرجییەکان</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === 'expenses' ? 'bg-rose-200 text-rose-800' : 'bg-slate-100 text-slate-600'}`}>
            {expenseTransactions.length}
          </span>
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

      {/* Main Ledger Content (Current & Archive) */}
      {(activeTab === 'current' || activeTab === 'archive') && (
        <>
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

        {/* کۆی خەرجی - Clickable to open Expenses tab */}
        <div 
          onClick={() => setActiveTab('expenses')}
          className="bg-white p-4 rounded-2xl border border-rose-200 shadow-sm flex items-center gap-3.5 hover:shadow-md transition cursor-pointer hover:border-rose-400 group"
          title="کرتە بکە بۆ چوونە سەر تابی خەرجییەکان"
        >
          <div className="p-3 bg-rose-100 text-rose-600 rounded-xl shrink-0 group-hover:scale-110 transition-transform">
            <Receipt size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500 mb-0.5 font-medium truncate flex items-center justify-between">
              <span>کۆی خەرجی</span>
              <span className="text-[10px] text-rose-500 font-bold group-hover:underline">بینین &larr;</span>
            </div>
            <div className="text-lg font-bold text-rose-600 tracking-tight" dir="ltr">{totalExpense.toLocaleString()}</div>
            <div className="text-[11px] text-rose-500/80 mt-0.5 truncate font-medium">کرتە بکە بۆ بەڕێوەبردن</div>
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

      <div className="w-full">
        {/* Transactions List */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden w-full">
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
                className="px-3 py-1.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-xs flex-1 sm:flex-none font-bold"
                value={dealFilterType}
                onChange={(e) => {
                  setDealFilterType(e.target.value as any);
                  setDealFilterName('all');
                }}
              >
                <option value="all">هەموو جۆرەکان</option>
                <option value="company">کۆمپانیاکان</option>
                <option value="market">مارکێت/کۆگا</option>
                <option value="expense">خەرجییەکان</option>
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
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            d.isDeleted ? 'bg-red-100 text-red-700' :
                            d.type.includes('خەرجی') ? 'bg-rose-100 text-rose-800 border border-rose-200' :
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
                        <td className={`px-4 py-4 font-bold ${
                          d.isDeleted ? 'text-slate-400 line-through' : 
                          d.type.includes('خەرجی') ? 'text-rose-600' : 'text-emerald-600'
                        }`} dir="ltr">
                          {d.type.includes('خەرجی') ? `-${d.amount.toLocaleString()}` : d.amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => printDeal(d)}
                              className="text-blue-600 hover:bg-blue-50 p-1.5 rounded transition"
                              title="چاپکردنی وەسڵ"
                            >
                              <Printer size={16} />
                            </button>
                            {!d.type.includes('خەرجی') && (
                              <button
                                onClick={() => printStatement(d.entityName)}
                                className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded transition"
                                title="کەشف حیساب"
                              >
                                <FileText size={16} />
                              </button>
                            )}
                            <button
                              onClick={() => handleStartEditDeal(d)}
                              className="text-amber-600 hover:bg-amber-50 p-1.5 rounded transition"
                              title="دەستکاریکردنی مامەڵە"
                            >
                              <Edit2 size={16} />
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
    </>
  )}

      {/* Expenses Tab View */}
      {activeTab === 'expenses' && (
        <div className="space-y-6">
          {/* Expenses Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Filtered Expense */}
            <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm flex items-center gap-4">
              <div className="p-3.5 bg-rose-100 text-rose-600 rounded-xl shrink-0">
                <Receipt size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-slate-500 font-medium mb-1">کۆی خەرجی ({expensePeriodLabel})</div>
                <div className="text-xl font-bold text-rose-600 tracking-tight" dir="ltr">
                  {totalFilteredExpenseAmount.toLocaleString()} <span className="text-xs font-normal text-slate-500">دینار</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                  {filteredExpenses.length} پسوولە / تۆمار
                </div>
              </div>
            </div>

            {/* All-time Total Expense */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3.5 bg-slate-100 text-slate-600 rounded-xl shrink-0">
                <Wallet size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-slate-500 font-medium mb-1">کۆی گشتی خەرجی (هەمووی)</div>
                <div className="text-xl font-bold text-slate-800 tracking-tight" dir="ltr">
                  {expenseTransactions.reduce((s, x) => s + (x.amount || 0), 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">دینار</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  کۆی گشتی {expenseTransactions.length} خەرجی تۆمارکراو
                </div>
              </div>
            </div>

            {/* Quick Actions / Print Report */}
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 p-5 rounded-2xl border border-indigo-200 shadow-sm flex flex-col justify-between sm:col-span-2">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-indigo-950 text-sm flex items-center gap-2">
                    <Printer size={18} className="text-indigo-600" />
                    چاپکردنی ڕاپۆرتی خەرجییەکان
                  </h4>
                  <p className="text-xs text-indigo-700/80 mt-1">
                    چاپکردنی خشتەی ڕاپۆرتی خەرجییە فلتەرکراوەکان بەپێی بەروار
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    printExpensesListReportPopup(filteredExpenses, expensePeriodLabel);
                  }}
                  disabled={filteredExpenses.length === 0}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-sm cursor-pointer"
                >
                  <Printer size={16} />
                  <span>چاپکردنی ڕاپۆرت ({filteredExpenses.length})</span>
                </button>
              </div>
            </div>
          </div>

          {/* Expenses Two-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Add New Expense Form (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-rose-50 to-white flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold">
                      <Plus size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">تۆمارکردنی خەرجی نوێ</h3>
                      <p className="text-[11px] text-slate-400">یەکسەر لە دەفتەر حساباتی سەرەکیش دەردەکەوێت</p>
                    </div>
                  </div>
                </div>

                {expenseSuccessMsg && (
                  <div className="m-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                    <span>{expenseSuccessMsg}</span>
                  </div>
                )}

                <form onSubmit={handleAddExpense} className="p-4 space-y-4">
                  {/* Amount */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      بڕی پارەی خەرجی (دینار) <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="نموونە: 25000"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none text-base font-bold text-slate-800"
                        value={expenseAmount}
                        onChange={(e) => setExpenseAmount(e.target.value)}
                        dir="ltr"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">IQD</span>
                    </div>
                  </div>

                  {/* Description / Reason */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      وردەکاری و هۆکاری خەرجی <span className="text-rose-600">*</span>
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="هۆکاری خەرجی بنووسە، وەک: کڕینی بەنزین بۆ ئۆتۆمبێل، کرێی بار، نانخواردن..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500"
                      value={expenseDescription}
                      onChange={(e) => setExpenseDescription(e.target.value)}
                    />
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      بەرواری خەرجی
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmittingExpense}
                    className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    <Plus size={18} />
                    <span>{isSubmittingExpense ? 'خەریکی تۆمارکردنە...' : 'پاشەکەوتکردنی خەرجی'}</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column: Expenses Table & Filters (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                {/* Header & Filter Controls */}
                <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                      <Receipt size={18} className="text-rose-600" />
                      <span>لیستی خەرجییەکان</span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-bold">
                        {filteredExpenses.length}
                      </span>
                    </h4>
                    
                    {/* Time Filter Buttons: day / week / month / all / custom */}
                    <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setExpenseFilterTime('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          expenseFilterTime === 'all'
                            ? 'bg-rose-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        هەمووی
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpenseFilterTime('day')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          expenseFilterTime === 'day'
                            ? 'bg-rose-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        ئەمڕۆ
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpenseFilterTime('week')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          expenseFilterTime === 'week'
                            ? 'bg-rose-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        ئەم هەفتەیە
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpenseFilterTime('month')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          expenseFilterTime === 'month'
                            ? 'bg-rose-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        ئەم مانگە
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpenseFilterTime('custom')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          expenseFilterTime === 'custom'
                            ? 'bg-rose-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        بەرواری دیاریکراو
                      </button>
                    </div>
                  </div>

                  {/* Secondary Filters: Custom Date and Search */}
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    {expenseFilterTime === 'custom' && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500 font-bold">بەروار:</label>
                        <input
                          type="date"
                          value={expenseCustomDate}
                          onChange={(e) => setExpenseCustomDate(e.target.value)}
                          className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500"
                        />
                      </div>
                    )}

                    <div className="flex-1 min-w-[200px] relative">
                      <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="گەڕان لە خەرجی..."
                        value={expenseSearch}
                        onChange={(e) => setExpenseSearch(e.target.value)}
                        className="w-full pr-8 pl-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Expenses Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-right">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-3 font-semibold">بەروار</th>
                        <th className="px-4 py-3 font-semibold">وردەکاری و هۆکاری خەرجی</th>
                        <th className="px-4 py-3 font-semibold">بڕی خەرجی</th>
                        <th className="px-4 py-3 font-semibold text-center w-24">کردەوەکان</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-100">
                      {filteredExpenses.map((exp) => (
                        <tr key={exp.id} className="hover:bg-rose-50/30 transition">
                          <td className="px-4 py-3 text-slate-500 text-xs font-mono" dir="ltr">
                            {format(exp.date, 'yyyy-MM-dd HH:mm')}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800 text-xs max-w-md">
                            {exp.description}
                          </td>
                          <td className="px-4 py-3 font-bold text-rose-600 text-sm" dir="ltr">
                            {exp.amount.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">IQD</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => printExpenseVoucherPopup(exp)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                title="چاپکردنی پسوولەی خەرجی"
                              >
                                <Printer size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeletingDeal({
                                    id: exp.id,
                                    type: 'خەرجی',
                                    entityName: exp.description || 'خەرجی',
                                    rawItem: { ...exp, type: 'expense' }
                                  });
                                }}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="سڕینەوەی خەرجی"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredExpenses.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center py-12 text-slate-400">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <Receipt size={36} className="text-slate-300" />
                              <span className="text-sm font-medium">هیچ خەرجییەک لەم بەروار یان فلتەرەدا نەدۆزرایەوە</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer Totals */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs text-slate-500 font-medium">
                    کۆی گشتی خەرجی لەم فلتەرەدا:
                  </div>
                  <div className="text-base font-bold text-rose-600" dir="ltr">
                    {totalFilteredExpenseAmount.toLocaleString()} <span className="text-xs text-slate-500 font-normal">دیناری عێراقی</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Deal Modal */}
      {editingDeal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-amber-600 to-amber-700 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Edit2 size={20} />
                <h3 className="font-bold text-lg">دەستکاریکردنی مامەڵە</h3>
              </div>
              <button
                onClick={() => setEditingDeal(null)}
                className="text-white/80 hover:text-white transition p-1 hover:bg-white/10 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditDeal} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  ناوی لایەن / مارکێت / کۆمپانیا
                </label>
                <input
                  type="text"
                  required
                  value={editEntityName}
                  onChange={(e) => setEditEntityName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  ژمارەی وەسڵ (فاتورە)
                </label>
                <input
                  type="text"
                  value={editInvoiceNo}
                  onChange={(e) => setEditInvoiceNo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none text-sm font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  بڕی پارە (د.ع)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none text-sm font-bold font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  تێبینی / ڕوونکردنەوە
                </label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none text-sm"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md shadow-amber-600/20 transition active:scale-[0.98]"
                >
                  پاشەکەوتکردنی گۆڕانکاری
                </button>
                <button
                  type="button"
                  onClick={() => setEditingDeal(null)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  پاشگەزبوونەوە
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
