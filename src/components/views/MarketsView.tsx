import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { Market, Order, CashvanSale, Transaction } from '../../types';
import { 
  Store, 
  Plus, 
  Edit2, 
  Trash2, 
  History, 
  X, 
  Truck, 
  ShoppingCart, 
  CreditCard, 
  DollarSign, 
  CheckCircle2, 
  TrendingDown, 
  Printer, 
  FileText,
  Clock,
  Check
} from 'lucide-react';
import { format } from 'date-fns';
import ConfirmModal from '../common/ConfirmModal';
import PayCompanyDebtModal from '../common/PayCompanyDebtModal';
import { printStatementPopup } from '../../lib/statementPrinter';

export default function MarketsView() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cashvanSales, setCashvanSales] = useState<CashvanSale[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingMarket, setDeletingMarket] = useState<Market | null>(null);

  // Pay Debt Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payModalMarket, setPayModalMarket] = useState<Market | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<'market' | 'warehouse'>('market');
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Modal / Selected Market states
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [marketTab, setMarketTab] = useState<'all' | 'orders' | 'cashvan' | 'transactions'>('all');

  useEffect(() => {
    // 1. Markets
    const qMarkets = query(collection(db, 'markets'), orderBy('createdAt', 'desc'));
    const unsubMarkets = onSnapshot(
      qMarkets,
      (snapshot) => {
        const data: Market[] = [];
        snapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() } as Market);
        });
        setMarkets(data);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'markets');
      }
    );

    // 2. Orders
    const qOrders = query(collection(db, 'orders'), orderBy('timestamp', 'desc'));
    const unsubOrders = onSnapshot(
      qOrders,
      (snapshot) => {
        const data: Order[] = [];
        snapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() } as Order);
        });
        setOrders(data);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'orders');
      }
    );

    // 3. Cashvan Sales
    const qCashvan = query(collection(db, 'cashvan_sales'));
    const unsubCashvan = onSnapshot(
      qCashvan,
      (snapshot) => {
        const data: CashvanSale[] = [];
        snapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() } as CashvanSale);
        });
        setCashvanSales(data.sort((a, b) => (b.date || 0) - (a.date || 0)));
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'cashvan_sales');
      }
    );

    // 4. Transactions (debts, payments, cash)
    const qTrans = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const unsubTrans = onSnapshot(
      qTrans,
      (snapshot) => {
        const data: Transaction[] = [];
        snapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() } as Transaction);
        });
        setTransactions(data);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'transactions');
      }
    );

    return () => {
      unsubMarkets();
      unsubOrders();
      unsubCashvan();
      unsubTrans();
    };
  }, []);

  // Compute stats per market
  const marketStatsMap = useMemo(() => {
    const map = new Map<string, { totalOrders: number; totalCashvan: number; totalSales: number; totalDebt: number; totalPaid: number; balance: number }>();
    
    markets.forEach(m => {
      map.set(m.name, { totalOrders: 0, totalCashvan: 0, totalSales: 0, totalDebt: 0, totalPaid: 0, balance: 0 });
    });

    orders.forEach(o => {
      const name = o.marketName?.trim();
      if (name && o.status !== 'deleted') {
        const current = map.get(name) || { totalOrders: 0, totalCashvan: 0, totalSales: 0, totalDebt: 0, totalPaid: 0, balance: 0 };
        current.totalOrders += (o.totalAmount || 0);
        current.totalSales += (o.totalAmount || 0);
        map.set(name, current);
      }
    });

    cashvanSales.forEach(c => {
      const name = c.marketName?.trim();
      if (name && c.status !== 'deleted') {
        const current = map.get(name) || { totalOrders: 0, totalCashvan: 0, totalSales: 0, totalDebt: 0, totalPaid: 0, balance: 0 };
        current.totalCashvan += (c.totalAmount || 0);
        current.totalSales += (c.totalAmount || 0);
        map.set(name, current);
      }
    });

    transactions.forEach(t => {
      const entity = t.relatedEntityId?.trim();
      if (entity) {
        const current = map.get(entity) || { totalOrders: 0, totalCashvan: 0, totalSales: 0, totalDebt: 0, totalPaid: 0, balance: 0 };
        if (t.type === 'debt' || t.type === 'market_debt') {
          current.totalDebt += (t.amount || 0);
        } else if (t.type === 'paid_debt' || t.type === 'market_paid_debt') {
          current.totalPaid += (t.amount || 0);
        }
        current.balance = Math.max(0, current.totalDebt - current.totalPaid);
        map.set(entity, current);
      }
    });

    return map;
  }, [markets, orders, cashvanSales, transactions]);

  // Selected Market Data
  const selectedMarketOrders = useMemo(() => {
    if (!selectedMarket) return [];
    return orders.filter(o => o.marketName === selectedMarket.name);
  }, [selectedMarket, orders]);

  const selectedMarketCashvan = useMemo(() => {
    if (!selectedMarket) return [];
    return cashvanSales.filter(c => c.marketName === selectedMarket.name);
  }, [selectedMarket, cashvanSales]);

  const selectedMarketTrans = useMemo(() => {
    if (!selectedMarket) return [];
    return transactions.filter(t => t.relatedEntityId === selectedMarket.name);
  }, [selectedMarket, transactions]);

  const selectedMarketStats = useMemo(() => {
    if (!selectedMarket) return { totalOrders: 0, totalCashvan: 0, totalSales: 0, totalDebt: 0, totalPaid: 0, balance: 0 };
    return marketStatsMap.get(selectedMarket.name) || { totalOrders: 0, totalCashvan: 0, totalSales: 0, totalDebt: 0, totalPaid: 0, balance: 0 };
  }, [selectedMarket, marketStatsMap]);

  const handleSubmit = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;

    if (isEditing && editingId) {
      await updateDoc(doc(db, 'markets', editingId), {
        name,
        location,
        phone,
        type,
      });
      setIsEditing(false);
      setEditingId(null);
    } else {
      await addDoc(collection(db, 'markets'), {
        name,
        location,
        phone,
        type,
        createdAt: Date.now()
      });
    }
    setName('');
    setLocation('');
    setPhone('');
    setType('market');
  };

  const handleEdit = (market: Market) => {
    setName(market.name);
    setLocation(market.location);
    setPhone(market.phone);
    setType(market.type || 'market');
    setIsEditing(true);
    setEditingId(market.id);
  };

  const confirmDeleteMarket = async () => {
    if (!deletingMarket) return;
    try {
      await deleteDoc(doc(db, 'markets', deletingMarket.id));
      if (editingId === deletingMarket.id) resetForm();
      setDeletingMarket(null);
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە کاتی سڕینەوەی مارکێت');
    }
  };

  const resetForm = () => {
    setName('');
    setLocation('');
    setPhone('');
    setType('market');
    setIsEditing(false);
    setEditingId(null);
  };

  const printStatement = (marketName: string) => {
    if (!marketName) return;
    const marketTrans = transactions.filter(t => t.relatedEntityId === marketName);
    printStatementPopup(marketName, marketTrans);
  };

  const printSingleInvoice = (title: string, entityName: string, amount: number, date: number, personName: string, items?: any[], invoiceNo?: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let itemsHtml = '';
    if (items && items.length > 0) {
      itemsHtml = `
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #f1f5f9;">
              <th style="padding: 8px; border: 1px solid #cbd5e1; width: 40px; text-align: center;">#</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">کاڵا</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1; width: 80px; text-align: center;">دانە</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1; width: 120px; text-align: left;">نرخ</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1; width: 140px; text-align: left;">کۆ</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((it, idx) => `
              <tr>
                <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${idx + 1}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">${it.name}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;" dir="ltr">${it.quantity}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;" dir="ltr">${(it.price || 0).toLocaleString()} د.ع</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: left; font-weight: bold;" dir="ltr">${((it.quantity || 0) * (it.price || 0)).toLocaleString()} د.ع</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    const invText = invoiceNo ? `<div style="font-size: 14px; font-weight: bold; margin-top: 5px;">ژمارەی وەسڵ: #${invoiceNo}</div>` : '';

    const html = `
      <html dir="rtl">
        <head>
          <title>${title} - ${entityName} ${invoiceNo ? `#${invoiceNo}` : ''}</title>
          <style>
            body { font-family: Tahoma, Arial, sans-serif; padding: 25px; color: #333; direction: rtl; }
            .header { text-align: center; border-bottom: 2px solid #eee; padding-bottom: 15px; margin-bottom: 20px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
            .amount { font-size: 22px; font-weight: bold; text-align: center; margin: 20px 0; padding: 12px; border: 2px solid #1e293b; border-radius: 8px; background-color: #f8fafc; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0; color: #1e293b; font-size: 32px; font-weight: 900; letter-spacing: 2px;">TAM TAM</h1>
            <div style="color: #64748b; font-size: 14px; margin-top: 4px;">${title}</div>
            ${invText}
          </div>
          <div class="row"><span>ناوی مارکێت:</span> <strong>${entityName}</strong></div>
          <div class="row"><span>ئەنجامدەر:</span> <strong>${personName}</strong></div>
          <div class="row"><span>بەروار:</span> <span dir="ltr">${format(date, 'yyyy-MM-dd HH:mm')}</span></div>
          
          ${itemsHtml}

          <div class="amount" dir="ltr">${amount.toLocaleString()} د.ع</div>

          <div style="display: flex; justify-content: space-between; margin-top: 40px;">
            <div style="text-align: center;">واژووی پێدەر<div style="margin-top: 30px; border-top: 1px solid #333; width: 120px;"></div></div>
            <div style="text-align: center;">واژووی وەرگر<div style="margin-top: 30px; border-top: 1px solid #333; width: 120px;"></div></div>
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6" onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(e); }}>
      {/* Add / Edit Market Form */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold mb-4 text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
          {isEditing ? 'دەستکاریکردنی زانیاری کڕیار' : 'زیادکردنی مارکێت یان کۆگای نوێ'}
        </h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm text-slate-600 mb-1">ناوی شوێن / کڕیار</label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="بۆ نموونە: مارکێتی سەردەم"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">جۆری کڕیار</label>
            <select
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as 'market' | 'warehouse')}
            >
              <option value="market">مارکێت (فرۆشتن بە نرخی ئاسایی)</option>
              <option value="warehouse">کۆگا/جوملە (فرۆشتن بە نرخی کۆگا)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">ناونیشان / گەڕەک</label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="بۆ نموونە: سلێمانی - ڕاپەڕین"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">ژمارەی تەلەفۆن</label>
            <input
              type="tel"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
              placeholder="07XXXXXXXXX"
            />
          </div>
          <div className="flex gap-2 lg:col-span-4 justify-end">
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2 text-sm h-10 shadow-sm"
            >
              {isEditing ? <Edit2 size={18} /> : <Plus size={18} />}
              <span>{isEditing ? 'پاشەکەوتکردن' : 'زیادکردنی کڕیار'}</span>
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 bg-slate-100 text-slate-600 font-medium rounded-lg hover:bg-slate-200 transition text-sm h-10"
              >
                پاشگەزبوونەوە
              </button>
            )}
          </div>
        </form>
      </section>

      {/* Markets List */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h4 className="font-bold text-slate-700 flex items-center gap-2">
            <Store size={20} className="text-indigo-600" />
            حسابات و لیستی مارکێت و کۆگاکان
          </h4>
          <span className="text-xs text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-full font-medium">
            کۆی گشتی: {markets.length} شوێن
          </span>
        </div>
        {loading ? (
          <div className="text-center py-10 text-slate-500">خەریکی هێنانە...</div>
        ) : (
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3.5 font-semibold">ناوی شوێن</th>
                  <th className="px-4 py-3.5 font-semibold">جۆر</th>
                  <th className="px-4 py-3.5 font-semibold">ناونیشان</th>
                  <th className="px-4 py-3.5 font-semibold">تەلەفۆن</th>
                  <th className="px-4 py-3.5 font-semibold">کۆی فرۆشراو</th>
                  <th className="px-4 py-3.5 font-semibold">قەرزی ماوە (باڵانس)</th>
                  <th className="px-4 py-3.5 font-semibold text-center">کردارەکان</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {markets.map(market => {
                  const stats = marketStatsMap.get(market.name) || { totalOrders: 0, totalCashvan: 0, totalSales: 0, totalDebt: 0, totalPaid: 0, balance: 0 };
                  const hasDebt = stats.balance > 0;

                  return (
                    <tr key={market.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-4 font-bold text-slate-900">{market.name}</td>
                      <td className="px-4 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          market.type === 'warehouse' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {market.type === 'warehouse' ? 'کۆگا/جوملە' : 'مارکێت'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-600">{market.location}</td>
                      <td className="px-4 py-4 text-slate-500 font-mono text-xs" dir="ltr">{market.phone || '-'}</td>
                      <td className="px-4 py-4 font-bold text-slate-700 font-mono" dir="ltr">
                        {stats.totalSales > 0 ? stats.totalSales.toLocaleString() : '-'}
                      </td>
                      <td className="px-4 py-4">
                        {hasDebt ? (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-800 font-mono" dir="ltr">
                            {stats.balance.toLocaleString()} د.ع
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">
                            حساب پاکە
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setPayModalMarket(market);
                              setIsPayModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition flex items-center gap-1 text-xs font-bold"
                            title="دانەوەی قەرز"
                          >
                            <CreditCard size={15} />
                            <span>دانەوەی قەرز</span>
                          </button>
                          <button
                            onClick={() => setSelectedMarket(market)}
                            className="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition flex items-center gap-1 text-xs font-bold"
                            title="حسابات و مێژووی مامەڵەکان"
                          >
                            <History size={15} />
                            <span>حسابات</span>
                          </button>
                          <button
                            onClick={() => printStatement(market.name)}
                            className="p-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg transition"
                            title="چاپکردنی کەشف حیساب"
                          >
                            <FileText size={16} />
                          </button>
                          <button
                            onClick={() => handleEdit(market)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition"
                            title="دەستکاری"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setDeletingMarket(market)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="سڕینەوە"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {markets.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-500">
                      هیچ مارکێت یان کۆگایەک تۆمار نەکراوە
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
        isOpen={!!deletingMarket}
        onClose={() => setDeletingMarket(null)}
        onConfirm={confirmDeleteMarket}
        title="سڕینەوەی کڕیار / مارکێت"
        message="ئایا دڵنیایت لە سڕینەوەی ئەم کڕیارە لە سیستەمدا؟"
        itemName={deletingMarket?.name}
        details={deletingMarket ? [
          { label: 'شوێن / ناونیشان', value: deletingMarket.location || '-' },
          { label: 'ژمارەی مۆبایل', value: deletingMarket.phone || '-' },
          { label: 'جۆر', value: deletingMarket.type === 'warehouse' ? 'کۆگا' : 'مارکێت' }
        ] : []}
      />

      {/* Detailed Market History & Accounts Modal */}
      {selectedMarket && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]" dir="rtl">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  <Store size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-base">{selectedMarket.name}</h3>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${selectedMarket.type === 'warehouse' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {selectedMarket.type === 'warehouse' ? 'کۆگا' : 'مارکێت'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {selectedMarket.location} {selectedMarket.phone ? ` • ${selectedMarket.phone}` : ''}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setPayModalMarket(selectedMarket);
                    setIsPayModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                >
                  <CreditCard size={15} />
                  <span>دانەوەی قەرز</span>
                </button>
                <button
                  onClick={() => printStatement(selectedMarket.name)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                >
                  <FileText size={15} />
                  <span>چاپکردنی کەشف حیساب</span>
                </button>
                <button 
                  onClick={() => setSelectedMarket(null)}
                  className="p-1.5 hover:bg-slate-200 rounded-full transition text-slate-400 hover:text-slate-700"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Financial Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50/50 border-b border-slate-100">
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                  <DollarSign size={14} className="text-emerald-600" />
                  کۆی فرۆشراو
                </div>
                <div className="text-base font-bold text-slate-800 font-mono" dir="ltr">
                  {selectedMarketStats.totalSales.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400">مەندووب + کاشڤان</div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-2xs">
                <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                  <CreditCard size={14} className="text-amber-600" />
                  کۆی قەرز
                </div>
                <div className="text-base font-bold text-amber-600 font-mono" dir="ltr">
                  {selectedMarketStats.totalDebt.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400">تۆماری قەرزەکان</div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-green-200 shadow-2xs">
                <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                  <CheckCircle2 size={14} className="text-green-600" />
                  کۆی واسڵکراو
                </div>
                <div className="text-base font-bold text-green-600 font-mono" dir="ltr">
                  {selectedMarketStats.totalPaid.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400">پارەی دراوە</div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-indigo-200 shadow-2xs">
                <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                  <TrendingDown size={14} className="text-indigo-600" />
                  قەرزی ماوە (باڵانس)
                </div>
                <div className="text-base font-bold text-indigo-700 font-mono" dir="ltr">
                  {selectedMarketStats.balance.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400">قەرز - واسڵکراو</div>
              </div>
            </div>

            {/* Sub Tabs */}
            <div className="flex border-b border-slate-200 bg-white px-4">
              <button
                onClick={() => setMarketTab('all')}
                className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition ${
                  marketTab === 'all' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Clock size={16} />
                تەواوی مامەڵەکان ({selectedMarketOrders.length + selectedMarketCashvan.length + selectedMarketTrans.length})
              </button>
              <button
                onClick={() => setMarketTab('orders')}
                className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition ${
                  marketTab === 'orders' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <ShoppingCart size={16} />
                ئۆردەری مەندووب ({selectedMarketOrders.length})
              </button>
              <button
                onClick={() => setMarketTab('cashvan')}
                className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition ${
                  marketTab === 'cashvan' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Truck size={16} />
                فرۆشتنی کاشڤان ({selectedMarketCashvan.length})
              </button>
              <button
                onClick={() => setMarketTab('transactions')}
                className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition ${
                  marketTab === 'transactions' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <CreditCard size={16} />
                تۆماری قەرز و نەقد ({selectedMarketTrans.length})
              </button>
            </div>
            
            {/* Modal Body / Lists */}
            <div className="p-4 overflow-y-auto bg-slate-50 flex-1 space-y-4">
              {/* 1. Mandoub Orders */}
              {(marketTab === 'all' || marketTab === 'orders') && (
                <div>
                  <h4 className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1.5">
                    <ShoppingCart size={15} className="text-indigo-600" />
                    ئۆردەرەکانی مەندووب (تەڵەبیە)
                  </h4>
                  {selectedMarketOrders.length === 0 ? (
                    <div className="bg-white p-4 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                      هیچ ئۆردەرێکی مەندووب نییە
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedMarketOrders.map(order => {
                        const invNo = order.invoiceId || order.invoiceNo || order.id.slice(-6);
                        return (
                          <div key={order.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                            <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-100">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-800 text-sm">
                                    مەندووب: {order.repName}
                                  </span>
                                  <span className="text-[11px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded" dir="ltr">
                                    #{invNo}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-400 font-mono mt-0.5" dir="ltr">
                                  {format(order.timestamp, 'yyyy-MM-dd HH:mm')}
                                </div>
                              </div>
                              <div className="text-left flex items-center gap-3">
                                <div>
                                  <div className="font-bold text-indigo-600 font-mono" dir="ltr">
                                    {order.totalAmount.toLocaleString()} د.ع
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {order.status === 'completed' ? 'تەسفییە کراوە' : order.status === 'printed' ? 'چاپکراوە' : 'چاوەڕوانە'}
                                    {order.paymentStatus === 'cash' ? ' (نەقد)' : order.paymentStatus === 'debt' ? ' (قەرز)' : ''}
                                  </div>
                                </div>
                                <button
                                  onClick={() => printSingleInvoice('پسوڵەی ئۆردەری مەندووب', order.marketName, order.totalAmount, order.timestamp, order.repName, order.items, invNo)}
                                  className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition"
                                  title="چاپکردن"
                                >
                                  <Printer size={15} />
                                </button>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              {order.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded-lg">
                                  <span className="font-medium text-slate-700">{item.name}</span>
                                  <span className="text-slate-500 font-mono" dir="ltr">{item.quantity} x {item.price.toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 2. Cashvan Sales */}
              {(marketTab === 'all' || marketTab === 'cashvan') && (
                <div>
                  <h4 className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1.5">
                    <Truck size={15} className="text-sky-600" />
                    فرۆشتنەکانی کاشڤان
                  </h4>
                  {selectedMarketCashvan.length === 0 ? (
                    <div className="bg-white p-4 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                      هیچ فرۆشتنێکی کاشڤان نییە
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedMarketCashvan.map(sale => {
                        const invNo = sale.invoiceNo || sale.invoiceId || sale.id.slice(-6);
                        return (
                          <div key={sale.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                            <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-100">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-800 text-sm">
                                    کاشڤان: {sale.cashvanName}
                                  </span>
                                  <span className="text-[11px] font-mono font-bold bg-sky-50 text-sky-700 px-2 py-0.5 rounded" dir="ltr">
                                    #{invNo}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-400 font-mono mt-0.5" dir="ltr">
                                  {format(sale.date, 'yyyy-MM-dd HH:mm')}
                                </div>
                              </div>
                              <div className="text-left flex items-center gap-3">
                                <div>
                                  <div className="font-bold text-sky-600 font-mono" dir="ltr">
                                    {sale.totalAmount.toLocaleString()} د.ع
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {sale.status === 'accounted' ? 'چووەتە حیسابات' : 'چاوەڕێی حیساباتە'}
                                    {sale.paymentType === 'cash' ? ' (نەقد)' : sale.paymentType === 'debt' ? ' (قەرز)' : ''}
                                  </div>
                                </div>
                                <button
                                  onClick={() => printSingleInvoice('پسوڵەی فرۆشتنی کاشڤان', sale.marketName, sale.totalAmount, sale.date, sale.cashvanName, sale.items, invNo)}
                                  className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition"
                                  title="چاپکردن"
                                >
                                  <Printer size={15} />
                                </button>
                              </div>
                            </div>
                            {sale.items && sale.items.length > 0 && (
                              <div className="space-y-1.5">
                                {sale.items.map((item, idx) => (
                                  <div key={idx} className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded-lg">
                                    <span className="font-medium text-slate-700">{item.name}</span>
                                    <span className="text-slate-500 font-mono" dir="ltr">{item.quantity} x {item.price.toLocaleString()}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 3. Debts & Payment Transactions */}
              {(marketTab === 'all' || marketTab === 'transactions') && (
                <div>
                  <h4 className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1.5">
                    <CreditCard size={15} className="text-amber-600" />
                    تۆماری قەرز و نەقد و پارەدانەوەی دەفتەر حیسابات
                  </h4>
                  {selectedMarketTrans.length === 0 ? (
                    <div className="bg-white p-4 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                      هیچ تۆمارێکی حیسابات نییە
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-100">
                          <tr>
                            <th className="p-3">بەروار</th>
                            <th className="p-3">جۆر</th>
                            <th className="p-3">وردەکاری</th>
                            <th className="p-3">بڕی پارە</th>
                            <th className="p-3 text-center">چاپ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedMarketTrans.map(t => {
                            const isDebt = t.type === 'debt';
                            const isPaid = t.type === 'paid_debt';
                            const isCash = t.type === 'cash';

                            return (
                              <tr key={t.id} className="hover:bg-slate-50/60 transition">
                                <td className="p-3 text-slate-500 font-mono" dir="ltr">
                                  {format(t.date, 'yyyy-MM-dd HH:mm')}
                                </td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded font-bold ${
                                    isDebt ? 'bg-amber-100 text-amber-700' :
                                    isPaid ? 'bg-green-100 text-green-700' :
                                    isCash ? 'bg-emerald-100 text-emerald-700' :
                                    'bg-slate-100 text-slate-700'
                                  }`}>
                                    {isDebt ? 'قەرز' : isPaid ? 'واسڵکراو' : isCash ? 'نەقد' : t.type}
                                  </span>
                                </td>
                                <td className="p-3 text-slate-700 font-medium">{t.description || '-'}</td>
                                <td className="p-3 font-bold font-mono text-slate-900" dir="ltr">
                                  {(t.amount || 0).toLocaleString()} د.ع
                                </td>
                                <td className="p-3 text-center">
                                  <button
                                    onClick={() => printSingleInvoice(isDebt ? 'پسوڵەی قەرز' : isPaid ? 'پسوڵەی واسڵکردن' : 'پسوڵەی نەقد', selectedMarket.name, t.amount, t.date, 'بەڕێوەبەر')}
                                    className="p-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-600 transition inline-block"
                                    title="چاپکردنی پسوڵە"
                                  >
                                    <Printer size={14} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Pay Debt Modal */}
      <PayCompanyDebtModal
        isOpen={isPayModalOpen}
        onClose={() => {
          setIsPayModalOpen(false);
          setPayModalMarket(null);
        }}
        initialCompany={payModalMarket?.name || ''}
        type="debt"
        targetName="مارکێت"
      />
    </div>
  );
}
