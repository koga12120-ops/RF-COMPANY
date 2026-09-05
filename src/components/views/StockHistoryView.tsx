import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, where, deleteDoc, doc, updateDoc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { StockHistory } from '../../types';
import { Package, Search, Calendar, Trash2, Edit2, Printer, FileText, X, Check } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import ConfirmModal from '../common/ConfirmModal';
import { syncHistoryInvoice } from '../../lib/invoiceSync';
import { renderReceiptHeaderHtml } from '../../lib/statementPrinter';

export default function StockHistoryView() {
  const [history, setHistory] = useState<StockHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [deletingHistory, setDeletingHistory] = useState<StockHistory | null>(null);
  const [editingHistory, setEditingHistory] = useState<StockHistory | null>(null);
  const [newQtyInput, setNewQtyInput] = useState('');
  const [newInvoiceInput, setNewInvoiceInput] = useState('');
  const [isProcessingEdit, setIsProcessingEdit] = useState(false);

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

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const data: StockHistory[] = [];
        snapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() } as StockHistory);
        });
        setHistory(data);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'stock_history');
      }
    );

    return () => unsub();
  }, [selectedDate]);


  const confirmDeleteHistory = async () => {
    if (!deletingHistory) return;
    try {
      await deleteDoc(doc(db, 'stock_history', deletingHistory.id));
      setDeletingHistory(null);
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە کاتی سڕینەوە');
    }
  };

  const confirmEditHistory = async () => {
    if (!editingHistory) return;
    const newQty = Number(newQtyInput);
    if (isNaN(newQty) || newQty < 0) {
      alert('تکایە بڕێکی دروست بنووسە');
      return;
    }

    setIsProcessingEdit(true);
    try {
      const diff = newQty - editingHistory.quantityAdded;
      const cleanNewInvoice = newInvoiceInput.trim();

      await updateDoc(doc(db, 'stock_history', editingHistory.id), { 
        quantityAdded: newQty,
        invoiceNo: cleanNewInvoice
      });

      // Update item total and invoice
      if (editingHistory.itemId) {
        const itemRef = doc(db, 'items', editingHistory.itemId);
        const itemSnap = await getDoc(itemRef);
        if (itemSnap.exists()) {
          const currentQty = itemSnap.data().quantity || 0;
          await updateDoc(itemRef, { 
            quantity: currentQty + diff,
            invoiceNo: cleanNewInvoice
          });
        }
      }

      // Sync invoice across all history and transactions if changed
      if (cleanNewInvoice !== (editingHistory.invoiceNo || '')) {
        await syncHistoryInvoice({
          historyId: editingHistory.id,
          itemId: editingHistory.itemId,
          oldInvoiceNo: editingHistory.invoiceNo || '',
          newInvoiceNo: cleanNewInvoice,
          itemName: editingHistory.itemName,
          supplier: editingHistory.supplier
        });
      }

      setEditingHistory(null);
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە کاتی دەستکاریکردنی بڕ و وەسڵ');
    } finally {
      setIsProcessingEdit(false);
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
          ${renderReceiptHeaderHtml({
            title: `ڕاپۆرتی هاتنەکانی کاڵا: ${itemName}`,
            date: Date.now()
          })}
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
          ${renderReceiptHeaderHtml({
            title: 'پسوڵەی هاتنی کاڵا بۆ کۆگا',
            invoiceNo: history.invoiceNo,
            date: history.date
          })}
          
          <div class="details">
            <div class="row">
              <span class="label">ناوی کاڵا:</span>
              <span>${history.itemName}</span>
            </div>
            ${history.invoiceNo ? `
            <div class="row">
              <span class="label">ژمارەی سەر وەسڵ:</span>
              <span dir="ltr">#${history.invoiceNo}</span>
            </div>` : ''}
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
    h.itemName.includes(searchTerm) || (h.invoiceNo && h.invoiceNo.includes(searchTerm))
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
                    <td className="px-4 py-4 font-medium text-slate-900">
                      <div>{item.itemName}</div>
                      {item.invoiceNo && (
                        <span className="inline-block mt-0.5 text-[11px] font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100" dir="ltr">
                          وەسڵ: #{item.invoiceNo}
                        </span>
                      )}
                    </td>
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
                        <button 
                          onClick={() => {
                            setEditingHistory(item);
                            setNewQtyInput(item.quantityAdded.toString());
                            setNewInvoiceInput(item.invoiceNo || '');
                          }} 
                          className="p-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition" 
                          title="دەستکاری"
                        >
                          <Edit2 size={16}/>
                        </button>
                        <button 
                          onClick={() => setDeletingHistory(item)} 
                          className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition" 
                          title="سڕینەوە"
                        >
                          <Trash2 size={16}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletingHistory}
        onClose={() => setDeletingHistory(null)}
        onConfirm={confirmDeleteHistory}
        title="سڕینەوەی تۆماری هاتنی کاڵا"
        message="ئایا دڵنیایت لە سڕینەوەی ئەم مێژووەی هاتنی کاڵا؟"
        itemName={deletingHistory?.itemName}
        details={deletingHistory ? [
          { label: 'بڕی هاتوو', value: `${(deletingHistory.quantityAdded || 0).toLocaleString()} دانە` },
          { label: 'بەروار و کات', value: format(deletingHistory.date, 'yyyy/MM/dd HH:mm') }
        ] : []}
      />

      {/* Edit Quantity Modal */}
      {editingHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150" dir="rtl">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-amber-50">
              <h3 className="font-bold text-amber-800 text-base flex items-center gap-2">
                <Edit2 className="text-amber-600" size={18} />
                دەستکاریکردنی بڕی هاتوو
              </h3>
              <button 
                onClick={() => setEditingHistory(null)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
                disabled={isProcessingEdit}
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">ناوی کاڵا:</span>
                  <span className="font-bold text-slate-800">{editingHistory.itemName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">بڕی پێشوو:</span>
                  <span className="font-bold text-slate-700 font-mono" dir="ltr">{editingHistory.quantityAdded.toLocaleString()} دانە</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">بڕی هاتووی نوێ:</label>
                <input
                  type="number"
                  dir="ltr"
                  value={newQtyInput}
                  onChange={(e) => setNewQtyInput(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl font-bold font-mono text-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  placeholder="بڕی نوێ بنووسە"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">ژمارەی سەر وەسڵ (Invoice No):</label>
                <input
                  type="text"
                  dir="ltr"
                  value={newInvoiceInput}
                  onChange={(e) => setNewInvoiceInput(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl font-bold font-mono text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  placeholder="وەک: 8899"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  💡 بە گۆڕینی ژمارەی وەسڵ لەم شوێنە، لە هەموو بەشە پەیوەندیدارەکان و کەشف حیساب نوێ دەبێتەوە.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={confirmEditHistory}
                  disabled={isProcessingEdit}
                  className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <Check size={18} />
                  {isProcessingEdit ? 'پاشەکەوت دەکرێت...' : 'نوێکردنەوە'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingHistory(null)}
                  disabled={isProcessingEdit}
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
