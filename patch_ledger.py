import re

content = """import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Transaction } from '../../types';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { Plus, TrendingUp, TrendingDown, DollarSign, Trash2, Calendar, Archive, Clock } from 'lucide-react';

export default function LedgerView() {
  const [activeTab, setActiveTab] = useState<'current' | 'archive'>('current');
  const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month'>('day');
  
  const [archiveYear, setArchiveYear] = useState(new Date().getFullYear().toString());
  const [archiveMonth, setArchiveMonth] = useState((new Date().getMonth() + 1).toString());

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [cashvanSales, setCashvanSales] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const qTrans = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const unsubTrans = onSnapshot(qTrans, (snapshot) => {
      const transData: Transaction[] = [];
      snapshot.forEach((doc) => {
        transData.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      setTransactions(transData);
      setLoading(false);
    });
    
    const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const ords: any[] = [];
      snapshot.forEach(doc => {
        ords.push({ id: doc.id, ...doc.data() });
      });
      setOrders(ords);
    });
    
    const unsubCashvan = onSnapshot(collection(db, 'cashvan_sales'), (snapshot) => {
      const cvs: any[] = [];
      snapshot.forEach(doc => {
        cvs.push({ id: doc.id, ...doc.data() });
      });
      setCashvanSales(cvs);
    });

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

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'transactions', id));
    } catch (error) {
      console.error(error);
    }
  };

  const filteredData = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date;

    if (activeTab === 'current') {
      if (timeFilter === 'day') {
        start = startOfDay(now);
        end = endOfDay(now);
      } else if (timeFilter === 'week') {
        start = startOfWeek(now, { weekStartsOn: 6 }); // Assuming week starts on Saturday
        end = endOfWeek(now, { weekStartsOn: 6 });
      } else {
        start = startOfMonth(now);
        end = endOfMonth(now);
      }
    } else {
      // Archive
      const y = parseInt(archiveYear);
      const m = parseInt(archiveMonth) - 1;
      start = startOfMonth(new Date(y, m, 1));
      end = endOfMonth(new Date(y, m, 1));
    }

    const interval = { start, end };

    const t = transactions.filter(tr => isWithinInterval(tr.date, interval));
    const o = orders.filter(ord => ord.status === 'completed' && isWithinInterval(ord.timestamp, interval));
    const c = cashvanSales.filter(cv => cv.status === 'accounted' && isWithinInterval(cv.timestamp, interval));

    return { t, o, c };
  }, [activeTab, timeFilter, archiveYear, archiveMonth, transactions, orders, cashvanSales]);

  const { t: fTrans, o: fOrders, c: fCashvan } = filteredData;

  const calculateTotal = (data: Transaction[], filterType: Transaction['type'][]) => {
    return data
      .filter(tr => filterType.includes(tr.type))
      .reduce((acc, curr) => acc + curr.amount, 0);
  };

  const totalIncome = calculateTotal(fTrans, ['income', 'cash', 'paid_debt']);
  const totalExpense = calculateTotal(fTrans, ['expense', 'company_cash', 'company_paid_debt', 'return_expense']);
  const manualExpenses = calculateTotal(fTrans, ['expense']);
  const returnProfitsLost = fTrans.filter(tr => tr.type === 'return_expense').reduce((acc, tr) => acc + (tr.profitReversal || 0), 0);

  const ordersProfit = fOrders.reduce((acc, ord) => acc + (ord.totalProfit || 0), 0);
  const ordersTotal = fOrders.reduce((acc, ord) => acc + (ord.totalAmount || 0), 0);

  const cashvanProfit = fCashvan.reduce((acc, cv) => acc + (cv.totalProfit || 0), 0);
  const cashvanTotal = fCashvan.reduce((acc, cv) => acc + (cv.totalAmount || 0), 0);

  const netProfit = totalIncome - totalExpense;
  const realProfit = ordersProfit + cashvanProfit - manualExpenses - returnProfitsLost;
  const totalSalesVolume = ordersTotal + cashvanTotal;

  // Generate years from 2024 to 2035
  const years = Array.from({ length: 12 }, (_, i) => 2024 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

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
              onClick={() => setTimeFilter('day')}
              className={`px-4 py-2 rounded-lg font-bold text-sm flex-1 md:flex-none transition ${timeFilter === 'day' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              ڕۆژانە
            </button>
            <button
              onClick={() => setTimeFilter('week')}
              className={`px-4 py-2 rounded-lg font-bold text-sm flex-1 md:flex-none transition ${timeFilter === 'week' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              هەفتانە
            </button>
            <button
              onClick={() => setTimeFilter('month')}
              className={`px-4 py-2 rounded-lg font-bold text-sm flex-1 md:flex-none transition ${timeFilter === 'month' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              مانگانە
            </button>
          </div>
        ) : (
          <div className="flex gap-4 w-full md:w-auto">
            <div className="flex-1 md:flex-none">
              <label className="block text-xs text-slate-500 mb-1">ساڵ</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
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
                className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                value={archiveMonth}
                onChange={(e) => setArchiveMonth(e.target.value)}
              >
                {months.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition">
          <div className="p-4 bg-indigo-100 text-indigo-600 rounded-full shrink-0">
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="text-sm text-slate-500 mb-1 font-medium">قازانجی سافی</div>
            <div className="text-2xl font-bold text-indigo-600" dir="ltr">{realProfit.toLocaleString()}</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition">
          <div className="p-4 bg-emerald-100 text-emerald-600 rounded-full shrink-0">
            <DollarSign size={24} />
          </div>
          <div>
            <div className="text-sm text-slate-500 mb-1 font-medium">باڵانسی نەقد</div>
            <div className="text-2xl font-bold text-emerald-600" dir="ltr">{netProfit.toLocaleString()}</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition">
          <div className="p-4 bg-red-100 text-red-600 rounded-full shrink-0">
            <TrendingDown size={24} />
          </div>
          <div>
            <div className="text-sm text-slate-500 mb-1 font-medium">کۆی خەرجی</div>
            <div className="text-2xl font-bold text-slate-800" dir="ltr">{totalExpense.toLocaleString()}</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition">
          <div className="p-4 bg-green-100 text-green-600 rounded-full shrink-0">
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="text-sm text-slate-500 mb-1 font-medium">کۆی فرۆش</div>
            <div className="text-2xl font-bold text-slate-800" dir="ltr">{totalSalesVolume.toLocaleString()}</div>
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
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h4 className="font-bold text-slate-700 flex items-center gap-2">تۆمارەکان</h4>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-bold">
              {fTrans.length} دانە
            </span>
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
                    <th className="px-4 py-3 font-semibold">وردەکاری</th>
                    <th className="px-4 py-3 font-semibold">بڕ</th>
                    <th className="px-4 py-3 font-semibold w-16"></th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-slate-50">
                  {fTrans.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-4 text-slate-500 text-xs font-mono" dir="ltr">{format(t.date, 'yyyy-MM-dd HH:mm')}</td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          ['income', 'cash', 'paid_debt'].includes(t.type) ? 'bg-green-100 text-green-700' : 
                          ['expense', 'company_cash', 'company_paid_debt', 'return_expense'].includes(t.type) ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {t.type === 'income' ? 'داهات' :
                           t.type === 'expense' ? 'خەرجی' :
                           t.type === 'return_expense' ? 'گەڕانەوە' :
                           t.type === 'cash' ? 'نەقد' :
                           t.type === 'paid_debt' ? 'واسڵکراو' : 
                           t.type === 'company_cash' ? 'نەقدی کۆمپانیا' :
                           t.type === 'company_paid_debt' ? 'پاردانەوە' :
                           t.type === 'company_debt' ? 'قەرزی کۆمپانیا' : 'قەرز'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-900 font-medium">{t.description}</td>
                      <td className="px-4 py-4 font-bold" dir="ltr">
                        <span className={['income', 'cash', 'paid_debt'].includes(t.type) ? 'text-green-600' : ['expense', 'company_cash', 'company_paid_debt', 'return_expense'].includes(t.type) ? 'text-red-600' : 'text-slate-900'}>
                          {t.amount.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="text-red-600 hover:bg-red-50 p-2 rounded transition"
                          title="سڕینەوە"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {fTrans.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-500">
                        هیچ تۆمارێک نییە لەم ماوەیەدا
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
"""
with open('src/components/views/LedgerView.tsx', 'w') as f:
    f.write(content)

print("done")
