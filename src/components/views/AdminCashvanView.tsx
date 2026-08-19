import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, updateDoc, doc, addDoc, getDocs, where, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { CashvanSale, CashvanTransfer, Transaction } from '../../types';
import { Truck, CheckCircle2, DollarSign, History, Trash2, Edit2, Printer, FileText } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminCashvanView() {
  const [sales, setSales] = useState<CashvanSale[]>([]);
  const [transfers, setTransfers] = useState<CashvanTransfer[]>([]);
  const [activeTab, setActiveTab] = useState<'sales' | 'transfers'>('sales');
  
  useEffect(() => {
    const unsubSales = onSnapshot(query(collection(db, 'cashvan_sales')), (snapshot) => {
      const data: CashvanSale[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as CashvanSale));
      setSales(data.sort((a,b) => b.date - a.date));
    });

    const unsubTransfers = onSnapshot(query(collection(db, 'cashvan_transfers')), (snapshot) => {
      const data: CashvanTransfer[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as CashvanTransfer));
      setTransfers(data.sort((a,b) => b.date - a.date));
    });

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

  const handleDeleteSale = async (id: string) => {
    if (window.confirm('دڵنیایت لە سڕینەوەی ئەم وەسڵە؟')) {
      await deleteDoc(doc(db, 'cashvan_sales', id));
    }
  };

  const handleEditSale = async (sale: CashvanSale) => {
    const newAmount = window.prompt('کۆی گشتی نوێ بنووسە:', sale.totalAmount.toString());
    if (newAmount !== null && !isNaN(Number(newAmount))) {
      await updateDoc(doc(db, 'cashvan_sales', sale.id), { totalAmount: Number(newAmount) });
    }
  };


  const handleEditTransfer = async (t: CashvanTransfer) => {
    const newTotal = window.prompt('کۆی تێچووی نوێ بنووسە:', t.totalValue.toString());
    if (newTotal !== null && !isNaN(Number(newTotal))) {
      await updateDoc(doc(db, 'cashvan_transfers', t.id), { totalValue: Number(newTotal) });
    }
  };

  const handleDeleteTransfer = async (id: string) => {
    if (window.confirm('دڵنیایت لە سڕینەوەی ئەم کاڵا پێدانە؟')) {
      await deleteDoc(doc(db, 'cashvan_transfers', id));
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
          className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition ${activeTab === 'sales' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
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
          className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition ${activeTab === 'transfers' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
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
                      <td className="p-4 font-bold text-indigo-600" dir="ltr">{sale.totalAmount.toLocaleString()}</td>
                      <td className="p-4">
                                                <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAccount(sale)}
                            className="px-4 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 font-bold rounded-lg transition flex items-center gap-2"
                          >
                            <CheckCircle2 size={16} /> ناردن بۆ حیسابات
                          </button>
                                                    <button onClick={() => printStatement(sale.marketName)} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100" title="کەشف حیساب"><FileText size={16}/></button>
                          <button onClick={() => handleEditSale(sale)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Edit2 size={16}/></button>
                          <button onClick={() => handleDeleteSale(sale.id)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Trash2 size={16}/></button>
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

          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden opacity-80">
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
                    <tr key={sale.id}>
                      <td className="p-4 font-medium">{sale.cashvanName}</td>
                      <td className="p-4">{sale.marketName}</td>
                      <td className="p-4">{format(sale.date, 'yyyy/MM/dd HH:mm')}</td>
                                            <td className="p-4" dir="ltr">{sale.totalAmount.toLocaleString()}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                                                    <button onClick={() => printStatement(sale.marketName)} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100" title="کەشف حیساب"><FileText size={16}/></button>
                          <button onClick={() => handleEditSale(sale)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Edit2 size={16}/></button>
                          <button onClick={() => handleDeleteSale(sale.id)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Trash2 size={16}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
                  <tr key={t.id}>
                    <td className="p-4 font-bold text-slate-800">{t.cashvanName}</td>
                    <td className="p-4 text-slate-600">{format(t.date, 'yyyy/MM/dd HH:mm')}</td>
                    <td className="p-4 text-xs text-slate-500">
                      {t.items.slice(0, 2).map(i => `${i.name} (${i.quantity})`).join(', ')}
                      {t.items.length > 2 ? ' ...' : ''}
                    </td>
                                        <td className="p-4 font-bold text-indigo-600" dir="ltr">{t.totalValue.toLocaleString()} د.ع</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleEditTransfer(t)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Edit2 size={16}/></button>
                        <button onClick={() => handleDeleteTransfer(t.id)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Trash2 size={16}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {transfers.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-6 text-slate-400">هیچ زانیارییەک نییە</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
