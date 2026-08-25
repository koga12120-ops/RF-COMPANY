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
      {/* Days of Week Navigation Bar */}
      <div className="p-3 sm:p-4 border-b border-slate-100 space-y-3">
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
          {/* Day Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {DAYS.map((day) => {
              const count = (schedule[day.key] || []).length;
              const isToday = day.key === currentDayIndex;
              const isSelected = selectedDay === day.key;

              return (
                <button
                  key={day.key}
                  onClick={() => setSelectedDay(day.key)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : isToday
                      ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80'
                  }`}
                >
                  <span>{day.label}</span>
                  {isToday && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${isSelected ? 'bg-indigo-500 text-white' : 'bg-indigo-200 text-indigo-900'}`}>
                      ئەمڕۆ
                    </span>
                  )}
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}

            {/* All Markets Button */}
            <button
              onClick={() => setSelectedDay('all')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                selectedDay === 'all'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80'
              }`}
            >
              <Store size={13} />
              <span>سەرجەم مارکێتەکان</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${selectedDay === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {markets.length}
              </span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-xs md:max-w-sm">
            <input
              type="text"
              placeholder="گەڕان بۆ مارکێت..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-8 pl-8 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white text-xs text-slate-800 placeholder-slate-400 transition"
            />
            <Search className="absolute right-2.5 top-2.5 text-slate-400" size={15} />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Markets List Body */}
      <div className="p-4 sm:p-5">
        {loading ? (
          <div className="text-center py-10 text-xs text-slate-400 font-bold">
            خەریکی هێنانی خشتەی سەردانەکانە...
          </div>
        ) : displayMarkets.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center space-y-2">
            <Store size={32} className="mx-auto text-slate-400" />
            <div className="font-bold text-sm text-slate-700">
              {selectedDay === 'all'
                ? 'هیچ مارکێتێک نەدۆزرایەوە'
                : `هیچ مارکێتێک لە خشتەی (${selectedDayLabel})دا دانەنراوە`}
            </div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              دەتوانیت ڕۆژێکی تر هەڵبژێریت یان لە بەشی "سەرجەم مارکێتەکان" مارکێتەکە بدۆزیتەوە.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {displayMarkets.map(({ market, isScheduled, isVisited }) => {
              const debt = getDebt(market.name);

              return (
                <div
                  key={market.id}
                  className={`relative p-3.5 rounded-xl border transition-all duration-150 flex flex-col justify-between gap-3 ${
                    isVisited
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : isScheduled
                      ? 'bg-white border-slate-200 hover:border-indigo-400 shadow-2xs'
                      : 'bg-slate-50/60 border-slate-200'
                  }`}
                >
                  {/* Top Row: Name, Status & 3-Lines Menu */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold text-sm text-slate-900 truncate">
                          {market.name}
                        </h3>
                        {isVisited && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] rounded-md font-bold">
                            <CheckCircle2 size={10} />
                            <span>سەردانکراو</span>
                          </span>
                        )}
                      </div>

                      {/* Location & Phone */}
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 truncate">
                        {market.location && (
                          <span className="flex items-center gap-1 truncate" title={market.location}>
                            <MapPin size={11} className="text-slate-400 shrink-0" />
                            <span className="truncate">{market.location}</span>
                          </span>
                        )}
                        {market.phone && (
                          <a
                            href={`tel:${market.phone}`}
                            className="flex items-center gap-1 hover:text-indigo-600 font-mono"
                            dir="ltr"
                          >
                            <Phone size={11} className="text-slate-400 shrink-0" />
                            <span>{market.phone}</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* 3-Lines Menu Button */}
                    <button
                      type="button"
                      onClick={() => setActionMarket({ market, isVisited, debt })}
                      className="p-2 rounded-xl transition border flex items-center justify-center min-w-[38px] min-h-[38px] bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border-indigo-200 shadow-2xs active:scale-95"
                      title="مینیوی کارەکانی ئەم مارکێتە"
                    >
                      <Menu size={18} />
                    </button>
                  </div>

                  {/* Bottom Row: Debt Balance & Quick Actions */}
                  <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    {/* Current Debt Badge */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500 font-bold">قەرز:</span>
                      <span
                        className={`font-mono font-bold text-xs px-2 py-0.5 rounded-lg border ${
                          debt > 0
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}
                        dir="ltr"
                      >
                        {debt.toLocaleString()} د.ع
                      </span>
                    </div>

                    {/* Fast Action Buttons */}
                    <div className="flex items-center gap-1.5 flex-1 sm:flex-initial justify-end">
                      <button
                        type="button"
                        onClick={() => onSelectForDebtPay(market, debt)}
                        className="flex-1 sm:flex-initial px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow-2xs"
                        title="دانەوەی قەرز"
                      >
                        <CreditCard size={13} />
                        <span>قەرزدانەوە</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectForOrder(market)}
                        className="flex-1 sm:flex-initial px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow-2xs"
                        title="داواکاری"
                      >
                        <ShoppingCart size={13} />
                        <span>داواکاری</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
            <div className="p-3 sm:p-4 space-y-2.5 overflow-y-auto">
              {/* Option 1: تەڵەبییە */}
              <button
                onClick={() => {
                  const m = actionMarket.market;
                  setActionMarket(null);
                  onSelectForOrder(m);
                }}
                className="w-full p-3.5 bg-indigo-50/70 hover:bg-indigo-100 text-slate-900 rounded-2xl flex items-center gap-3 transition border border-indigo-100 text-right active:scale-98"
              >
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs shrink-0">
                  <ShoppingCart size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-indigo-950">١. تەڵەبییە (داواکاری مەندووب)</div>
                  <div className="text-xs text-slate-500 mt-0.5">تۆمارکردنی داواکاری کاڵا بە قەرز یان نەقد</div>
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
                className="w-full p-3.5 bg-amber-50/70 hover:bg-amber-100 text-slate-900 rounded-2xl flex items-center gap-3 transition border border-amber-100 text-right active:scale-98"
              >
                <div className="p-2.5 bg-amber-600 text-white rounded-xl shadow-xs shrink-0">
                  <Truck size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-amber-950">٢. کاشڤان (فرۆشتنی ڕاستەوخۆ)</div>
                  <div className="text-xs text-slate-500 mt-0.5">فرۆشتن لە کاڵاکانی ناو ڤان بە نەقد یان قەرز</div>
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
                className="w-full p-3.5 bg-emerald-50/70 hover:bg-emerald-100 text-slate-900 rounded-2xl flex items-center gap-3 transition border border-emerald-100 text-right active:scale-98"
              >
                <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0">
                  <CreditCard size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-emerald-950">٣. دانەوەی قەرزی مارکێت</div>
                  <div className="text-xs text-slate-500 mt-0.5">وەرگرتنەوەی قەرز و چاپکردنی پسوڵەی وەرگرتن</div>
                </div>
              </button>

              {/* Option 4: سەردانیکراو */}
              <button
                onClick={(e) => {
                  handleToggleVisit(actionMarket.market.id, actionMarket.isVisited, e);
                  setActionMarket(null);
                }}
                className="w-full p-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl flex items-center justify-between transition border border-slate-200 text-right active:scale-98"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl shrink-0 ${actionMarket.isVisited ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'}`}>
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-900">
                      {actionMarket.isVisited ? 'نیشانکردن وەک سەردان نەکراو' : '٤. وەک سەردانیکراو نیشانی بدە'}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">گۆڕینی دۆخی سەردان لە خشتەی ئەمڕۆدا</div>
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
