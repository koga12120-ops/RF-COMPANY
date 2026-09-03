import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, deleteDoc, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { Item, Role } from '../../types';
import { Plus, Search, Edit2, Trash2, Package } from 'lucide-react';
import ConfirmModal from '../common/ConfirmModal';
import { updateItemAndSyncEverywhere } from '../../lib/invoiceSync';

export default function InventoryView({ role }: { role: Role }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);

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
  const [cartonCost, setCartonCost] = useState('');
  const [cartonPrice, setCartonPrice] = useState('');
  const [cartonWholesale, setCartonWholesale] = useState('');

  // Packet fields
  const [packetQuantity, setPacketQuantity] = useState('');
  const [packetCost, setPacketCost] = useState('');
  const [packetPrice, setPacketPrice] = useState('');
  const [packetWholesale, setPacketWholesale] = useState('');

  const [companies, setCompanies] = useState<any[]>([]);
  const [filterSupplier, setFilterSupplier] = useState('');
  const [sortDate, setSortDate] = useState<'desc' | 'asc'>('desc');
  const [paymentType, setPaymentType] = useState<'cash' | 'debt'>('cash');

  useEffect(() => {
    const q = query(collection(db, 'items'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const itemsData: Item[] = [];
        snapshot.forEach((doc) => {
          itemsData.push({ id: doc.id, ...doc.data() } as Item);
        });
        setItems(itemsData);
        setLoading(false);
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

  const formatStock = (item: Item) => {
    const parts = [];

    if (item.cartonQuantity !== undefined || item.packetQuantity !== undefined) {
      if (item.cartonQuantity !== undefined && item.cartonQuantity > 0) parts.push(`${item.cartonQuantity} کارتۆن`);
      if (item.packetQuantity !== undefined && item.packetQuantity > 0) parts.push(`${item.packetQuantity} پاکەت`);
      if (parts.length === 0) {
        return `${item.quantity || 0} ${item.packetSellingPrice && !item.cartonSellingPrice ? 'پاکەت' : 'کارتۆن'}`;
      }
    } else {
      if ((item.quantity || 0) > 0) {
        if (item.packetSellingPrice && !item.cartonSellingPrice) {
          parts.push(`${item.quantity} پاکەت`);
        } else {
          parts.push(`${item.quantity} کارتۆن`);
        }
      } else {
        parts.push('0 کارتۆن');
      }
    }

    return parts.join(' و ') || '0';
  };

  const handleSubmit = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      alert('تکایە ناوی کاڵا بنووسە');
      return;
    }
    if (!hasCarton && !hasPacket) {
      alert('تکایە لانیکەم یەکەیەکی کاڵاکە (کارتۆن یان پاکەت) دیاری بکە');
      return;
    }

    const cleanInvoice = invoiceNo.trim();
    const cQty = Number(cartonQuantity) || 0;
    const pQty = Number(packetQuantity) || 0;
    const totalQty = hasCarton && hasPacket ? cQty + pQty : hasCarton ? cQty : pQty;

    const cCost = Number(cartonCost) || 0;
    const cPrice = Number(cartonPrice) || 0;
    const cWholesale = Number(cartonWholesale) || 0;

    const pCost = Number(packetCost) || 0;
    const pPrice = Number(packetPrice) || 0;
    const pWholesale = Number(packetWholesale) || 0;

    // Primary cost & selling prices
    const primaryCost = hasCarton ? cCost : pCost;
    const primaryPrice = hasCarton ? cPrice : pPrice;
    const primaryWholesale = hasCarton ? cWholesale : pWholesale;

    const itemData: any = {
      name: name.trim(),
      barcode: barcode.trim(),
      supplier: supplier.trim(),
      invoiceNo: cleanInvoice || '',
      quantity: totalQty,
      hasCarton,
      hasPacket,
      
      costPrice: primaryCost,
      sellingPrice: primaryPrice,
      wholesalePrice: primaryWholesale,

      cartonCostPrice: hasCarton ? cCost : 0,
      cartonSellingPrice: hasCarton ? cPrice : 0,
      cartonWholesalePrice: hasCarton ? cWholesale : 0,
      cartonQuantity: hasCarton ? cQty : 0,

      packetCostPrice: hasPacket ? pCost : 0,
      packetSellingPrice: hasPacket ? pPrice : 0,
      packetWholesalePrice: hasPacket ? pWholesale : 0,
      packetQuantity: hasPacket ? pQty : 0,
    };

    try {
      if (supplier && !companies.find(c => c.name === supplier.trim())) {
        await addDoc(collection(db, 'companies'), {
          name: supplier.trim(),
          location: '',
          phone: '',
          type: 'warehouse',
          createdAt: Date.now()
        });
      }

      if (isEditing) {
        const oldItem = items.find(i => i.id === editId) || ({} as Item);
        const oldQuantity = oldItem ? (oldItem.quantity || 0) : 0;
        const quantityAdded = totalQty - oldQuantity;

        await updateItemAndSyncEverywhere({
          itemId: editId,
          oldItem,
          itemData,
          quantityAdded,
          paymentType,
          costPricePerPiece: primaryCost,
        });
      } else {
        await addDoc(collection(db, 'items'), {
          ...itemData,
          createdAt: Date.now()
        });

        if (totalQty > 0) {
          await addDoc(collection(db, 'stock_history'), {
            itemName: name.trim(),
            quantityAdded: totalQty,
            unit: hasCarton ? 'carton' : 'packet',
            date: Date.now(),
            invoiceNo: cleanInvoice || '',
            supplier: supplier.trim() || ''
          });

          const totalCostVal = hasCarton && hasPacket
            ? (cCost * cQty) + (pCost * pQty)
            : hasCarton
            ? (cCost * cQty)
            : (pCost * pQty);

          const unitLabel = hasCarton && hasPacket ? 'کارتۆن و پاکەت' : hasCarton ? 'کارتۆن' : 'پاکەت';
          const transactionDesc = paymentType === 'cash'
            ? (cleanInvoice ? `نەقدی کڕین (وەسڵی #${cleanInvoice}) - ${name.trim()} (${totalQty} ${unitLabel})` : `نەقدی کڕینی کاڵای ${name.trim()}`)
            : (cleanInvoice ? `قەرزی کڕین (وەسڵی #${cleanInvoice}) - ${name.trim()} (${totalQty} ${unitLabel})` : `قەرزی کڕینی کاڵای ${name.trim()}`);

          await addDoc(collection(db, 'transactions'), {
            type: paymentType === 'cash' ? 'company_cash' : 'company_debt',
            amount: totalCostVal,
            date: Date.now(),
            description: transactionDesc,
            relatedEntityId: supplier.trim() || 'نەزانراو',
            invoiceNo: cleanInvoice || ''
          });
        }
      }
      resetForm();
    } catch (error) {
      console.error("Error saving item: ", error);
      alert('هەڵەیەک ڕوویدا لە کاتی پاشەکەوتکردندا');
    }
  };

  const handleEdit = (item: Item) => {
    setIsEditing(true);
    setEditId(item.id);
    setName(item.name || '');
    setBarcode(item.barcode || '');
    setSupplier(item.supplier || '');
    setInvoiceNo(item.invoiceNo || '');

    const isCarton = !!item.cartonCostPrice || !!item.cartonSellingPrice || (item.cartonQuantity !== undefined && item.cartonQuantity > 0) || (!item.packetCostPrice && !item.packetSellingPrice);
    const isPacket = !!item.packetCostPrice || !!item.packetSellingPrice || (item.packetQuantity !== undefined && item.packetQuantity > 0);

    setHasCarton(isCarton);
    setHasPacket(isPacket);

    setCartonCost(item.cartonCostPrice ? item.cartonCostPrice.toString() : (item.costPrice ? item.costPrice.toString() : ''));
    setCartonPrice(item.cartonSellingPrice ? item.cartonSellingPrice.toString() : (item.sellingPrice ? item.sellingPrice.toString() : ''));
    setCartonWholesale(item.cartonWholesalePrice ? item.cartonWholesalePrice.toString() : (item.wholesalePrice ? item.wholesalePrice.toString() : ''));
    setCartonQuantity(item.cartonQuantity !== undefined ? item.cartonQuantity.toString() : (item.quantity ? item.quantity.toString() : '0'));

    setPacketCost(item.packetCostPrice ? item.packetCostPrice.toString() : '');
    setPacketPrice(item.packetSellingPrice ? item.packetSellingPrice.toString() : '');
    setPacketWholesale(item.packetWholesalePrice ? item.packetWholesalePrice.toString() : '');
    setPacketQuantity(item.packetQuantity !== undefined ? item.packetQuantity.toString() : '0');

    setPaymentType('cash');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmDeleteItem = async () => {
    if (!deletingItem) return;
    try {
      await deleteDoc(doc(db, 'items', deletingItem.id));
      if (editId === deletingItem.id) resetForm();
      setDeletingItem(null);
    } catch (error) {
      console.error("Error deleting item: ", error);
      alert('هەڵەیەک ڕوویدا لە کاتی سڕینەوەی کاڵا');
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
    setCartonCost('');
    setCartonPrice('');
    setCartonWholesale('');
    setPacketQuantity('');
    setPacketCost('');
    setPacketPrice('');
    setPacketWholesale('');
    setPaymentType('cash');
  };

  let filteredItems = items.filter(item => {
    const nameMatch = item.name ? item.name.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    const barcodeMatch = item.barcode ? item.barcode.includes(searchTerm) : false;
    const invoiceMatch = item.invoiceNo ? item.invoiceNo.includes(searchTerm) : false;
    return (nameMatch || barcodeMatch || invoiceMatch) && (filterSupplier ? item.supplier === filterSupplier : true);
  });

  filteredItems.sort((a, b) => {
    const dateA = a.createdAt || 0;
    const dateB = b.createdAt || 0;
    return sortDate === 'desc' ? dateB - dateA : dateA - dateB;
  });

  const uniqueSuppliers = Array.from(new Set(items.map(i => i.supplier).filter(Boolean)));

  return (
    <div className="space-y-6" onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(e); }}>
      {/* Form Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold mb-4 text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
          <Package className="text-indigo-600" size={20} />
          {isEditing ? 'دەستکاریکردنی کاڵا یان نوێکردنەوەی بڕ' : 'داخڵکردنی کاڵای نوێ بە کارتۆن و پاکەت'}
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
                list="companies-list"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="ناوی کۆمپانیا..."
              />
              <datalist id="companies-list">
                {companies.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">ژمارەی سەر وەسڵ (دەفتەر وەسڵ)</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-indigo-200 bg-indigo-50/30 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="ژمارەی وەسڵی کۆمپانیا..."
                dir="ltr"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-indigo-100 transition select-none">
              <input 
                type="checkbox" 
                checked={keepInvoiceInfo} 
                onChange={(e) => setKeepInvoiceInfo(e.target.checked)} 
                className="rounded text-indigo-600 w-3.5 h-3.5" 
              />
              <span>هێشتنەوەی ناوی کۆمپانیا و ژمارەی وەسڵ بۆ داخڵکردنی کاڵاکانی تری ئەم وەسڵە</span>
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
                className="rounded text-indigo-600 w-4 h-4" 
              />
              <span>کارتۆن (Carton)</span>
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={hasPacket} 
                onChange={e => setHasPacket(e.target.checked)} 
                className="rounded text-indigo-600 w-4 h-4" 
              />
              <span>پاکەت (Packet)</span>
            </label>
          </div>

          {/* Unit fields grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Carton Group */}
            {hasCarton && (
              <div className="p-5 border border-indigo-200 rounded-2xl bg-indigo-50/20 space-y-3 relative">
                <div className="flex justify-between items-center pb-2 border-b border-indigo-100">
                  <h4 className="font-bold text-indigo-900 text-sm flex items-center gap-2">
                    📦 یەکەی کارتۆن
                  </h4>
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">کارتۆن</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">بڕ (کارتۆن)</label>
                    <input 
                      type="number" 
                      min="0" 
                      step="any" 
                      required={hasCarton}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" 
                      value={cartonQuantity} 
                      onChange={(e) => setCartonQuantity(e.target.value)} 
                      placeholder="0"
                      dir="ltr" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">تێچوو بۆ کارتۆن</label>
                    <input 
                      type="number" 
                      min="0" 
                      step="any" 
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" 
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
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" 
                      value={cartonPrice} 
                      onChange={(e) => setCartonPrice(e.target.value)} 
                      placeholder="0"
                      dir="ltr" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">نرخی کۆگا / کۆمەڵ (کارتۆن)</label>
                    <input 
                      type="number" 
                      min="0" 
                      step="any" 
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" 
                      value={cartonWholesale} 
                      onChange={(e) => setCartonWholesale(e.target.value)} 
                      placeholder="0"
                      dir="ltr" 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Packet Group */}
            {hasPacket && (
              <div className="p-5 border border-emerald-200 rounded-2xl bg-emerald-50/20 space-y-3 relative">
                <div className="flex justify-between items-center pb-2 border-b border-emerald-100">
                  <h4 className="font-bold text-emerald-900 text-sm flex items-center gap-2">
                    🛍️ یەکەی پاکەت
                  </h4>
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">پاکەت</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">بڕ (پاکەت)</label>
                    <input 
                      type="number" 
                      min="0" 
                      step="any" 
                      required={hasPacket}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none" 
                      value={packetQuantity} 
                      onChange={(e) => setPacketQuantity(e.target.value)} 
                      placeholder="0"
                      dir="ltr" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">تێچوو بۆ پاکەت</label>
                    <input 
                      type="number" 
                      min="0" 
                      step="any" 
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none" 
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
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none" 
                      value={packetPrice} 
                      onChange={(e) => setPacketPrice(e.target.value)} 
                      placeholder="0"
                      dir="ltr" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">نرخی کۆگا / کۆمەڵ (پاکەت)</label>
                    <input 
                      type="number" 
                      min="0" 
                      step="any" 
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none" 
                      value={packetWholesale} 
                      onChange={(e) => setPacketWholesale(e.target.value)} 
                      placeholder="0"
                      dir="ltr" 
                    />
                  </div>
                </div>
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
                  className="text-indigo-600 w-4 h-4" 
                />
                <span className="text-sm font-bold text-slate-700">نەقدی کۆمپانیا</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="radio" 
                  checked={paymentType === 'debt'} 
                  onChange={() => setPaymentType('debt')} 
                  className="text-indigo-600 w-4 h-4" 
                />
                <span className="text-sm font-bold text-slate-700">قەرزی کۆمپانیا</span>
              </label>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="submit"
                className="flex-1 sm:flex-none px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-sm text-sm"
              >
                {isEditing ? <Edit2 size={16} /> : <Plus size={16} />}
                <span>{isEditing ? 'پاشەکەوتکردنی گۆڕانکاری' : 'زیادکردنی کاڵا بۆ کۆگا'}</span>
              </button>
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition font-bold text-sm"
                >
                  پاشگەزبوونەوە
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* List Section */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <h4 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
            <Package className="text-indigo-600" size={18} />
            لیستی کاڵاکان لە کۆگا ({filteredItems.length} کاڵا)
          </h4>

          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
            <select
              className="px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-semibold"
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
            >
              <option value="">هەموو کۆمپانیاکان</option>
              {uniqueSuppliers.map((sup, i) => (
                <option key={i} value={sup as string}>{sup}</option>
              ))}
            </select>
            <select
              className="px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-semibold"
              value={sortDate}
              onChange={(e) => setSortDate(e.target.value as 'desc' | 'asc')}
            >
              <option value="desc">نوێترین</option>
              <option value="asc">کۆنترین</option>
            </select>
            <div className="relative w-full md:w-60">
              <input
                type="text"
                placeholder="گەڕان بەپێی ناو یان بارکۆد..."
                className="w-full pr-10 pl-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm">خەریکی هێنانە...</div>
        ) : (
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 text-slate-500 text-xs font-bold border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3">ناوی کاڵا</th>
                  <th className="px-4 py-3">کۆمپانیا و وەسڵ</th>
                  <th className="px-4 py-3">نرخی فرۆشتن (کارتۆن / پاکەت)</th>
                  <th className="px-4 py-3">ماوە لە کۆگا</th>
                  <th className="px-4 py-3 text-center">کردارەکان</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-3 font-bold text-slate-800">
                      <div>{item.name}</div>
                      {item.barcode && <div className="text-[11px] font-mono text-slate-400" dir="ltr">{item.barcode}</div>}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-600 text-xs">
                      <div>{item.supplier || '-'}</div>
                      {item.invoiceNo && (
                        <span className="inline-block mt-0.5 text-[11px] font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100" dir="ltr">
                          وەسڵ: #{item.invoiceNo}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-800 font-bold text-xs" dir="ltr">
                      <div className="flex flex-col gap-1">
                        {(item.cartonSellingPrice || item.cartonCostPrice || (!item.packetSellingPrice && item.sellingPrice)) ? (
                          <span className="text-indigo-700 font-mono">
                            کارتۆن: {(item.cartonSellingPrice || item.sellingPrice || 0).toLocaleString()} د.ع
                          </span>
                        ) : null}
                        {item.packetSellingPrice ? (
                          <span className="text-emerald-700 font-mono">
                            پاکەت: {(item.packetSellingPrice || 0).toLocaleString()} د.ع
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-900 font-bold" dir="ltr">
                      <span className={`${(item.quantity || 0) <= 0 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'} px-2.5 py-1 rounded-lg text-xs font-bold inline-block`}>
                        {formatStock(item)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-indigo-600 font-bold text-xs px-2.5 py-1 hover:bg-indigo-50 rounded-lg transition"
                        >
                          دەستکاری
                        </button>
                        <button
                          onClick={() => setDeletingItem(item)}
                          className="text-red-600 font-bold text-xs px-2.5 py-1 hover:bg-red-50 rounded-lg transition"
                        >
                          سڕینەوە
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-slate-400 text-sm">
                      هیچ کاڵایەک نەدۆزرایەوە
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Delete Item Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        onConfirm={confirmDeleteItem}
        title="سڕینەوەی کاڵا"
        message="ئایا دڵنیایت لە سڕینەوەی ئەم کاڵایە لە کۆگادا؟"
        itemName={deletingItem?.name}
        details={deletingItem ? [
          { label: 'بارکۆد', value: deletingItem.barcode || '-' },
          { label: 'بڕی ماوە لە کۆگا', value: formatStock(deletingItem) },
          { label: 'کۆمپانیا / سەرچاوە', value: deletingItem.supplier || '-' }
        ] : []}
      />
    </div>
  );
}
