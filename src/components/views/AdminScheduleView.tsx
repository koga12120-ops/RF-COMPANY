import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { Market, SalesRep } from '../../types';
import { Calendar, Save, Trash2, Search, Store, UserCheck, Plus } from 'lucide-react';

const DAYS = [
  { id: '6', label: 'شەممە', color: 'border-indigo-200 bg-indigo-50/40 text-indigo-900' },
  { id: '0', label: 'یەکشەممە', color: 'border-blue-200 bg-blue-50/40 text-blue-900' },
  { id: '1', label: 'دووشەممە', color: 'border-emerald-200 bg-emerald-50/40 text-emerald-900' },
  { id: '2', label: 'سێشەممە', color: 'border-amber-200 bg-amber-50/40 text-amber-900' },
  { id: '3', label: 'چوارشەممە', color: 'border-purple-200 bg-purple-50/40 text-purple-900' },
  { id: '4', label: 'پێنجشەممە', color: 'border-rose-200 bg-rose-50/40 text-rose-900' },
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
  const [marketSearch, setMarketSearch] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsubReps = onSnapshot(
      query(collection(db, 'reps')),
      (snapshot) => {
        const data: SalesRep[] = [];
        snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as SalesRep));
        data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setReps(data);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'reps');
      }
    );

    const unsubMarkets = onSnapshot(
      query(collection(db, 'markets')),
      (snapshot) => {
        const data: Market[] = [];
        snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Market));
        data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setMarkets(data);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'markets');
      }
    );

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
    const unsubSchedule = onSnapshot(
      doc(db, 'schedules', selectedRep),
      (docSnap) => {
        if (docSnap.exists()) {
          setSchedule(docSnap.data().schedule || { '6': [], '0': [], '1': [], '2': [], '3': [], '4': [] });
        } else {
          setSchedule({ '6': [], '0': [], '1': [], '2': [], '3': [], '4': [] });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'schedules');
      }
    );
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [schedule, selectedRep, saving]);

  const handleSave = async () => {
    if (!selectedRep) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'schedules', selectedRep), {
        repId: selectedRep,
        schedule
      });
      alert('خشتەی سەردان بە سەرکەوتوویی پاشەکەوت کرا');
    } catch (error) {
      console.error(error);
      alert('کێشەیەک ڕوویدا لە پاشەکەوتکردن');
    } finally {
      setSaving(false);
    }
  };

  const selectedRepObj = reps.find(r => r.id === selectedRep);
  const totalAssignedMarkets = (Object.values(schedule) as string[][]).reduce((acc, curr) => acc + (curr?.length || 0), 0);

  if (loading) return <div className="text-center py-10 text-slate-500 font-bold">خەریکی هێنانە...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-slate-200">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <Calendar size={22} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">دانانی خشتەی سەردانی مەندووب و کاشڤان</h2>
              <p className="text-xs text-slate-500">دیاریکردنی مارکێتەکان بۆ ڕۆژەکانی هەفتە بۆ مەندووب و کاشڤانەکان</p>
            </div>
          </div>

          {selectedRep && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 active:scale-98 transition flex items-center gap-2 shadow-xs disabled:opacity-60 text-xs sm:text-sm"
            >
              <Save size={18} />
              <span>{saving ? 'پاشەکەوت دەکرێت...' : 'پاشەکەوتکردنی خشتە'}</span>
            </button>
          )}
        </div>

        {/* Rep Selection Card */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex-1 max-w-lg">
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <UserCheck size={16} className="text-indigo-600" />
              مەندووب یان کاشڤان هەڵبژێرە:
            </label>
            <select
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition shadow-2xs"
              value={selectedRep}
              onChange={(e) => setSelectedRep(e.target.value)}
            >
              <option value="">-- مەندووب یان کاشڤان هەڵبژێرە --</option>
              {reps.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.phone ? `(${r.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedRepObj && (
            <div className="flex items-center gap-4 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-right">
                <div className="text-xs text-slate-500">کۆی مارکێتە دانراوەکان</div>
                <div className="text-sm sm:text-base font-bold text-indigo-700">
                  {totalAssignedMarkets} مارکێت لە هەفتەدا
                </div>
              </div>
            </div>
          )}
        </div>

        {selectedRep ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {DAYS.map(day => {
                const dayMarkets = schedule[day.id] || [];
                const search = (marketSearch[day.id] || '').toLowerCase();
                const availableMarkets = markets.filter(
                  m => !dayMarkets.includes(m.id) && (search === '' || m.name.toLowerCase().includes(search) || (m.location && m.location.toLowerCase().includes(search)))
                );

                return (
                  <div key={day.id} className="border border-slate-200 rounded-2xl overflow-hidden flex flex-col bg-white shadow-2xs">
                    {/* Day Header */}
                    <div className={`px-4 py-3 border-b flex justify-between items-center font-bold text-sm ${day.color}`}>
                      <span className="flex items-center gap-2">
                        <Calendar size={16} />
                        {day.label}
                      </span>
                      <span className="text-xs bg-white/80 backdrop-blur-xs px-2.5 py-0.5 rounded-full font-mono border border-slate-200">
                        {dayMarkets.length} مارکێت
                      </span>
                    </div>

                    <div className="p-3.5 flex-1 flex flex-col space-y-3 bg-slate-50/50">
                      {/* Add Market Selector */}
                      <div className="space-y-1.5">
                        <select
                          className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl font-medium outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                          onChange={(e) => {
                            handleAddMarket(day.id, e.target.value);
                            e.target.value = ''; // reset
                          }}
                          defaultValue=""
                        >
                          <option value="" disabled>+ زیادکردنی مارکێت بۆ {day.label}</option>
                          {availableMarkets.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name} {m.location ? `(${m.location})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* List of Scheduled Markets */}
                      <div className="space-y-2 flex-1 max-h-72 overflow-y-auto pr-1">
                        {dayMarkets.map((marketId, idx) => {
                          const market = markets.find(m => m.id === marketId);
                          return (
                            <div
                              key={`${marketId}-${idx}`}
                              className="flex justify-between items-center bg-white p-2.5 border border-slate-200 rounded-xl shadow-2xs hover:border-slate-300 transition"
                            >
                              <div className="flex items-center gap-2 min-w-0 pr-1">
                                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-mono font-bold flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                <div className="min-w-0">
                                  <div className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                                    {market?.name || 'مارکێتی نەزانراو'}
                                  </div>
                                  {market?.location && (
                                    <div className="text-[11px] text-slate-400 truncate">
                                      {market.location}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => handleRemoveMarket(day.id, marketId)}
                                className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg transition shrink-0"
                                title="سڕینەوە لەم ڕۆژە"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          );
                        })}

                        {dayMarkets.length === 0 && (
                          <div className="text-center text-slate-400 text-xs py-6 bg-white/60 rounded-xl border border-dashed border-slate-200">
                            هیچ مارکێتێک دانەنراوە بۆ ئەم ڕۆژە
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Save Button */}
            <div className="flex justify-end border-t border-slate-100 pt-5 mt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full sm:w-auto px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 active:scale-98 transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-60 text-sm"
              >
                <Save size={18} />
                <span>{saving ? 'پاشەکەوت دەکرێت...' : 'پاشەکەوتکردنی سەرجەم گۆڕانکارییەکان'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-slate-500 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <Calendar size={40} className="mx-auto text-slate-300 mb-3" />
            <div className="font-bold text-slate-700 text-sm sm:text-base">تکایە مەندووب یان کاشڤانێک هەڵبژێرە</div>
            <div className="text-xs text-slate-400 mt-1">بۆ بینین، ڕێکخستن و دانانی خشتەی سەردانی مارکێتەکان</div>
          </div>
        )}
      </div>
    </div>
  );
}
