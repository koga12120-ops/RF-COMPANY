import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { getStoredSession } from '../../lib/authService';
import { Calendar, CheckCircle2, Clock, MapPin, Menu, ShoppingCart, CreditCard, Phone, DollarSign, RefreshCw, Layers, ArrowRightLeft } from 'lucide-react';
import { Market, Transaction } from '../../types';
import SimpleMarketDebtPayModal from '../common/SimpleMarketDebtPayModal';
import {
  createEmptySchedule,
  getWeekScheduleInfo,
  getCalculatedWeekSchedule,
  getWeekId,
  ScheduleRotationConfig
} from '../../lib/scheduleRotation';

const WEEK_DAYS = ['6', '0', '1', '2', '3', '4']; // Saturday to Thursday
const DAY_NAMES: Record<string, string> = {
  '6': 'شەممە', '0': 'یەکشەممە', '1': 'دووشەممە', '2': 'سێشەممە', '3': 'چوارشەممە', '4': 'پێنجشەممە'
};

export default function RepScheduleView() {
  const storedSession = getStoredSession();
  const initialRepId = storedSession?.repId || storedSession?.id || sessionStorage.getItem('active_rep_id') || '';
  const initialRepName = storedSession?.name || storedSession?.username || sessionStorage.getItem('active_rep_name') || 'مەندووب';

  const [repId, setRepId] = useState<string | null>(initialRepId || null);
  const [repName, setRepName] = useState<string>(initialRepName);
  const [schedule1, setSchedule1] = useState<Record<string, string[]>>(createEmptySchedule());
  const [schedule2, setSchedule2] = useState<Record<string, string[]>>(createEmptySchedule());
  const [rotationConfig, setRotationConfig] = useState<ScheduleRotationConfig>({
    activeScheduleOverride: 'auto',
    startingSchedule: '1'
  });
  const [viewingScheduleTab, setViewingScheduleTab] = useState<'1' | '2' | 'auto'>('auto');

  const [visits, setVisits] = useState<Record<string, boolean>>({});
  const [markets, setMarkets] = useState<Record<string, Market>>({});
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Pay Debt Modal
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [selectedMarketForDebt, setSelectedMarketForDebt] = useState<Market | null>(null);
  const [openMenuMarketId, setOpenMenuMarketId] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);

  const weekId = getWeekId();
  const currentDayStr = new Date().getDay().toString();

  // Rotation details
  const weekInfo = useMemo(() => {
    return getWeekScheduleInfo(rotationConfig);
  }, [rotationConfig]);

  const activeCalculated = weekInfo.currentSchedule; // '1' or '2'
  const activeViewingSchedule: '1' | '2' = viewingScheduleTab === 'auto' ? activeCalculated : viewingScheduleTab;
  const currentSchedule = activeViewingSchedule === '1' ? schedule1 : schedule2;

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuMarketId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 1. Resolve Rep ID & Name from session or reps collection
  useEffect(() => {
    const session = getStoredSession();
    const sessionRepId = session?.repId || session?.id || sessionStorage.getItem('active_rep_id');
    const sessionRepName = session?.name || session?.username || sessionStorage.getItem('active_rep_name');

    if (sessionRepId) setRepId(sessionRepId);
    if (sessionRepName) setRepName(sessionRepName);

    const unsubReps = onSnapshot(collection(db, 'reps'), (snap) => {
      snap.forEach((d) => {
        const data = d.data();
        if (
          (sessionRepId && d.id === sessionRepId) ||
          (sessionRepName && (data.name === sessionRepName || data.username === sessionRepName || d.id === sessionRepName))
        ) {
          setRepId(d.id);
          if (data.name) setRepName(data.name);
        }
      });
    }, (err) => handleFirestoreError(err, OperationType.GET, 'reps'));

    return () => unsubReps();
  }, []);

  useEffect(() => {
    const activeTargetId = repId || initialRepId;
    const activeTargetName = repName || initialRepName;

    // 1. Listen to template schedule (by repId, by repName, and all schedules fallback)
    let unsubSchedule1 = () => {};
    let unsubSchedule2 = () => {};
    let unsubAllSchedules = () => {};

    const applyScheduleData = (data: any) => {
      const s1 = data.schedule1 || data.schedule || createEmptySchedule();
      const s2 = data.schedule2 || createEmptySchedule();
      setSchedule1({
        '6': s1['6'] || [],
        '0': s1['0'] || [],
        '1': s1['1'] || [],
        '2': s1['2'] || [],
        '3': s1['3'] || [],
        '4': s1['4'] || []
      });
      setSchedule2({
        '6': s2['6'] || [],
        '0': s2['0'] || [],
        '1': s2['1'] || [],
        '2': s2['2'] || [],
        '3': s2['3'] || [],
        '4': s2['4'] || []
      });
      if (data.activeScheduleOverride || data.startingSchedule) {
        setRotationConfig({
          activeScheduleOverride: data.activeScheduleOverride || 'auto',
          startingSchedule: data.startingSchedule || '1'
        });
      }
    };

    if (activeTargetId) {
      unsubSchedule1 = onSnapshot(
        doc(db, 'schedules', activeTargetId),
        (docSnap) => {
          if (docSnap.exists()) {
            applyScheduleData(docSnap.data());
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, 'schedules');
        }
      );
    }

    if (activeTargetName && activeTargetName !== activeTargetId) {
      unsubSchedule2 = onSnapshot(
        doc(db, 'schedules', activeTargetName),
        (docSnap) => {
          if (docSnap.exists()) {
            applyScheduleData(docSnap.data());
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, 'schedules');
        }
      );
    }

    unsubAllSchedules = onSnapshot(
      collection(db, 'schedules'),
      (snap) => {
        snap.forEach((d) => {
          const data = d.data();
          if (
            d.id === activeTargetId ||
            d.id === activeTargetName ||
            data.repId === activeTargetId ||
            (activeTargetName && data.repName === activeTargetName)
          ) {
            applyScheduleData(data);
          }
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'schedules');
      }
    );

    // 2. Listen to this week's visits
    const qVisits = query(
      collection(db, 'schedule_visits'),
      where('weekId', '==', weekId)
    );
    const unsubVisits = onSnapshot(
      qVisits,
      (snap) => {
        const visitedMap: Record<string, boolean> = {};
        snap.forEach(d => {
          const data = d.data();
          if (
            data.repId === activeTargetId ||
            data.repId === activeTargetName ||
            (activeTargetName && data.repName === activeTargetName)
          ) {
            if (!data.unvisited) {
              visitedMap[data.marketId] = true;
            }
          }
        });
        setVisits(visitedMap);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'schedule_visits');
      }
    );

    // 3. Load Markets mapping
    const unsubMarkets = onSnapshot(
      collection(db, 'markets'),
      (snap) => {
        const mks: Record<string, Market> = {};
        snap.forEach(d => {
          mks[d.id] = { id: d.id, ...d.data() } as Market;
        });
        setMarkets(mks);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'markets');
      }
    );

    // 4. Load Transactions for live debt calculation
    const unsubTrans = onSnapshot(
      collection(db, 'transactions'),
      (snap) => {
        const trs: Transaction[] = [];
        snap.forEach((d) => {
          trs.push({ id: d.id, ...d.data() } as Transaction);
        });
        setTransactions(trs);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'transactions');
      }
    );

    return () => {
      unsubSchedule1();
      unsubSchedule2();
      unsubAllSchedules();
      unsubVisits();
      unsubMarkets();
      unsubTrans();
    };
  }, [repId, repName, weekId]);

  // Debt map
  const marketDebtMap = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach(t => {
      const entity = t.relatedEntityId?.trim();
      if (!entity) return;
      let key = entity;
      Object.values(markets).forEach((m: Market) => {
        if (m.name && m.name.trim().toLowerCase() === entity.toLowerCase()) {
          key = m.name;
        }
      });
      const cur = map.get(key) || 0;
      if (t.type === 'debt') map.set(key, cur + (t.amount || 0));
      else if (t.type === 'paid_debt') map.set(key, Math.max(0, cur - (t.amount || 0)));
    });
    return map;
  }, [transactions, markets]);

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

  // Calculate pending markets
  const todayIndex = WEEK_DAYS.indexOf(currentDayStr);
  
  const displaySchedule: Record<string, string[]> = {};
  WEEK_DAYS.forEach(d => displaySchedule[d] = []);

  WEEK_DAYS.forEach(day => {
    const originalMarkets = currentSchedule[day] || [];
    originalMarkets.forEach(mId => {
      const isPast = WEEK_DAYS.indexOf(day) < todayIndex;
      if (isPast && !visits[mId]) {
        if (todayIndex !== -1) {
          displaySchedule[currentDayStr].push(mId);
        } else {
          displaySchedule[day].push(mId);
        }
      } else {
        displaySchedule[day].push(mId);
      }
    });
  });

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4 mb-5">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Calendar size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">خشتەی سەردانەکانی مەندووب</h2>
              <p className="text-xs text-slate-500">دوو خشتەی هەفتانە بە سووڕی ئۆتۆماتیکی (شەممە تا پێنجشەممە)</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {repName && (
              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold">
                👤 {repName}
              </span>
            )}
            {/* Dual Tabs for Schedule 1 and Schedule 2 */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setViewingScheduleTab('1')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeViewingSchedule === '1'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>خشتەی یەکەم</span>
                {activeCalculated === '1' && (
                  <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] rounded-full font-bold">
                    ئەم هەفتەیە
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setViewingScheduleTab('2')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeViewingSchedule === '2'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>خشتەی دووەم</span>
                {activeCalculated === '2' && (
                  <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] rounded-full font-bold">
                    ئەم هەفتەیە
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Automatic Rotation Information Banner */}
        <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-indigo-900">
            <RefreshCw size={15} className="text-indigo-600 shrink-0" />
            <span>
              ئەم هەفتەیە لەسەر <strong className="font-black text-indigo-700">{weekInfo.currentScheduleLabel}</strong> کار دەکات ({weekInfo.currentWeekRangeShort}) • هەفتەی داهاتوو دەبێتە <strong className="font-black text-slate-800">{weekInfo.nextScheduleLabel}</strong> ({weekInfo.nextWeekRangeShort})
            </span>
          </div>

          {viewingScheduleTab !== 'auto' && viewingScheduleTab !== activeCalculated && (
            <button
              type="button"
              onClick={() => setViewingScheduleTab('auto')}
              className="text-[11px] font-bold text-indigo-700 hover:underline bg-white px-2 py-0.5 rounded border border-indigo-200 shrink-0"
            >
              گەڕانەوە بۆ خشتەی ئەم هەفتەیە
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {WEEK_DAYS.map(day => {
            const dayMarkets = displaySchedule[day] || [];
            const isToday = day === currentDayStr;
            
            return (
              <div key={day} className={`border rounded-2xl overflow-hidden flex flex-col ${isToday ? 'border-indigo-400 ring-2 ring-indigo-300 shadow-md bg-white' : 'border-slate-200 shadow-sm bg-white'}`}>
                <div className={`${isToday ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-700'} px-4 py-3 border-b ${isToday ? 'border-indigo-500' : 'border-slate-200'} font-bold flex justify-between items-center`}>
                  <div className="flex items-center gap-2">
                    <span>{DAY_NAMES[day]}</span>
                    {isToday && <span className="px-2 py-0.5 bg-white/20 text-white rounded-full text-[10px]">ئەمڕۆ</span>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${isToday ? 'bg-white/20 text-white font-bold' : 'bg-slate-200 text-slate-700'}`}>
                    {dayMarkets.length} مارکێت
                  </span>
                </div>
                
                <div className={`p-4 flex-1 space-y-3 ${isToday ? 'bg-indigo-50/20' : 'bg-slate-50/30'}`}>
                  {dayMarkets.length === 0 ? (
                    <div className="text-center text-slate-400 text-xs py-6">هیچ مارکێتێک دانەنراوە</div>
                  ) : (
                    dayMarkets.map((mId, idx) => {
                      const market = markets[mId];
                      const isVisited = visits[mId];
                      if (!market) return null;
                      const debt = marketDebtMap.get(market.name) || 0;
                      const isMenuOpen = openMenuMarketId === market.id;
                      
                      return (
                        <div
                          key={`${mId}-${idx}`}
                          className={`p-3 rounded-xl border transition-all relative ${
                            isVisited
                              ? 'bg-emerald-50/80 border-emerald-200'
                              : 'bg-white border-slate-200 hover:border-indigo-300 shadow-2xs'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2 mb-1.5">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className={`font-bold text-xs ${isVisited ? 'text-emerald-900' : 'text-slate-800'}`}>
                                  {market.name}
                                </h3>
                                {isVisited && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] rounded-md font-bold">
                                    <CheckCircle2 size={10} />
                                    <span>سەردانکراو</span>
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                                {market.location && <span>{market.location}</span>}
                                {market.phone && <span dir="ltr" className="font-mono text-slate-600">{market.phone}</span>}
                              </div>
                            </div>

                            {/* 3-Lines Action Menu */}
                            <div className="relative shrink-0" ref={isMenuOpen ? menuRef : null}>
                              <button
                                type="button"
                                onClick={() => setOpenMenuMarketId(isMenuOpen ? null : market.id)}
                                className={`p-1.5 rounded-lg border transition ${
                                  isMenuOpen
                                    ? 'bg-indigo-600 text-white border-indigo-500'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                                }`}
                                title="هەڵبژاردنەکان"
                              >
                                <Menu size={14} />
                              </button>

                              {isMenuOpen && (
                                <div className="absolute left-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in text-slate-800 text-xs font-bold">
                                  <div className="px-3 py-1 border-b border-slate-100 text-[10px] text-slate-400">
                                    کردارەکانی {market.name}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuMarketId(null);
                                      setSelectedMarketForDebt(market);
                                      setIsDebtModalOpen(true);
                                    }}
                                    className="w-full px-3 py-2 text-right hover:bg-emerald-50 text-emerald-800 flex items-center gap-2"
                                  >
                                    <CreditCard size={14} className="text-emerald-600" />
                                    <span>دانەوەی قەرزی مارکێت</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuMarketId(null);
                                      handleVisit(mId);
                                    }}
                                    className="w-full px-3 py-2 text-right hover:bg-slate-50 text-slate-700 flex items-center gap-2 border-t border-slate-100"
                                  >
                                    <CheckCircle2 size={14} className="text-emerald-600" />
                                    <span>نیشانکردن وەک سەردانکراو</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Bottom Row */}
                          <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-xs">
                            <div className="text-[11px] text-slate-500">
                              قەرز: <span className={`font-mono font-bold ${debt > 0 ? 'text-amber-700' : 'text-emerald-700'}`} dir="ltr">
                                {debt.toLocaleString()} د.ع
                              </span>
                            </div>
                            
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedMarketForDebt(market);
                                setIsDebtModalOpen(true);
                              }}
                              className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-md text-[10px] font-bold transition flex items-center gap-1"
                            >
                              <CreditCard size={11} />
                              <span>دانەوەی قەرز</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Simple Market Debt Payment Modal */}
      {selectedMarketForDebt && (
        <SimpleMarketDebtPayModal
          isOpen={isDebtModalOpen}
          onClose={() => {
            setIsDebtModalOpen(false);
            setSelectedMarketForDebt(null);
          }}
          marketName={selectedMarketForDebt.name}
          market={selectedMarketForDebt}
          currentDebt={marketDebtMap.get(selectedMarketForDebt.name) || 0}
          collectorName={repName || 'مەندووب'}
          repId={repId || undefined}
        />
      )}
    </div>
  );
}

