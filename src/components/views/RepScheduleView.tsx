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
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userName = userDoc.data()?.name;
      if (!userName) return;

      const repsSnap = await getDocs(query(collection(db, 'reps'), where('name', '==', userName)));
      if (!repsSnap.empty) {
        setRepId(repsSnap.docs[0].id);
      }
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
        <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-4">
          <Calendar className="text-indigo-600" size={24} />
          <h2 className="text-lg font-bold text-slate-800">خشتەی سەردانەکانی ئەمڕۆ</h2>
        </div>

        {pendingMarkets.length === 0 ? (
          <div className="text-center py-16 bg-emerald-50 rounded-xl border border-dashed border-emerald-200">
            <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-3" />
            <h3 className="text-lg font-bold text-emerald-800">هیچ سەردانێک نەماوە!</h3>
            <p className="text-emerald-600 mt-1">هەموو سەردانەکانی ئەمڕۆت ئەنجامداوە.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingMarkets.map(({ marketId, assignedDay }) => {
              const market = markets[marketId];
              if (!market) return null;
              const isDelayed = assignedDay !== currentDayStr;

              return (
                <div key={marketId} className={`p-4 rounded-xl border ${isDelayed ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'} shadow-sm flex flex-col justify-between h-full`}>
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-slate-800 text-lg truncate pr-2">{market.name}</h3>
                      {isDelayed && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium whitespace-nowrap">دواکەوتوو ({DAY_NAMES[assignedDay]})</span>}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-slate-600 mb-4"><MapPin size={16} className="text-slate-400" /> {market.location || 'بێ ناونیشان'}</div>
                  </div>
                  <button onClick={() => handleVisit(marketId)} className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-indigo-700 transition">
                    <CheckCircle2 size={18} /><span>سەردانم کرد</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
