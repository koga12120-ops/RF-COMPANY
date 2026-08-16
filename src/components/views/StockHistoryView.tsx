import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { StockHistory } from '../../types';
import { Package, Search, Calendar } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';

export default function StockHistoryView() {
  const [history, setHistory] = useState<StockHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    // Only query by selectedDate to filter locally, or use Firestore where
    // For simplicity with Firestore index, we will query all and filter locally for search, 
    // but use a timestamp range for the selected day.
    const start = startOfDay(new Date(selectedDate)).getTime();
    const end = endOfDay(new Date(selectedDate)).getTime();

    const q = query(
      collection(db, 'stock_history'),
      where('date', '>=', start),
      where('date', '<=', end),
      orderBy('date', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data: StockHistory[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as StockHistory);
      });
      setHistory(data);
      setLoading(false);
    });

    return () => unsub();
  }, [selectedDate]);

  const filteredHistory = history.filter(h => 
    h.itemName.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50">
          <h4 className="font-bold text-slate-700 flex items-center gap-2">
            <Package size={20} /> ڕاپۆرتی هاتنی کاڵا
          </h4>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative">
              <input
                type="date"
                className="w-full pl-4 pr-10 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono text-slate-600"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              <Calendar className="absolute right-3 top-2.5 text-slate-400" size={18} />
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="گەڕان بەدوای کاڵا..."
                className="w-full pr-10 pl-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute right-3 top-2.5 text-slate-400" size={18} />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10 text-slate-500">خەریکی هێنانە...</div>
        ) : filteredHistory.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            هیچ کاڵایەک نەهاتووە لەم ڕۆژەدا
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">ناوی کاڵا</th>
                  <th className="px-4 py-3 font-semibold">بڕی زیادکراو</th>
                  <th className="px-4 py-3 font-semibold">کات</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-50">
                {filteredHistory.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-4 font-medium text-slate-900">{item.itemName}</td>
                    <td className="px-4 py-4 text-green-600 font-bold" dir="ltr">
                      +{item.quantityAdded.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-slate-500 font-mono text-xs" dir="ltr">
                      {format(item.date, 'HH:mm')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
