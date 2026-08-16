import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Transaction } from '../../types';
import { format } from 'date-fns';
import { Plus, Trash2 } from 'lucide-react';

export default function CashView({ type = 'cash', targetName = 'مارکێت' }: { type?: 'cash' | 'company_cash', targetName?: string }) {
  const [cashSales, setCashSales] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [relatedEntityId, setRelatedEntityId] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'transactions'), where('type', '==', type));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const salesData: Transaction[] = [];
      snapshot.forEach((doc) => {
        salesData.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      setCashSales(salesData.sort((a, b) => b.date - a.date));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description) return;

    try {
      if (relatedEntityId && !suggestions.find(s => s.name === relatedEntityId)) {
        const collectionName = type.includes('company') ? 'companies' : 'markets';
        await addDoc(collection(db, collectionName), { name: relatedEntityId, location: '', phone: '', createdAt: Date.now() });
      }

      await addDoc(collection(db, 'transactions'), {
        type,
        amount: Number(amount),
        description,
        relatedEntityId, // Name of the shop/person
        date: Date.now()
      });
      setAmount('');
      setDescription('');
      setRelatedEntityId('');
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

  const totalCash = cashSales.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-6">
      <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold mb-4 text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">تۆمارکردنی نەقد</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
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
          <div className="md:col-span-4 flex justify-end">
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

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h4 className="font-bold text-slate-700 flex items-center gap-2">💵 لیستی نەقدەکان</h4>
          <div className="bg-green-50 text-green-700 px-3 py-1.5 rounded-lg text-sm font-bold border border-green-100" dir="ltr">
            کۆی گشتی: {totalCash.toLocaleString()}
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
                {cashSales.map(sale => (
                  <tr key={sale.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-4 font-medium text-slate-900">{sale.relatedEntityId}</td>
                    <td className="px-4 py-4 text-slate-600">{sale.description}</td>
                    <td className="px-4 py-4 font-bold text-green-600" dir="ltr">{sale.amount.toLocaleString()}</td>
                    <td className="px-4 py-4 text-slate-500 text-xs font-mono" dir="ltr">{format(sale.date, 'yyyy-MM-dd HH:mm')}</td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => handleDelete(sale.id)}
                        className="text-red-600 hover:bg-red-50 p-2 rounded transition"
                        title="سڕینەوە"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {cashSales.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-500">
                      هیچ تۆمارێکی نەقدی نییە
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
