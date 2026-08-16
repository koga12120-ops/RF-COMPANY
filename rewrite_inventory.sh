cat << 'INNER_EOF' > src/components/views/InventoryView.tsx
import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { Item } from '../../types';

export default function InventoryView({ role }: { role: string | null }) {
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
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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

    const costPricePerPiece = Number(pieceCost) || 0;

    try {
      if (supplier && !companies.find(c => c.name === supplier)) {
        await addDoc(collection(db, 'companies'), { name: supplier, location: '', phone: '', createdAt: Date.now() });
      }
      
      if (isEditing) {
        const oldItem = items.find(i => i.id === editId);
        const oldQuantity = oldItem ? oldItem.quantity : 0;
        itemData.quantity = oldQuantity + totalPiecesToAdd; // Add to existing stock
        
        await updateDoc(doc(db, 'items', editId), itemData);
        
        if (totalPiecesToAdd > 0) {
          await addDoc(collection(db, 'stock_history'), {
            itemId: editId,
            itemName: name,
            quantityAdded: totalPiecesToAdd,
            date: Date.now()
          });
          
          await addDoc(collection(db, 'transactions'), {
            type: paymentType === 'cash' ? 'company_cash' : 'company_debt',
            amount: costPricePerPiece * totalPiecesToAdd,
            date: Date.now(),
            description: paymentType === 'cash' ? `نەقدی زیادکردنی کاڵای ${name}` : `قەرزی زیادکردنی کاڵای ${name}`,
            relatedEntityId: supplier || 'نەزانراو'
          });
        }
      } else {
        const docRef = await addDoc(collection(db, 'items'), { ...itemData, quantity: totalPiecesToAdd, createdAt: Date.now() });
        
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
    
    setPieceCost(item.costPrice ? item.costPrice.toString() : '');
    setPiecePrice(item.sellingPrice ? item.sellingPrice.toString() : '');
    setPieceQuantity('');

    setPacketRatio(item.packetRatio ? item.packetRatio.toString() : '');
    setPacketCost(item.packetCostPrice ? item.packetCostPrice.toString() : '');
    setPacketPrice(item.packetSellingPrice ? item.packetSellingPrice.toString() : '');
    setPacketQuantity('');

    setCartonRatio(item.ratio ? item.ratio.toString() : '');
    setCartonCost(item.cartonCostPrice ? item.cartonCostPrice.toString() : '');
    setCartonPrice(item.cartonSellingPrice ? item.cartonSellingPrice.toString() : '');
    setCartonQuantity('');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if(!window.confirm('دڵنیایت لە سڕینەوەی ئەم کاڵایە؟')) return;
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

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold mb-4 text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
          {isEditing ? 'دەستکاریکردنی کاڵا' : 'داخڵکردنی کاڵای نوێ'}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">ناوی کاڵا</label>
              <input type="text" required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">بارکۆد</label>
              <input type="text" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono" value={barcode} onChange={e => setBarcode(e.target.value)} dir="ltr" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">کۆمپانیا</label>
              <input type="text" list="companies-list" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={supplier} onChange={e => setSupplier(e.target.value)} />
              <datalist id="companies-list">
                {companies.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pieces Section */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
              <h4 className="font-bold text-slate-700">زانیاری دانە</h4>
              <div>
                <label className="block text-sm text-gray-600 mb-1">تێچووی دانە</label>
                <input type="number" required min="0" step="0.01" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={pieceCost} onChange={e => setPieceCost(e.target.value)} dir="ltr" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">نرخی فرۆشتنی دانە</label>
                <input type="number" required min="0" step="0.01" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={piecePrice} onChange={e => setPiecePrice(e.target.value)} dir="ltr" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">دانەی داخڵکراو</label>
                <input type="number" min="0" step="1" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={pieceQuantity} onChange={e => setPieceQuantity(e.target.value)} dir="ltr" />
              </div>
            </div>

            {/* Packets Section */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
              <h4 className="font-bold text-slate-700">زانیاری پاکەت</h4>
              <div>
                <label className="block text-sm text-gray-600 mb-1">هەر پاکەتێک چەند دانەیە؟</label>
                <input type="number" min="0" step="1" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={packetRatio} onChange={e => setPacketRatio(e.target.value)} dir="ltr" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">تێچووی پاکەت</label>
                  <input type="number" min="0" step="0.01" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={packetCost} onChange={e => setPacketCost(e.target.value)} dir="ltr" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">فرۆشتنی پاکەت</label>
                  <input type="number" min="0" step="0.01" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={packetPrice} onChange={e => setPacketPrice(e.target.value)} dir="ltr" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">پاکەتی داخڵکراو</label>
                <input type="number" min="0" step="1" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={packetQuantity} onChange={e => setPacketQuantity(e.target.value)} dir="ltr" />
              </div>
            </div>

            {/* Cartons Section */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
              <h4 className="font-bold text-slate-700">زانیاری کارتۆن</h4>
              <div>
                <label className="block text-sm text-gray-600 mb-1">هەر کارتۆنێک چەند دانەیە؟</label>
                <input type="number" min="0" step="1" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={cartonRatio} onChange={e => setCartonRatio(e.target.value)} dir="ltr" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">تێچووی کارتۆن</label>
                  <input type="number" min="0" step="0.01" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={cartonCost} onChange={e => setCartonCost(e.target.value)} dir="ltr" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">فرۆشتنی کارتۆن</label>
                  <input type="number" min="0" step="0.01" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={cartonPrice} onChange={e => setCartonPrice(e.target.value)} dir="ltr" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">کارتۆنی داخڵکراو</label>
                <input type="number" min="0" step="1" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={cartonQuantity} onChange={e => setCartonQuantity(e.target.value)} dir="ltr" />
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pt-4 border-t">
            <div className="flex gap-4 items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={paymentType === 'cash'} onChange={() => setPaymentType('cash')} className="text-indigo-600" />
                <span className="text-sm font-medium text-slate-700">نەقد</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={paymentType === 'debt'} onChange={() => setPaymentType('debt')} className="text-indigo-600" />
                <span className="text-sm font-medium text-slate-700">قەرز</span>
              </label>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button type="submit" className="flex-1 md:flex-none px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition flex items-center justify-center gap-2">
                {isEditing ? <Edit2 size={18} /> : <Plus size={18} />}
                <span>{isEditing ? 'پاشەکەوتکردن' : 'زیادکردنی کاڵا'}</span>
              </button>
              {isEditing && (
                <button type="button" onClick={resetForm} className="px-6 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition font-medium">
                  پاشگەزبوونەوە
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

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
                  <th className="px-4 py-3 font-semibold text-center">تێچوو (دانە/پاکەت/کارتۆن)</th>
                  <th className="px-4 py-3 font-semibold text-center">فرۆشتن (دانە/پاکەت/کارتۆن)</th>
                  <th className="px-4 py-3 font-semibold">ماوە (کۆگا)</th>
                  <th className="px-4 py-3 font-semibold">کردارەکان</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-50">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-4 font-medium text-slate-900">{item.name}</td>
                    <td className="px-4 py-4 font-medium text-slate-600">{item.supplier || '-'}</td>
                    <td className="px-4 py-4 text-slate-500 font-medium text-xs text-center" dir="ltr">
                      <div className="flex flex-col gap-1">
                        <span>د: {item.costPrice?.toLocaleString() || 0}</span>
                        {(item.packetRatio || 0) > 0 && <span>پ: {item.packetCostPrice?.toLocaleString() || 0}</span>}
                        {(item.ratio || 0) > 0 && <span>ک: {item.cartonCostPrice?.toLocaleString() || 0}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-900 font-medium text-xs text-center" dir="ltr">
                      <div className="flex flex-col gap-1">
                        <span>د: {item.sellingPrice?.toLocaleString() || 0}</span>
                        {(item.packetRatio || 0) > 0 && <span>پ: {item.packetSellingPrice?.toLocaleString() || 0}</span>}
                        {(item.ratio || 0) > 0 && <span>ک: {item.cartonSellingPrice?.toLocaleString() || 0}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-900 font-medium" dir="ltr">
                      <span className={`${item.quantity <= 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'} px-2 py-1 rounded text-xs font-bold`}>
                        {formatStock(item)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleEdit(item)} className="text-indigo-600 font-bold px-2 py-1 hover:bg-indigo-50 rounded transition">
                          دەستکاری
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="text-red-600 font-bold px-2 py-1 hover:bg-red-50 rounded transition">
                          سڕینەوە
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500">هیچ کاڵایەک نەدۆزرایەوە</td>
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
INNER_EOF
sh rewrite_inventory.sh
