import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, where, deleteDoc, doc, updateDoc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { StockHistory } from '../../types';
import { Package, Search, Calendar, Trash2, Edit2, Printer, FileText } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';

export default function StockHistoryView() {
  const [history, setHistory] = useState<StockHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    // Only query by selectedDate to filter locally, or use Firestore where
    // For simplicity with Firestore index, we will query all and filter locally for search, 
    // but use a timestamp range for the selected day.
    const start = startOfDay(new Date(selectedDate)).getTime();
    const end = endOfDay(new Date(selectedDate)).getTime();

    const q = query(
      collection(db, 'stock_history'),
      where('date', '>=', start),
      where('date', '<=', end),
      orderBy('date', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data: StockHistory[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as StockHistory);
      });
      setHistory(data);
      setLoading(false);
    });

    return () => unsub();
  }, [selectedDate]);


  const handleDelete = async (id: string) => {
    if (window.confirm('دڵنیایت لە سڕینەوەی ئەم مێژووە؟')) {
      await deleteDoc(doc(db, 'stock_history', id));
    }
  };


  const handleEdit = async (history: StockHistory) => {
    const newQtyStr = window.prompt('بڕی هاتوو نوێ بنووسە:', history.quantityAdded.toString());
    if (newQtyStr !== null && newQtyStr.trim() !== '') {
      const newQty = Number(newQtyStr);
      if (!isNaN(newQty)) {
        const diff = newQty - history.quantityAdded;
        await updateDoc(doc(db, 'stock_history', history.id), { quantityAdded: newQty });

        // Update item total
        const itemRef = doc(db, 'items', history.itemId);
        const itemSnap = await getDoc(itemRef);
        if (itemSnap.exists()) {
          const currentQty = itemSnap.data().quantity || 0;
          await updateDoc(itemRef, { quantity: currentQty + diff });
        }
      }
    }
  };

  const printAllHistory = async (itemName: string) => {
    const q = query(collection(db, 'stock_history'), where('itemName', '==', itemName));
    const snap = await getDocs(q);
    const hist: StockHistory[] = [];
    snap.forEach(d => hist.push({ id: d.id, ...d.data() } as StockHistory));
    
    hist.sort((a,b) => b.date - a.date);
    
    let totalAdded = 0;
    const rowsHtml = hist.map(h => {
      totalAdded += h.quantityAdded;
      return `<tr>
        <td dir="ltr">${format(h.date, 'yyyy-MM-dd HH:mm')}</td>
        <td>${h.quantityAdded.toLocaleString()}</td>
      </tr>`;
    }).join('');

    const html = `
      <html dir="rtl">
        <head>
          <title>هەموو هاتنەکانی کاڵا - ${itemName}</title>
          <style>
            body { font-family: Tahoma, Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; text-align: right; }
            th, td { border: 1px solid #ddd; padding: 12px; }
            th { background-color: #f8f9fa; }
            .header { text-align: center; margin-bottom: 20px; }
            .summary { margin-top: 20px; padding: 15px; border: 2px solid #333; border-radius: 8px; font-weight: bold; font-size: 18px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>کۆمپانیای RF</h2>
            <h3>ڕاپۆرتی هاتنەکانی کاڵا: ${itemName}</h3>
            <p>بەرواری چاپ: <span dir="ltr">${format(Date.now(), 'yyyy-MM-dd HH:mm')}</span></p>
          </div>
          <table>
            <thead><tr><th>بەروار و کات</th><th>بڕی زیادکراو</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div class="summary">
            کۆی گشتی هاتوو بۆ ئەم کاڵایە: ${totalAdded.toLocaleString()} پارچە
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `;
    const win = window.open('', '_blank');
    win?.document.write(html);
    win?.document.close();
  };

  const printHistory = (history: StockHistory) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html dir="rtl">
        <head>
          <title>پسوڵەی هاتنی کاڵا - ${history.itemName}</title>
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
            <div class="subtitle">پسوڵەی هاتنی کاڵا بۆ کۆگا</div>
          </div>
          
          <div class="details">
            <div class="row">
              <span class="label">ناوی کاڵا:</span>
              <span>${history.itemName}</span>
            </div>
            <div class="row">
              <span class="label">بەروار:</span>
              <span dir="ltr">${format(history.date, 'yyyy-MM-dd HH:mm')}</span>
            </div>
          </div>
          
          <div class="amount" dir="ltr">
            بڕی هاتوو: ${history.quantityAdded}
          </div>
          
          <div style="display: flex; justify-content: space-between; margin-top: 50px;">
            <div style="text-align: center;">
              <div>واژووی کۆگا</div>
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

  const filteredHistory = history.filter(h => 
    h.itemName.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50">
          <h4 className="font-bold text-slate-700 flex items-center gap-2">
            <Package size={20} /> ڕاپۆرتی هاتنی کاڵا
          </h4>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative">
              <input
                type="date"
                className="w-full pl-4 pr-10 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono text-slate-600"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              <Calendar className="absolute right-3 top-2.5 text-slate-400" size={18} />
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="گەڕان بەدوای کاڵا..."
                className="w-full pr-10 pl-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute right-3 top-2.5 text-slate-400" size={18} />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10 text-slate-500">خەریکی هێنانە...</div>
        ) : filteredHistory.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            هیچ کاڵایەک نەهاتووە لەم ڕۆژەدا
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">ناوی کاڵا</th>
                  <th className="px-4 py-3 font-semibold">بڕی زیادکراو</th>
                  <th className="px-4 py-3 font-semibold">کات</th>
                  <th className="px-4 py-3 font-semibold">کردارەکان</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-50">
                {filteredHistory.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-4 font-medium text-slate-900">{item.itemName}</td>
                    <td className="px-4 py-4 text-green-600 font-bold" dir="ltr">
                      +{item.quantityAdded.toLocaleString()}
                    </td>
                                        <td className="px-4 py-4 text-slate-500 font-mono text-xs" dir="ltr">
                      {format(item.date, 'HH:mm')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                                                <button onClick={() => printHistory(item)} title="چاپکردنی تەنها ئەمە" className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Printer size={16}/></button>
                        <button onClick={() => printAllHistory(item.itemName)} title="هەموو هاتنەکانی ئەم کاڵایە" className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100"><FileText size={16}/></button>
                        <button onClick={() => handleEdit(item)} className="p-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100"><Edit2 size={16}/></button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Trash2 size={16}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
