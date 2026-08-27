import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, doc, setDoc, query, where, onSnapshot, getDocs, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { Market, Order, CashvanSale, Transaction } from '../../types';
import { printMarketDebtReceiptPopup } from '../../lib/statementPrinter';
import { X, CreditCard, Printer, CheckCircle2, DollarSign, FileText, User, PieChart, TrendingUp, PackageCheck, AlertCircle } from 'lucide-react';

interface SimpleMarketDebtPayModalProps {
  isOpen: boolean;
  onClose: () => void;
  marketName: string;
  market?: Market | null;
  currentDebt: number;
  collectorName?: string;
  repId?: string;
  onSuccess?: () => void;
}

const getWeekId = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 6 ? 0 : day + 1;
  d.setDate(d.getDate() - diff);
  return `week_${d.toISOString().split('T')[0]}`;
};

export default function SimpleMarketDebtPayModal({
  isOpen,
  onClose,
  marketName,
  market,
  currentDebt: propDebt,
  collectorName,
  repId,
  onSuccess
}: SimpleMarketDebtPayModalProps) {
  const [amount, setAmount] = useState<string>('');
  const [receiptNo, setReceiptNo] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Live market financial stats
  const [liveDebts, setLiveDebts] = useState<Transaction[]>([]);
  const [marketOrders, setMarketOrders] = useState<Order[]>([]);
  const [marketSales, setMarketSales] = useState<CashvanSale[]>([]);

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setReceiptNo('');
      setNotes('');
      setError('');
      setSaving(false);
    }
  }, [isOpen, marketName]);

  // Listen to transactions for this market to ensure 100% accurate debt calculation
  useEffect(() => {
    if (!isOpen || !marketName) return;

    const cleanName = marketName.trim();
    const qTrans = query(
      collection(db, 'transactions'),
      where('relatedEntityId', '==', cleanName)
    );

    const unsubTrans = onSnapshot(
      qTrans,
      (snap) => {
        const list: Transaction[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Transaction));
        setLiveDebts(list);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'transactions')
    );

    const qOrders = query(
      collection(db, 'orders'),
      where('marketName', '==', cleanName)
    );
    const unsubOrders = onSnapshot(
      qOrders,
      (snap) => {
        const list: Order[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Order));
        setMarketOrders(list.filter(o => o.status !== 'deleted'));
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'orders')
    );

    const qSales = query(
      collection(db, 'cashvan_sales'),
      where('marketName', '==', cleanName)
    );
    const unsubSales = onSnapshot(
      qSales,
      (snap) => {
        const list: CashvanSale[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as CashvanSale));
        setMarketSales(list.filter(s => s.status !== 'deleted'));
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'cashvan_sales')
    );

    return () => {
      unsubTrans();
      unsubOrders();
      unsubSales();
    };
  }, [isOpen, marketName]);

  // Compute live accurate debt
  const computedDebt = useMemo(() => {
    if (liveDebts.length === 0) return propDebt || 0;
    let totalDebt = 0;
    let totalPaid = 0;

    liveDebts.forEach((t) => {
      const amt = t.amount || 0;
      if (t.type === 'debt' || t.type === 'market_debt') {
        totalDebt += amt;
      } else if (t.type === 'paid_debt' || t.type === 'market_paid_debt') {
        totalPaid += amt;
      }
    });

    return Math.max(0, totalDebt - totalPaid);
  }, [liveDebts, propDebt]);

  // Compute profit and cost ratio based on this market's orders & sales
  const { costRatio, profitRatio } = useMemo(() => {
    let totalRevenue = 0;
    let totalProfit = 0;

    marketOrders.forEach((o) => {
      totalRevenue += (o.totalAmount || 0);
      totalProfit += (o.totalProfit || 0);
    });

    marketSales.forEach((s) => {
      totalRevenue += (s.totalAmount || 0);
      totalProfit += (s.totalProfit || 0);
    });

    if (totalRevenue > 0 && totalProfit >= 0) {
      const pRatio = Math.min(0.9, Math.max(0.05, totalProfit / totalRevenue));
      return { costRatio: 1 - pRatio, profitRatio: pRatio };
    }

    // Default business markup: 25% profit, 75% cost
    return { costRatio: 0.75, profitRatio: 0.25 };
  }, [marketOrders, marketSales]);

  if (!isOpen || !marketName) return null;

  const parsedAmount = Number(amount) || 0;
  const remainingDebt = Math.max(0, computedDebt - parsedAmount);
  const costAmount = Math.round(parsedAmount * costRatio);
  const profitAmount = parsedAmount - costAmount;
  const activeCollector = collectorName || auth.currentUser?.displayName || 'مەندووب / کاشڤان';

  const handleQuickAmount = (val: number) => {
    setAmount(val.toString());
  };

  const handleFullDebt = () => {
    if (computedDebt > 0) {
      setAmount(computedDebt.toString());
    }
  };

  const handleSavePayment = async (andPrint: boolean) => {
    if (parsedAmount <= 0) {
      setError('تکایە بڕی پارەی وەرگیراو بە دروستی بنووسە');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const now = Date.now();
      const cleanReceipt = receiptNo.trim();
      const cleanNotes = notes.trim();

      // 1. Record in transactions collection with complete cost and profit breakdown
      const trnData: any = {
        type: 'paid_debt',
        amount: parsedAmount,
        costAmount: costAmount,
        profitAmount: profitAmount,
        costRatio: costRatio,
        profitRatio: profitRatio,
        previousDebt: computedDebt,
        remainingDebt: remainingDebt,
        date: now,
        relatedEntityId: marketName.trim(),
        collectorName: activeCollector,
        repName: activeCollector,
        description: `دانەوەی قەرزی مارکێت لەلایەن (${activeCollector})` + (cleanNotes ? ` - ${cleanNotes}` : ''),
      };
      if (cleanReceipt) {
        trnData.invoiceNo = cleanReceipt;
      }

      await addDoc(collection(db, 'transactions'), trnData);

      // 2. Record in paid_debts collection with financial distribution
      await addDoc(collection(db, 'paid_debts'), {
        entityId: market?.id || '',
        entityName: marketName.trim(),
        entityType: 'market',
        amount: parsedAmount,
        costAmount: costAmount,
        profitAmount: profitAmount,
        costRatio: costRatio,
        profitRatio: profitRatio,
        previousDebt: computedDebt,
        remainingDebt: remainingDebt,
        paidDate: now,
        collectorName: activeCollector,
        repName: activeCollector,
        notes: cleanNotes,
        invoiceNo: cleanReceipt,
        type: 'paid_debt',
        createdAt: now
      });

      // 3. Update collector rep / cashvan stats in reps or cashvans collection
      try {
        const cleanCollector = activeCollector.trim();
        const repSnap = await getDocs(query(collection(db, 'reps'), where('name', '==', cleanCollector)));
        if (!repSnap.empty) {
          const repDoc = repSnap.docs[0];
          const repData = repDoc.data();
          await updateDoc(doc(db, 'reps', repDoc.id), {
            totalDebtCollected: (repData.totalDebtCollected || 0) + parsedAmount,
            totalProfit: (repData.totalProfit || 0) + profitAmount
          });
        } else {
          const cvSnap = await getDocs(query(collection(db, 'cashvans'), where('name', '==', cleanCollector)));
          if (!cvSnap.empty) {
            const cvDoc = cvSnap.docs[0];
            const cvData = cvDoc.data();
            await updateDoc(doc(db, 'cashvans', cvDoc.id), {
              totalDebtCollected: (cvData.totalDebtCollected || 0) + parsedAmount,
              totalProfit: (cvData.totalProfit || 0) + profitAmount
            });
          }
        }
      } catch (statErr) {
        console.warn('Non-critical collector stat update:', statErr);
      }

      // 4. If rep or cashvan has a schedule, mark as visited
      const activeRepId = repId || auth.currentUser?.uid;
      if (activeRepId && market?.id) {
        const weekId = getWeekId();
        const visitId = `${activeRepId}_${weekId}_${market.id}`;
        try {
          await setDoc(doc(db, 'schedule_visits', visitId), {
            repId: activeRepId,
            weekId,
            marketId: market.id,
            visitedAt: now
          }, { merge: true });
        } catch {
          // Non-critical visit recording
        }
      }

      if (andPrint) {
        printMarketDebtReceiptPopup({
          marketName: marketName.trim(),
          amount: parsedAmount,
          costAmount: costAmount,
          profitAmount: profitAmount,
          collectorName: activeCollector,
          date: now,
          receiptNo: cleanReceipt || undefined,
          notes: cleanNotes || undefined,
          previousDebt: computedDebt,
          remainingDebt: remainingDebt
        });
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving market debt payment:', err);
      handleFirestoreError(err, OperationType.WRITE, 'transactions');
      setError('هەڵەیەک ڕوویدا لە تۆمارکردنی قەرزدانەوە');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-4 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 rounded-xl backdrop-blur-xs">
              <CreditCard size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base">دانەوەی قەرزی مارکێت</h3>
              <p className="text-xs text-emerald-100 font-medium">
                مارکێت: <span className="font-bold text-white underline underline-offset-2">{marketName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-bold">
              ⚠️ {error}
            </div>
          )}

          {/* Current Debt Card */}
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-500 font-medium">کۆی گشتی قەرزی ئێستای مارکێت</div>
              <div className="text-lg font-black font-mono text-amber-700 mt-0.5" dir="ltr">
                {(computedDebt || 0).toLocaleString()} <span className="text-xs font-sans text-slate-600">د.ع</span>
              </div>
            </div>
            {computedDebt > 0 ? (
              <button
                type="button"
                onClick={handleFullDebt}
                className="px-3 py-1.5 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs"
              >
                <CheckCircle2 size={14} />
                <span>دانەوەی تەواوی قەرز</span>
              </button>
            ) : (
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold">
                هیچ قەرزێکی نییە
              </span>
            )}
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>بڕی پارەی وەرگیراو (دینار) *</span>
              {parsedAmount > 0 && (
                <span className="text-emerald-700 font-mono text-xs font-bold" dir="ltr">
                  {parsedAmount.toLocaleString()} IQD
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="250"
                required
                autoFocus
                placeholder="0"
                className="w-full pl-3 pr-9 py-2.5 border-2 border-emerald-500 bg-emerald-50/20 rounded-xl outline-none focus:ring-3 focus:ring-emerald-500/20 text-sm font-bold text-slate-900 font-mono"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <DollarSign className="absolute right-3 top-3 text-emerald-600" size={18} />
            </div>
          </div>

          {/* Simple Debt Summary */}
          {parsedAmount > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs animate-in fade-in duration-150">
              <div className="flex justify-between text-slate-600">
                <span>قەرزی پێشوو:</span>
                <span className="font-mono font-bold" dir="ltr">{(computedDebt || 0).toLocaleString()} د.ع</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>بڕی واسڵکراو (دانراو):</span>
                <span className="font-mono" dir="ltr">-{parsedAmount.toLocaleString()} د.ع</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-slate-200 font-black text-slate-800">
                <span>قەرزی ماوە پاش دانەوە:</span>
                <span className={`font-mono ${remainingDebt > 0 ? 'text-amber-700' : 'text-emerald-700'}`} dir="ltr">
                  {remainingDebt.toLocaleString()} د.ع
                </span>
              </div>
            </div>
          )}

          {/* Collector Name Display */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              وەرگیراوە لەلایەن
            </label>
            <div className="relative">
              <input
                type="text"
                disabled
                className="w-full pr-8 pl-3 py-2 border border-slate-200 bg-slate-100 rounded-xl text-xs font-bold text-slate-700"
                value={activeCollector}
              />
              <User className="absolute right-2.5 top-2.5 text-slate-400" size={14} />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition"
          >
            پاشگەزبوونەوە
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving || parsedAmount <= 0}
              onClick={() => handleSavePayment(true)}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
            >
              <Printer size={15} />
              <span>{saving ? 'خەریکی پاشەکەوتکردنە...' : 'تۆمارکردن و چاپکردنی پسوڵە'}</span>
            </button>

            <button
              type="button"
              disabled={saving || parsedAmount <= 0}
              onClick={() => handleSavePayment(false)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
            >
              <CheckCircle2 size={15} />
              <span>{saving ? 'خەریکی پاشەکەوتکردنە...' : 'تەنها تۆمارکردن'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
