import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, updateDoc, doc, addDoc, getDocs, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { CashvanSale, CashvanTransfer, Transaction } from '../../types';
import { Truck, CheckCircle2, DollarSign, History } from 'lucide-react';
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

  const handleAccount = async (sale: CashvanSale) => {
    try {
      // Create a ledger transaction
      await addDoc(collection(db, 'transactions'), {
        type: 'cash',
        amount: sale.totalAmount,
        date: Date.now(),
        description: `فرۆشتنی نەقدی کاشڤان (${sale.cashvanName}) بۆ (${sale.marketName})`,
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
                        <button
                          onClick={() => handleAccount(sale)}
                          className="px-4 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 font-bold rounded-lg transition flex items-center gap-2"
                        >
                          <CheckCircle2 size={16} /> ناردن بۆ حیسابات
                        </button>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                  {accountedSales.map(sale => (
                    <tr key={sale.id}>
                      <td className="p-4 font-medium">{sale.cashvanName}</td>
                      <td className="p-4">{sale.marketName}</td>
                      <td className="p-4">{format(sale.date, 'yyyy/MM/dd HH:mm')}</td>
                      <td className="p-4" dir="ltr">{sale.totalAmount.toLocaleString()}</td>
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
