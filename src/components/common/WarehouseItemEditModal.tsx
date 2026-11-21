import React, { useState, useEffect, useMemo } from 'react';
import { Item, Transaction } from '../../types';
import { format } from 'date-fns';
import { Calendar, FileText, CreditCard, DollarSign, Edit2, Building2, Layers, CheckCircle2, AlertCircle } from 'lucide-react';
import { updateItemAndSyncEverywhere, findMatchingCompanyTransaction } from '../../lib/invoiceSync';
import { normalizeKurdishArabicText } from '../../lib/similaritySearch';

interface WarehouseItemEditModalProps {
  item: Item | null;
  allItems: Item[];
  companies: any[];
  transactions: Array<Transaction & { id: string }>;
  onClose: () => void;
  onSaved?: (message: string) => void;
}

export default function WarehouseItemEditModal({
  item,
  allItems,
  companies,
  transactions,
  onClose,
  onSaved,
}: WarehouseItemEditModalProps) {
  const [selectedBatch, setSelectedBatch] = useState<Item | null>(item);

  const [editName, setEditName] = useState('');
  const [editSupplier, setEditSupplier] = useState('');
  const [editInvoiceNo, setEditInvoiceNo] = useState('');
  const [editDateStr, setEditDateStr] = useState('');

  const [editHasCarton, setEditHasCarton] = useState(true);
  const [editHasPacket, setEditHasPacket] = useState(false);

  const [editCartonQuantity, setEditCartonQuantity] = useState('');
  const [editCartonBonus, setEditCartonBonus] = useState('');
  const [editCartonCost, setEditCartonCost] = useState('');
  const [editCartonPrice, setEditCartonPrice] = useState('');
  const [editCartonWholesale, setEditCartonWholesale] = useState('');

  const [editPacketQuantity, setEditPacketQuantity] = useState('');
  const [editPacketBonus, setEditPacketBonus] = useState('');
  const [editPacketCost, setEditPacketCost] = useState('');
  const [editPacketPrice, setEditPacketPrice] = useState('');
  const [editPacketWholesale, setEditPacketWholesale] = useState('');

  const [editPaymentType, setEditPaymentType] = useState<'cash' | 'debt'>('cash');
  const [isSaving, setIsSaving] = useState(false);

  // Sync selectedBatch when parent `item` prop changes
  useEffect(() => {
    setSelectedBatch(item);
  }, [item]);

  // All warehouse batches (invoices) related to this item name
  const relatedBatches = useMemo(() => {
    const target = selectedBatch || item;
    if (!target) return [];
    const normTargetName = normalizeKurdishArabicText((target.name || '').trim()).toLowerCase();
    return allItems
      .filter((it) => normalizeKurdishArabicText((it.name || '').trim()).toLowerCase() === normTargetName)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [allItems, selectedBatch, item]);

  // Populate form whenever `selectedBatch` changes
  useEffect(() => {
    if (!selectedBatch) return;

    setEditName(selectedBatch.name || '');
    setEditSupplier(selectedBatch.supplier || '');
    setEditInvoiceNo(selectedBatch.invoiceNo || '');
    setEditDateStr(
      selectedBatch.createdAt
        ? format(selectedBatch.createdAt, 'yyyy-MM-dd')
        : format(Date.now(), 'yyyy-MM-dd')
    );

    const hasC =
      !!selectedBatch.cartonCostPrice ||
      !!selectedBatch.cartonPurchaseCost ||
      !!selectedBatch.cartonSellingPrice ||
      (selectedBatch.cartonQuantity !== undefined && selectedBatch.cartonQuantity > 0) ||
      selectedBatch.unitType === 'carton' ||
      (!selectedBatch.packetCostPrice && !selectedBatch.packetSellingPrice && !(selectedBatch.packetQuantity && selectedBatch.packetQuantity > 0));

    const hasP =
      !!selectedBatch.packetCostPrice ||
      !!selectedBatch.packetPurchaseCost ||
      !!selectedBatch.packetSellingPrice ||
      (selectedBatch.packetQuantity !== undefined && selectedBatch.packetQuantity > 0) ||
      selectedBatch.unitType === 'packet';

    setEditHasCarton(hasC);
    setEditHasPacket(hasP);

    const initialCartonCost =
      selectedBatch.cartonPurchaseCost !== undefined
        ? selectedBatch.cartonPurchaseCost.toString()
        : selectedBatch.cartonCostPrice || selectedBatch.costPrice
          ? (selectedBatch.cartonCostPrice || selectedBatch.costPrice)!.toString()
          : '';
    setEditCartonCost(initialCartonCost);
    setEditCartonPrice(
      selectedBatch.cartonSellingPrice || selectedBatch.sellingPrice
        ? (selectedBatch.cartonSellingPrice || selectedBatch.sellingPrice)!.toString()
        : ''
    );
    setEditCartonWholesale(
      selectedBatch.cartonWholesalePrice || selectedBatch.wholesalePrice
        ? (selectedBatch.cartonWholesalePrice || selectedBatch.wholesalePrice)!.toString()
        : ''
    );

    const totalCartonsVal =
      selectedBatch.cartonQuantity !== undefined
        ? selectedBatch.cartonQuantity
        : selectedBatch.unitType === 'carton' || !hasP
          ? selectedBatch.quantity || 0
          : 0;
    const bonusCartonsVal =
      selectedBatch.cartonBonusQuantity ||
      (selectedBatch.unitType === 'carton' ? selectedBatch.bonusQuantity || 0 : 0) ||
      0;
    const purchasedCartonsVal =
      selectedBatch.cartonPurchasedQuantity !== undefined
        ? selectedBatch.cartonPurchasedQuantity
        : Math.max(0, totalCartonsVal - bonusCartonsVal);

    setEditCartonQuantity(purchasedCartonsVal.toString());
    setEditCartonBonus(bonusCartonsVal > 0 ? bonusCartonsVal.toString() : '');

    const initialPacketCost =
      selectedBatch.packetPurchaseCost !== undefined
        ? selectedBatch.packetPurchaseCost.toString()
        : selectedBatch.packetCostPrice
          ? selectedBatch.packetCostPrice.toString()
          : '';
    setEditPacketCost(initialPacketCost);
    setEditPacketPrice(selectedBatch.packetSellingPrice ? selectedBatch.packetSellingPrice.toString() : '');
    setEditPacketWholesale(selectedBatch.packetWholesalePrice ? selectedBatch.packetWholesalePrice.toString() : '');

    const totalPacketsVal =
      selectedBatch.packetQuantity !== undefined
        ? selectedBatch.packetQuantity
        : selectedBatch.unitType === 'packet'
          ? selectedBatch.quantity || 0
          : 0;
    const bonusPacketsVal =
      selectedBatch.packetBonusQuantity ||
      (selectedBatch.unitType === 'packet' ? selectedBatch.bonusQuantity || 0 : 0) ||
      0;
    const purchasedPacketsVal =
      selectedBatch.packetPurchasedQuantity !== undefined
        ? selectedBatch.packetPurchasedQuantity
        : Math.max(0, totalPacketsVal - bonusPacketsVal);

    setEditPacketQuantity(purchasedPacketsVal.toString());
    setEditPacketBonus(bonusPacketsVal > 0 ? bonusPacketsVal.toString() : '');

    // Auto-detect existing payment type (debt vs cash) from transactions
    const matchedTx = findMatchingCompanyTransaction(selectedBatch, transactions);
    if (matchedTx) {
      setEditPaymentType(matchedTx.type === 'company_debt' ? 'debt' : 'cash');
    } else {
      setEditPaymentType('cash');
    }
  }, [selectedBatch, transactions]);

  if (!item || !selectedBatch) return null;

  const matchedTx = findMatchingCompanyTransaction(selectedBatch, transactions);

  const liveCartonCostTotal = editHasCarton
    ? (Number(editCartonQuantity) || 0) * (Number(editCartonCost) || 0)
    : 0;
  const livePacketCostTotal = editHasPacket
    ? (Number(editPacketQuantity) || 0) * (Number(editPacketCost) || 0)
    : 0;
  const liveTotalCost = liveCartonCostTotal + livePacketCostTotal;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    if (!editHasCarton && !editHasPacket) {
      alert('تکایە بەلایەنی کەم یەکەیەک هەڵبژێرە (کارتۆن یان پاکەت)');
      return;
    }

    setIsSaving(true);
    try {
      const cPurchased = editHasCarton ? Number(editCartonQuantity) || 0 : 0;
      const cBonus = editHasCarton ? Number(editCartonBonus) || 0 : 0;
      const cTotal = cPurchased + cBonus;

      const pPurchased = editHasPacket ? Number(editPacketQuantity) || 0 : 0;
      const pBonus = editHasPacket ? Number(editPacketBonus) || 0 : 0;
      const pTotal = pPurchased + pBonus;

      const cCost = editHasCarton ? Number(editCartonCost) || 0 : 0;
      const cPrice = editHasCarton ? Number(editCartonPrice) || 0 : 0;
      const cWholesale = editHasCarton ? Number(editCartonWholesale) || 0 : 0;

      const pCost = editHasPacket ? Number(editPacketCost) || 0 : 0;
      const pPrice = editHasPacket ? Number(editPacketPrice) || 0 : 0;
      const pWholesale = editHasPacket ? Number(editPacketWholesale) || 0 : 0;

      const totalQty = cTotal + pTotal;
      const totalCostVal = cPurchased * cCost + pPurchased * pCost;
      const totalBonusQty = cBonus + pBonus;

      const primaryCost = cCost || pCost;
      const primaryPrice = cPrice || pPrice;
      const cleanInvoice = editInvoiceNo.trim();

      // Compute invoice timestamp (preserve original time of day if date was changed)
      let resolvedTimestamp = selectedBatch.createdAt || Date.now();
      if (editDateStr) {
        const origDateStr = selectedBatch.createdAt ? format(selectedBatch.createdAt, 'yyyy-MM-dd') : '';
        if (editDateStr !== origDateStr) {
          const [y, m, d] = editDateStr.split('-').map(Number);
          const origDateObj = new Date(resolvedTimestamp);
          const newDateObj = new Date(
            y,
            m - 1,
            d,
            origDateObj.getHours(),
            origDateObj.getMinutes(),
            origDateObj.getSeconds()
          );
          resolvedTimestamp = newDateObj.getTime();
        }
      }

      const itemData: any = {
        name: editName.trim(),
        supplier: editSupplier.trim(),
        invoiceNo: cleanInvoice,
        quantity: totalQty,
        unitType: editHasCarton && editHasPacket ? 'both' : editHasCarton ? 'carton' : 'packet',
        costPrice: primaryCost,
        sellingPrice: primaryPrice,
        wholesalePrice: cWholesale || pWholesale || 0,

        cartonQuantity: editHasCarton ? cTotal : 0,
        cartonPurchasedQuantity: editHasCarton ? cPurchased : 0,
        cartonBonusQuantity: cBonus,
        cartonPurchaseCost: cCost,
        cartonCostPrice: cCost,
        cartonSellingPrice: cPrice,
        cartonWholesalePrice: cWholesale,

        packetQuantity: editHasPacket ? pTotal : 0,
        packetPurchasedQuantity: editHasPacket ? pPurchased : 0,
        packetBonusQuantity: pBonus,
        packetPurchaseCost: pCost,
        packetCostPrice: pCost,
        packetSellingPrice: pPrice,
        packetWholesalePrice: pWholesale,
      };

      const oldTotal = selectedBatch.quantity || 0;
      const quantityAdded = totalQty > oldTotal ? totalQty - oldTotal : 0;

      await updateItemAndSyncEverywhere({
        itemId: selectedBatch.id,
        oldItem: selectedBatch,
        itemData,
        quantityAdded,
        paymentType: editPaymentType,
        costPricePerPiece: primaryCost,
        totalCostAmount: totalCostVal,
        bonusQuantityAdded: totalBonusQty,
        syncFinancials: true,
        invoiceDate: resolvedTimestamp,
      });

      if (onSaved) {
        onSaved(
          `کاڵای «${editName.trim()}» لە وەسڵی ${cleanInvoice ? `#${cleanInvoice}` : 'بێ ژمارە'} پاشەکەوتکرا و لە دەفتەر حیسابات و ${
            editPaymentType === 'debt' ? 'قەرزی' : 'نەقدی'
          } کۆمپانیاش نوێکرایەوە.`
        );
      }
      onClose();
    } catch (error) {
      console.error('Error updating item:', error);
      alert('هەڵەیەک ڕوویدا لە کاتی پاشەکەوتکردندا');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div
        className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto border border-slate-200"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Edit2 size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base sm:text-lg">
                دەستکاریکردنی کاڵا: {selectedBatch.name}
              </h3>
              <p className="text-[11px] text-slate-500">
                دەستکاریکردن بەپێی وەسڵ لەگەڵ نوێبوونەوەی ڕاستەوخۆی دەفتەر حیسابات و قەرز/نەقدی کۆمپانیا
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* RELATED INVOICES LIST (ژمارەی وەسڵەکان و بەرواری وەسڵە پەیوەندیدارەکان) */}
        <div className="mb-5 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
              <Layers size={15} className="text-indigo-600" />
              <span>
                وەسڵە پەیوەندیدارەکان بە «{selectedBatch.name}» ({relatedBatches.length} وەسڵ)
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              کلیک لەسەر هەر وەسڵێک بکە بۆ دەستکاریکردنی
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-0.5">
            {relatedBatches.map((batch) => {
              const isSelected = batch.id === selectedBatch.id;
              const batchTx = findMatchingCompanyTransaction(batch, transactions);
              const isDebt = batchTx?.type === 'company_debt';
              const cQ =
                batch.cartonQuantity !== undefined
                  ? batch.cartonQuantity
                  : batch.unitType === 'carton'
                    ? batch.quantity || 0
                    : 0;
              const pQ = batch.packetQuantity || 0;

              return (
                <button
                  key={batch.id}
                  type="button"
                  onClick={() => setSelectedBatch(batch)}
                  className={`text-right p-2.5 rounded-xl border transition flex flex-col gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white hover:bg-indigo-50/70 text-slate-800 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span
                      className={`font-mono font-black text-xs px-2 py-0.5 rounded-md ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700'
                      }`}
                      dir="ltr"
                    >
                      {batch.invoiceNo ? `#${batch.invoiceNo}` : 'بێ ژمارە'}
                    </span>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : isDebt
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {isDebt ? 'قەرز 💳' : 'نەقد 💵'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] w-full">
                    <span className={`flex items-center gap-1 font-medium ${isSelected ? 'text-indigo-100' : 'text-slate-600'}`}>
                      <Calendar size={12} />
                      <span dir="ltr">
                        {batch.createdAt ? format(batch.createdAt, 'yyyy-MM-dd HH:mm') : 'بەروار نادیار'}
                      </span>
                    </span>
                    <span className={`font-bold font-mono ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                      {cQ > 0 ? `${cQ} کارتۆن` : ''}
                      {cQ > 0 && pQ > 0 ? ' + ' : ''}
                      {pQ > 0 ? `${pQ} پاکەت` : ''}
                      {cQ === 0 && pQ === 0 ? `${batch.quantity || 0}` : ''}
                    </span>
                  </div>

                  <div className={`text-[10px] truncate w-full flex items-center gap-1 ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                    <Building2 size={11} />
                    <span>{batch.supplier || 'کۆمپانیای نەزانراو'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs sm:text-sm">
          {/* Row 1: Name + Supplier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">ناوی کاڵا *</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">کۆمپانیا / دابینکەر</label>
              <input
                type="text"
                list="modal-edit-companies-list"
                value={editSupplier}
                onChange={(e) => setEditSupplier(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              />
              <datalist id="modal-edit-companies-list">
                {companies.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Row 2: Invoice No + Invoice Date + Payment Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-indigo-900 font-bold mb-1 flex items-center gap-1">
                <FileText size={13} />
                <span>ژمارەی وەسڵ</span>
              </label>
              <input
                type="text"
                value={editInvoiceNo}
                onChange={(e) => setEditInvoiceNo(e.target.value)}
                className="w-full px-3.5 py-2 border border-indigo-200 bg-indigo-50/40 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
                dir="ltr"
                placeholder="ژمارەی وەسڵ..."
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1">
                <Calendar size={13} />
                <span>بەرواری وەسڵ</span>
              </label>
              <input
                type="date"
                value={editDateStr}
                onChange={(e) => setEditDateStr(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">شێوازی پارەدان (کۆمپانیا)</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditPaymentType('cash')}
                  className={`py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 border transition cursor-pointer ${
                    editPaymentType === 'cash'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <DollarSign size={14} />
                  <span>نەقد</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditPaymentType('debt')}
                  className={`py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 border transition cursor-pointer ${
                    editPaymentType === 'debt'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <CreditCard size={14} />
                  <span>قەرز</span>
                </button>
              </div>
            </div>
          </div>

          {/* Units checkboxes */}
          <div className="p-3 bg-slate-50 rounded-2xl flex items-center gap-5 border border-slate-200/60">
            <span className="font-bold text-slate-700">یەکەکان:</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editHasCarton}
                onChange={(e) => setEditHasCarton(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
              />
              <span className="font-bold text-slate-800">کارتۆن</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editHasPacket}
                onChange={(e) => setEditHasPacket(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
              />
              <span className="font-bold text-slate-800">پاکەت</span>
            </label>
          </div>

          {/* Carton details */}
          {editHasCarton && (
            <div className="p-3.5 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-2.5">
              <div className="font-bold text-indigo-900 text-xs">زانیاری کارتۆن:</div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">بڕی کڕدراو</label>
                  <input
                    type="number"
                    step="any"
                    value={editCartonQuantity}
                    onChange={(e) => setEditCartonQuantity(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-center font-bold font-mono"
                    placeholder="0"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-emerald-700 mb-1">🎁 دیاری</label>
                  <input
                    type="number"
                    step="any"
                    value={editCartonBonus}
                    onChange={(e) => setEditCartonBonus(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-emerald-200 rounded-xl text-center font-bold font-mono text-emerald-700"
                    placeholder="0"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">تێچوو (کڕین)</label>
                  <input
                    type="number"
                    step="any"
                    value={editCartonCost}
                    onChange={(e) => setEditCartonCost(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-center font-bold font-mono"
                    placeholder="0"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">نرخی فرۆشتن</label>
                  <input
                    type="number"
                    step="any"
                    value={editCartonPrice}
                    onChange={(e) => setEditCartonPrice(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-center font-bold font-mono"
                    placeholder="0"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">نرخی کۆ</label>
                  <input
                    type="number"
                    step="any"
                    value={editCartonWholesale}
                    onChange={(e) => setEditCartonWholesale(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-center font-bold font-mono"
                    placeholder="0"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Packet details */}
          {editHasPacket && (
            <div className="p-3.5 bg-emerald-50/40 rounded-2xl border border-emerald-100 space-y-2.5">
              <div className="font-bold text-emerald-900 text-xs">زانیاری پاکەت:</div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">بڕی کڕدراو</label>
                  <input
                    type="number"
                    step="any"
                    value={editPacketQuantity}
                    onChange={(e) => setEditPacketQuantity(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-center font-bold font-mono"
                    placeholder="0"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-emerald-700 mb-1">🎁 دیاری</label>
                  <input
                    type="number"
                    step="any"
                    value={editPacketBonus}
                    onChange={(e) => setEditPacketBonus(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-emerald-200 rounded-xl text-center font-bold font-mono text-emerald-700"
                    placeholder="0"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">تێچوو (کڕین)</label>
                  <input
                    type="number"
                    step="any"
                    value={editPacketCost}
                    onChange={(e) => setEditPacketCost(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-center font-bold font-mono"
                    placeholder="0"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">نرخی فرۆشتن</label>
                  <input
                    type="number"
                    step="any"
                    value={editPacketPrice}
                    onChange={(e) => setEditPacketPrice(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-center font-bold font-mono"
                    placeholder="0"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">نرخی کۆ</label>
                  <input
                    type="number"
                    step="any"
                    value={editPacketWholesale}
                    onChange={(e) => setEditPacketWholesale(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-center font-bold font-mono"
                    placeholder="0"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Live Financial Sync Banner */}
          <div className="p-3.5 rounded-2xl border bg-amber-50/60 border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-start gap-2">
              {matchedTx ? (
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="text-[11px] text-slate-700 leading-relaxed">
                <span className="font-black text-slate-900 block">
                  نوێکردنەوەی حیساباتی کۆمپانیا و دەفتەر حیسابات:
                </span>
                <span>
                  بە پاشەکەوتکردن، بڕی کاڵا و کۆی پارەی ئەم وەسڵە لە{' '}
                  <strong>دەفتەر حیسابات</strong> و{' '}
                  <strong>{editPaymentType === 'debt' ? 'قەرزەکانی کۆمپانیا' : 'نەقدەکانی کۆمپانیا'}</strong>{' '}
                  ڕاستەوخۆ دەستکاری دەکرێت (
                  {matchedTx
                    ? `پێشتر: ${(matchedTx.amount || 0).toLocaleString()} د.ع`
                    : 'تۆماری حیسابات دروست/نوێ دەکرێت'}
                  ).
                </span>
              </div>
            </div>
            <div className="text-left shrink-0 bg-white px-3 py-1.5 rounded-xl border border-amber-200 font-mono">
              <div className="text-[10px] text-slate-500 font-sans font-bold">تێچووی نوێی وەسڵ</div>
              <div className="text-sm font-black text-indigo-700" dir="ltr">
                {liveTotalCost.toLocaleString()} د.ع
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition cursor-pointer"
            >
              پاشگەزبوونەوە
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <Edit2 size={15} />
              <span>{isSaving ? 'خەریکی پاشەکەوتکردنە...' : 'پاشەکەوتکردن و نوێکردنەوەی حیسابات'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
