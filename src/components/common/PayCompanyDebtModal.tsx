import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { Transaction } from '../../types';
import { format } from 'date-fns';
import { X, Check, FileText, Building2, CreditCard, DollarSign, Calculator, ArrowRight, Printer, AlertCircle } from 'lucide-react';

interface PayCompanyDebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCompany?: string;
  initialDebt?: Transaction | null;
  type?: 'company_debt' | 'debt';
  targetName?: string;
  onSuccess?: () => void;
}

export default function PayCompanyDebtModal({
  isOpen,
  onClose,
  initialCompany = '',
  initialDebt = null,
  type = 'company_debt',
  targetName = 'کۆمپانیا',
  onSuccess
}: PayCompanyDebtModalProps) {
  const isCompany = type === 'company_debt';
  const paidType = isCompany ? 'company_paid_debt' : 'paid_debt';
  const entityCollection = isCompany ? 'companies' : 'markets';

  const [entities, setEntities] = useState<any[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<string>(initialCompany);
  const [companyDebts, setCompanyDebts] = useState<Transaction[]>([]);
  const [loadingDebts, setLoadingDebts] = useState(false);

  // Modes: 'by_invoice' (select specific invoice/debt) or 'general' (pay overall debt)
  const [payMode, setPayMode] = useState<'by_invoice' | 'general'>('by_invoice');
  const [selectedDebtId, setSelectedDebtId] = useState<string>('');
  const [payAmount, setPayAmount] = useState<string>('');
  const [invoiceNoInput, setInvoiceNoInput] = useState<string>('');
  const [noteInput, setNoteInput] = useState<string>('');
  const [payDate, setPayDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 1. Fetch list of entities (companies or markets)
  useEffect(() => {
    if (!isOpen) return;
    const q = query(collection(db, entityCollection));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
        setEntities(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, entityCollection);
      }
    );
    return () => unsub();
  }, [isOpen, entityCollection]);

  // 2. Initialize selection when opening
  useEffect(() => {
    if (isOpen) {
      if (initialDebt) {
        setSelectedEntity(initialDebt.relatedEntityId || '');
        setSelectedDebtId(initialDebt.id);
        setPayAmount(initialDebt.amount?.toString() || '');
        setInvoiceNoInput(initialDebt.invoiceNo || '');
        setPayMode('by_invoice');
      } else if (initialCompany) {
        setSelectedEntity(initialCompany);
        setSelectedDebtId('');
        setPayAmount('');
        setInvoiceNoInput('');
      } else {
        setSelectedEntity('');
        setSelectedDebtId('');
        setPayAmount('');
        setInvoiceNoInput('');
      }
      setNoteInput('');
      setPayDate(format(new Date(), 'yyyy-MM-dd'));
      setErrorMessage('');
    }
  }, [isOpen, initialCompany, initialDebt]);

  // 3. Listen to active unpaid debts for the selected entity
  useEffect(() => {
    if (!isOpen || !selectedEntity) {
      setCompanyDebts([]);
      return;
    }
    setLoadingDebts(true);
    const q = query(
      collection(db, 'transactions'),
      where('type', '==', type),
      where('relatedEntityId', '==', selectedEntity)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: Transaction[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Transaction);
        });
        // Sort by date descending
        list.sort((a, b) => b.date - a.date);
        setCompanyDebts(list);
        setLoadingDebts(false);

        // If we have an initial debt id, ensure it exists or keep selected
        if (initialDebt && list.some(d => d.id === initialDebt.id)) {
          setSelectedDebtId(initialDebt.id);
        } else if (list.length > 0 && !selectedDebtId && payMode === 'by_invoice') {
          // default select first debt
          setSelectedDebtId(list[0].id);
          setPayAmount(list[0].amount?.toString() || '');
          setInvoiceNoInput(list[0].invoiceNo || '');
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'transactions');
        setLoadingDebts(false);
      }
    );

    return () => unsub();
  }, [isOpen, selectedEntity, type, initialDebt]);

  // Calculate totals
  const totalCompanyDebt = useMemo(() => {
    return companyDebts.reduce((sum, d) => sum + (d.amount || 0), 0);
  }, [companyDebts]);

  // Currently selected specific debt object
  const activeDebt = useMemo(() => {
    return companyDebts.find((d) => d.id === selectedDebtId) || null;
  }, [companyDebts, selectedDebtId]);

  // Handle selecting a specific debt
  const handleSelectDebt = (debt: Transaction) => {
    setSelectedDebtId(debt.id);
    setPayAmount(debt.amount?.toString() || '');
    setInvoiceNoInput(debt.invoiceNo || '');
    setErrorMessage('');
  };

  // Quick amount percentage setters
  const setPercentageOfDebt = (percentage: number) => {
    const baseAmount = payMode === 'by_invoice' && activeDebt ? activeDebt.amount : totalCompanyDebt;
    if (baseAmount > 0) {
      const calculated = Math.round((baseAmount * percentage) / 100);
      setPayAmount(calculated.toString());
    }
  };

  // Submit payment
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!selectedEntity.trim()) {
      setErrorMessage(`تکایە ناوی ${targetName} هەڵبژێرە.`);
      return;
    }

    const numAmount = Number(payAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMessage('تکایە بڕێکی دروستی پارە بنووسە (لە سفر زیاتر).');
      return;
    }

    setIsProcessing(true);

    try {
      // Parse custom payment timestamp
      const [year, month, day] = payDate.split('-').map(Number);
      const paymentDateObj = new Date(year, month - 1, day, new Date().getHours(), new Date().getMinutes(), new Date().getSeconds());
      const paymentTimestamp = paymentDateObj.getTime() || Date.now();

      if (payMode === 'by_invoice' && activeDebt) {
        // === Mode 1: Pay Specific Invoice / Debt ===
        const currentDebtAmount = activeDebt.amount || 0;
        const invNo = invoiceNoInput.trim() || activeDebt.invoiceNo || '';

        if (numAmount >= currentDebtAmount) {
          // 1A. Full payment of this invoice
          await updateDoc(doc(db, 'transactions', activeDebt.id), {
            type: paidType,
            amount: currentDebtAmount,
            date: paymentTimestamp,
            invoiceNo: invNo || undefined,
            description: noteInput.trim() || `دانەوەی تەواوی قەرزی وەسڵی ${invNo ? '#' + invNo : ''} (${activeDebt.description || ''})`
          });
        } else {
          // 1B. Partial payment of this invoice
          const remainingAmount = currentDebtAmount - numAmount;
          
          // Reduce the remaining amount on original debt
          await updateDoc(doc(db, 'transactions', activeDebt.id), {
            amount: remainingAmount,
            invoiceNo: invNo || undefined
          });

          // Create new paid debt transaction
          await addDoc(collection(db, 'transactions'), {
            type: paidType,
            amount: numAmount,
            relatedEntityId: selectedEntity,
            invoiceNo: invNo || undefined,
            date: paymentTimestamp,
            description: noteInput.trim() || `دانەوەی بەشێک لە وەسڵی ${invNo ? '#' + invNo : ''} (بڕی ماوە لە وەسڵەکە: ${remainingAmount.toLocaleString()} د.ع)`
          });
        }
      } else {
        // === Mode 2: General Company Debt Payment (Deduct sequentially or record as bulk payment) ===
        let amountToDeduct = numAmount;
        const invNo = invoiceNoInput.trim();

        // Deduct from oldest unpaid debts sequentially
        // Sort oldest first
        const sortedOldestFirst = [...companyDebts].sort((a, b) => a.date - b.date);

        for (const debt of sortedOldestFirst) {
          if (amountToDeduct <= 0) break;
          const dAmount = debt.amount || 0;

          if (amountToDeduct >= dAmount) {
            // Full debt consumed
            await updateDoc(doc(db, 'transactions', debt.id), {
              type: paidType,
              date: paymentTimestamp,
              description: `دانەوەی قەرز (لە کۆی واسڵکراو): ${debt.description || ''}`
            });
            amountToDeduct -= dAmount;
          } else {
            // Partial deduction from this debt
            const remaining = dAmount - amountToDeduct;
            await updateDoc(doc(db, 'transactions', debt.id), {
              amount: remaining
            });
            // Record the paid part
            await addDoc(collection(db, 'transactions'), {
              type: paidType,
              amount: amountToDeduct,
              relatedEntityId: selectedEntity,
              invoiceNo: debt.invoiceNo || invNo || undefined,
              date: paymentTimestamp,
              description: noteInput.trim() || `دانەوەی بەشێک لە قەرز: ${debt.description || ''} (ماوە: ${remaining.toLocaleString()} د.ع)`
            });
            amountToDeduct = 0;
            break;
          }
        }

        // If there's still extra paid amount beyond recorded debts (advance payment / credit)
        if (amountToDeduct > 0) {
          await addDoc(collection(db, 'transactions'), {
            type: paidType,
            amount: amountToDeduct,
            relatedEntityId: selectedEntity,
            invoiceNo: invNo || undefined,
            date: paymentTimestamp,
            description: noteInput.trim() || `دانەوەی قەرزی گشتی ${targetName}: ${selectedEntity}`
          });
        }
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error paying debt:', err);
      setErrorMessage('هەڵەیەک ڕوویدا لە کاتی واسڵکردنی قەرز. تکایە دووبارە هەوڵبدەرەوە.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const currentDebtAmount = activeDebt ? activeDebt.amount : totalCompanyDebt;
  const numPay = Number(payAmount) || 0;
  const remainingAfterPay = Math.max(0, currentDebtAmount - numPay);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 my-8 animate-in fade-in zoom-in duration-150">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-green-600 to-emerald-700 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
              <Check className="text-white" size={22} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">
                دانەوەی قەرزی {targetName} (واسڵکردن)
              </h3>
              <p className="text-xs text-green-100 mt-0.5">
                دەتوانیت قەرزی وەسڵێکی دیاریکراو بدەیتەوە یان بڕێک لە پارەکەی بدەیتەوە
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition"
            disabled={isProcessing}
          >
            <X size={22} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmitPayment} className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Entity Selection & Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ناوی {targetName}:
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  list="entity-list-suggestions"
                  placeholder={`ناوی ${targetName} بنووسە یان هەڵبژێرە...`}
                  value={selectedEntity}
                  onChange={(e) => {
                    setSelectedEntity(e.target.value);
                    setSelectedDebtId('');
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:bg-white outline-none font-medium"
                />
                <datalist id="entity-list-suggestions">
                  {entities.map((ent) => (
                    <option key={ent.id} value={ent.name} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Total Debt Card */}
            <div className="bg-amber-50/70 border border-amber-200/80 p-3 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs text-amber-800 font-medium block">کۆی گشتی قەرزی ماوەی ئەم {targetName}یە:</span>
                <span className="text-lg font-bold text-amber-700 font-mono tracking-tight" dir="ltr">
                  {totalCompanyDebt.toLocaleString()} د.ع
                </span>
              </div>
              <div className="p-2.5 bg-amber-100 text-amber-700 rounded-lg">
                <CreditCard size={20} />
              </div>
            </div>
          </div>

          {/* 2. Payment Method Tabs */}
          <div className="border border-slate-200 rounded-xl p-1 bg-slate-100 flex text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setPayMode('by_invoice');
                if (companyDebts.length > 0 && !selectedDebtId) {
                  setSelectedDebtId(companyDebts[0].id);
                  setPayAmount(companyDebts[0].amount?.toString() || '');
                  setInvoiceNoInput(companyDebts[0].invoiceNo || '');
                }
              }}
              className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
                payMode === 'by_invoice'
                  ? 'bg-white text-green-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText size={15} />
              <span>دانەوەی بەپێی وەسڵ (وەسڵێکی دیاریکراو)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPayMode('general');
                setSelectedDebtId('');
                setPayAmount(totalCompanyDebt > 0 ? totalCompanyDebt.toString() : '');
              }}
              className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
                payMode === 'general'
                  ? 'bg-white text-green-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calculator size={15} />
              <span>دانەوەی بڕێکی گشتی لە قەرز</span>
            </button>
          </div>

          {/* 3. Mode Content */}
          {payMode === 'by_invoice' ? (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                وەسڵ و قەرزە ماوەکانی ئەم {targetName}یە هەڵبژێرە:
              </label>

              {loadingDebts ? (
                <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                  خەریکی هێنانی وەسڵەکانە...
                </div>
              ) : companyDebts.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                  هیچ قەرزێکی تۆمارکراو بۆ ئەم {targetName}یە نەدۆزرایەوە.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {companyDebts.map((debt) => {
                    const isSelected = debt.id === selectedDebtId;
                    return (
                      <div
                        key={debt.id}
                        onClick={() => handleSelectDebt(debt)}
                        className={`p-3 rounded-xl border transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-green-50/80 border-green-500 ring-2 ring-green-200'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                            <FileText size={16} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-800">
                                {debt.invoiceNo ? `وەسڵی #${debt.invoiceNo}` : 'وەسڵی بێ ژمارە'}
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono" dir="ltr">
                                {format(debt.date, 'yyyy-MM-dd')}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 truncate max-w-xs mt-0.5">
                              {debt.description || 'بێ وردەکاری'}
                            </div>
                          </div>
                        </div>

                        <div className="text-left sm:shrink-0 flex items-center justify-between sm:justify-end gap-3">
                          <div>
                            <span className="text-[10px] text-slate-400 block">بڕی قەرز</span>
                            <span className="font-bold text-amber-600 text-sm font-mono" dir="ltr">
                              {(debt.amount || 0).toLocaleString()} د.ع
                            </span>
                          </div>
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'border-green-600 bg-green-600 text-white' : 'border-slate-300'}`}>
                            {isSelected && <Check size={12} />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
              <p className="font-bold text-slate-800">تێبینی واسڵکردنی گشتی:</p>
              <p>
                بڕی پارەی دیاریکراو ڕاستەوخۆ لە کۆی قەرزی کۆمپانیا دەردەکرێت و بەپێی بەرواری کۆن بۆ نوێ لە وەسڵە ماوەکان کەم دەبێتەوە.
              </p>
            </div>
          )}

          {/* 4. Payment Amount & Quick Options */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="block text-xs font-bold text-slate-700">
                بڕی پارەی واسڵکراو (د.ع):
              </label>
              
              {/* Quick Percentage Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setPercentageOfDebt(100)}
                  className="px-2.5 py-1 bg-green-100 hover:bg-green-200 text-green-800 text-[11px] font-bold rounded-lg transition"
                >
                  تەواوی قەرز (100%)
                </button>
                <button
                  type="button"
                  onClick={() => setPercentageOfDebt(50)}
                  className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold rounded-lg transition"
                >
                  نیوەی قەرز (50%)
                </button>
                <button
                  type="button"
                  onClick={() => setPercentageOfDebt(25)}
                  className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold rounded-lg transition"
                >
                  25%
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                type="number"
                dir="ltr"
                required
                min="1"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="بڕی پارە بنووسە، بۆ نموونە: 250000"
                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-lg font-bold font-mono text-slate-900 focus:ring-2 focus:ring-green-500 outline-none"
              />
              <span className="absolute left-3 top-3.5 text-xs font-bold text-slate-400 font-sans">
                د.ع
              </span>
            </div>

            {/* Live Calculation Preview */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 text-xs">
              <div>
                <span className="text-slate-500">بڕی قەرزی دیاریکراو: </span>
                <span className="font-bold text-slate-800 font-mono" dir="ltr">
                  {currentDebtAmount.toLocaleString()} د.ع
                </span>
              </div>
              <div className="text-left">
                <span className="text-slate-500">بڕی ماوە دوای واسڵکردن: </span>
                <span className={`font-bold font-mono ${remainingAfterPay > 0 ? 'text-amber-600' : 'text-green-600'}`} dir="ltr">
                  {remainingAfterPay.toLocaleString()} د.ع
                </span>
              </div>
            </div>
          </div>

          {/* 5. Additional Details (Invoice No, Date, Notes) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                ژمارەی سەر وەسڵ (دەفتەر وەسڵ):
              </label>
              <input
                type="text"
                dir="ltr"
                placeholder="وەک: 1042"
                value={invoiceNoInput}
                onChange={(e) => setInvoiceNoInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-green-500 focus:bg-white outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                بەرواری واسڵکردن:
              </label>
              <input
                type="date"
                required
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-green-500 focus:bg-white outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-600 mb-1">
                تێبینی / وردەکاری (ئارەزوومەندانە):
              </label>
              <input
                type="text"
                placeholder="تێبینی دەربارەی ئەم واسڵکردنە بنووسە..."
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-green-500 focus:bg-white outline-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
            <button
              type="submit"
              disabled={isProcessing || !selectedEntity || numPay <= 0}
              className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 text-sm"
            >
              <Check size={18} />
              <span>{isProcessing ? 'خەریکی پاشەکەوتکردنە...' : 'تۆمارکردن و واسڵکردنی پارە'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-sm"
            >
              پاشگەزبوونەوە
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
