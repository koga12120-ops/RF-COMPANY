import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { getStoredSession } from '../../lib/authService';
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
  X,
  Lock,
  RefreshCw,
  Layers,
  ArrowRightLeft
} from 'lucide-react';
import {
  createEmptySchedule,
  getWeekScheduleInfo,
  getCalculatedWeekSchedule,
  getWeekId,
  ScheduleRotationConfig
} from '../../lib/scheduleRotation';

export interface MarketDailyScheduleCardProps {
  role: 'sales_rep' | 'cashvan' | 'admin' | 'warehouse' | null;
  activeRepName?: string;
  activeCashvanName?: string;
  onSelectForOrder: (market: Market) => void;
  onSelectForCashvan?: (market: Market) => void;
  onSelectForDebtPay: (market: Market, debtAmount: number) => void;
  onOpenMarketActions?: (market: Market, debt: number, isVisited: boolean) => void;
  marketDebtMap?: Map<string, number>;
  isRepAllowed?: boolean;
  isCashvanAllowed?: boolean;
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

export default function MarketDailyScheduleCard({
  role,
  activeRepName,
  activeCashvanName,
  onSelectForOrder,
  onSelectForCashvan,
  onSelectForDebtPay,
  onOpenMarketActions,
  marketDebtMap,
  isRepAllowed,
  isCashvanAllowed
}: MarketDailyScheduleCardProps) {
  const [repDocId, setRepDocId] = useState<string | null>(null);
  const [schedule1, setSchedule1] = useState<Record<string, string[]>>(createEmptySchedule());
  const [schedule2, setSchedule2] = useState<Record<string, string[]>>(createEmptySchedule());
  const [rotationConfig, setRotationConfig] = useState<ScheduleRotationConfig>({
    activeScheduleOverride: 'auto',
    startingSchedule: '1'
  });
  const [viewingScheduleTab, setViewingScheduleTab] = useState<'1' | '2' | 'auto'>('auto');

  const [visits, setVisits] = useState<Record<string, boolean>>({});
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const currentDayIndex = new Date().getDay().toString();
  const [selectedDay, setSelectedDay] = useState<string>(currentDayIndex);
  
  // Selected market for mobile action bottom-sheet / modal
  const [actionMarket, setActionMarket] = useState<{ market: Market; isVisited: boolean; debt: number } | null>(null);

  const weekId = getWeekId();
  const storedSession = getStoredSession();
  const sessionRepId = storedSession?.repId || storedSession?.id || sessionStorage.getItem('active_rep_id') || '';
  const sessionRepName = storedSession?.name || storedSession?.username || sessionStorage.getItem('active_rep_name') || '';
  const effectiveName = activeRepName || activeCashvanName || sessionRepName || '';

  const rawUserType = storedSession?.userType;
  const userType: 'both' | 'rep' | 'cashvan' = rawUserType 
    ? rawUserType 
    : (storedSession ? (storedSession.isRep && storedSession.isCashvan ? 'both' : (storedSession.isCashvan ? 'cashvan' : 'rep')) : 'both');
  
  const effectiveIsRep = isRepAllowed !== undefined ? isRepAllowed : (role === 'admin' || role === 'warehouse' || userType === 'both' || userType === 'rep');
  const effectiveIsCashvan = isCashvanAllowed !== undefined ? isCashvanAllowed : (role === 'admin' || role === 'warehouse' || userType === 'both' || userType === 'cashvan');

  // Rotation information
  const weekInfo = useMemo(() => {
    return getWeekScheduleInfo(rotationConfig);
  }, [rotationConfig]);

  const activeCalculated = weekInfo.currentSchedule; // '1' or '2'
  const activeViewingSchedule: '1' | '2' = viewingScheduleTab === 'auto' ? activeCalculated : viewingScheduleTab;
  const currentSchedule = activeViewingSchedule === '1' ? schedule1 : schedule2;

  // Calculate week days with dates for header pills
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
      const count = (currentSchedule[day.key] || []).length;
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
  }, [currentSchedule, currentDayIndex, selectedDay]);

  // 1. Locate rep/cashvan doc id in Firestore (from reps or cashvans collection, or session)
  useEffect(() => {
    let activeId = sessionRepId || effectiveName || null;
    if (activeId) {
      setRepDocId(activeId);
    }

    const unsubReps = onSnapshot(
      collection(db, 'reps'),
      (snap) => {
        let foundId: string | null = null;
        snap.forEach((d) => {
          const data = d.data();
          if (
            (sessionRepId && d.id === sessionRepId) ||
            (effectiveName && (data.name === effectiveName || data.username === effectiveName || d.id === effectiveName))
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
                  (sessionRepId && cvDoc.id === sessionRepId) ||
                  (effectiveName && (cvData.name === effectiveName || cvData.username === effectiveName || cvDoc.id === effectiveName))
                ) {
                  cvFoundId = cvDoc.id;
                }
              });
              if (cvFoundId) {
                setRepDocId(cvFoundId);
              } else if (sessionRepId) {
                setRepDocId(sessionRepId);
              } else if (effectiveName) {
                setRepDocId(effectiveName);
              }
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
  }, [effectiveName, sessionRepId]);

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

    // Multi-way schedule lookup: by repDocId, sessionRepId, effectiveName, or schedules collection query
    const activeTargetId = repDocId || sessionRepId || effectiveName;
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

      if (effectiveName && effectiveName !== activeTargetId) {
        unsubSchedule2 = onSnapshot(
          doc(db, 'schedules', effectiveName),
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
    }

    // Also listen to all schedules in case rep is referenced inside the document
    unsubAllSchedules = onSnapshot(
      collection(db, 'schedules'),
      (snap) => {
        snap.forEach((d) => {
          const data = d.data();
          if (
            d.id === activeTargetId ||
            d.id === effectiveName ||
            d.id === sessionRepId ||
            data.repId === activeTargetId ||
            data.repId === sessionRepId ||
            (effectiveName && data.repName === effectiveName)
          ) {
            applyScheduleData(data);
          }
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'schedules');
      }
    );

    const qVisits = query(
      collection(db, 'schedule_visits'),
      where('weekId', '==', weekId)
    );
    const unsubVisits = onSnapshot(
      qVisits,
      (snap) => {
        const vMap: Record<string, boolean> = {};
        snap.forEach((d) => {
          const data = d.data();
          if (
            data.repId === activeTargetId ||
            data.repId === repDocId ||
            data.repId === sessionRepId ||
            data.repId === effectiveName ||
            (effectiveName && (data.repName === effectiveName || data.name === effectiveName))
          ) {
            if (!data.unvisited) {
              vMap[data.marketId] = true;
            }
          }
        });
        setVisits(vMap);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'schedule_visits');
      }
    );

    return () => {
      unsubMarkets();
      unsubSchedule1();
      unsubSchedule2();
      unsubAllSchedules();
      unsubVisits();
    };
  }, [repDocId, sessionRepId, effectiveName, weekId]);

  const marketMap = useMemo(() => {
    const map = new Map<string, Market>();
    markets.forEach((m) => map.set(m.id, m));
    return map;
  }, [markets]);

  const handleToggleVisit = async (marketId: string, currentStatus: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const activeId = repDocId || sessionRepId || effectiveName;
    if (!activeId) return;

    const visitId = `${activeId}_${weekId}_${marketId}`;
    try {
      if (currentStatus) {
        await setDoc(
          doc(db, 'schedule_visits', visitId),
          { repId: activeId, repName: effectiveName, weekId, marketId, visitedAt: null, unvisited: true },
          { merge: true }
        );
        setVisits(prev => ({ ...prev, [marketId]: false }));
      } else {
        await setDoc(
          doc(db, 'schedule_visits', visitId),
          { repId: activeId, repName: effectiveName, weekId, marketId, visitedAt: Date.now(), unvisited: false },
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
      const scheduledIds = currentSchedule[selectedDay] || [];
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
  }, [markets, currentSchedule, selectedDay, marketMap, visits, searchTerm]);

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
      {/* Top Header Bar: Schedule 1 / Schedule 2 Tabs & Auto-Rotation Info */}
      <div className="bg-slate-50/80 border-b border-slate-200 p-3 sm:p-4 space-y-3">
        {/* Dual Schedule Switcher & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <Layers size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-800">خشتەی سەردانی مارکێتەکان</h3>
                {effectiveName && (
                  <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md font-bold">
                    {effectiveName}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500">
                سیستەمی دوو خشتەیی بە سووڕی ئۆتۆماتیکی هەفتانە (شەممە تا پێنجشەممە)
              </div>
            </div>
          </div>

          {/* Schedule 1 / Schedule 2 Segmented Tabs */}
          <div className="flex items-center bg-slate-200/80 p-1 rounded-xl self-start sm:self-auto">
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

        {/* Auto Rotation Banner */}
        <div className="bg-indigo-50/70 border border-indigo-100/80 rounded-xl px-3 py-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-indigo-900">
            <RefreshCw size={14} className="text-indigo-600 shrink-0" />
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
                  if (!effectiveIsRep) {
                    alert('بەشی تەڵەبیە قوفڵکراوە!\nهەژماری تۆ تەنها وەک «کاشڤان» دیاریکراوە و بەشی مەندووب (تەڵەبیە) قوفڵە.\nبۆ کاراکردنی ئەم بەشە داوا لە بەڕێوەبەر بکە لە لیستی مەندووب و کاشڤانەکان هەژمارەکەت بکاتە «مەندووب و کاشڤان».');
                    return;
                  }
                  const m = actionMarket.market;
                  setActionMarket(null);
                  onSelectForOrder(m);
                }}
                className={`w-full p-2.5 rounded-xl flex items-center gap-2.5 transition text-right ${
                  !effectiveIsRep
                    ? 'bg-slate-50 border border-dashed border-red-200 opacity-60 cursor-not-allowed'
                    : 'bg-indigo-50/70 hover:bg-indigo-100 text-slate-900 border border-indigo-100 active:scale-98'
                }`}
              >
                <div className={`p-2 rounded-lg shadow-xs shrink-0 ${!effectiveIsRep ? 'bg-slate-200 text-slate-500' : 'bg-indigo-600 text-white'}`}>
                  {!effectiveIsRep ? <Lock size={16} className="text-red-500" /> : <ShoppingCart size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-xs sm:text-sm text-indigo-950">١. تەڵەبیە</div>
                    {!effectiveIsRep && (
                      <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Lock size={10} />
                        قوفڵە
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {!effectiveIsRep ? 'تەنها بۆ مەندووبە و بۆ تۆ قوفڵکراوە' : 'تۆمارکردنی داواکاری کاڵاکانی کۆگا'}
                  </div>
                </div>
              </button>

              {/* Option 2: کاشڤان */}
              <button
                onClick={() => {
                  if (!effectiveIsCashvan) {
                    alert('بەشی فرۆشتنی کاشڤان قوفڵکراوە!\nهەژماری تۆ تەنها وەک «مەندووب» دیاریکراوە و بەشی کاشڤان قوفڵە.\nبۆ کاراکردنی ئەم بەشە داوا لە بەڕێوەبەر بکە لە لیستی مەندووب و کاشڤانەکان هەژمارەکەت بکاتە «مەندووب و کاشڤان».');
                    return;
                  }
                  const m = actionMarket.market;
                  setActionMarket(null);
                  if (onSelectForCashvan) {
                    onSelectForCashvan(m);
                  } else {
                    onSelectForOrder(m);
                  }
                }}
                className={`w-full p-2.5 rounded-xl flex items-center gap-2.5 transition text-right ${
                  !effectiveIsCashvan
                    ? 'bg-slate-50 border border-dashed border-red-200 opacity-60 cursor-not-allowed'
                    : 'bg-amber-50/70 hover:bg-amber-100 text-slate-900 border border-amber-100 active:scale-98'
                }`}
              >
                <div className={`p-2 rounded-lg shadow-xs shrink-0 ${!effectiveIsCashvan ? 'bg-slate-200 text-slate-500' : 'bg-amber-600 text-white'}`}>
                  {!effectiveIsCashvan ? <Lock size={16} className="text-red-500" /> : <Truck size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-xs sm:text-sm text-amber-950">٢. کاشڤان</div>
                    {!effectiveIsCashvan && (
                      <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Lock size={10} />
                        قوفڵە
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {!effectiveIsCashvan ? 'تەنها بۆ کاشڤانە و بۆ تۆ قوفڵکراوە' : 'فرۆشتن لە کاڵاکانی ناو ڤان'}
                  </div>
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
