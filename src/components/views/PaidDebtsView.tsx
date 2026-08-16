import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Transaction } from '../../types';
import { format } from 'date-fns';
import { Trash2 } from 'lucide-react';

export default function PaidDebtsView({ type = 'paid_debt' }: { type?: 'paid_debt' | 'company_paid_debt' }) {
  const [paidDebts, setPaidDebts] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'transactions'), where('type', '==', type));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const debtsData: Transaction[] = [];
      snapshot.forEach((doc) => {
        debtsData.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      setPaidDebts(debtsData.sort((a, b) => b.date - a.date));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [type]);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'transactions', id));
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h4 className="font-bold text-slate-700 flex items-center gap-2">✅ قەرزە واسڵکراوەکان</h4>
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
                {paidDebts.map(debt => (
                  <tr key={debt.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-4 font-medium text-slate-900">{debt.relatedEntityId}</td>
                    <td className="px-4 py-4 text-slate-600">{debt.description}</td>
                    <td className="px-4 py-4 font-bold text-green-600" dir="ltr">{debt.amount.toLocaleString()}</td>
                    <td className="px-4 py-4 text-slate-500 text-xs font-mono" dir="ltr">{format(debt.date, 'yyyy-MM-dd HH:mm')}</td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => handleDelete(debt.id)}
                        className="text-red-600 hover:bg-red-50 p-2 rounded transition"
                        title="سڕینەوە"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {paidDebts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-500">
                      هیچ قەرزێکی واسڵکراو نییە
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
