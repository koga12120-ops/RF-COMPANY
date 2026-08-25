import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { Transaction } from '../../types';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { Plus, Trash2, Printer, FileText, Calendar, Search, DollarSign, Clock, X, TrendingUp } from 'lucide-react';
import ConfirmModal from '../common/ConfirmModal';
import { printStatementPopup } from '../../lib/statementPrinter';

export default function CashView({ type = 'cash', targetName = 'مارکێت' }: { type?: 'cash' | 'company_cash', targetName?: string }) {
  const [cashSales, setCashSales] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingSale, setDeletingSale] = useState<Transaction | null>(null);

  // Filters
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | 'this_week' | 'this_month' | 'custom_day' | 'range'>('all');
  const [selectedDay, setSelectedDay] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState('');

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [relatedEntityId, setRelatedEntityId] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);

  useEffect(() => {
    const isCompany = type.includes('company');
    const q = query(collection(db, 'transactions'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const salesData: Transaction[] = [];
        snapshot.forEach((doc) => {
          const d = { id: doc.id, ...doc.data() } as Transaction;
          if (isCompany) {
            if (d.type === 'company_cash') {
              salesData.push(d);
            }
          } else {
            if (d.type === 'cash') {
              salesData.push(d);
            }
          }
        });
        
        setCashSales(salesData.sort((a, b) => b.date - a.date));
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'transactions');
      }
    );

    const collectionName = type.includes('company') ? 'companies' : 'markets';
    const qSuggestions = query(collection(db, collectionName));
    const unsubSuggestions = onSnapshot(
      qSuggestions,
      (snapshot) => {
        const data: any[] = [];
        snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
        setSuggestions(data);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, collectionName);
      }
    );

    return () => {
      unsubscribe();
      unsubSuggestions();
    };
  }, [type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description) return;

    try {
      if (relatedEntityId && !suggestions.find(s => s.name === relatedEntityId)) {
        const collectionName = type.includes('company') ? 'companies' : 'markets';
        const docData: any = { name: relatedEntityId, location: '', phone: '', createdAt: Date.now() };
        if (collectionName === 'markets') docData.type = 'market';
        if (collectionName === 'companies') docData.type = 'warehouse';
        await addDoc(collection(db, collectionName), docData);
      }

      const trnData: any = {
        type,
        amount: Number(amount),
        description,
        relatedEntityId, // Name of the shop/person
        date: Date.now()
      };
      if (invoiceNo.trim()) {
        trnData.invoiceNo = invoiceNo.trim();
      }

      await addDoc(collection(db, 'transactions'), trnData);
      setAmount('');
      setDescription('');
      setInvoiceNo('');
      setRelatedEntityId('');
    } catch (error) {
      console.error(error);
    }
  };

  const confirmDeleteSale = async () => {
    if (!deletingSale) return;
    try {
      await deleteDoc(doc(db, 'transactions', deletingSale.id));
      setDeletingSale(null);
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە کاتی سڕینەوە');
    }
  };

  const isDateInFilter = (timestamp: number) => {
    if (filterPeriod === 'all') return true;
    const now = new Date();
    const date = new Date(timestamp);
    if (filterPeriod === 'today') {
      return isWithinInterval(date, { start: startOfDay(now), end: endOfDay(now) });
    }
    if (filterPeriod === 'this_week') {
      return isWithinInterval(date, { start: startOfWeek(now, { weekStartsOn: 6 }), end: endOfWeek(now, { weekStartsOn: 6 }) });
    }
    if (filterPeriod === 'this_month') {
      return isWithinInterval(date, { start: startOfMonth(now), end: endOfMonth(now) });
    }
    if (filterPeriod === 'custom_day') {
      if (!selectedDay) return true;
      const target = new Date(selectedDay);
      return isWithinInterval(date, { start: startOfDay(target), end: endOfDay(target) });
    }
    if (filterPeriod === 'range') {
      if (!startDate && !endDate) return true;
      const s = startDate ? startOfDay(new Date(startDate)) : new Date(0);
      const e = endDate ? endOfDay(new Date(endDate)) : new Date(8640000000000000);
      return isWithinInterval(date, { start: s, end: e });
    }
    return true;
  };

  const filteredSales = useMemo(() => {
    return cashSales.filter(sale => {
      const matchDate = isDateInFilter(sale.date);
      const matchSearch = !searchQuery.trim() || 
        (sale.relatedEntityId && sale.relatedEntityId.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (sale.description && sale.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (sale.invoiceNo && sale.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchDate && matchSearch;
    });
  }, [cashSales, filterPeriod, selectedDay, startDate, endDate, searchQuery]);

  const totalFilteredCash = useMemo(() => {
    return filteredSales.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  }, [filteredSales]);

  const avgCash = filteredSales.length > 0 ? Math.round(totalFilteredCash / filteredSales.length) : 0;


  const printTransaction = (transaction: Transaction) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const isCompany = transaction.type.includes('company');
    const roleTitle = isCompany ? 'کۆمپانیا' : 'مارکێت';
    
    let typeLabel = '';
    if (transaction.type.includes('debt')) typeLabel = 'قەرز';
    if (transaction.type.includes('paid')) typeLabel = 'واسڵکراو';
    if (transaction.type === 'cash' || transaction.type === 'company_cash') typeLabel = 'نەقد';

    const html = `
      <html dir="rtl">
        <head>
          <title>پسوڵەی پارە - ${transaction.relatedEntityId}</title>
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
            <div class="subtitle">پسوڵەی وەرگرتن / پێدان</div>
          </div>
          
          <div class="details">
            <div class="row">
              <span class="label">جۆری مامەڵە:</span>
              <span>${typeLabel}</span>
            </div>
            <div class="row">
              <span class="label">ناوی ${roleTitle}:</span>
              <span>${transaction.relatedEntityId}</span>
            </div>
            ${transaction.invoiceNo ? `
            <div class="row">
              <span class="label">ژمارەی سەر وەسڵ:</span>
              <span dir="ltr">#${transaction.invoiceNo}</span>
            </div>` : ''}
            <div class="row">
              <span class="label">بەروار:</span>
              <span dir="ltr">${format(transaction.date, 'yyyy-MM-dd HH:mm')}</span>
            </div>
            <div class="row">
              <span class="label">وردەکاری:</span>
              <span>${transaction.description || 'بێ وردەکاری'}</span>
            </div>
          </div>
          
          <div class="amount" dir="ltr">
            ${(transaction.amount || 0).toLocaleString()} د.ع
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

  const printStatement = async (entityName: string) => {
    if (!entityName) return;
    const q = query(collection(db, 'transactions'), where('relatedEntityId', '==', entityName));
    const snap = await getDocs(q);
    const allTrans: Transaction[] = [];
    snap.forEach(d => allTrans.push({ id: d.id, ...d.data() } as Transaction));
    printStatementPopup(entityName, allTrans);
  };
  return (
    <div className="space-y-6">
      {/* Top Filter and Search Bar */}
      <section className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="text-emerald-600" size={20} />
            <span className="font-bold text-slate-800 text-sm">فلتەری بەروار و گەڕان</span>
          </div>
          
          <div className="w-full md:w-72 relative">
            <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder={`گەڕان بەپێی ناوی ${targetName} یان وردەکاری...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Quick Period Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterPeriod('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              filterPeriod === 'all'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            هەموو کات
          </button>
          <button
            onClick={() => setFilterPeriod('today')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              filterPeriod === 'today'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ئەمڕۆ
          </button>
          <button
            onClick={() => setFilterPeriod('this_week')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              filterPeriod === 'this_week'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ئەم هەفتەیە
          </button>
          <button
            onClick={() => setFilterPeriod('this_month')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              filterPeriod === 'this_month'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ئەم مانگە
          </button>
          <button
            onClick={() => setFilterPeriod('custom_day')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              filterPeriod === 'custom_day'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            بەرواری دیاریکراو
          </button>
          <button
            onClick={() => setFilterPeriod('range')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              filterPeriod === 'range'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            مەودای بەروار
          </button>
        </div>

        {/* Date Pickers for Custom Day or Range */}
        {filterPeriod === 'custom_day' && (
          <div className="flex items-center gap-3 bg-emerald-50/70 p-3 rounded-xl border border-emerald-100 text-xs">
            <span className="font-bold text-emerald-900">بەروار هەڵبژێرە:</span>
            <input
              type="date"
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="px-3 py-1.5 bg-white border border-emerald-200 rounded-lg outline-none font-mono text-emerald-900"
            />
          </div>
        )}

        {filterPeriod === 'range' && (
          <div className="flex flex-wrap items-center gap-3 bg-emerald-50/70 p-3 rounded-xl border border-emerald-100 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-emerald-900">لە بەرواری:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 bg-white border border-emerald-200 rounded-lg outline-none font-mono text-emerald-900"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-emerald-900">تا بەرواری:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 bg-white border border-emerald-200 rounded-lg outline-none font-mono text-emerald-900"
              />
            </div>
          </div>
        )}
      </section>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* 1. Total Cash */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-sm flex items-center gap-3.5 hover:shadow-md transition">
          <div className="p-3.5 bg-emerald-100 text-emerald-700 rounded-xl shrink-0">
            <DollarSign size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500 mb-0.5 font-medium truncate">
              کۆی نەقد ({filterPeriod === 'all' ? 'هەموو کات' : 'بەپێی بەروار'})
            </div>
            <div className="text-xl font-bold text-emerald-600 tracking-tight" dir="ltr">
              {totalFilteredCash.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">د.ع</div>
          </div>
        </div>

        {/* 2. Count of Transactions */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5 hover:shadow-md transition">
          <div className="p-3.5 bg-slate-100 text-slate-700 rounded-xl shrink-0">
            <Clock size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500 mb-0.5 font-medium truncate">
              ژمارەی تۆمارەکان
            </div>
            <div className="text-xl font-bold text-slate-800 tracking-tight" dir="ltr">
              {filteredSales.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">مامەڵەی نەقد</div>
          </div>
        </div>

        {/* 3. Average Transaction */}
        <div className="bg-white p-4 rounded-2xl border border-indigo-200/80 shadow-sm flex items-center gap-3.5 hover:shadow-md transition">
          <div className="p-3.5 bg-indigo-100 text-indigo-700 rounded-xl shrink-0">
            <TrendingUp size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500 mb-0.5 font-medium truncate">
              تێکڕای مامەڵە
            </div>
            <div className="text-xl font-bold text-indigo-600 tracking-tight" dir="ltr">
              {avgCash.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">بۆ هەر مامەڵەیەک</div>
          </div>
        </div>
      </div>

      {/* Add Cash Form */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold mb-4 text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">تۆمارکردنی نەقد</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-sm text-slate-600 mb-1">{`ناوی ${targetName}`}</label>
            <input
              type="text"
              required
              list={`suggestions-cash-${type}`}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              value={relatedEntityId}
              onChange={(e) => setRelatedEntityId(e.target.value)}
            />
            <datalist id={`suggestions-cash-${type}`}>
              {suggestions.map(s => <option key={s.id} value={s.name} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">ژمارەی وەسڵ / دەفتەر</label>
            <input
              type="text"
              placeholder="دەفتەر وەسڵ..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              dir="ltr"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-slate-600 mb-1">وردەکاری (بۆ نموونە: بڕی کاڵاکان)</label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
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
          <div className="md:col-span-5 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 font-medium text-sm h-10"
            >
              <Plus size={18} />
              <span>تۆمارکردن</span>
            </button>
          </div>
        </form>
      </section>

      {/* Cash Table */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
          <h4 className="font-bold text-slate-700 flex items-center gap-2">💵 لیستی نەقدەکان</h4>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
              پیشاندانی {filteredSales.length} لە {cashSales.length} تۆمار
            </span>
          </div>
        </div>
        
        {loading ? (
          <div className="text-center py-10 text-slate-500">خەریکی هێنانە...</div>
        ) : (
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">ناو</th>
                  <th className="px-4 py-3 font-semibold">وردەکاری</th>
                  <th className="px-4 py-3 font-semibold">بڕی پارە</th>
                  <th className="px-4 py-3 font-semibold">بەروار</th>
                  <th className="px-4 py-3 font-semibold w-16"></th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-50">
                {filteredSales.map(sale => (
                  <tr key={sale.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-4 font-medium text-slate-900">{sale.relatedEntityId}</td>
                    <td className="px-4 py-4 text-slate-600">
                      <div>{sale.description}</div>
                      {sale.invoiceNo && (
                        <span className="inline-block mt-0.5 text-[11px] font-mono bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200" dir="ltr">
                          وەسڵ: #{sale.invoiceNo}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 font-bold text-green-600" dir="ltr">{sale.amount.toLocaleString()}</td>
                    <td className="px-4 py-4 text-slate-500 text-xs font-mono" dir="ltr">{format(sale.date, 'yyyy-MM-dd HH:mm')}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => printTransaction(sale)}
                          className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                          title="چاپکردنی تەنها ئەمە"
                        >
                          <Printer size={16} />
                        </button>
                        <button
                          onClick={() => printStatement(sale.relatedEntityId || sale.description)}
                          className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition"
                          title="کەشف حیساب"
                        >
                          <FileText size={16} />
                        </button>
                        <button
                          onClick={() => setDeletingSale(sale)}
                          className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                          title="سڕینەوە"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredSales.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-500">
                      هیچ تۆمارێکی نەقدی بەپێی ئەم فلتەرە نەدۆزرایەوە
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletingSale}
        onClose={() => setDeletingSale(null)}
        onConfirm={confirmDeleteSale}
        title="سڕینەوەی تۆماری نەقد"
        message="ئایا دڵنیایت لە سڕینەوەی ئەم تۆمارەی نەقد؟"
        details={deletingSale ? [
          { label: targetName, value: deletingSale.relatedEntityId || '-' },
          { label: 'بڕی پارە', value: `${(deletingSale.amount || 0).toLocaleString()} د.ع` },
          { label: 'وردەکاری', value: deletingSale.description || '-' }
        ] : []}
      />
    </div>
  );
}
