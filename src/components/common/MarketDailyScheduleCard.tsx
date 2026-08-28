import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { Market } from '../../types';
import {
  Calendar,
  Store,
  Menu,
  ShoppingCart,
  Truck,
  CreditCard,
  CheckCircle2,
  Phone,
  MapPin,
  Search,
  X
} from 'lucide-react';

export interface MarketDailyScheduleCardProps {
  role: 'sales_rep' | 'cashvan' | 'admin' | 'warehouse' | null;
  activeRepName?: string;
  activeCashvanName?: string;
  onSelectForOrder: (market: Market) => void;
  onSelectForCashvan?: (market: Market) => void;
  onSelectForDebtPay: (market: Market, debtAmount: number) => void;
  onOpenMarketActions?: (market: Market, debt: number, isVisited: boolean) => void;
  marketDebtMap?: Map<string, number>;
}

const DAYS = [
  { key: '6', label: 'شەممە' },
  { key: '0', label: 'یەکشەممە' },
  { key: '1', label: 'دووشەممە' },
  { key: '2', label: 'سێشەممە' },
  { key: '3', label: 'چوارشەممە' },
  { key: '4', label: 'پێنجشەممە' },
  { key: '5', label: 'هەینی' }
];

const getWeekId = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 6 ? 0 : day + 1;
  d.setDate(d.getDate() - diff);
  return `week_${d.toISOString().split('T')[0]}`;
};

export default function MarketDailyScheduleCard({
  role,
  activeRepName,
  activeCashvanName,
  onSelectForOrder,
  onSelectForCashvan,
  onSelectForDebtPay,
  onOpenMarketActions,
  marketDebtMap
}: MarketDailyScheduleCardProps) {
  const [repDocId, setRepDocId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<Record<string, string[]>>({});
  const [visits, setVisits] = useState<Record<string, boolean>>({});
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const currentDayIndex = new Date().getDay().toString();
  const [selectedDay, setSelectedDay] = useState<string>(currentDayIndex);
  
  // Selected market for mobile action bottom-sheet / modal
  const [actionMarket, setActionMarket] = useState<{ market: Market; isVisited: boolean; debt: number } | null>(null);

  const weekId = getWeekId();
  const effectiveName = activeRepName || activeCashvanName || auth.currentUser?.displayName || '';

  // Calculate week days with dates for header pills (like the screenshot)
  const weekDays = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay();
    const diffToSaturday = currentDay === 6 ? 0 : currentDay + 1;
    const saturday = new Date(now);
    saturday.setDate(now.getDate() - diffToSaturday);
    saturday.setHours(0, 0, 0, 0);

    return DAYS.map((day, idx) => {
      const d = new Date(saturday);
      d.setDate(saturday.getDate() + idx);
      const dayNum = d.getDate();
      const monthNum = d.getMonth() + 1;
      const yearNum = d.getFullYear();
      const count = (schedule[day.key] || []).length;
      const isToday = day.key === currentDayIndex;
      const isSelected = selectedDay === day.key;
      return {
        ...day,
        dateFormatted: `${dayNum}.${monthNum}.${yearNum}`,
        count,
        isToday,
        isSelected
      };
    });
  }, [schedule, currentDayIndex, selectedDay]);

  // 1. Locate rep/cashvan doc id in Firestore
  useEffect(() => {
    const findRepId = async () => {
      const userUid = auth.currentUser?.uid;
      if (!userUid) {
        setRepDocId(null);
        return;
      }

      const unsubReps = onSnapshot(
        collection(db, 'reps'),
        (snap) => {
          let foundId: string | null = null;
          snap.forEach((d) => {
            const data = d.data();
            if (
              d.id === userUid ||
              data.uid === userUid ||
              (effectiveName && data.name === effectiveName)
            ) {
              foundId = d.id;
            }
          });
          if (foundId) {
            setRepDocId(foundId);
          } else {
            const unsubCV = onSnapshot(
              collection(db, 'cashvans'),
              (cvSnap) => {
                let cvFoundId: string | null = null;
                cvSnap.forEach((cvDoc) => {
                  const cvData = cvDoc.data();
                  if (
                    cvDoc.id === userUid ||
                    cvData.uid === userUid ||
                    (effectiveName && cvData.name === effectiveName)
                  ) {
                    cvFoundId = cvDoc.id;
                  }
                });
                setRepDocId(cvFoundId || userUid);
              },
              (err) => {
                handleFirestoreError(err, OperationType.GET, 'cashvans');
              }
            );
            return () => unsubCV();
          }
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, 'reps');
        }
      );

      return () => unsubReps();
    };

    findRepId();
  }, [effectiveName]);

  // 2. Fetch schedule, visits, and markets
  useEffect(() => {
    const unsubMarkets = onSnapshot(
      collection(db, 'markets'),
      (snap) => {
        const mks: Market[] = [];
        snap.forEach((d) => {
          mks.push({ id: d.id, ...d.data() } as Market);
        });
        setMarkets(mks);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'markets');
      }
    );

    let unsubSchedule = () => {};
    if (repDocId) {
      unsubSchedule = onSnapshot(
        doc(db, 'schedules', repDocId),
        (docSnap) => {
          if (docSnap.exists()) {
            setSchedule(docSnap.data().schedule || {});
          } else {
            if (auth.currentUser?.uid && auth.currentUser.uid !== repDocId) {
              onSnapshot(doc(db, 'schedules', auth.currentUser.uid), (uSnap) => {
                if (uSnap.exists()) {
                  setSchedule(uSnap.data().schedule || {});
                }
              });
            } else {
              setSchedule({});
            }
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, 'schedules');
        }
      );
    }

    let unsubVisits = () => {};
    if (repDocId) {
      const qVisits = query(
        collection(db, 'schedule_visits'),
        where('weekId', '==', weekId)
      );
      unsubVisits = onSnapshot(
        qVisits,
        (snap) => {
          const vMap: Record<string, boolean> = {};
          snap.forEach((d) => {
            const data = d.data();
            if (data.repId === repDocId || data.repId === auth.currentUser?.uid) {
              vMap[data.marketId] = true;
            }
          });
          setVisits(vMap);
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, 'schedule_visits');
        }
      );
    }

    return () => {
      unsubMarkets();
      unsubSchedule();
      unsubVisits();
    };
  }, [repDocId, weekId]);

  const marketMap = useMemo(() => {
    const map = new Map<string, Market>();
    markets.forEach((m) => map.set(m.id, m));
    return map;
  }, [markets]);

  const handleToggleVisit = async (marketId: string, currentStatus: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const activeId = repDocId || auth.currentUser?.uid;
    if (!activeId) return;

    const visitId = `${activeId}_${weekId}_${marketId}`;
    try {
      if (currentStatus) {
        await setDoc(
          doc(db, 'schedule_visits', visitId),
          { repId: activeId, weekId, marketId, visitedAt: null, unvisited: true },
          { merge: true }
        );
        setVisits(prev => ({ ...prev, [marketId]: false }));
      } else {
        await setDoc(
          doc(db, 'schedule_visits', visitId),
          { repId: activeId, weekId, marketId, visitedAt: Date.now() },
          { merge: true }
        );
        setVisits(prev => ({ ...prev, [marketId]: true }));
      }
    } catch (error) {
      console.error('Error toggling visit:', error);
    }
  };

  const displayMarkets = useMemo(() => {
    let list: { market: Market; isScheduled: boolean; isVisited: boolean }[] = [];

    if (selectedDay === 'all') {
      list = markets.map((m) => ({
        market: m,
        isScheduled: false,
        isVisited: !!visits[m.id]
      }));
    } else {
      const scheduledIds = schedule[selectedDay] || [];
      list = scheduledIds
        .map((id) => marketMap.get(id))
        .filter((m): m is Market => Boolean(m))
        .map((m) => ({
          market: m,
          isScheduled: true,
          isVisited: !!visits[m.id]
        }));
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.market.name.toLowerCase().includes(term) ||
          (item.market.location && item.market.location.toLowerCase().includes(term)) ||
          (item.market.phone && item.market.phone.includes(term))
      );
    }

    return list;
  }, [markets, schedule, selectedDay, marketMap, visits, searchTerm]);

  const getDebt = (marketName: string) => {
    if (!marketDebtMap) return 0;
    const clean = marketName?.trim();
    if (!clean) return 0;
    const direct = marketDebtMap.get(clean);
    if (direct !== undefined) return direct;
    for (const [key, val] of marketDebtMap.entries()) {
      if (key.trim().toLowerCase() === clean.toLowerCase()) return val;
    }
    return 0;
  };

  const selectedDayLabel = selectedDay === 'all' 
    ? 'سەرجەم مارکێتەکان' 
    : DAYS.find(d => d.key === selectedDay)?.label || 'ڕۆژ';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
      {/* Top Header Bar: Clean Light Theme with Horizontally Scrollable Days */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 sm:p-4">
        {/* Days Horizontal Scroll */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {weekDays.map((day) => {
            const isSelected = day.isSelected;
            return (
              <button
                key={day.key}
                type="button"
                onClick={() => setSelectedDay(day.key)}
                className={`flex-shrink-0 px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-1 min-w-[95px] sm:min-w-[105px] border ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm scale-102'
                    : day.isToday
                    ? 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100/70'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100/80'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                    isSelected ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {day.count}
                  </span>
                  <span>{day.label}</span>
                </div>
                <div className={`text-[10px] font-mono tracking-tight ${
                  isSelected ? 'text-indigo-100 font-bold' : 'text-slate-500'
                }`}>
                  {day.dateFormatted}
                </div>
              </button>
            );
          })}

          {/* All Markets Button (Only for Admin/Warehouse) */}
          {(role === 'admin' || role === 'warehouse') && (
            <button
              type="button"
              onClick={() => setSelectedDay('all')}
              className={`flex-shrink-0 px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-1 min-w-[95px] border ${
                selectedDay === 'all'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-1">
                <Store size={12} />
                <span>هەموو</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 font-bold">
                {markets.length} مارکێت
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Markets List Body (Matching the Reference Image Row Design) */}
      <div className="divide-y divide-slate-100">
        {loading ? (
          <div className="text-center py-12 text-xs text-slate-400 font-bold">
            خەریکی هێنانی خشتەی سەردانەکانە...
          </div>
        ) : displayMarkets.length === 0 ? (
          <div className="bg-slate-50 p-8 text-center space-y-2">
            <Store size={32} className="mx-auto text-slate-400" />
            <div className="font-bold text-sm text-slate-700">
              {selectedDay === 'all'
                ? 'هیچ مارکێتێک نەدۆزرایەوە'
                : `هیچ مارکێتێک لە خشتەی (${selectedDayLabel})دا نییە`}
            </div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              ڕۆژێکی تر لە خشتەی سەرەوە هەڵبژێرە بۆ بینینی مارکێتەکان.
            </p>
          </div>
        ) : (
          displayMarkets.map(({ market, isScheduled, isVisited }, index) => {
            const debt = getDebt(market.name);

            return (
              <div
                key={market.id}
                className={`p-3 sm:p-4 flex items-center justify-between gap-3 transition-colors ${
                  isVisited
                    ? 'bg-emerald-50/30 hover:bg-emerald-50/50'
                    : 'bg-white hover:bg-slate-50'
                }`}
              >
                {/* Start Column: Index, Phone, Name, Visited Badge */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-400 font-mono font-bold text-xs">
                      {String(index + 1).padStart(2, '0')}.
                    </span>
                    <span className="font-mono font-bold text-xs text-slate-700 tracking-wider" dir="ltr">
                      {market.phone || market.code || '---'}
                    </span>
                    {isVisited && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] rounded-md font-bold">
                        <CheckCircle2 size={11} />
                        <span>سەردانکراو</span>
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-sm sm:text-base text-slate-900 mt-1 truncate">
                    {market.name}
                  </h3>

                  {market.location && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5 truncate">
                      <MapPin size={11} className="text-slate-400 shrink-0" />
                      <span className="truncate">{market.location}</span>
                    </div>
                  )}
                </div>

                {/* Middle Column: Current Debt Amount */}
                <div className="px-2 text-left shrink-0">
                  <div
                    className={`font-mono font-bold text-xs sm:text-sm ${
                      debt > 0 ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                    dir="ltr"
                  >
                    {debt > 0 ? `+${debt.toLocaleString()} IQD` : `0 IQD`}
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold text-right">
                    بڕی قەرز
                  </div>
                </div>

                {/* End Column: 3-Dots Action Menu Pill Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenMarketActions) {
                      onOpenMarketActions(market, debt, isVisited);
                    } else {
                      setActionMarket({ market, isVisited, debt });
                    }
                  }}
                  className="w-9 h-12 rounded-xl bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 flex flex-col items-center justify-center gap-1 transition active:scale-95 shadow-2xs shrink-0 border border-slate-200"
                  title="مینیوی کارەکان"
                >
                  <div className="w-1.5 h-1.5 bg-current rounded-full"></div>
                  <div className="w-1.5 h-1.5 bg-current rounded-full"></div>
                  <div className="w-1.5 h-1.5 bg-current rounded-full"></div>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* FIXED BOTTOM SHEET / ACTION MODAL FOR MOBILE & DESKTOP */}
      {actionMarket && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setActionMarket(null)}
        >
          <div 
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom duration-200 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  <Store size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{actionMarket.market.name}</h3>
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <span>قەرزی ئێستا:</span>
                    <strong className={`font-mono ${actionMarket.debt > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {actionMarket.debt.toLocaleString()} د.ع
                    </strong>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setActionMarket(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Action Options */}
            <div className="p-3 sm:p-4 space-y-2 overflow-y-auto">
              {/* Option 1: تەڵەبیە */}
              <button
                onClick={() => {
                  const m = actionMarket.market;
                  setActionMarket(null);
                  onSelectForOrder(m);
                }}
                className="w-full p-2.5 bg-indigo-50/70 hover:bg-indigo-100 text-slate-900 rounded-xl flex items-center gap-2.5 transition border border-indigo-100 text-right active:scale-98"
              >
                <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-xs shrink-0">
                  <ShoppingCart size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-xs sm:text-sm text-indigo-950">١. تەڵەبیە</div>
                  <div className="text-[11px] text-slate-500 truncate">تۆمارکردنی داواکاری کاڵاکانی کۆگا</div>
                </div>
              </button>

              {/* Option 2: کاشڤان */}
              <button
                onClick={() => {
                  const m = actionMarket.market;
                  setActionMarket(null);
                  if (onSelectForCashvan) {
                    onSelectForCashvan(m);
                  } else {
                    onSelectForOrder(m);
                  }
                }}
                className="w-full p-2.5 bg-amber-50/70 hover:bg-amber-100 text-slate-900 rounded-xl flex items-center gap-2.5 transition border border-amber-100 text-right active:scale-98"
              >
                <div className="p-2 bg-amber-600 text-white rounded-lg shadow-xs shrink-0">
                  <Truck size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-xs sm:text-sm text-amber-950">٢. کاشڤان</div>
                  <div className="text-[11px] text-slate-500 truncate">فرۆشتن لە کاڵاکانی ناو ڤان</div>
                </div>
              </button>

              {/* Option 3: دانەوەی قەرز */}
              <button
                onClick={() => {
                  const m = actionMarket.market;
                  const d = actionMarket.debt;
                  setActionMarket(null);
                  onSelectForDebtPay(m, d);
                }}
                className="w-full p-2.5 bg-emerald-50/70 hover:bg-emerald-100 text-slate-900 rounded-xl flex items-center gap-2.5 transition border border-emerald-100 text-right active:scale-98"
              >
                <div className="p-2 bg-emerald-600 text-white rounded-lg shadow-xs shrink-0">
                  <CreditCard size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-xs sm:text-sm text-emerald-950">٣. دانەوەی قەرزی مارکێت</div>
                  <div className="text-[11px] text-slate-500 truncate">وەرگرتنەوەی قەرز و پسوڵە</div>
                </div>
              </button>

              {/* Option 4: سەردانیکراو */}
              <button
                onClick={(e) => {
                  handleToggleVisit(actionMarket.market.id, actionMarket.isVisited, e);
                  setActionMarket(null);
                }}
                className="w-full p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl flex items-center justify-between transition border border-slate-200 text-right active:scale-98"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg shrink-0 ${actionMarket.isVisited ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'}`}>
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <div className="font-bold text-xs sm:text-sm text-slate-900">
                      {actionMarket.isVisited ? 'نیشانکردن وەک سەردان نەکراو' : '٤. وەک سەردانیکراو نیشانی بدە'}
                    </div>
                    <div className="text-[11px] text-slate-500">گۆڕینی دۆخی سەردان</div>
                  </div>
                </div>
              </button>
            </div>

            {/* Close button at bottom */}
            <div className="p-3 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setActionMarket(null)}
                className="w-full py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition"
              >
                داخستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
