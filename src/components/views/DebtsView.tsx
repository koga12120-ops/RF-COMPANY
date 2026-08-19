import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, where, updateDoc, doc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Transaction } from '../../types';
import { format } from 'date-fns';
import { Plus, Check, Trash2, Printer, FileText } from 'lucide-react';

export default function DebtsView({ type = 'debt', targetName = 'مارکێت' }: { type?: 'debt' | 'company_debt', targetName?: string }) {
  const [debts, setDebts] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [relatedEntityId, setRelatedEntityId] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'transactions'), where('type', '==', type));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const debtsData: Transaction[] = [];
      snapshot.forEach((doc) => {
        debtsData.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      setDebts(debtsData.sort((a, b) => b.date - a.date));
      setLoading(false);
    });

    const collectionName = type.includes('company') ? 'companies' : 'markets';
    const qSuggestions = query(collection(db, collectionName));
    const unsubSuggestions = onSnapshot(qSuggestions, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setSuggestions(data);
    });

  
  return () => {
      unsubscribe();
      unsubSuggestions();
    };
  }, [type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description) return;

    try {
      if (relatedEntityId && !suggestions.find(s => s.name === relatedEntityId)) {
        const collectionName = type.includes('company') ? 'companies' : 'markets';
        const docData: any = { name: relatedEntityId, location: '', phone: '', createdAt: Date.now() };
        if (collectionName === 'markets') docData.type = 'market';
        if (collectionName === 'companies') docData.type = 'warehouse';
        await addDoc(collection(db, collectionName), docData);
      }

      await addDoc(collection(db, 'transactions'), {
        type,
        amount: Number(amount),
        description,
        relatedEntityId, // Name of the shop/person
        date: Date.now()
      });
      setAmount('');
      setDescription('');
      setRelatedEntityId('');
    } catch (error) {
      console.error(error);
    }
  };

  const handleMarkAsPaid = async (id: string) => {
    try {
      await updateDoc(doc(db, 'transactions', id), {
        type: type === 'debt' ? 'paid_debt' : 'company_paid_debt'
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'transactions', id));
    } catch (error) {
      console.error(error);
    }
  };


  const printTransaction = (transaction: Transaction) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const isCompany = transaction.type.includes('company');
    const roleTitle = isCompany ? 'کۆمپانیا' : 'مارکێت';
    
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
      else { typeLabel = 'نەقد'; totalCash += t.amount || 0; }
      
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
  return (
    <div className="space-y-6">
      <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold mb-4 text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">تۆمارکردنی قەرز</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm text-slate-600 mb-1">{`ناوی ${targetName}`}</label>
            <input
              type="text"
              required
              list={`suggestions-${type}`}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              value={relatedEntityId}
              onChange={(e) => setRelatedEntityId(e.target.value)}
            />
            <datalist id={`suggestions-${type}`}>
              {suggestions.map(s => <option key={s.id} value={s.name} />)}
            </datalist>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-slate-600 mb-1">وردەکاری (بۆ نموونە: بڕی کاڵاکان)</label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">بڕی پارە</label>
            <input
              type="number"
              required
              min="0"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              dir="ltr"
            />
          </div>
          <div className="md:col-span-4 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition flex items-center gap-2 font-medium text-sm h-10"
            >
              <Plus size={18} />
              <span>تۆمارکردنی قەرز</span>
            </button>
          </div>
        </form>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h4 className="font-bold text-slate-700 flex items-center gap-2">📝 لیستی قەرزەکان</h4>
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
                  <th className="px-4 py-3 font-semibold">کردارەکان</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-50">
                {debts.map(debt => (
                  <tr key={debt.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-4 font-medium text-slate-900">{debt.relatedEntityId}</td>
                    <td className="px-4 py-4 text-slate-600">{debt.description}</td>
                    <td className="px-4 py-4 font-bold text-amber-600" dir="ltr">{debt.amount.toLocaleString()}</td>
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
                          onClick={() => handleDelete(debt.id)}
                          className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                          title="سڕینەوە"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
</td>
                  </tr>
                ))}
                {debts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-500">
                      هیچ قەرزێک نییە
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
