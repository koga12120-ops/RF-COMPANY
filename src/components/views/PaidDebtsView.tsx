import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { Transaction } from '../../types';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { Trash2, Printer, FileText, Calendar, Search, CheckCircle2, Clock, X, TrendingUp } from 'lucide-react';
import ConfirmModal from '../common/ConfirmModal';
import { printStatementPopup, printPaymentReceiptPopup } from '../../lib/statementPrinter';

export default function PaidDebtsView({ type = 'paid_debt' }: { type?: 'paid_debt' | 'company_paid_debt' }) {
  const [paidDebts, setPaidDebts] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingDebt, setDeletingDebt] = useState<Transaction | null>(null);

  // Filters
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | 'this_week' | 'this_month' | 'custom_day' | 'range'>('all');
  const [selectedDay, setSelectedDay] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const isCompany = type.includes('company');
    const q = query(collection(db, 'transactions'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const debtsData: Transaction[] = [];
        snapshot.forEach((doc) => {
          const d = { id: doc.id, ...doc.data() } as Transaction;
          if (isCompany) {
            if (d.type === 'company_paid_debt') {
              debtsData.push(d);
            }
          } else {
            if (d.type === 'paid_debt' || d.type === 'market_paid_debt') {
              debtsData.push(d);
            }
          }
        });
        setPaidDebts(debtsData.sort((a, b) => b.date - a.date));
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'transactions');
      }
    );
  
    return () => unsubscribe();
  }, [type]);

  const confirmDeleteDebt = async () => {
    if (!deletingDebt) return;
    try {
      await deleteDoc(doc(db, 'transactions', deletingDebt.id));
      setDeletingDebt(null);
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە کاتی سڕینەوە');
    }
  };

  const isDateInFilter = (timestamp: number) => {
    if (filterPeriod === 'all') return true;
    const now = new Date();
    const date = new Date(timestamp);
    if (filterPeriod === 'today') {
      return isWithinInterval(date, { start: startOfDay(now), end: endOfDay(now) });
    }
    if (filterPeriod === 'this_week') {
      return isWithinInterval(date, { start: startOfWeek(now, { weekStartsOn: 6 }), end: endOfWeek(now, { weekStartsOn: 6 }) });
    }
    if (filterPeriod === 'this_month') {
      return isWithinInterval(date, { start: startOfMonth(now), end: endOfMonth(now) });
    }
    if (filterPeriod === 'custom_day') {
      if (!selectedDay) return true;
      const target = new Date(selectedDay);
      return isWithinInterval(date, { start: startOfDay(target), end: endOfDay(target) });
    }
    if (filterPeriod === 'range') {
      if (!startDate && !endDate) return true;
      const s = startDate ? startOfDay(new Date(startDate)) : new Date(0);
      const e = endDate ? endOfDay(new Date(endDate)) : new Date(8640000000000000);
      return isWithinInterval(date, { start: s, end: e });
    }
    return true;
  };

  const filteredDebts = useMemo(() => {
    return paidDebts.filter(debt => {
      const matchDate = isDateInFilter(debt.date);
      const matchSearch = !searchQuery.trim() || 
        (debt.relatedEntityId && debt.relatedEntityId.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (debt.description && debt.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (debt.invoiceNo && debt.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchDate && matchSearch;
    });
  }, [paidDebts, filterPeriod, selectedDay, startDate, endDate, searchQuery]);

  const totalFilteredPaid = useMemo(() => {
    return filteredDebts.reduce((sum, d) => sum + (d.amount || 0), 0);
  }, [filteredDebts]);

  const avgPaid = filteredDebts.length > 0 ? Math.round(totalFilteredPaid / filteredDebts.length) : 0;


  const printTransaction = async (transaction: Transaction) => {
    const isCompany = transaction.type.includes('company');
    const roleTitle = isCompany ? 'کۆمپانیا' : 'مارکێت';
    
    if (transaction.type.includes('paid') && transaction.relatedEntityId) {
      try {
        const entityName = transaction.relatedEntityId;
        const q = query(collection(db, 'transactions'), where('relatedEntityId', '==', entityName));
        const snap = await getDocs(q);
        const allTrans: Transaction[] = [];
        snap.forEach(d => allTrans.push({ id: d.id, ...d.data() } as Transaction));

        let origDebt = 0;
        let totalPaidForTarget = 0;

        if (transaction.invoiceNo) {
          const cleanInv = transaction.invoiceNo.trim();
          const invDebts = allTrans.filter(t => t.type.includes('debt') && !t.type.includes('paid') && t.invoiceNo?.trim() === cleanInv);
          const invPaids = allTrans.filter(t => t.type.includes('paid') && t.invoiceNo?.trim() === cleanInv);

          origDebt = invDebts.reduce((sum, t) => sum + (t.amount || 0), 0);
          totalPaidForTarget = invPaids.reduce((sum, t) => sum + (t.amount || 0), 0);
        } else {
          const entityDebts = allTrans.filter(t => t.type.includes('debt') && !t.type.includes('paid'));
          const entityPaids = allTrans.filter(t => t.type.includes('paid'));
          origDebt = entityDebts.reduce((sum, t) => sum + (t.amount || 0), 0);
          totalPaidForTarget = entityPaids.reduce((sum, t) => sum + (t.amount || 0), 0);
        }

        if (origDebt === 0) {
          origDebt = transaction.amount || 0;
        }
        const remainingDebt = Math.max(0, origDebt - totalPaidForTarget);

        printPaymentReceiptPopup({
          entityName,
          roleTitle,
          invoiceNo: transaction.invoiceNo,
          originalDebtAmount: origDebt,
          paidAmount: transaction.amount || 0,
          remainingDebtAmount: remainingDebt,
          date: transaction.date,
          description: transaction.description
        });
        return;
      } catch (err) {
        console.error('Error fetching details for receipt:', err);
      }
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let typeLabel = '';
    if (transaction.type.includes('debt')) typeLabel = 'قەرز';
    if (transaction.type.includes('paid')) typeLabel = 'واسڵکراو';
    if (transaction.type === 'cash' || transaction.type === 'company_cash') typeLabel = 'نەقد';

    const html = `
      <html dir="rtl">
        <head>
          <title>پسوڵەی پارە - ${transaction.relatedEntityId}</title>
          <style>
            body { font-family: Tahoma, Arial, sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 10px; }
            .title { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
            .subtitle { color: #666; font-size: 14px; }
            .details { margin-bottom: 30px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 10px; padding: 5px 0; border-bottom: 1px dashed #eee; }
            .label { font-weight: bold; }
            .amount { font-size: 20px; font-weight: bold; text-align: center; margin: 30px 0; padding: 15px; border: 2px solid #333; border-radius: 8px; }
            .footer { text-align: center; margin-top: 50px; font-size: 12px; color: #888; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">کۆمپانیای RF</div>
            <div class="subtitle">پسوڵەی وەرگرتن / پێدان</div>
          </div>
          
          <div class="details">
            <div class="row">
              <span class="label">جۆری مامەڵە:</span>
              <span>${typeLabel}</span>
            </div>
            <div class="row">
              <span class="label">ناوی ${roleTitle}:</span>
              <span>${transaction.relatedEntityId}</span>
            </div>
            ${transaction.invoiceNo ? `
            <div class="row">
              <span class="label">ژمارەی سەر وەسڵ:</span>
              <span dir="ltr">#${transaction.invoiceNo}</span>
            </div>` : ''}
            <div class="row">
              <span class="label">بەروار:</span>
              <span dir="ltr">${format(transaction.date, 'yyyy-MM-dd HH:mm')}</span>
            </div>
            <div class="row">
              <span class="label">وردەکاری:</span>
              <span>${transaction.description || 'بێ وردەکاری'}</span>
            </div>
          </div>
          
          <div class="amount" dir="ltr">
            ${(transaction.amount || 0).toLocaleString()} د.ع
          </div>
          
          <div style="display: flex; justify-content: space-between; margin-top: 50px;">
            <div style="text-align: center;">
              <div>واژووی پێدەر</div>
              <div style="margin-top: 30px; border-top: 1px solid #333; width: 150px;"></div>
            </div>
            <div style="text-align: center;">
              <div>واژووی وەرگر</div>
              <div style="margin-top: 30px; border-top: 1px solid #333; width: 150px;"></div>
            </div>
          </div>
          
          <div class="footer">
            کات و بەرواری چاپ: <span dir="ltr">${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</span>
          </div>
          <script>
            window.onload = () => window.print();
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const printStatement = async (entityName: string) => {
    if (!entityName) return;
    const q = query(collection(db, 'transactions'), where('relatedEntityId', '==', entityName));
    const snap = await getDocs(q);
    const allTrans: Transaction[] = [];
    snap.forEach(d => allTrans.push({ id: d.id, ...d.data() } as Transaction));
    printStatementPopup(entityName, allTrans);
  };
  return (
    <div className="space-y-6">
      {/* Top Filter and Search Bar */}
      <section className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="text-green-600" size={20} />
            <span className="font-bold text-slate-800 text-sm">فلتەری بەروار و گەڕان</span>
          </div>
          
          <div className="w-full md:w-72 relative">
            <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="گەڕان بەپێی ناو یان وردەکاری..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-green-500 focus:bg-white outline-none"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Quick Period Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterPeriod('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              filterPeriod === 'all'
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            هەموو کات
          </button>
          <button
            onClick={() => setFilterPeriod('today')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              filterPeriod === 'today'
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ئەمڕۆ
          </button>
          <button
            onClick={() => setFilterPeriod('this_week')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              filterPeriod === 'this_week'
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ئەم هەفتەیە
          </button>
          <button
            onClick={() => setFilterPeriod('this_month')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              filterPeriod === 'this_month'
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ئەم مانگە
          </button>
          <button
            onClick={() => setFilterPeriod('custom_day')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              filterPeriod === 'custom_day'
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            بەرواری دیاریکراو
          </button>
          <button
            onClick={() => setFilterPeriod('range')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              filterPeriod === 'range'
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            مەودای بەروار
          </button>
        </div>

        {/* Date Pickers for Custom Day or Range */}
        {filterPeriod === 'custom_day' && (
          <div className="flex items-center gap-3 bg-green-50/70 p-3 rounded-xl border border-green-100 text-xs">
            <span className="font-bold text-green-900">بەروار هەڵبژێرە:</span>
            <input
              type="date"
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="px-3 py-1.5 bg-white border border-green-200 rounded-lg outline-none font-mono text-green-900"
            />
          </div>
        )}

        {filterPeriod === 'range' && (
          <div className="flex flex-wrap items-center gap-3 bg-green-50/70 p-3 rounded-xl border border-green-100 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-green-900">لە بەرواری:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 bg-white border border-green-200 rounded-lg outline-none font-mono text-green-900"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-green-900">تا بەرواری:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 bg-white border border-green-200 rounded-lg outline-none font-mono text-green-900"
              />
            </div>
          </div>
        )}
      </section>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* 1. Total Paid Debt */}
        <div className="bg-white p-4 rounded-2xl border border-green-200/80 shadow-sm flex items-center gap-3.5 hover:shadow-md transition">
          <div className="p-3.5 bg-green-100 text-green-700 rounded-xl shrink-0">
            <CheckCircle2 size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500 mb-0.5 font-medium truncate">
              کۆی قەرزی دراوە ({filterPeriod === 'all' ? 'هەموو کات' : 'بەپێی بەروار'})
            </div>
            <div className="text-xl font-bold text-green-600 tracking-tight" dir="ltr">
              {totalFilteredPaid.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">د.ع واسڵکراو</div>
          </div>
        </div>

        {/* 2. Count of Records */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5 hover:shadow-md transition">
          <div className="p-3.5 bg-slate-100 text-slate-700 rounded-xl shrink-0">
            <Clock size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500 mb-0.5 font-medium truncate">
              ژمارەی تۆمارەکان
            </div>
            <div className="text-xl font-bold text-slate-800 tracking-tight" dir="ltr">
              {filteredDebts.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">تۆماری واسڵکراو</div>
          </div>
        </div>

        {/* 3. Average Paid */}
        <div className="bg-white p-4 rounded-2xl border border-indigo-200/80 shadow-sm flex items-center gap-3.5 hover:shadow-md transition">
          <div className="p-3.5 bg-indigo-100 text-indigo-700 rounded-xl shrink-0">
            <TrendingUp size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500 mb-0.5 font-medium truncate">
              تێکڕای واسڵکردن
            </div>
            <div className="text-xl font-bold text-indigo-600 tracking-tight" dir="ltr">
              {avgPaid.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">بۆ هەر مامەڵەیەک</div>
          </div>
        </div>
      </div>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
          <h4 className="font-bold text-slate-700 flex items-center gap-2">✅ قەرزە واسڵکراوەکان</h4>
          <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
            پیشاندانی {filteredDebts.length} لە {paidDebts.length} تۆمار
          </span>
        </div>
        {loading ? (
          <div className="text-center py-10 text-slate-500">خەریکی هێنانە...</div>
        ) : (
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">ناو</th>
                  <th className="px-4 py-3 font-semibold">وردەکاری</th>
                  <th className="px-4 py-3 font-semibold">بڕی پارە</th>
                  <th className="px-4 py-3 font-semibold">بەروار</th>
                  <th className="px-4 py-3 font-semibold w-16"></th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-50">
                {filteredDebts.map(debt => (
                  <tr key={debt.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-4 font-medium text-slate-900">{debt.relatedEntityId}</td>
                    <td className="px-4 py-4 text-slate-600">
                      <div>{debt.description}</div>
                      {debt.invoiceNo && (
                        <span className="inline-block mt-0.5 text-[11px] font-mono bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-200" dir="ltr">
                          وەسڵ: #{debt.invoiceNo}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 font-bold text-green-600" dir="ltr">{debt.amount.toLocaleString()}</td>
                    <td className="px-4 py-4 text-slate-500 text-xs font-mono" dir="ltr">{format(debt.date, 'yyyy-MM-dd HH:mm')}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => printTransaction(debt)}
                          className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                          title="چاپکردنی تەنها ئەمە"
                        >
                          <Printer size={16} />
                        </button>
                        <button
                          onClick={() => printStatement(debt.relatedEntityId || debt.description)}
                          className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition"
                          title="کەشف حیساب"
                        >
                          <FileText size={16} />
                        </button>
                        <button
                          onClick={() => setDeletingDebt(debt)}
                          className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                          title="سڕینەوە"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredDebts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-500">
                      هیچ قەرزێکی واسڵکراو بەپێی ئەم فلتەرە نەدۆزرایەوە
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletingDebt}
        onClose={() => setDeletingDebt(null)}
        onConfirm={confirmDeleteDebt}
        title="سڕینەوەی قەرزی واسڵکراو"
        message="ئایا دڵنیایت لە سڕینەوەی ئەم تۆمارەی قەرزی واسڵکراو؟"
        details={deletingDebt ? [
          { label: 'ناو', value: deletingDebt.relatedEntityId || '-' },
          { label: 'بڕی پارە', value: `${(deletingDebt.amount || 0).toLocaleString()} د.ع` },
          { label: 'وردەکاری', value: deletingDebt.description || '-' }
        ] : []}
      />
    </div>
  );
}
