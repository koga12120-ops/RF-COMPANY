import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { Item, Role } from '../../types';
import { Plus, Edit2, PackagePlus, ArrowLeft, CheckCircle2, Package } from 'lucide-react';
import { updateItemAndSyncEverywhere } from '../../lib/invoiceSync';

interface StockEntryViewProps {
  role: Role;
  onNavigateToInventory?: () => void;
}

export default function StockEntryView({ role, onNavigateToInventory }: StockEntryViewProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [savedSuccessMessage, setSavedSuccessMessage] = useState<string | null>(null);

  // Form state
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState('');
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [supplier, setSupplier] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [keepInvoiceInfo, setKeepInvoiceInfo] = useState(false);

  // Units selection: carton, packet, or both
  const [hasCarton, setHasCarton] = useState(true);
  const [hasPacket, setHasPacket] = useState(false);

  // Carton fields
  const [cartonQuantity, setCartonQuantity] = useState('');
  const [cartonBonus, setCartonBonus] = useState(''); // دیاری / هەدیەی کارتۆن (تێچوو 0)
  const [cartonCost, setCartonCost] = useState('');
  const [cartonPrice, setCartonPrice] = useState('');
  const [cartonWholesale, setCartonWholesale] = useState('');

  // Packet fields
  const [packetQuantity, setPacketQuantity] = useState('');
  const [packetBonus, setPacketBonus] = useState(''); // دیاری / هەدیەی پاکەت (تێچوو 0)
  const [packetCost, setPacketCost] = useState('');
  const [packetPrice, setPacketPrice] = useState('');
  const [packetWholesale, setPacketWholesale] = useState('');

  const [paymentType, setPaymentType] = useState<'cash' | 'debt'>('cash');

  useEffect(() => {
    const q = query(collection(db, 'items'), orderBy('createdAt', 'desc'), limit(15));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const itemsData: Item[] = [];
        snapshot.forEach((doc) => {
          itemsData.push({ id: doc.id, ...doc.data() } as Item);
        });
        setItems(itemsData);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'items');
      }
    );

    const qComp = query(collection(db, 'companies'));
    const unsubComp = onSnapshot(
      qComp,
      (snapshot) => {
        const compData: any[] = [];
        snapshot.forEach((doc) => {
          compData.push({ id: doc.id, ...doc.data() });
        });
        setCompanies(compData);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'companies');
      }
    );

    return () => {
      unsubscribe();
      unsubComp();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (!hasCarton && !hasPacket) {
      alert('تکایە بەلایەنی کەم یەکەیەک هەڵبژێرە (کارتۆن یان پاکەت)');
      return;
    }

    const cPurchased = hasCarton ? (Number(cartonQuantity) || 0) : 0;
    const cBonus = hasCarton ? (Number(cartonBonus) || 0) : 0;
    const cTotal = cPurchased + cBonus;

    const pPurchased = hasPacket ? (Number(packetQuantity) || 0) : 0;
    const pBonus = hasPacket ? (Number(packetBonus) || 0) : 0;
    const pTotal = pPurchased + pBonus;

    const cCost = hasCarton ? (Number(cartonCost) || 0) : 0;
    const cPrice = hasCarton ? (Number(cartonPrice) || 0) : 0;
    const cWholesale = hasCarton ? (Number(cartonWholesale) || 0) : 0;

    const pCost = hasPacket ? (Number(packetCost) || 0) : 0;
    const pPrice = hasPacket ? (Number(packetPrice) || 0) : 0;
    const pWholesale = hasPacket ? (Number(packetWholesale) || 0) : 0;

    const totalQty = cTotal + pTotal;
    const totalPurchasedQty = cPurchased + pPurchased;
    const totalBonusQty = cBonus + pBonus;
    const totalCostVal = (cPurchased * cCost) + (pPurchased * pCost);

    const primaryCost = cCost || pCost;
    const primaryPrice = cPrice || pPrice;
    const cleanInvoice = invoiceNo.trim();

    const itemData: any = {
      name: name.trim(),
      barcode: barcode.trim(),
      supplier: supplier.trim(),
      invoiceNo: cleanInvoice,
      quantity: totalQty,
      unitType: hasCarton && hasPacket ? 'both' : (hasCarton ? 'carton' : 'packet'),
      costPrice: primaryCost,
      sellingPrice: primaryPrice,
      wholesalePrice: cWholesale || pWholesale || 0,
      
      cartonQuantity: hasCarton ? cTotal : 0,
      cartonBonusQuantity: cBonus,
      cartonPurchaseCost: cCost,
      cartonCostPrice: cCost,
      cartonSellingPrice: cPrice,
      cartonWholesalePrice: cWholesale,

      packetQuantity: hasPacket ? pTotal : 0,
      packetBonusQuantity: pBonus,
      packetPurchaseCost: pCost,
      packetCostPrice: pCost,
      packetSellingPrice: pPrice,
      packetWholesalePrice: pWholesale,
    };

    try {
      if (isEditing) {
        const oldItem = items.find(i => i.id === editId) || ({} as Item);
        const oldTotal = oldItem.quantity || 0;
        const quantityAdded = totalQty > oldTotal ? totalQty - oldTotal : 0;

        await updateItemAndSyncEverywhere({
          itemId: editId,
          oldItem,
          itemData,
          quantityAdded,
          paymentType,
          costPricePerPiece: primaryCost,
          totalCostAmount: totalCostVal,
          bonusQuantityAdded: totalBonusQty,
        });
        setSavedSuccessMessage(`کاڵای «${name.trim()}» بە سەرکەوتوویی نوێکرایەوە`);
      } else {
        await addDoc(collection(db, 'items'), {
          ...itemData,
          createdAt: Date.now()
        });

        if (totalQty > 0) {
          const giftDetails = [];
          if (cBonus > 0) giftDetails.push(`${cBonus} کارتۆن دیاری`);
          if (pBonus > 0) giftDetails.push(`${pBonus} پاکەت دیاری`);
          const giftNote = giftDetails.length > 0 ? ` (+ ${giftDetails.join(' و ')} بە بێ تێچوو)` : '';

          await addDoc(collection(db, 'stock_history'), {
            itemName: name.trim(),
            quantityAdded: totalQty,
            purchasedQuantity: totalPurchasedQty,
            bonusQuantity: totalBonusQty,
            cartonBonus: cBonus,
            packetBonus: pBonus,
            unit: hasCarton ? 'carton' : 'packet',
            date: Date.now(),
            invoiceNo: cleanInvoice || '',
            supplier: supplier.trim() || '',
            notes: giftDetails.length > 0 ? `دیاری: ${giftDetails.join(' و ')} (تێچوو سفر - تەواو قازانج)` : ''
          });

          const unitParts = [];
          if (hasCarton && cPurchased > 0) unitParts.push(`${cPurchased} کارتۆن`);
          if (hasPacket && pPurchased > 0) unitParts.push(`${pPurchased} پاکەت`);
          const unitLabel = unitParts.join(' و ') || (hasCarton ? 'کارتۆن' : 'پاکەت');

          const transactionDesc = paymentType === 'cash'
            ? (cleanInvoice ? `نەقدی کڕین (وەسڵی #${cleanInvoice}) - ${name.trim()} (${unitLabel}${giftNote})` : `نەقدی کڕینی کاڵای ${name.trim()}${giftNote}`)
            : (cleanInvoice ? `قەرزی کڕین (وەسڵی #${cleanInvoice}) - ${name.trim()} (${unitLabel}${giftNote})` : `قەرزی کڕینی کاڵای ${name.trim()}${giftNote}`);

          await addDoc(collection(db, 'transactions'), {
            type: paymentType === 'cash' ? 'company_cash' : 'company_debt',
            amount: totalCostVal,
            date: Date.now(),
            description: transactionDesc,
            relatedEntityId: supplier.trim() || 'نەزانراو',
            invoiceNo: cleanInvoice || ''
          });
        }
        setSavedSuccessMessage(`کاڵای «${name.trim()}» بە سەرکەوتوویی داخڵ کرا بۆ کۆگا`);
      }
      setTimeout(() => setSavedSuccessMessage(null), 5000);
      resetForm();
    } catch (error) {
      console.error("Error saving item: ", error);
      alert('هەڵەیەک ڕوویدا لە کاتی پاشەکەوتکردندا');
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditId('');
    setName('');
    setBarcode('');
    if (!keepInvoiceInfo) {
      setSupplier('');
      setInvoiceNo('');
    }
    setHasCarton(true);
    setHasPacket(false);
    setCartonQuantity('');
    setCartonBonus('');
    setCartonCost('');
    setCartonPrice('');
    setCartonWholesale('');
    setPacketQuantity('');
    setPacketBonus('');
    setPacketCost('');
    setPacketPrice('');
    setPacketWholesale('');
    setPaymentType('cash');
  };

  return (
    <div className="space-y-6" onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(e); }}>
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 text-white p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 backdrop-blur-md rounded-xl">
              <PackagePlus size={24} className="text-indigo-200" />
            </div>
            <div>
              <h2 className="text-xl font-black">داخڵکردنی کاڵا بۆ کۆگا</h2>
              <p className="text-xs text-indigo-200 mt-0.5">
                تۆمارکردنی کاڵای نوێ و کڕینی کۆمپانیا بە کارتۆن، پاکەت، دیاری و بەستنەوە بە وەسڵ
              </p>
            </div>
          </div>
        </div>

        {onNavigateToInventory && (
          <button
            type="button"
            onClick={onNavigateToInventory}
            className="px-4 py-2.5 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 border border-white/20 shadow-sm cursor-pointer"
          >
            <Package size={16} />
            <span>چوون بۆ لیستی کۆگا</span>
            <ArrowLeft size={14} />
          </button>
        )}
      </div>

      {/* Success Notification */}
      {savedSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
          <span className="text-sm font-bold">{savedSuccessMessage}</span>
        </div>
      )}

      {/* Form Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-base font-bold mb-4 text-slate-800 border-b border-slate-100 pb-3 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <PackagePlus className="text-indigo-600" size={20} />
            {isEditing ? 'دەستکاریکردنی کاڵا یان نوێکردنەوەی بڕ' : 'داخڵکردنی کاڵای نوێ بە کارتۆن و پاکەت'}
          </span>
          {isEditing && (
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-lg font-bold">
              دۆخی دەستکاریکردن
            </span>
          )}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">ناوی کاڵا *</label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ناوی کاڵاکە..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">بارکۆد</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="بارکۆد..."
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">کۆمپانیا / سەرچاوە</label>
              <input
                type="text"
                list="entry-companies-list"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="ناوی کۆمپانیا..."
              />
              <datalist id="entry-companies-list">
                {companies.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-bold text-indigo-900 mb-1 flex items-center justify-between">
                <span>ژمارەی سەر وەسڵ (ڕەقەم وەسڵ)</span>
                <span className="text-[10px] text-indigo-600 font-normal">وەسڵی کۆمپانیا</span>
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-indigo-200 bg-indigo-50/40 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm font-bold text-indigo-950"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="وەسڵی ژمارە..."
                dir="ltr"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-indigo-100 transition select-none font-medium">
              <input 
                type="checkbox" 
                checked={keepInvoiceInfo} 
                onChange={(e) => setKeepInvoiceInfo(e.target.checked)} 
                className="rounded text-indigo-600 w-3.5 h-3.5 cursor-pointer" 
              />
              <span>هێشتنەوەی ناوی کۆمپانیا و ژمارەی وەسڵ بۆ داخڵکردنی خێرای کاڵاکانی تری ئەم وەسڵە</span>
            </label>
          </div>

          {/* Unit selection toggles */}
          <div className="flex items-center gap-6 border-y border-slate-100 py-3">
            <span className="text-xs font-bold text-slate-700">جۆری یەکەکانی کاڵا:</span>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={hasCarton} 
                onChange={e => setHasCarton(e.target.checked)} 
                className="rounded text-indigo-600 w-4 h-4 cursor-pointer" 
              />
              <span>کارتۆن (Carton)</span>
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={hasPacket} 
                onChange={e => setHasPacket(e.target.checked)} 
                className="rounded text-indigo-600 w-4 h-4 cursor-pointer" 
              />
              <span>پاکەت (Packet)</span>
            </label>
          </div>

          {/* Cartons & Packets Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Carton inputs */}
            {hasCarton && (
              <div className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100 space-y-3">
                <div className="font-bold text-sm text-indigo-900 flex items-center justify-between border-b border-indigo-100/80 pb-2">
                  <span>بڕ و نرخەکانی کارتۆن</span>
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-mono">Carton</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">بڕی کارتۆنی کڕدراو</label>
                    <input 
                      type="number" 
                      min="0" 
                      step="any" 
                      required={hasCarton}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none bg-white" 
                      value={cartonQuantity} 
                      onChange={(e) => setCartonQuantity(e.target.value)} 
                      placeholder="0"
                      dir="ltr" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-amber-700 mb-1 flex items-center gap-1">
                      <span>🎁 دیاری / هەدیە (تێچوو 0)</span>
                    </label>
                    <input 
                      type="number" 
                      min="0" 
                      step="any" 
                      className="w-full px-3 py-2 border border-amber-300 bg-amber-50/60 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none" 
                      value={cartonBonus} 
                      onChange={(e) => setCartonBonus(e.target.value)} 
                      placeholder="بڕی هەدیە (0)"
                      dir="ltr" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">تێچوو بۆ کارتۆنی کڕدراو</label>
                    <input 
                      type="number" 
                      min="0" 
                      step="any" 
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none bg-white" 
                      value={cartonCost} 
                      onChange={(e) => setCartonCost(e.target.value)} 
                      placeholder="0"
                      dir="ltr" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">نرخی فرۆشتن (کارتۆن)</label>
                    <input 
                      type="number" 
                      min="0" 
                      step="any" 
                      required={hasCarton} 
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none bg-white" 
                      value={cartonPrice} 
                      onChange={(e) => setCartonPrice(e.target.value)} 
                      placeholder="0"
                      dir="ltr" 
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-600 mb-1">نرخی کۆگا / کۆمەڵ (کارتۆن)</label>
                    <input 
                      type="number" 
                      min="0" 
                      step="any" 
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none bg-white" 
                      value={cartonWholesale} 
                      onChange={(e) => setCartonWholesale(e.target.value)} 
                      placeholder="0"
                      dir="ltr" 
                    />
                  </div>
                </div>

                {Number(cartonBonus) > 0 && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed font-medium">
                    <div className="flex items-center gap-1 font-bold text-amber-950 mb-0.5">
                      <span>🎁 بڕی دیاری: {cartonBonus} کارتۆن بێ تێچوو</span>
                    </div>
                    <div>
                      کۆی گشتی لە کۆگا: <strong className="font-bold">{(Number(cartonQuantity) || 0) + Number(cartonBonus)}</strong> کارتۆن دادەنرێت. پارەی کۆمپانیا تەنها بۆ <strong className="font-bold">{Number(cartonQuantity) || 0}</strong> کارتۆنی کڕدراوە ({((Number(cartonCost) || 0) * (Number(cartonQuantity) || 0)).toLocaleString()} د.ع).
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Packet inputs */}
            {hasPacket && (
              <div className="p-4 bg-emerald-50/40 rounded-2xl border border-emerald-100 space-y-3">
                <div className="font-bold text-sm text-emerald-900 flex items-center justify-between border-b border-emerald-100/80 pb-2">
                  <span>بڕ و نرخەکانی پاکەت</span>
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-mono">Packet</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">بڕی پاکەتی کڕدراو</label>
                    <input 
                      type="number" 
                      min="0" 
                      step="any" 
                      required={hasPacket}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none bg-white" 
                      value={packetQuantity} 
                      onChange={(e) => setPacketQuantity(e.target.value)} 
                      placeholder="0"
                      dir="ltr" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-amber-700 mb-1 flex items-center gap-1">
                      <span>🎁 دیاری / هەدیە (تێچوو 0)</span>
                    </label>
                    <input 
                      type="number" 
                      min="0" 
                      step="any" 
                      className="w-full px-3 py-2 border border-amber-300 bg-amber-50/60 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none" 
                      value={packetBonus} 
                      onChange={(e) => setPacketBonus(e.target.value)} 
                      placeholder="بڕی هەدیە (0)"
                      dir="ltr" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">تێچوو بۆ پاکەتی کڕدراو</label>
                    <input 
                      type="number" 
                      min="0" 
                      step="any" 
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none bg-white" 
                      value={packetCost} 
                      onChange={(e) => setPacketCost(e.target.value)} 
                      placeholder="0"
                      dir="ltr" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">نرخی فرۆشتن (پاکەت)</label>
                    <input 
                      type="number" 
                      min="0" 
                      step="any" 
                      required={hasPacket} 
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none bg-white" 
                      value={packetPrice} 
                      onChange={(e) => setPacketPrice(e.target.value)} 
                      placeholder="0"
                      dir="ltr" 
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-600 mb-1">نرخی کۆگا / کۆمەڵ (پاکەت)</label>
                    <input 
                      type="number" 
                      min="0" 
                      step="any" 
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none bg-white" 
                      value={packetWholesale} 
                      onChange={(e) => setPacketWholesale(e.target.value)} 
                      placeholder="0"
                      dir="ltr" 
                    />
                  </div>
                </div>

                {Number(packetBonus) > 0 && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed font-medium">
                    <div className="flex items-center gap-1 font-bold text-amber-950 mb-0.5">
                      <span>🎁 بڕی دیاری: {packetBonus} پاکەت بێ تێچوو</span>
                    </div>
                    <div>
                      کۆی گشتی لە کۆگا: <strong className="font-bold">{(Number(packetQuantity) || 0) + Number(packetBonus)}</strong> پاکەت دادەنرێت. پارەی کۆمپانیا تەنها بۆ <strong className="font-bold">{Number(packetQuantity) || 0}</strong> پاکەتی کڕدراوە ({((Number(packetCost) || 0) * (Number(packetQuantity) || 0)).toLocaleString()} د.ع).
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-3 border-t border-slate-100">
            <div className="flex gap-4 items-center">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="radio" 
                  checked={paymentType === 'cash'} 
                  onChange={() => setPaymentType('cash')} 
                  className="text-indigo-600 w-4 h-4 cursor-pointer" 
                />
                <span className="text-sm font-bold text-slate-700">نەقدی کۆمپانیا</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="radio" 
                  checked={paymentType === 'debt'} 
                  onChange={() => setPaymentType('debt')} 
                  className="text-indigo-600 w-4 h-4 cursor-pointer" 
                />
                <span className="text-sm font-bold text-slate-700">قەرزی کۆمپانیا</span>
              </label>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="submit"
                className="flex-1 sm:flex-none px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-sm text-sm cursor-pointer"
              >
                {isEditing ? <Edit2 size={16} /> : <Plus size={16} />}
                <span>{isEditing ? 'پاشەکەوتکردنی گۆڕانکاری' : 'زیادکردنی کاڵا بۆ کۆگا'}</span>
              </button>
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition font-bold text-sm cursor-pointer"
                >
                  پاشگەزبوونەوە
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
