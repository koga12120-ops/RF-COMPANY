import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Market, SalesRep } from '../../types';
import { Calendar, Save, Trash2 } from 'lucide-react';

const DAYS = [
  { id: '6', label: 'شەممە' },
  { id: '0', label: 'یەکشەممە' },
  { id: '1', label: 'دووشەممە' },
  { id: '2', label: 'سێشەممە' },
  { id: '3', label: 'چوارشەممە' },
  { id: '4', label: 'پێنجشەممە' },
];

export default function AdminScheduleView() {
  const [reps, setReps] = useState<SalesRep[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedRep, setSelectedRep] = useState<string>('');
  const [schedule, setSchedule] = useState<Record<string, string[]>>({
    '6': [], '0': [], '1': [], '2': [], '3': [], '4': []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubReps = onSnapshot(query(collection(db, 'reps')), (snapshot) => {
      const data: SalesRep[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as SalesRep));
      setReps(data);
    });

    const unsubMarkets = onSnapshot(query(collection(db, 'markets')), (snapshot) => {
      const data: Market[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Market));
      setMarkets(data);
      setLoading(false);
    });

    return () => {
      unsubReps();
      unsubMarkets();
    };
  }, []);

  useEffect(() => {
    if (!selectedRep) {
      setSchedule({ '6': [], '0': [], '1': [], '2': [], '3': [], '4': [] });
      return;
    }
    const unsubSchedule = onSnapshot(doc(db, 'schedules', selectedRep), (docSnap) => {
      if (docSnap.exists()) {
        setSchedule(docSnap.data().schedule || { '6': [], '0': [], '1': [], '2': [], '3': [], '4': [] });
      } else {
        setSchedule({ '6': [], '0': [], '1': [], '2': [], '3': [], '4': [] });
      }
    });
    return () => unsubSchedule();
  }, [selectedRep]);

  const handleAddMarket = (day: string, marketId: string) => {
    if (!marketId) return;
    setSchedule(prev => {
      const dayList = prev[day] || [];
      if (dayList.includes(marketId)) return prev;
      return { ...prev, [day]: [...dayList, marketId] };
    });
  };

  const handleRemoveMarket = (day: string, marketId: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: prev[day].filter(id => id !== marketId)
    }));
  };

  const handleSave = async () => {
    if (!selectedRep) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'schedules', selectedRep), {
        repId: selectedRep,
        schedule
      });
      alert('خشتەکە بە سەرکەوتوویی پاشەکەوت کرا');
    } catch (error) {
      console.error(error);
      alert('کێشەیەک ڕوویدا لە پاشەکەوتکردن');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-10">خەریکی هێنانە...</div>;

  return (
    <div className="space-y-6" onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}>
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-4">
          <Calendar className="text-indigo-600" size={24} />
          <h2 className="text-lg font-bold text-slate-800">دانانی خشتەی سەردانی مەندووبەکان</h2>
        </div>

        <div className="mb-8 max-w-md">
          <label className="block text-sm font-medium text-slate-700 mb-2">مەندووب هەڵبژێرە</label>
          <select
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            value={selectedRep}
            onChange={(e) => setSelectedRep(e.target.value)}
          >
            <option value="">-- هەڵبژێرە --</option>
            {reps.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        {selectedRep && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {DAYS.map(day => (
                <div key={day.id} className="border border-slate-200 rounded-xl overflow-hidden flex flex-col bg-slate-50">
                  <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 font-bold text-slate-700 flex justify-between items-center">
                    <span>{day.label}</span>
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
                      {(schedule[day.id] || []).length} مارکێت
                    </span>
                  </div>
                  <div className="p-4 flex-1">
                    <select
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mb-3"
                      onChange={(e) => {
                        handleAddMarket(day.id, e.target.value);
                        e.target.value = ''; // reset
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>+ زیادکردنی مارکێت</option>
                      {markets
                        .filter(m => !(schedule[day.id] || []).includes(m.id))
                        .map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>

                    <div className="space-y-2">
                      {(schedule[day.id] || []).map(marketId => {
                        const market = markets.find(m => m.id === marketId);
                        return (
                          <div key={marketId} className="flex justify-between items-center bg-white p-2 border border-slate-200 rounded-lg shadow-sm">
                            <span className="text-sm font-medium truncate pr-2">{market?.name || 'نەزانراو'}</span>
                            <button
                              onClick={() => handleRemoveMarket(day.id, marketId)}
                              className="text-red-500 hover:bg-red-50 p-1.5 rounded-md transition"
                              title="سڕینەوە"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        );
                      })}
                      {(schedule[day.id] || []).length === 0 && (
                        <div className="text-center text-slate-400 text-sm py-4">
                          هیچ مارکێتێک دانەنراوە
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-6 mt-6">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-70"
              >
                <Save size={20} />
                <span>{saving ? 'پاشەکەوت دەکرێت...' : 'پاشەکەوتکردنی خشتە'}</span>
              </button>
            </div>
          </div>
        )}
        {!selectedRep && (
          <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">مەندووبێک هەڵبژێرە بۆ بینین و دانانی خشتەکەی</div>
        )}
      </div>
    </div>
  );
}
