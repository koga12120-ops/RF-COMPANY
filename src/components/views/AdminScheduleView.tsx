import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { Market, SalesRep } from '../../types';
import { 
  Calendar, Save, Trash2, Search, Store, UserCheck, Plus, CheckCircle2, 
  AlertCircle, Sparkles, RefreshCw, Copy, Layers, Clock, ArrowRightLeft, Info
} from 'lucide-react';
import { 
  createEmptySchedule, 
  getWeekScheduleInfo, 
  ScheduleRotationConfig,
  getCalculatedWeekSchedule
} from '../../lib/scheduleRotation';

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
  
  // Two distinct schedules: Plan 1 (خشتەی یەکەم) and Plan 2 (خشتەی دووەم)
  const [schedule1, setSchedule1] = useState<Record<string, string[]>>(createEmptySchedule());
  const [schedule2, setSchedule2] = useState<Record<string, string[]>>(createEmptySchedule());
  
  // Rotation Settings
  const [activeEditingSchedule, setActiveEditingSchedule] = useState<'1' | '2'>('1');
  const [activeScheduleOverride, setActiveScheduleOverride] = useState<'auto' | '1' | '2'>('auto');
  const [startingSchedule, setStartingSchedule] = useState<'1' | '2'>('1');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [marketSearch, setMarketSearch] = useState<Record<string, string>>({});

  useEffect(() => {
    let repsList: SalesRep[] = [];
    let cashvansList: SalesRep[] = [];

    const updateCombinedReps = () => {
      const map = new Map<string, SalesRep>();
      repsList.forEach(r => map.set(r.id, r));
      cashvansList.forEach(cv => {
        if (!map.has(cv.id)) {
          map.set(cv.id, cv);
        }
      });
      const combined = Array.from(map.values());
      combined.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setReps(combined);
    };

    const unsubReps = onSnapshot(
      query(collection(db, 'reps')),
      (snapshot) => {
        repsList = [];
        snapshot.forEach(doc => repsList.push({ id: doc.id, ...doc.data() } as SalesRep));
        updateCombinedReps();
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'reps');
      }
    );

    const unsubCashvans = onSnapshot(
      query(collection(db, 'cashvans')),
      (snapshot) => {
        cashvansList = [];
        snapshot.forEach(doc => cashvansList.push({ id: doc.id, isCashvan: true, ...doc.data() } as any));
        updateCombinedReps();
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'cashvans');
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
      unsubCashvans();
      unsubMarkets();
    };
  }, []);

  // Fetch Rep's Dual Schedules
  useEffect(() => {
    if (!selectedRep) {
      setSchedule1(createEmptySchedule());
      setSchedule2(createEmptySchedule());
      setActiveScheduleOverride('auto');
      setStartingSchedule('1');
      return;
    }

    const unsubSchedule = onSnapshot(
      doc(db, 'schedules', selectedRep),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Backward compatibility: if only legacy `schedule` exists, load into schedule1
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

          setActiveScheduleOverride(data.activeScheduleOverride || 'auto');
          setStartingSchedule(data.startingSchedule || '1');
        } else {
          setSchedule1(createEmptySchedule());
          setSchedule2(createEmptySchedule());
          setActiveScheduleOverride('auto');
          setStartingSchedule('1');
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'schedules');
      }
    );
    return () => unsubSchedule();
  }, [selectedRep]);

  // Current active schedule for display
  const currentEditingSchedule = activeEditingSchedule === '1' ? schedule1 : schedule2;
  const setCurrentEditingSchedule = activeEditingSchedule === '1' ? setSchedule1 : setSchedule2;

  // Rotation Information
  const rotationConfig: ScheduleRotationConfig = useMemo(() => ({
    activeScheduleOverride,
    startingSchedule
  }), [activeScheduleOverride, startingSchedule]);

  const weekInfo = useMemo(() => {
    return getWeekScheduleInfo(rotationConfig);
  }, [rotationConfig]);

  const handleAddMarket = (day: string, marketId: string) => {
    if (!marketId) return;
    setCurrentEditingSchedule(prev => {
      const dayList = prev[day] || [];
      if (dayList.includes(marketId)) return prev;
      return { ...prev, [day]: [...dayList, marketId] };
    });
  };

  const handleRemoveMarket = (day: string, marketId: string) => {
    setCurrentEditingSchedule(prev => ({
      ...prev,
      [day]: (prev[day] || []).filter(id => id !== marketId)
    }));
  };

  // Copy helper
  const handleCopySchedule = (from: '1' | '2', to: '1' | '2') => {
    const source = from === '1' ? schedule1 : schedule2;
    const copied: Record<string, string[]> = {};
    Object.keys(source).forEach(key => {
      copied[key] = [...(source[key] || [])];
    });

    if (to === '1') {
      setSchedule1(copied);
    } else {
      setSchedule2(copied);
    }

    setSaveSuccess(`مارکێتەکانی (${from === '1' ? 'خشتەی یەکەم' : 'خشتەی دووەم'}) بە سەرکەوتوویی کۆپیکران بۆ (${to === '1' ? 'خشتەی یەکەم' : 'خشتەی دووەم'}).`);
    setTimeout(() => setSaveSuccess(null), 4000);
  };

  const handleClearCurrentSchedule = () => {
    if (confirm(`دڵنیایت لە بەتاڵکردنەوەی تەواوی مارکێتەکانی (${activeEditingSchedule === '1' ? 'خشتەی یەکەم' : 'خشتەی دووەم'})؟`)) {
      setCurrentEditingSchedule(createEmptySchedule());
    }
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
  }, [schedule1, schedule2, selectedRep, saving, activeScheduleOverride, startingSchedule]);

  const handleSave = async () => {
    if (!selectedRep) return;
    setSaving(true);
    setSaveSuccess(null);
    setSaveError(null);
    try {
      const repObj = reps.find(r => r.id === selectedRep);
      const repDisplayName = repObj?.name || 'مەندووب';

      // Current active schedule for legacy fallback
      const activeScheduleNow = getCalculatedWeekSchedule(rotationConfig);
      const legacySchedule = activeScheduleNow === '2' ? schedule2 : schedule1;

      const payload = {
        repId: selectedRep,
        repName: repDisplayName,
        schedule: legacySchedule, // fallback for legacy versions
        schedule1,
        schedule2,
        activeScheduleOverride,
        startingSchedule,
        updatedAt: Date.now()
      };

      await setDoc(doc(db, 'schedules', selectedRep), payload, { merge: true });

      if (repObj?.name && repObj.name !== selectedRep) {
        await setDoc(doc(db, 'schedules', repObj.name), payload, { merge: true });
      }

      setSaveSuccess(`خشتەی سەردانی دوو هەفتەیی (${repDisplayName}) بە سەرکەوتوویی پاشەکەوت کرا.`);
      setTimeout(() => {
        setSaveSuccess(null);
      }, 5000);
    } catch (error) {
      console.error(error);
      setSaveError('کێشەیەک لە پاشەکەوتکردنی خشتە ڕوویدا، تکایە دووبارە هەوڵبدەرەوە.');
      setTimeout(() => {
        setSaveError(null);
      }, 5000);
    } finally {
      setSaving(false);
    }
  };

  const selectedRepObj = reps.find(r => r.id === selectedRep);

  const totalAssigned1 = (Object.values(schedule1) as string[][]).reduce((acc, curr) => acc + (curr?.length || 0), 0);
  const totalAssigned2 = (Object.values(schedule2) as string[][]).reduce((acc, curr) => acc + (curr?.length || 0), 0);

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
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-800">سیستەمی دوو خشتەیی بە نۆرە بۆ مەندووب و کاشڤان</h2>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-md border border-emerald-200">
                  خۆکارانە بە نۆرە (Alternating)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                دانانی دوو نەخشەی سەردان (خشتەی یەکەم و خشتەی دووەم) لە شەممە تا پێنجشەممە کە هەفتانە تۆماتیکی دەگۆڕێنەوە
              </p>
            </div>
          </div>

          {selectedRep && (
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-6 py-2.5 rounded-xl font-bold active:scale-98 transition flex items-center gap-2 shadow-xs disabled:opacity-60 text-xs sm:text-sm ${
                saveSuccess
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 ring-2 ring-emerald-300'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 size={18} className="animate-bounce" />
                  <span>پاشەکەوت کرا!</span>
                </>
              ) : (
                <>
                  <Save size={18} />
                  <span>{saving ? 'پاشەکەوت دەکرێت...' : 'پاشەکەوتکردنی هەردوو خشتەکە'}</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Success / Error Notification Banners */}
        {saveSuccess && (
          <div className="mb-6 p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl flex items-center gap-3 text-emerald-900 shadow-sm animate-fade-in">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-black flex items-center gap-2">
                <span>سەرکەوتوو بوو!</span>
                <Sparkles size={16} className="text-emerald-600" />
              </div>
              <div className="text-xs text-emerald-800 font-medium mt-0.5">
                {saveSuccess}
              </div>
            </div>
            <button
              onClick={() => setSaveSuccess(null)}
              className="text-emerald-600 hover:text-emerald-900 text-xs font-bold px-3 py-1 bg-emerald-100/80 rounded-lg hover:bg-emerald-200 transition shrink-0"
            >
              داخستن
            </button>
          </div>
        )}

        {saveError && (
          <div className="mb-6 p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-center gap-3 text-rose-900 shadow-sm animate-fade-in">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
              <AlertCircle size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-black">هەڵە لە پاشەکەوتکردن</div>
              <div className="text-xs text-rose-800 font-medium mt-0.5">{saveError}</div>
            </div>
            <button
              onClick={() => setSaveError(null)}
              className="text-rose-600 hover:text-rose-900 text-xs font-bold px-3 py-1 bg-rose-100 rounded-lg hover:bg-rose-200 transition shrink-0"
            >
              داخستن
            </button>
          </div>
        )}

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
                <div className="text-xs text-slate-500">کۆی مارکێتەکانی هەردوو خشتە</div>
                <div className="text-xs sm:text-sm font-bold text-indigo-700 flex items-center gap-2">
                  <span>خشتەی ١: <strong>{totalAssigned1}</strong></span>
                  <span>•</span>
                  <span>خشتەی ٢: <strong>{totalAssigned2}</strong></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {selectedRep ? (
          <div className="space-y-6">
            {/* Automatic Alternating Rotation Banner */}
            <div className="p-4 bg-gradient-to-r from-indigo-50 via-blue-50 to-emerald-50 rounded-2xl border border-indigo-200/80 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-indigo-600 text-white rounded-lg">
                      <RefreshCw size={15} />
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">
                      دۆخی ئێستای سوڕی دوو خشتەیی بۆ ئەم هەفتەیە:
                    </h3>
                    <span className="px-2.5 py-0.5 bg-indigo-600 text-white text-xs font-black rounded-lg shadow-2xs">
                      {weekInfo.currentScheduleLabel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    بەرواری ئەم هەفتەیە: <strong className="text-indigo-950 font-bold">{weekInfo.currentWeekRangeFull}</strong>
                    {' '}— لە ڕۆژی شەممەی داهاتوودا تۆماتیکی دەگۆڕێت بۆ: <strong className="text-emerald-700 font-bold">{weekInfo.nextScheduleLabel}</strong> ({weekInfo.nextWeekRangeShort}).
                  </p>
                </div>

                {/* Optional Override Selector for Admin */}
                <div className="flex items-center gap-2 self-start md:self-auto bg-white p-1.5 rounded-xl border border-indigo-100 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-600 pr-1">مۆدی سوڕانەوە:</span>
                  <select
                    value={activeScheduleOverride}
                    onChange={(e) => setActiveScheduleOverride(e.target.value as any)}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 text-slate-800 outline-none"
                  >
                    <option value="auto">🔄 خۆکار (تۆماتیکی نۆرە بە نۆرە هەموو شەممەیەک)</option>
                    <option value="1">قوفڵکردن لەسەر خشتەی یەکەم</option>
                    <option value="2">قوفڵکردن لەسەر خشتەی دووەم</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setStartingSchedule(prev => prev === '1' ? '2' : '1')}
                    className="px-2 py-1 text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition flex items-center gap-1"
                    title="گۆڕینی ڕیزبەندی سەرەتای هەفتەکان (پێچەوانەکردنەوەی نۆرە)"
                  >
                    <ArrowRightLeft size={12} />
                    <span>پێچەوانەکردنی نۆرە</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Main Tabs: Switch between Editing Schedule 1 and Schedule 2 */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveEditingSchedule('1')}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition border ${
                    activeEditingSchedule === '1'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Layers size={16} />
                  <span>خشتەی یەکەم (Plan 1)</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono ${
                    activeEditingSchedule === '1' ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {totalAssigned1} مارکێت
                  </span>
                  {weekInfo.currentSchedule === '1' && (
                    <span className="text-[10px] bg-emerald-400 text-emerald-950 font-black px-1.5 py-0.5 rounded-md">
                      ئەم هەفتەیە چالاکە
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveEditingSchedule('2')}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition border ${
                    activeEditingSchedule === '2'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Layers size={16} />
                  <span>خشتەی دووەم (Plan 2)</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono ${
                    activeEditingSchedule === '2' ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {totalAssigned2} مارکێت
                  </span>
                  {weekInfo.currentSchedule === '2' && (
                    <span className="text-[10px] bg-emerald-400 text-emerald-950 font-black px-1.5 py-0.5 rounded-md">
                      ئەم هەفتەیە چالاکە
                    </span>
                  )}
                </button>
              </div>

              {/* Utility Tools */}
              <div className="flex items-center gap-2 flex-wrap">
                {activeEditingSchedule === '1' ? (
                  <button
                    type="button"
                    onClick={() => handleCopySchedule('1', '2')}
                    className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center gap-1.5"
                    title="کۆپیکردنی سەرجەم مارکێتەکانی خشتەی یەکەم بۆ ناو خشتەی دووەم"
                  >
                    <Copy size={13} />
                    <span>کۆپیکردن بۆ خشتەی دووەم</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCopySchedule('2', '1')}
                    className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center gap-1.5"
                    title="کۆپیکردنی سەرجەم مارکێتەکانی خشتەی دووەم بۆ ناو خشتەی یەکەم"
                  >
                    <Copy size={13} />
                    <span>کۆپیکردن بۆ خشتەی یەکەم</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleClearCurrentSchedule}
                  className="px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition border border-rose-200 flex items-center gap-1"
                  title="سڕینەوە و بەتاڵکردنەوەی هەموو مارکێتەکانی ئەم خشتەیە"
                >
                  <Trash2 size={13} />
                  <span>بەتاڵکردنەوە</span>
                </button>
              </div>
            </div>

            {/* Days Grid for currently selected editing schedule */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {DAYS.map(day => {
                const dayMarkets = currentEditingSchedule[day.id] || [];
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
                          <option value="" disabled>+ زیادکردنی مارکێت بۆ {day.label} ({activeEditingSchedule === '1' ? 'خشتەی ١' : 'خشتەی ٢'})</option>
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
                            هیچ مارکێتێک دانەنراوە بۆ ئەم ڕۆژە لە {activeEditingSchedule === '1' ? 'خشتەی یەکەم' : 'خشتەی دووەم'}
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
                className={`w-full sm:w-auto px-8 py-3 rounded-xl font-bold active:scale-98 transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-60 text-sm ${
                  saveSuccess
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 ring-2 ring-emerald-300'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {saveSuccess ? (
                  <>
                    <CheckCircle2 size={20} className="animate-bounce" />
                    <span>خشتەکان بە سەرکەوتوویی پاشەکەوت کران!</span>
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    <span>{saving ? 'پاشەکەوت دەکرێت...' : 'پاشەکەوتکردنی هەردوو خشتەی یەکەم و دووەم'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-slate-500 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <Calendar size={40} className="mx-auto text-slate-300 mb-3" />
            <div className="font-bold text-slate-700 text-sm sm:text-base">تکایە مەندووب یان کاشڤانێک هەڵبژێرە</div>
            <div className="text-xs text-slate-400 mt-1">بۆ بینین، ڕێکخستن و دانانی خشتەی یەکەم و دووەمی سەردانەکان</div>
          </div>
        )}
      </div>
    </div>
  );
}
