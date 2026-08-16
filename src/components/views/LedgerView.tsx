import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Transaction } from '../../types';
import { format } from 'date-fns';
import { Plus, TrendingUp, TrendingDown, DollarSign, Trash2 } from 'lucide-react';

export default function LedgerView() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [type, setType] = useState<'income' | 'expense'>('income');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const [ordersProfit, setOrdersProfit] = useState(0);
  const [cashvanProfit, setCashvanProfit] = useState(0);

  useEffect(() => {
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const unsubTrans = onSnapshot(q, (snapshot) => {
      const transData: Transaction[] = [];
      snapshot.forEach((doc) => {
        transData.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      setTransactions(transData);
      setLoading(false);
    });

    const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      let profit = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.status === 'completed' && data.totalProfit) {
          profit += data.totalProfit;
        }
      });
      setOrdersProfit(profit);
    });

    const unsubCashvan = onSnapshot(collection(db, 'cashvan_sales'), (snapshot) => {
      let profit = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.status === 'accounted' && data.totalProfit) {
          profit += data.totalProfit;
        }
      });
      setCashvanProfit(profit);
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

  const calculateTotal = (filterType: Transaction['type'][]) => {
    return transactions
      .filter(t => filterType.includes(t.type))
      .reduce((acc, curr) => acc + curr.amount, 0);
  };

  const totalIncome = calculateTotal(['income', 'cash', 'paid_debt']);
  const totalExpense = calculateTotal(['expense', 'company_cash', 'company_paid_debt', 'return_expense']);
  const manualExpenses = calculateTotal(['expense']);
  const returnProfitsLost = transactions.filter(t => t.type === 'return_expense').reduce((acc, t) => acc + (t.profitReversal || 0), 0);
  const netProfit = totalIncome - totalExpense; // Cash Flow
  const realProfit = ordersProfit + cashvanProfit - manualExpenses - returnProfitsLost;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-indigo-100 text-indigo-600 rounded-full shrink-0">
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="text-sm text-slate-500 mb-1">قازانجی سافی (فرۆشتن)</div>
            <div className="text-2xl font-bold text-indigo-600" dir="ltr">{realProfit.toLocaleString()}</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-emerald-100 text-emerald-600 rounded-full shrink-0">
            <DollarSign size={24} />
          </div>
          <div>
            <div className="text-sm text-slate-500 mb-1">باڵانسی نەقد</div>
            <div className="text-2xl font-bold text-emerald-600" dir="ltr">{netProfit.toLocaleString()}</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-red-100 text-red-600 rounded-full shrink-0">
            <TrendingDown size={24} />
          </div>
          <div>
            <div className="text-sm text-slate-500 mb-1">کۆی خەرجی</div>
            <div className="text-2xl font-bold text-slate-800" dir="ltr">{totalExpense.toLocaleString()}</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-green-100 text-green-600 rounded-full shrink-0">
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="text-sm text-slate-500 mb-1">کۆی فرۆش</div>
            <div className="text-2xl font-bold text-slate-800" dir="ltr">{totalIncome.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entry Form */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 lg:col-span-1 h-fit flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100">
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

        {/* Transactions List */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 lg:col-span-2 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h4 className="font-bold text-slate-700 flex items-center gap-2">دوایین تۆمارەکان</h4>
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
                  {transactions.slice(0, 50).map(t => (
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
                           t.type === 'paid_debt' ? 'واسڵکراو' : 'قەرز'}
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
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-500">
                        هیچ تۆمارێک نییە
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
