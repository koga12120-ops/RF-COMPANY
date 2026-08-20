import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, updateDoc, doc, addDoc, getDocs, where, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { CashvanSale, CashvanTransfer, Transaction } from '../../types';
import { Truck, CheckCircle2, DollarSign, History, Trash2, Edit2, Printer, FileText, X, AlertTriangle, Check } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminCashvanView() {
  const [sales, setSales] = useState<CashvanSale[]>([]);
  const [transfers, setTransfers] = useState<CashvanTransfer[]>([]);
  const [activeTab, setActiveTab] = useState<'sales' | 'transfers'>('sales');

  // Modal States
  const [deletingSale, setDeletingSale] = useState<CashvanSale | null>(null);
  const [editingSale, setEditingSale] = useState<CashvanSale | null>(null);
  const [editSaleAmount, setEditSaleAmount] = useState<string>('');

  const [deletingTransfer, setDeletingTransfer] = useState<CashvanTransfer | null>(null);
  const [editingTransfer, setEditingTransfer] = useState<CashvanTransfer | null>(null);
  const [editTransferValue, setEditTransferValue] = useState<string>('');

  const [isProcessing, setIsProcessing] = useState(false);
  
  useEffect(() => {
    const unsubSales = onSnapshot(
      query(collection(db, 'cashvan_sales')),
      (snapshot) => {
        const data: CashvanSale[] = [];
        snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as CashvanSale));
        setSales(data.sort((a,b) => b.date - a.date));
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'cashvan_sales');
      }
    );

    const unsubTransfers = onSnapshot(
      query(collection(db, 'cashvan_transfers')),
      (snapshot) => {
        const data: CashvanTransfer[] = [];
        snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as CashvanTransfer));
        setTransfers(data.sort((a,b) => b.date - a.date));
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'cashvan_transfers');
      }
    );

    return () => {
      unsubSales();
      unsubTransfers();
    };
  }, []);

  const printStatement = async (entityName: string) => {
    if (!entityName || entityName === 'نەزانراو' || entityName === '') {
      alert('ناوی مارکێت دیاری نەکراوە بۆ چاپکردنی کەشف حیساب');
      return;
    }
    const q = query(collection(db, 'transactions'), where('relatedEntityId', '==', entityName));
    const snap = await getDocs(q);
    const allTrans: Transaction[] = [];
    snap.forEach(d => allTrans.push({ id: d.id, ...d.data() } as Transaction));
    
    allTrans.sort((a,b) => a.date - b.date);
    
    let totalDebt = 0;
    let totalPaid = 0;
    let totalCash = 0;

    const rowsHtml = allTrans.map(t => {
      let typeLabel = '';
      if (t.type.includes('debt') && !t.type.includes('paid')) { typeLabel = 'قەرز'; totalDebt += t.amount || 0; }
      else if (t.type.includes('paid')) { typeLabel = 'واسڵکراو'; totalPaid += t.amount || 0; }
      else { typeLabel = 'نەقد/تر'; totalCash += t.amount || 0; }
      
      return `<tr>
        <td dir="ltr">${format(t.date, 'yyyy-MM-dd HH:mm')}</td>
        <td>${typeLabel}</td>
        <td>${t.description}</td>
        <td dir="ltr">${(t.amount || 0).toLocaleString()}</td>
      </tr>`;
    }).join('');
    
    let finalBalance = totalDebt - totalPaid;
    
    const html = `
    <html dir="rtl">
      <head>
        <title>کەشف حیساب - ${entityName}</title>
        <style>
          body { font-family: Tahoma, Arial, sans-serif; padding: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
          th { background-color: #f8f9fa; }
          .header { text-align: center; margin-bottom: 20px; }
          .summary { margin-top: 20px; padding: 15px; border: 2px solid #333; border-radius: 8px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>کۆمپانیای RF</h2>
          <h3>کەشف حیساب - ${entityName}</h3>
          <p>بەرواری چاپ: <span dir="ltr">${format(Date.now(), 'yyyy-MM-dd HH:mm')}</span></p>
        </div>
        <table style="width: 100%">
          <thead><tr><th>بەروار و کات</th><th>جۆر</th><th>وردەکاری</th><th>بڕی پارە</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="summary">
          <p>کۆی قەرزەکان: <span dir="ltr">${totalDebt.toLocaleString()}</span></p>
          <p>کۆی واسڵکراو: <span dir="ltr">${totalPaid.toLocaleString()}</span></p>
          <p>کۆی نەقد: <span dir="ltr">${totalCash.toLocaleString()}</span></p>
          <hr style="margin: 10px 0;" />
          <h3 style="margin: 0; font-size: 20px;">ماوەی قەرز (باڵانس): <span dir="ltr">${finalBalance.toLocaleString()}</span> د.ع</h3>
        </div>
        <script>window.onload = () => window.print();</script>
      </body>
    </html>`;
    const win = window.open('', '_blank');
    win?.document.write(html);
    win?.document.close();
  };

  const confirmDeleteSale = async () => {
    if (!deletingSale) return;
    setIsProcessing(true);
    try {
      // 1. Delete from cashvan_sales
      await deleteDoc(doc(db, 'cashvan_sales', deletingSale.id));
      
      // 2. Restore items to cashvan inventory
      for (const item of (deletingSale.items || [])) {
        try {
          const q = query(
            collection(db, 'cashvan_inventory'), 
            where('itemId', '==', item.itemId), 
            where('cashvanName', '==', deletingSale.cashvanName)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            const itemDoc = snap.docs[0];
            const totalPieces = item.unit === 'carton' 
              ? item.quantity * (item.ratio || 1) 
              : (item.unit === 'packet' ? item.quantity * (item.packetRatio || 1) : item.quantity);
            await updateDoc(doc(db, 'cashvan_inventory', itemDoc.id), {
              quantity: (itemDoc.data().quantity || 0) + totalPieces
            });
          }
        } catch (itemErr) {
          console.warn('Could not restore inventory item:', itemErr);
        }
      }

      // 3. If sale was accounted, deduct from cashvan totalSales
      if (deletingSale.status === 'accounted') {
        try {
          const cvSnap = await getDocs(query(collection(db, 'cashvans'), where('name', '==', deletingSale.cashvanName)));
          if (!cvSnap.empty) {
            const cvDoc = cvSnap.docs[0];
            const currentSales = cvDoc.data().totalSales || 0;
            const currentProfit = cvDoc.data().totalProfit || 0;
            await updateDoc(doc(db, 'cashvans', cvDoc.id), {
              totalSales: Math.max(0, currentSales - deletingSale.totalAmount),
              totalProfit: Math.max(0, currentProfit - (deletingSale.totalProfit || 0))
            });
          }
        } catch (cvErr) {
          console.warn('Could not update cashvan stats:', cvErr);
        }
      }

      setDeletingSale(null);
    } catch (error: any) {
      console.error('Delete error:', error);
      alert('هەڵەیەک ڕوویدا لە کاتی سڕینەوە: ' + (error.message || error));
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmEditSale = async () => {
    if (!editingSale) return;
    const num = Number(editSaleAmount);
    if (isNaN(num) || num < 0) {
      alert('تکایە بڕێکی دروست بنووسە');
      return;
    }
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'cashvan_sales', editingSale.id), { totalAmount: num });
      setEditingSale(null);
    } catch (error: any) {
      console.error(error);
      alert('هەڵە لە دەستکاریکردن: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmDeleteTransfer = async () => {
    if (!deletingTransfer) return;
    setIsProcessing(true);
    try {
      await deleteDoc(doc(db, 'cashvan_transfers', deletingTransfer.id));
      setDeletingTransfer(null);
    } catch (error: any) {
      console.error(error);
      alert('هەڵە لە سڕینەوە: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmEditTransfer = async () => {
    if (!editingTransfer) return;
    const num = Number(editTransferValue);
    if (isNaN(num) || num < 0) {
      alert('تکایە بڕێکی دروست بنووسە');
      return;
    }
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'cashvan_transfers', editingTransfer.id), { totalValue: num });
      setEditingTransfer(null);
    } catch (error: any) {
      console.error(error);
      alert('هەڵە لە دەستکاریکردن: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAccount = async (sale: CashvanSale) => {
    try {
      // Create a ledger transaction
      await addDoc(collection(db, 'transactions'), {
        type: sale.paymentType || 'cash',
        amount: sale.totalAmount,
        date: Date.now(),
        description: `فرۆشتنی کاشڤان (${sale.cashvanName}) بۆ (${sale.marketName})`,
        relatedEntityId: sale.marketName || 'نەزانراو'
      } as Transaction);

      // Mark as accounted
      await updateDoc(doc(db, 'cashvan_sales', sale.id), {
        status: 'accounted'
      });
      
      // Update cashvan stats
      const cvSnap = await getDocs(query(collection(db, 'cashvans'), where('name', '==', sale.cashvanName)));
      if (!cvSnap.empty) {
        const cvDoc = cvSnap.docs[0];
        await updateDoc(doc(db, 'cashvans', cvDoc.id), {
          totalSales: (cvDoc.data().totalSales || 0) + sale.totalAmount,
          totalProfit: (cvDoc.data().totalProfit || 0) + (sale.totalProfit || 0)
        });
      }

    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە کاتی ناردن بۆ حیسابات');
    }
  };

  const pendingSales = sales.filter(s => s.status === 'pending_accounting');
  const accountedSales = sales.filter(s => s.status === 'accounted');
  const pendingTotal = pendingSales.reduce((a, b) => a + b.totalAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
        <button
          onClick={() => setActiveTab('sales')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition ${activeTab === 'sales' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          <div className="flex justify-center items-center gap-2">
            <DollarSign size={18} /> فرۆشتنەکانی کاشڤان
            {pendingSales.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingSales.length}</span>
            )}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('transfers')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition ${activeTab === 'transfers' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          <div className="flex justify-center items-center gap-2">
            <Truck size={18} /> کاڵا پێدراوەکان لە کۆگاوە
          </div>
        </button>
      </div>

      {activeTab === 'sales' && (
        <div className="space-y-6">
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-amber-50/50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <History className="text-amber-500" /> چاوەڕێی حیسابات
              </h3>
              <div className="text-sm font-bold text-amber-700">
                کۆی گشتی چاوەڕوانکراو: <span dir="ltr">{pendingTotal.toLocaleString()} د.ع</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="p-4">کاشڤان</th>
                    <th className="p-4">مارکێت</th>
                    <th className="p-4">بەروار</th>
                    <th className="p-4">بڕی پارە</th>
                    <th className="p-4">کردارەکان</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {pendingSales.map(sale => (
                    <tr key={sale.id} className="hover:bg-slate-50 transition">
                      <td className="p-4 font-bold text-slate-800">{sale.cashvanName}</td>
                      <td className="p-4">{sale.marketName}</td>
                      <td className="p-4 text-slate-500">{format(sale.date, 'yyyy/MM/dd HH:mm')}</td>
                      <td className="p-4 font-bold text-indigo-600" dir="ltr">{sale.totalAmount.toLocaleString()} د.ع</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAccount(sale)}
                            className="px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 font-bold rounded-lg transition flex items-center gap-1.5 text-xs"
                          >
                            <CheckCircle2 size={16} /> ناردن بۆ حیسابات
                          </button>
                          <button 
                            onClick={() => printStatement(sale.marketName)} 
                            className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition" 
                            title="کەشف حیساب"
                          >
                            <FileText size={16}/>
                          </button>
                          <button 
                            onClick={() => {
                              setEditingSale(sale);
                              setEditSaleAmount(sale.totalAmount.toString());
                            }} 
                            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                            title="دەستکاری بڕی پارە"
                          >
                            <Edit2 size={16}/>
                          </button>
                          <button 
                            onClick={() => setDeletingSale(sale)} 
                            className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                            title="سڕینەوەی وەسڵ"
                          >
                            <Trash2 size={16}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {pendingSales.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-6 text-slate-400">هیچ فرۆشتنێکی نوێ نییە</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden opacity-90">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <CheckCircle2 className="text-green-500" /> چووەتە حیسابات
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-slate-50 text-slate-400 text-xs uppercase">
                  <tr>
                    <th className="p-4">کاشڤان</th>
                    <th className="p-4">مارکێت</th>
                    <th className="p-4">بەروار</th>
                    <th className="p-4">بڕی پارە</th>
                    <th className="p-4">کردارەکان</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                  {accountedSales.map(sale => (
                    <tr key={sale.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-4 font-medium">{sale.cashvanName}</td>
                      <td className="p-4">{sale.marketName}</td>
                      <td className="p-4">{format(sale.date, 'yyyy/MM/dd HH:mm')}</td>
                      <td className="p-4 font-bold text-slate-700" dir="ltr">{sale.totalAmount.toLocaleString()} د.ع</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => printStatement(sale.marketName)} 
                            className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition" 
                            title="کەشف حیساب"
                          >
                            <FileText size={16}/>
                          </button>
                          <button 
                            onClick={() => {
                              setEditingSale(sale);
                              setEditSaleAmount(sale.totalAmount.toString());
                            }} 
                            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                            title="دەستکاری بڕی پارە"
                          >
                            <Edit2 size={16}/>
                          </button>
                          <button 
                            onClick={() => setDeletingSale(sale)} 
                            className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                            title="سڕینەوەی وەسڵ"
                          >
                            <Trash2 size={16}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {accountedSales.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-6 text-slate-400">هیچ فرۆشتنێکی حیسابکراو نییە</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'transfers' && (
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Truck className="text-indigo-600" /> مێژووی پێدانی کاڵا بە کاشڤانەکان لە کۆگاوە
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 text-slate-500 text-xs">
                <tr>
                  <th className="p-4">کاشڤان</th>
                  <th className="p-4">بەروار</th>
                  <th className="p-4">وردەکاری</th>
                  <th className="p-4">کۆی تێچوو</th>
                  <th className="p-4">کردارەکان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {transfers.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-4 font-bold text-slate-800">{t.cashvanName}</td>
                    <td className="p-4 text-slate-600">{format(t.date, 'yyyy/MM/dd HH:mm')}</td>
                    <td className="p-4 text-xs text-slate-500">
                      {t.items.slice(0, 2).map(i => `${i.name} (${i.quantity})`).join(', ')}
                      {t.items.length > 2 ? ' ...' : ''}
                    </td>
                    <td className="p-4 font-bold text-indigo-600" dir="ltr">{t.totalValue.toLocaleString()} د.ع</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            setEditingTransfer(t);
                            setEditTransferValue(t.totalValue.toString());
                          }} 
                          className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                          title="دەستکاری"
                        >
                          <Edit2 size={16}/>
                        </button>
                        <button 
                          onClick={() => setDeletingTransfer(t)} 
                          className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                          title="سڕینەوە"
                        >
                          <Trash2 size={16}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {transfers.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-6 text-slate-400">هیچ زانیارییەک نییە</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Delete Sale Confirmation Modal */}
      {deletingSale && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-red-50">
              <h3 className="font-bold text-red-800 text-base flex items-center gap-2">
                <AlertTriangle className="text-red-600" size={20} />
                سڕینەوەی وەسڵی فرۆشتن
              </h3>
              <button 
                onClick={() => setDeletingSale(null)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
                disabled={isProcessing}
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-700 text-sm leading-relaxed">
                ئایا دڵنیایت لە سڕینەوەی ئەم وەسڵە؟ کاڵاکان بە شێوەی ئۆتۆماتیکی دەگەڕێنەوە ناو کۆگای کاشڤانەکە.
              </p>
              
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">کاشڤان:</span>
                  <span className="font-bold text-slate-800">{deletingSale.cashvanName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">مارکێت:</span>
                  <span className="font-bold text-slate-800">{deletingSale.marketName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">بڕی پارە:</span>
                  <span className="font-bold text-indigo-600 font-mono" dir="ltr">{deletingSale.totalAmount.toLocaleString()} د.ع</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">دۆخ:</span>
                  <span className={`font-bold ${deletingSale.status === 'accounted' ? 'text-green-600' : 'text-amber-600'}`}>
                    {deletingSale.status === 'accounted' ? 'چووەتە حیسابات' : 'چاوەڕێی حیسابات'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={confirmDeleteSale}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <Trash2 size={18} />
                  {isProcessing ? 'دەسڕێتەوە...' : 'بەڵێ، بسڕەوە'}
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingSale(null)}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  پاشگەزبوونەوە
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Sale Modal */}
      {editingSale && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-blue-50">
              <h3 className="font-bold text-blue-800 text-base flex items-center gap-2">
                <Edit2 className="text-blue-600" size={20} />
                دەستکاریکردنی بڕی پارەی وەسڵ
              </h3>
              <button 
                onClick={() => setEditingSale(null)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
                disabled={isProcessing}
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">کۆی گشتی نوێ (د.ع):</label>
                <input
                  type="number"
                  dir="ltr"
                  value={editSaleAmount}
                  onChange={(e) => setEditSaleAmount(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl font-bold font-mono text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="بڕی پارە بنووسە"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={confirmEditSale}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <Check size={18} />
                  {isProcessing ? 'پاشەکەوت دەکرێت...' : 'پاشەکەوتکردن'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingSale(null)}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  پاشگەزبوونەوە
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Transfer Modal */}
      {deletingTransfer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-red-50">
              <h3 className="font-bold text-red-800 text-base flex items-center gap-2">
                <AlertTriangle className="text-red-600" size={20} />
                سڕینەوەی پێدانی کاڵا
              </h3>
              <button 
                onClick={() => setDeletingTransfer(null)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
                disabled={isProcessing}
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-700 text-sm leading-relaxed">
                ئایا دڵنیایت لە سڕینەوەی ئەم تۆمارەی کاڵا پێدان بە کاشڤان (<strong className="text-slate-900">{deletingTransfer.cashvanName}</strong>)؟
              </p>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={confirmDeleteTransfer}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <Trash2 size={18} />
                  {isProcessing ? 'دەسڕێتەوە...' : 'بەڵێ، بسڕەوە'}
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingTransfer(null)}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  پاشگەزبوونەوە
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Transfer Modal */}
      {editingTransfer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-blue-50">
              <h3 className="font-bold text-blue-800 text-base flex items-center gap-2">
                <Edit2 className="text-blue-600" size={20} />
                دەستکاریکردنی تێچووی پێدانی کاڵا
              </h3>
              <button 
                onClick={() => setEditingTransfer(null)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
                disabled={isProcessing}
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">کۆی تێچووی نوێ (د.ع):</label>
                <input
                  type="number"
                  dir="ltr"
                  value={editTransferValue}
                  onChange={(e) => setEditTransferValue(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl font-bold font-mono text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="بڕی پارە بنووسە"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={confirmEditTransfer}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <Check size={18} />
                  {isProcessing ? 'پاشەکەوت دەکرێت...' : 'پاشەکەوتکردن'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTransfer(null)}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  پاشگەزبوونەوە
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
