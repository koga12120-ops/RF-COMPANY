import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, where, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Transaction } from '../../types';
import { format } from 'date-fns';
import { Plus, Check, Trash2 } from 'lucide-react';

export default function DebtsView({ type = 'debt', targetName = 'مارکێت' }: { type?: 'debt' | 'company_debt', targetName?: string }) {
  const [debts, setDebts] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [relatedEntityId, setRelatedEntityId] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'transactions'), where('type', '==', type));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const debtsData: Transaction[] = [];
      snapshot.forEach((doc) => {
        debtsData.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      setDebts(debtsData.sort((a, b) => b.date - a.date));
      setLoading(false);
    });

    const collectionName = type.includes('company') ? 'companies' : 'markets';
    const qSuggestions = query(collection(db, collectionName));
    const unsubSuggestions = onSnapshot(qSuggestions, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setSuggestions(data);
    });

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

  const handleMarkAsPaid = async (id: string) => {
    try {
      await updateDoc(doc(db, 'transactions', id), {
        type: type === 'debt' ? 'paid_debt' : 'company_paid_debt'
      });
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

  return (
    <div className="space-y-6">
      <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold mb-4 text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">تۆمارکردنی قەرز</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm text-slate-600 mb-1">{`ناوی ${targetName}`}</label>
            <input
              type="text"
              required
              list={`suggestions-${type}`}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              value={relatedEntityId}
              onChange={(e) => setRelatedEntityId(e.target.value)}
            />
            <datalist id={`suggestions-${type}`}>
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
              className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition flex items-center gap-2 font-medium text-sm h-10"
            >
              <Plus size={18} />
              <span>تۆمارکردنی قەرز</span>
            </button>
          </div>
        </form>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h4 className="font-bold text-slate-700 flex items-center gap-2">📝 لیستی قەرزەکان</h4>
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
                  <th className="px-4 py-3 font-semibold">کردارەکان</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-50">
                {debts.map(debt => (
                  <tr key={debt.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-4 font-medium text-slate-900">{debt.relatedEntityId}</td>
                    <td className="px-4 py-4 text-slate-600">{debt.description}</td>
                    <td className="px-4 py-4 font-bold text-amber-600" dir="ltr">{debt.amount.toLocaleString()}</td>
                    <td className="px-4 py-4 text-slate-500 text-xs font-mono" dir="ltr">{format(debt.date, 'yyyy-MM-dd HH:mm')}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleMarkAsPaid(debt.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition text-sm font-medium"
                        >
                          <Check size={16} />
                          <span>واسڵ کردن</span>
                        </button>
                        <button
                          onClick={() => handleDelete(debt.id)}
                          className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                          title="سڕینەوە"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {debts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-500">
                      هیچ قەرزێک نییە
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
