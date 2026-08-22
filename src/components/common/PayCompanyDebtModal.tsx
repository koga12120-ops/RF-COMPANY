import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { Transaction } from '../../types';
import { format } from 'date-fns';
import { X, Check, FileText, CreditCard, Calculator, Printer, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { printPaymentReceiptPopup, printStatementPopup } from '../../lib/statementPrinter';

interface PayCompanyDebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCompany?: string;
  initialDebt?: Transaction | null;
  type?: 'company_debt' | 'debt';
  targetName?: string;
  onSuccess?: () => void;
}

interface GroupedInvoiceDebt {
  key: string;
  invoiceNo?: string;
  debtIds: string[];
  originalDebt: number;
  paidAmount: number;
  remainingDebt: number;
  date: number;
  description: string;
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
  const [rawDebts, setRawDebts] = useState<Transaction[]>([]);
  const [rawPaidDebts, setRawPaidDebts] = useState<Transaction[]>([]);
  const [loadingDebts, setLoadingDebts] = useState(false);

  // Modes: 'by_invoice' (select specific invoice/debt) or 'general' (pay overall debt)
  const [payMode, setPayMode] = useState<'by_invoice' | 'general'>('by_invoice');
  const [selectedInvoiceKey, setSelectedInvoiceKey] = useState<string>('');
  const [payAmount, setPayAmount] = useState<string>('');
  const [invoiceNoInput, setInvoiceNoInput] = useState<string>('');
  const [noteInput, setNoteInput] = useState<string>('');
  const [payDate, setPayDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Success screen state
  const [paymentSuccessData, setPaymentSuccessData] = useState<{
    entityName: string;
    invoiceNo?: string;
    originalDebtAmount: number;
    paidAmount: number;
    remainingDebtAmount: number;
    date: number;
    description?: string;
  } | null>(null);

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
      setPaymentSuccessData(null);
      if (initialDebt) {
        setSelectedEntity(initialDebt.relatedEntityId || '');
        const invKey = initialDebt.invoiceNo ? `inv_${initialDebt.invoiceNo.trim()}` : `id_${initialDebt.id}`;
        setSelectedInvoiceKey(invKey);
        setInvoiceNoInput(initialDebt.invoiceNo || '');
        setPayMode('by_invoice');
      } else if (initialCompany) {
        setSelectedEntity(initialCompany);
        setSelectedInvoiceKey('');
        setPayAmount('');
        setInvoiceNoInput('');
      } else {
        setSelectedEntity('');
        setSelectedInvoiceKey('');
        setPayAmount('');
        setInvoiceNoInput('');
      }
      setNoteInput('');
      setPayDate(format(new Date(), 'yyyy-MM-dd'));
      setErrorMessage('');
    }
  }, [isOpen, initialCompany, initialDebt]);

  // 3. Listen to both Debts and Paid Debts for selected entity
  useEffect(() => {
    if (!isOpen || !selectedEntity) {
      setRawDebts([]);
      setRawPaidDebts([]);
      return;
    }
    setLoadingDebts(true);

    const qDebts = query(
      collection(db, 'transactions'),
      where('type', '==', type),
      where('relatedEntityId', '==', selectedEntity)
    );

    const qPaid = query(
      collection(db, 'transactions'),
      where('type', '==', paidType),
      where('relatedEntityId', '==', selectedEntity)
    );

    const unsubDebts = onSnapshot(
      qDebts,
      (snapshot) => {
        const list: Transaction[] = [];
        snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Transaction));
        list.sort((a, b) => b.date - a.date);
        setRawDebts(list);
        setLoadingDebts(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'transactions');
        setLoadingDebts(false);
      }
    );

    const unsubPaid = onSnapshot(
      qPaid,
      (snapshot) => {
        const list: Transaction[] = [];
        snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Transaction));
        list.sort((a, b) => b.date - a.date);
        setRawPaidDebts(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'transactions');
      }
    );

    return () => {
      unsubDebts();
      unsubPaid();
    };
  }, [isOpen, selectedEntity, type, paidType]);

  // Group debts by Invoice No
  const groupedInvoices: GroupedInvoiceDebt[] = useMemo(() => {
    const invMap = new Map<string, GroupedInvoiceDebt>();

    // 1. Add debts
    rawDebts.forEach((d) => {
      const cleanInv = d.invoiceNo?.trim();
      const key = cleanInv ? `inv_${cleanInv}` : `id_${d.id}`;
      
      if (!invMap.has(key)) {
        invMap.set(key, {
          key,
          invoiceNo: cleanInv || undefined,
          debtIds: [d.id],
          originalDebt: d.amount || 0,
          paidAmount: 0,
          remainingDebt: d.amount || 0,
          date: d.date,
          description: d.description || ''
        });
      } else {
        const existing = invMap.get(key)!;
        existing.debtIds.push(d.id);
        existing.originalDebt += (d.amount || 0);
        if (d.date > existing.date) existing.date = d.date;
      }
    });

    // 2. Subtract matched paid transactions by invoiceNo
    rawPaidDebts.forEach((p) => {
      const cleanInv = p.invoiceNo?.trim();
      if (cleanInv) {
        const key = `inv_${cleanInv}`;
        if (invMap.has(key)) {
          const item = invMap.get(key)!;
          item.paidAmount += (p.amount || 0);
        }
      }
    });

    // 3. Compute remaining debt
    const result: GroupedInvoiceDebt[] = [];
    invMap.forEach((item) => {
      item.remainingDebt = Math.max(0, item.originalDebt - item.paidAmount);
      result.push(item);
    });

    // Sort by date descending
    result.sort((a, b) => b.date - a.date);
    return result;
  }, [rawDebts, rawPaidDebts]);

  // Overall Entity Balances
  const totalEntityDebt = useMemo(() => {
    return rawDebts.reduce((sum, d) => sum + (d.amount || 0), 0);
  }, [rawDebts]);

  const totalEntityPaid = useMemo(() => {
    return rawPaidDebts.reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [rawPaidDebts]);

  const totalEntityRemaining = Math.max(0, totalEntityDebt - totalEntityPaid);

  // Active selected invoice group
  const activeInvoice = useMemo(() => {
    return groupedInvoices.find((g) => g.key === selectedInvoiceKey) || null;
  }, [groupedInvoices, selectedInvoiceKey]);

  // Auto-select invoice if initialDebt or initial load
  useEffect(() => {
    if (groupedInvoices.length > 0 && !selectedInvoiceKey && payMode === 'by_invoice') {
      const firstUnpaid = groupedInvoices.find(g => g.remainingDebt > 0) || groupedInvoices[0];
      setSelectedInvoiceKey(firstUnpaid.key);
      setPayAmount(firstUnpaid.remainingDebt.toString());
      setInvoiceNoInput(firstUnpaid.invoiceNo || '');
    }
  }, [groupedInvoices, selectedInvoiceKey, payMode]);

  // Handle selecting a specific invoice
  const handleSelectInvoice = (inv: GroupedInvoiceDebt) => {
    setSelectedInvoiceKey(inv.key);
    setPayAmount(inv.remainingDebt > 0 ? inv.remainingDebt.toString() : inv.originalDebt.toString());
    setInvoiceNoInput(inv.invoiceNo || '');
    setErrorMessage('');
  };

  // Quick amount percentage setters
  const setPercentageOfDebt = (percentage: number) => {
    const baseAmount = payMode === 'by_invoice' && activeInvoice ? activeInvoice.remainingDebt : totalEntityRemaining;
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
      setErrorMessage('تکایە بڕێکی دروستی پارە بنووسە (لە صفر زیاتر).');
      return;
    }

    setIsProcessing(true);

    try {
      // Parse custom payment timestamp
      const [year, month, day] = payDate.split('-').map(Number);
      const paymentDateObj = new Date(year, month - 1, day, new Date().getHours(), new Date().getMinutes(), new Date().getSeconds());
      const paymentTimestamp = paymentDateObj.getTime() || Date.now();

      const invNo = invoiceNoInput.trim() || (activeInvoice?.invoiceNo ? activeInvoice.invoiceNo : '');

      let origDebt = 0;
      let remainingDebt = 0;

      if (payMode === 'by_invoice' && activeInvoice) {
        origDebt = activeInvoice.originalDebt;
        remainingDebt = Math.max(0, activeInvoice.remainingDebt - numAmount);
      } else {
        origDebt = totalEntityRemaining;
        remainingDebt = Math.max(0, totalEntityRemaining - numAmount);
      }

      // Add a clean payment transaction without corrupting/modifying the original debt amount
      const autoDesc = noteInput.trim() || (invNo ? `دانەوەی قەرزی وەسڵی #${invNo}` : `دانەوەی قەرزی ${targetName}: ${selectedEntity}`);
      
      const docData: any = {
        type: paidType,
        amount: numAmount,
        relatedEntityId: selectedEntity,
        date: paymentTimestamp,
        description: autoDesc
      };
      if (invNo) {
        docData.invoiceNo = invNo;
      }
      
      await addDoc(collection(db, 'transactions'), docData);

      // Prepare success data for immediate printing receipt
      setPaymentSuccessData({
        entityName: selectedEntity,
        invoiceNo: invNo || undefined,
        originalDebtAmount: origDebt,
        paidAmount: numAmount,
        remainingDebtAmount: remainingDebt,
        date: paymentTimestamp,
        description: autoDesc
      });

      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Error paying debt:', err);
      setErrorMessage('هەڵەیەک ڕوویدا لە کاتی واسڵکردنی قەرز. تکایە دووبارە هەوڵبدەرەوە.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  // Active debt reference for preview
  const currentInvoiceDebt = activeInvoice ? activeInvoice.remainingDebt : totalEntityRemaining;
  const originalInvoiceDebt = activeInvoice ? activeInvoice.originalDebt : totalEntityDebt;
  const numPay = Number(payAmount) || 0;
  const remainingAfterPay = Math.max(0, currentInvoiceDebt - numPay);

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
                دانەوەی دروستی قەرز بەپێی ژمارەی وەسڵ یان بڕی دیاریکراو
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

        {/* Success View */}
        {paymentSuccessData ? (
          <div className="p-6 space-y-6 text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-green-50">
              <CheckCircle2 size={36} />
            </div>

            <div>
              <h4 className="text-xl font-bold text-slate-800">واسڵکردنی پارە بە سەرکەوتوویی تۆمارکرا</h4>
              <p className="text-xs text-slate-500 mt-1">تۆماری دارایی نوێکرایەوە و باڵانسی ماوە بە دروستی حیسابکرا.</p>
            </div>

            {/* Financial Summary Box */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-sm space-y-2 text-right">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">ناوی {targetName}:</span>
                <span className="font-bold text-slate-800">{paymentSuccessData.entityName}</span>
              </div>
              {paymentSuccessData.invoiceNo && (
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500">ژمارەی سەر وەسڵ:</span>
                  <span className="font-bold text-indigo-700 font-mono" dir="ltr">#{paymentSuccessData.invoiceNo}</span>
                </div>
              )}
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">قەرزی سەر وەسڵ / قەرزی پێشوو:</span>
                <span className="font-bold text-slate-700 font-mono" dir="ltr">{paymentSuccessData.originalDebtAmount.toLocaleString()} د.ع</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2 bg-green-50/80 p-2 rounded-lg">
                <span className="font-bold text-green-800">بڕی پارەی واسڵکراو (دراوە):</span>
                <span className="font-bold text-green-700 font-mono text-base" dir="ltr">{paymentSuccessData.paidAmount.toLocaleString()} د.ع</span>
              </div>
              <div className="flex justify-between bg-amber-50/80 p-2 rounded-lg">
                <span className="font-bold text-amber-900">بڕی قەرزی ماوەی ئێستا:</span>
                <span className="font-bold text-amber-700 font-mono text-base" dir="ltr">{paymentSuccessData.remainingDebtAmount.toLocaleString()} د.ع</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  printPaymentReceiptPopup({
                    entityName: paymentSuccessData.entityName,
                    roleTitle: targetName,
                    invoiceNo: paymentSuccessData.invoiceNo,
                    originalDebtAmount: paymentSuccessData.originalDebtAmount,
                    paidAmount: paymentSuccessData.paidAmount,
                    remainingDebtAmount: paymentSuccessData.remainingDebtAmount,
                    date: paymentSuccessData.date,
                    description: paymentSuccessData.description
                  });
                }}
                className="w-full sm:flex-1 py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-sm text-sm"
              >
                <Printer size={18} />
                <span>چاپکردنی پسوڵەی واسڵکردن</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const allTrans = [...rawDebts, ...rawPaidDebts];
                  printStatementPopup(paymentSuccessData.entityName, allTrans);
                }}
                className="w-full sm:flex-1 py-3 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl transition flex items-center justify-center gap-2 border border-indigo-200 text-sm"
              >
                <FileText size={18} />
                <span>چاپکردنی کەشف حیساب</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-sm"
              >
                داخستن
              </button>
            </div>
          </div>
        ) : (
          /* Modal Body Form */
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
                      setSelectedInvoiceKey('');
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
                  <span className="text-xs text-amber-800 font-medium block">کۆی قەرزی ماوەی ئەم {targetName}یە:</span>
                  <span className="text-lg font-bold text-amber-700 font-mono tracking-tight" dir="ltr">
                    {totalEntityRemaining.toLocaleString()} د.ع
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
                  if (groupedInvoices.length > 0 && !selectedInvoiceKey) {
                    setSelectedInvoiceKey(groupedInvoices[0].key);
                    setPayAmount(groupedInvoices[0].remainingDebt.toString());
                    setInvoiceNoInput(groupedInvoices[0].invoiceNo || '');
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
                  setSelectedInvoiceKey('');
                  setPayAmount(totalEntityRemaining > 0 ? totalEntityRemaining.toString() : '');
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
                ) : groupedInvoices.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                    هیچ قەرزێکی تۆمارکراو بۆ ئەم {targetName}یە نەدۆزرایەوە.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                    {groupedInvoices.map((inv) => {
                      const isSelected = inv.key === selectedInvoiceKey;
                      const isFullySettled = inv.remainingDebt <= 0;
                      return (
                        <div
                          key={inv.key}
                          onClick={() => handleSelectInvoice(inv)}
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
                                  {inv.invoiceNo ? `وەسڵی #${inv.invoiceNo}` : 'وەسڵی بێ ژمارە'}
                                </span>
                                <span className="text-[11px] text-slate-400 font-mono" dir="ltr">
                                  {format(inv.date, 'yyyy-MM-dd')}
                                </span>
                                {isFullySettled && (
                                  <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">
                                    تەواو واسڵکراوە
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                                <span>قەرزی سەر وەسڵ: <strong className="font-mono text-slate-700" dir="ltr">{inv.originalDebt.toLocaleString()}</strong></span>
                                {inv.paidAmount > 0 && (
                                  <span className="text-green-600 font-medium">واسڵکراو: <strong className="font-mono" dir="ltr">{inv.paidAmount.toLocaleString()}</strong></span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-left sm:shrink-0 flex items-center justify-between sm:justify-end gap-3">
                            <div>
                              <span className="text-[10px] text-slate-400 block">قەرزی ماوە</span>
                              <span className="font-bold text-amber-600 text-sm font-mono" dir="ltr">
                                {inv.remainingDebt.toLocaleString()} د.ع
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
                  بڕی پارەی دیاریکراو ڕاستەوخۆ وەک واسڵکردنی قەرز تۆمار دەکرێت و لە کۆی گشتی قەرزی کۆمپانیا دەردەکرێت.
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
                  placeholder="بڕی پارە بنووسە، بۆ نموونە: 40000"
                  className="w-full pl-12 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-lg font-bold font-mono text-slate-900 focus:ring-2 focus:ring-green-500 outline-none"
                />
                <span className="absolute left-3 top-3.5 text-xs font-bold text-slate-400 font-sans">
                  د.ع
                </span>
              </div>

              {/* Accurate Live Calculation Preview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block">قەرزی سەر وەسڵ / پێشوو:</span>
                  <span className="font-bold text-slate-800 font-mono text-sm" dir="ltr">
                    {originalInvoiceDebt.toLocaleString()} د.ع
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">بڕی واسڵکراو (دراوە):</span>
                  <span className="font-bold text-green-700 font-mono text-sm" dir="ltr">
                    {numPay.toLocaleString()} د.ع
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">بڕی ماوە دوای واسڵکردن:</span>
                  <span className={`font-bold font-mono text-sm ${remainingAfterPay > 0 ? 'text-amber-600' : 'text-green-600'}`} dir="ltr">
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
        )}
      </div>
    </div>
  );
}
