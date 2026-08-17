import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot, doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { Calendar, CheckCircle2, Clock, MapPin } from 'lucide-react';
import { Market } from '../../types';

const WEEK_DAYS = ['6', '0', '1', '2', '3', '4']; // Saturday to Thursday
const DAY_NAMES: Record<string, string> = {
  '6': 'شەممە', '0': 'یەکشەممە', '1': 'دووشەممە', '2': 'سێشەممە', '3': 'چوارشەممە', '4': 'پێنجشەممە'
};

const getWeekId = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 6 ? 0 : day + 1;
  d.setDate(d.getDate() - diff);
  return `week_${d.toISOString().split('T')[0]}`;
};

export default function RepScheduleView() {
  const [repId, setRepId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<Record<string, string[]>>({});
  const [visits, setVisits] = useState<Record<string, boolean>>({});
  const [markets, setMarkets] = useState<Record<string, Market>>({});
  const [loading, setLoading] = useState(true);

  const weekId = getWeekId();
  const currentDayStr = new Date().getDay().toString();

  useEffect(() => {
    const init = async () => {
      if (!auth.currentUser) return;
      setRepId(auth.currentUser.uid);
    };
    init();
  }, []);

  useEffect(() => {
    if (!repId) return;

    // 1. Listen to template schedule
    const unsubSchedule = onSnapshot(doc(db, 'schedules', repId), (docSnap) => {
      if (docSnap.exists()) {
        setSchedule(docSnap.data().schedule || {});
      } else {
        setSchedule({});
      }
    });

    // 2. Listen to this week's visits
    const qVisits = query(collection(db, 'schedule_visits'), 
      where('repId', '==', repId),
      where('weekId', '==', weekId)
    );
    const unsubVisits = onSnapshot(qVisits, (snap) => {
      const visitedMap: Record<string, boolean> = {};
      snap.forEach(d => {
        visitedMap[d.data().marketId] = true;
      });
      setVisits(visitedMap);
    });

    // 3. Load Markets mapping
    const unsubMarkets = onSnapshot(collection(db, 'markets'), (snap) => {
      const mks: Record<string, Market> = {};
      snap.forEach(d => {
        mks[d.id] = { id: d.id, ...d.data() } as Market;
      });
      setMarkets(mks);
      setLoading(false);
    });

    return () => {
      unsubSchedule();
      unsubVisits();
      unsubMarkets();
    };
  }, [repId, weekId]);

  const handleVisit = async (marketId: string) => {
    if (!repId) return;
    const visitId = `${repId}_${weekId}_${marketId}`;
    try {
      await setDoc(doc(db, 'schedule_visits', visitId), {
        repId,
        weekId,
        marketId,
        visitedAt: Date.now()
      });
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) return <div className="text-center py-10">خەریکی هێنانە...</div>;
  if (!repId) return <div className="text-center py-10 text-slate-500">مەندووب نەدۆزرایەوە لە سیستەمدا</div>;

  // Calculate pending markets (from start of week up to today, if not visited)
  const todayIndex = WEEK_DAYS.indexOf(currentDayStr);
  const activeDays = todayIndex === -1 ? WEEK_DAYS : WEEK_DAYS.slice(0, todayIndex + 1);

  const pendingMarkets: { marketId: string, assignedDay: string }[] = [];
  activeDays.forEach(day => {
    const dayMarkets = schedule[day] || [];
    dayMarkets.forEach(mId => {
      if (!visits[mId]) {
        pendingMarkets.push({ marketId: mId, assignedDay: day });
      }
    });
  });

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-6">
          <Calendar className="text-indigo-600" size={24} />
          <h2 className="text-lg font-bold text-slate-800">خشتەی سەردانەکانی هەفتە</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {WEEK_DAYS.map(day => {
            const dayMarkets = schedule[day] || [];
            const isToday = day === currentDayStr;
            
            return (
              <div key={day} className={`border rounded-xl overflow-hidden flex flex-col ${isToday ? 'border-indigo-300 ring-1 ring-indigo-300 shadow-md' : 'border-slate-200 shadow-sm'}`}>
                <div className={`${isToday ? 'bg-indigo-50 text-indigo-800' : 'bg-slate-50 text-slate-700'} px-4 py-3 border-b ${isToday ? 'border-indigo-200' : 'border-slate-200'} font-bold flex justify-between items-center`}>
                  <span>{DAY_NAMES[day]} {isToday && '(ئەمڕۆ)'}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${isToday ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-200 text-slate-600'}`}>
                    {dayMarkets.length} سەردان
                  </span>
                </div>
                
                <div className={`p-4 flex-1 ${isToday ? 'bg-white' : 'bg-slate-50/50'}`}>
                  {dayMarkets.length === 0 ? (
                    <div className="text-center text-slate-400 text-sm py-4">هیچ سەردانێک نییە</div>
                  ) : (
                    <div className="space-y-3">
                      {dayMarkets.map(mId => {
                        const market = markets[mId];
                        const isVisited = visits[mId];
                        if (!market) return null;
                        
                        return (
                          <div key={mId} className={`p-3 rounded-lg border ${isVisited ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'} shadow-sm`}>
                            <div className="flex justify-between items-start mb-2">
                              <h3 className={`font-bold text-sm truncate pr-2 ${isVisited ? 'text-emerald-800 line-through' : 'text-slate-800'}`}>{market.name}</h3>
                              {isVisited && <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />}
                            </div>
                            <div className="flex justify-between items-center mt-2">
                              <div className="text-xs text-slate-500 truncate max-w-[60%]">{market.location || '-'}</div>
                              {!isVisited && (
                                <button 
                                  onClick={() => handleVisit(mId)} 
                                  className="px-2.5 py-1.5 bg-indigo-50 text-indigo-600 rounded-md text-xs font-bold hover:bg-indigo-100 transition"
                                >
                                  سەردانم کرد
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
