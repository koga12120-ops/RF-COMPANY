import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Item, Role } from '../../types';
import { Plus, Search, Edit2, Trash2, Calculator } from 'lucide-react';

export default function InventoryView({ role }: { role: Role }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState('');
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [supplier, setSupplier] = useState('');

  const [pieceCost, setPieceCost] = useState('');
  const [piecePrice, setPiecePrice] = useState('');
  const [pieceQuantity, setPieceQuantity] = useState('');

  const [packetRatio, setPacketRatio] = useState('');
  const [packetCost, setPacketCost] = useState('');
  const [packetPrice, setPacketPrice] = useState('');
  const [packetQuantity, setPacketQuantity] = useState('');

  const [cartonRatio, setCartonRatio] = useState('');
  const [cartonCost, setCartonCost] = useState('');
  const [cartonPrice, setCartonPrice] = useState('');
  const [cartonQuantity, setCartonQuantity] = useState('');

  const [companies, setCompanies] = useState<any[]>([]);
  const [filterSupplier, setFilterSupplier] = useState('');
  const [sortDate, setSortDate] = useState<'desc' | 'asc'>('desc');
  const [paymentType, setPaymentType] = useState<'cash' | 'debt'>('cash');
  const [showPacket, setShowPacket] = useState(false);
  const [showCarton, setShowCarton] = useState(false);
  const [showPiece, setShowPiece] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'items'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemsData: Item[] = [];
      snapshot.forEach((doc) => {
        itemsData.push({ id: doc.id, ...doc.data() } as Item);
      });
      setItems(itemsData);
      setLoading(false);
    });
    const formatStock = (item: Item) => {
    let pieces = item.quantity || 0;
    const cRatio = item.ratio || 0;
    const pRatio = item.packetRatio || 0;

    let cartons = 0;
    let packets = 0;

    if (cRatio > 0) {
      cartons = Math.floor(pieces / cRatio);
      pieces = pieces % cRatio;
    }

    if (pRatio > 0) {
      packets = Math.floor(pieces / pRatio);
      pieces = pieces % pRatio;
    }

    const parts = [];
    if (cartons > 0) parts.push(`${cartons} کار`);
    if (packets > 0) parts.push(`${packets} پاک`);
    if (pieces > 0 || parts.length === 0) parts.push(`${pieces} دانە`);

    return parts.join(' و ');
  };

  return () => unsubscribe();
  }, []);

  const handleSubmit = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    
    const pRatio = Number(packetRatio) || 0;
    const cRatio = Number(cartonRatio) || 0;
    
    let totalPiecesToAdd = (Number(pieceQuantity) || 0) + 
                           ((Number(packetQuantity) || 0) * (pRatio || 1)) + 
                           ((Number(cartonQuantity) || 0) * (cRatio || 1));

    const itemData: any = {
      name,
      barcode,
      supplier,
      costPrice: Number(pieceCost) || 0,
      sellingPrice: Number(piecePrice) || 0,
      packetRatio: pRatio,
      packetCostPrice: Number(packetCost) || 0,
      packetSellingPrice: Number(packetPrice) || 0,
      ratio: cRatio,
      cartonCostPrice: Number(cartonCost) || 0,
      cartonSellingPrice: Number(cartonPrice) || 0,
    };

    let costPricePerPiece = itemData.costPrice || (pRatio ? itemData.packetCostPrice / pRatio : 0) || (cRatio ? itemData.cartonCostPrice / cRatio : 0);

    try {
      if (supplier && !companies.find(c => c.name === supplier)) {
        await addDoc(collection(db, 'companies'), { name: supplier, location: '', phone: '', createdAt: Date.now() });
      }
      
      if (isEditing) {
        const oldItem = items.find(i => i.id === editId);
        const oldQuantity = oldItem ? oldItem.quantity : 0;
        
        // سیستمە پێشکەوتووەکەی حساباتی تێچوو (Weighted Average Cost)
        if (totalPiecesToAdd > 0 && oldQuantity > 0 && oldItem) {
          const oldCost = oldItem.costPrice || 0;
          const newCost = costPricePerPiece;
          
          if (oldCost > 0 && newCost > 0) {
            const totalOldValue = oldQuantity * oldCost;
            const totalNewValue = totalPiecesToAdd * newCost;
            const avgCost = (totalOldValue + totalNewValue) / (oldQuantity + totalPiecesToAdd);
            
            itemData.costPrice = Number(avgCost.toFixed(2));
            if (pRatio > 0) itemData.packetCostPrice = Number((avgCost * pRatio).toFixed(2));
            if (cRatio > 0) itemData.cartonCostPrice = Number((avgCost * cRatio).toFixed(2));
            
            // Update cost for transactions
            costPricePerPiece = itemData.costPrice; 
          }
        }

        itemData.quantity = oldQuantity + totalPiecesToAdd; // Add to existing stock
        
        await updateDoc(doc(db, 'items', editId), itemData);
        
        if (totalPiecesToAdd > 0) {
          const quantityAdded = totalPiecesToAdd;
          await addDoc(collection(db, 'stock_history'), {
            itemId: editId,
            itemName: name,
            quantityAdded,
            date: Date.now()
          });
          
          await addDoc(collection(db, 'transactions'), {
            type: paymentType === 'cash' ? 'company_cash' : 'company_debt',
            amount: costPricePerPiece * quantityAdded,
            date: Date.now(),
            description: paymentType === 'cash' ? `نەقدی زیادکردنی کاڵای ${name}` : `قەرزی زیادکردنی کاڵای ${name}`,
            relatedEntityId: supplier || 'نەزانراو'
          });
        }
      } else {
        itemData.quantity = totalPiecesToAdd;
        const docRef = await addDoc(collection(db, 'items'), { ...itemData, createdAt: Date.now() });
        
        if (totalPiecesToAdd > 0) {
          await addDoc(collection(db, 'stock_history'), {
            itemId: docRef.id,
            itemName: name,
            quantityAdded: totalPiecesToAdd,
            date: Date.now()
          });
          
          await addDoc(collection(db, 'transactions'), {
            type: paymentType === 'cash' ? 'company_cash' : 'company_debt',
            amount: costPricePerPiece * totalPiecesToAdd,
            date: Date.now(),
            description: paymentType === 'cash' ? `نەقدی کڕینی کاڵای ${name}` : `قەرزی کڕینی کاڵای ${name}`,
            relatedEntityId: supplier || 'نەزانراو'
          });
        }

      }
      resetForm();
    } catch (error) {
      console.error("Error saving document: ", error);
      alert('هەڵەیەک ڕوویدا لە کاتی پاشەکەوتکردندا');
    }
  };

  const handleEdit = (item: Item) => {
    setIsEditing(true);
    setEditId(item.id);
    setName(item.name);
    setBarcode(item.barcode);
    setSupplier(item.supplier || '');
    
    setPieceCost(item.costPrice?.toString() || '');
    setPiecePrice(item.sellingPrice?.toString() || '');
    setPieceQuantity(''); // Only for adding new quantity

    setPacketRatio(item.packetRatio?.toString() || '');
    setPacketCost(item.packetCostPrice?.toString() || '');
    setPacketPrice(item.packetSellingPrice?.toString() || '');
    setPacketQuantity('');

    setCartonRatio(item.ratio?.toString() || '');
    setCartonCost(item.cartonCostPrice?.toString() || '');
    setCartonPrice(item.cartonSellingPrice?.toString() || '');
    setCartonQuantity('');

    setShowPacket(!!item.packetRatio || !!item.packetCostPrice || !!item.packetSellingPrice);
    setShowCarton(!!item.ratio || !!item.cartonCostPrice || !!item.cartonSellingPrice);
    setShowPiece(!!item.costPrice || !!item.sellingPrice);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'items', id));
    } catch (error) {
      console.error("Error deleting document: ", error);
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditId('');
    setName('');
    setBarcode('');
    setSupplier('');
    setPieceCost('');
    setPiecePrice('');
    setPieceQuantity('');
    setPacketRatio('');
    setPacketCost('');
    setPacketPrice('');
    setPacketQuantity('');
    setCartonRatio('');
    setCartonCost('');
    setCartonPrice('');
    setCartonQuantity('');
    setPaymentType('cash');
    setShowPacket(false);
    setShowCarton(false);
  };

  let filteredItems = items.filter(item => 
    (item.name.includes(searchTerm) || item.barcode.includes(searchTerm)) &&
    (filterSupplier ? item.supplier === filterSupplier : true)
  );

  filteredItems.sort((a, b) => {
    const dateA = a.createdAt || 0;
    const dateB = b.createdAt || 0;
    return sortDate === 'desc' ? dateB - dateA : dateA - dateB;
  });

  const uniqueSuppliers = Array.from(new Set(items.map(i => i.supplier).filter(Boolean)));

  const formatStock = (item: Item) => {
    let pieces = item.quantity || 0;
    const cRatio = item.ratio || 0;
    const pRatio = item.packetRatio || 0;

    let cartons = 0;
    let packets = 0;

    if (cRatio > 0) {
      cartons = Math.floor(pieces / cRatio);
      pieces = pieces % cRatio;
    }

    if (pRatio > 0) {
      packets = Math.floor(pieces / pRatio);
      pieces = pieces % pRatio;
    }

    const parts = [];
    if (cartons > 0) parts.push(`${cartons} کار`);
    if (packets > 0) parts.push(`${packets} پاک`);
    if (pieces > 0 || parts.length === 0) parts.push(`${pieces} دانە`);

    return parts.join(' و ');
  };

  const autoCalculate = () => {
    let pCost = Number(pieceCost) || 0;
    let pPrice = Number(piecePrice) || 0;
    const cRatio = Number(cartonRatio) || 0;
    const pktRatio = Number(packetRatio) || 0;

    // 1. Try to deduce piece cost/price from carton if piece is empty
    if (pCost === 0 && showCarton && Number(cartonCost) > 0 && cRatio > 0) {
      pCost = Number(cartonCost) / cRatio;
      setPieceCost(pCost.toString());
    }
    if (pPrice === 0 && showCarton && Number(cartonPrice) > 0 && cRatio > 0) {
      pPrice = Number(cartonPrice) / cRatio;
      setPiecePrice(pPrice.toString());
    }

    // 2. Try to deduce piece cost/price from packet if piece is empty
    if (pCost === 0 && showPacket && Number(packetCost) > 0 && pktRatio > 0) {
      pCost = Number(packetCost) / pktRatio;
      setPieceCost(pCost.toString());
    }
    if (pPrice === 0 && showPacket && Number(packetPrice) > 0 && pktRatio > 0) {
      pPrice = Number(packetPrice) / pktRatio;
      setPiecePrice(pPrice.toString());
    }

    // 3. Fill carton cost/price if empty
    if (showCarton && cRatio > 0) {
      if (!cartonCost && pCost > 0) setCartonCost((pCost * cRatio).toString());
      if (!cartonPrice && pPrice > 0) setCartonPrice((pPrice * cRatio).toString());
    }

    // 4. Fill packet cost/price if empty
    if (showPacket && pktRatio > 0) {
      if (!packetCost && pCost > 0) setPacketCost((pCost * pktRatio).toString());
      if (!packetPrice && pPrice > 0) setPacketPrice((pPrice * pktRatio).toString());
    }
  };

  return (
    <div className="space-y-6" onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(e); }}>
      {/* Form Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold mb-4 text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
          {isEditing ? 'دەستکاریکردنی کاڵا یان زیادکردنی بڕ' : 'داخڵکردنی کاڵای نوێ'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">ناوی کاڵا</label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">بارکۆد</label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">کۆمپانیا / شوێن</label>
              <input
                type="text"
                list="companies-list"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
              />
              <datalist id="companies-list">
                {companies.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
            </div>
          </div>

          <div className="flex gap-6 border-b border-slate-100 pb-4 flex-col sm:flex-row justify-between sm:items-center">
            <div className="flex gap-6 items-center">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                <input type="checkbox" checked={showPiece} onChange={e => setShowPiece(e.target.checked)} className="rounded text-indigo-600 w-4 h-4" />
                <span>ئەم کاڵایە بە دانە هەیە</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                <input type="checkbox" checked={showPacket} onChange={e => setShowPacket(e.target.checked)} className="rounded text-indigo-600 w-4 h-4" />
                <span>ئەم کاڵایە پاکەتی هەیە</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                <input type="checkbox" checked={showCarton} onChange={e => setShowCarton(e.target.checked)} className="rounded text-indigo-600 w-4 h-4" />
                <span>ئەم کاڵایە کارتۆنی هەیە</span>
              </label>
            </div>
            {(showPacket || showCarton) && (
              <button
                type="button"
                onClick={autoCalculate}
                className="px-4 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-sm font-medium transition flex items-center gap-2"
              >
                <Calculator size={16} />
                حیسابکردنی ئۆتۆماتیکی نرخ
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Piece Group */}
            {showPiece && (
              <div className="p-4 border border-indigo-100 rounded-xl bg-indigo-50/30 space-y-3 relative">
                <button type="button" onClick={() => { setShowPiece(false); setPieceCost(''); setPiecePrice(''); setPieceQuantity(''); }} className="absolute top-4 left-4 text-slate-400 hover:text-red-500 transition">
                  <Trash2 size={16} />
                </button>
                <h4 className="font-bold text-indigo-800">بە دانە</h4>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">بڕ (دانە)</label>
                  <input type="number" min="0" step="any" className="w-full px-2 py-1.5 border rounded-md text-sm" value={pieceQuantity} onChange={(e) => setPieceQuantity(e.target.value)} dir="ltr" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">تێچوو بۆ هەر دانەیەک</label>
                  <input type="number" min="0" step="any" className="w-full px-2 py-1.5 border rounded-md text-sm" value={pieceCost} onChange={(e) => setPieceCost(e.target.value)} dir="ltr" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">نرخی فرۆشتن بۆ دانە</label>
                  <input type="number" min="0" step="any" required={showPiece} className="w-full px-2 py-1.5 border rounded-md text-sm" value={piecePrice} onChange={(e) => setPiecePrice(e.target.value)} dir="ltr" />
                </div>
              </div>
            )}

            {/* Packet Group */}
            {showPacket && (
              <div className="p-4 border border-slate-100 rounded-xl bg-slate-50 space-y-3 relative">
                <button type="button" onClick={() => { setShowPacket(false); setPacketRatio(''); setPacketQuantity(''); setPacketCost(''); setPacketPrice(''); }} className="absolute top-4 left-4 text-slate-400 hover:text-red-500 transition">
                  <Trash2 size={16} />
                </button>
                <h4 className="font-bold text-slate-700">بە پاکەت</h4>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">ژمارەی دانە لە پاکەتێکدا</label>
                  <input type="number" min="0" step="any" required={showPacket} className="w-full px-2 py-1.5 border rounded-md text-sm" value={packetRatio} onChange={(e) => setPacketRatio(e.target.value)} dir="ltr" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">بڕ (پاکەت)</label>
                  <input type="number" min="0" step="any" className="w-full px-2 py-1.5 border rounded-md text-sm" value={packetQuantity} onChange={(e) => setPacketQuantity(e.target.value)} dir="ltr" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">تێچوو بۆ پاکەت</label>
                  <input type="number" min="0" step="any" className="w-full px-2 py-1.5 border rounded-md text-sm" value={packetCost} onChange={(e) => setPacketCost(e.target.value)} dir="ltr" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">نرخی فرۆشتنی پاکەت</label>
                  <input type="number" min="0" step="any" required={showPacket} className="w-full px-2 py-1.5 border rounded-md text-sm" value={packetPrice} onChange={(e) => setPacketPrice(e.target.value)} dir="ltr" />
                </div>
              </div>
            )}

            {/* Carton Group */}
            {showCarton && (
              <div className="p-4 border border-slate-100 rounded-xl bg-slate-50 space-y-3 relative">
                <button type="button" onClick={() => { setShowCarton(false); setCartonRatio(''); setCartonQuantity(''); setCartonCost(''); setCartonPrice(''); }} className="absolute top-4 left-4 text-slate-400 hover:text-red-500 transition">
                  <Trash2 size={16} />
                </button>
                <h4 className="font-bold text-slate-700">بە کارتۆن</h4>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">ژمارەی دانە لە کارتۆنێکدا</label>
                  <input type="number" min="0" step="any" required={showCarton} className="w-full px-2 py-1.5 border rounded-md text-sm" value={cartonRatio} onChange={(e) => setCartonRatio(e.target.value)} dir="ltr" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">بڕ (کارتۆن)</label>
                  <input type="number" min="0" step="any" className="w-full px-2 py-1.5 border rounded-md text-sm" value={cartonQuantity} onChange={(e) => setCartonQuantity(e.target.value)} dir="ltr" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">تێچوو بۆ کارتۆن</label>
                  <input type="number" min="0" step="any" className="w-full px-2 py-1.5 border rounded-md text-sm" value={cartonCost} onChange={(e) => setCartonCost(e.target.value)} dir="ltr" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">نرخی فرۆشتنی کارتۆن</label>
                  <input type="number" min="0" step="any" required={showCarton} className="w-full px-2 py-1.5 border rounded-md text-sm" value={cartonPrice} onChange={(e) => setCartonPrice(e.target.value)} dir="ltr" />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <div className="flex gap-4 items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={paymentType === 'cash'} onChange={() => setPaymentType('cash')} className="text-indigo-600" />
                <span className="text-sm font-medium text-slate-700">نەقدی کۆمپانیا</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={paymentType === 'debt'} onChange={() => setPaymentType('debt')} className="text-indigo-600" />
                <span className="text-sm font-medium text-slate-700">قەرزی کۆمپانیا</span>
              </label>
            </div>
            <div className="flex items-end gap-3">
              <button
                type="submit"
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2"
              >
                {isEditing ? <Edit2 size={18} /> : <Plus size={18} />}
                <span>{isEditing ? 'پاشەکەوتکردنی گۆڕانکاری' : 'زیادکردنی کاڵا'}</span>
              </button>
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition font-medium"
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
          <h4 className="font-bold text-slate-700 flex items-center gap-2">📊 لیستی کاڵاکان لە کۆگا</h4>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <select
              className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
            >
              <option value="">هەموو کۆمپانیاکان</option>
              {uniqueSuppliers.map((sup, i) => (
                <option key={i} value={sup as string}>{sup}</option>
              ))}
            </select>
            <select
              className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              value={sortDate}
              onChange={(e) => setSortDate(e.target.value as 'desc' | 'asc')}
            >
              <option value="desc">نوێترین</option>
              <option value="asc">کۆنترین</option>
            </select>
            <div className="relative w-full md:w-64">
              <input
                type="text"
                placeholder="گەڕان بەپێی ناو یان بارکۆد..."
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
        ) : (
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">ناوی کاڵا</th>
                  <th className="px-4 py-3 font-semibold">کۆمپانیا</th>
                  <th className="px-4 py-3 font-semibold">نرخی فرۆشتن (دانە/پاکەت/کارتۆن)</th>
                  <th className="px-4 py-3 font-semibold">ماوە (کۆگا)</th>
                  <th className="px-4 py-3 font-semibold">کردارەکان</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-50">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-4 font-medium text-slate-900">{item.name}</td>
                    <td className="px-4 py-4 font-medium text-slate-600">{item.supplier || '-'}</td>
                    <td className="px-4 py-4 text-slate-900 font-medium text-xs" dir="ltr">
                      <div className="flex flex-col gap-1">
                        <span>د: {item.sellingPrice?.toLocaleString() || 0}</span>
                        {item.packetRatio > 0 && <span>پ: {item.packetSellingPrice?.toLocaleString() || 0}</span>}
                        {item.ratio > 0 && <span>ک: {item.cartonSellingPrice?.toLocaleString() || 0}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-900 font-medium" dir="ltr">
                      <span className={`${item.quantity <= 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'} px-2 py-1 rounded text-xs font-bold`}>
                        {formatStock(item)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-indigo-600 font-bold px-2 py-1 hover:bg-indigo-50 rounded transition"
                        >
                          دەستکاری
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-red-600 font-bold px-2 py-1 hover:bg-red-50 rounded transition"
                        >
                          سڕینەوە
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-500">
                      هیچ کاڵایەک نەدۆزرایەوە
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
