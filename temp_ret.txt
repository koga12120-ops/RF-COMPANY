import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Item, Market, Role } from '../../types';
import { Undo2, Search } from 'lucide-react';

export default function ReturnsView({ role }: { role: Role }) {
  const [items, setItems] = useState<Item[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [marketName, setMarketName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Return Form
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<'piece' | 'carton'>('piece');

  useEffect(() => {
    const qItems = query(collection(db, 'items'));
    const unsubItems = onSnapshot(qItems, (snapshot) => {
      const itemsData: Item[] = [];
      snapshot.forEach((doc) => {
        itemsData.push({ id: doc.id, ...doc.data() } as Item);
      });
      setItems(itemsData);
    });

    const qMarkets = query(collection(db, 'markets'));
    const unsubMarkets = onSnapshot(qMarkets, (snapshot) => {
      const marketsData: Market[] = [];
      snapshot.forEach((doc) => {
        marketsData.push({ id: doc.id, ...doc.data() } as Market);
      });
      setMarkets(marketsData);
      setLoading(false);
    });

    return () => {
      unsubItems();
      unsubMarkets();
    };
  }, []);

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !quantity || !marketName) return;

    try {
      const parsedQuantity = Number(quantity);
      let totalPieces = parsedQuantity;
      if (unit === 'carton') totalPieces = parsedQuantity * (selectedItem.ratio || 1);
      else if (unit === 'packet') totalPieces = parsedQuantity * (selectedItem.packetRatio || 1);
      
      const newQty = selectedItem.quantity + totalPieces;
      
      // Update item quantity
      await updateDoc(doc(db, 'items', selectedItem.id), {
        quantity: newQty
      });
      
      // Add to returns collection for log
      await addDoc(collection(db, 'returns'), {
        marketName,
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        quantityReturned: parsedQuantity,
        unit,
        totalPieces,
        date: Date.now()
      });
      
      // Add expense transaction for the returned goods
      // Value of returned goods
      const value = totalPieces * selectedItem.costPrice;
      await addDoc(collection(db, 'transactions'), {
        type: 'expense',
        amount: value,
        description: `گەڕانەوەی کاڵا: ${selectedItem.name} لە مارکێتی ${marketName}`,
        relatedEntityId: marketName,
        date: Date.now()
      });

      setQuantity('');
      setSelectedItem(null);
      setMarketName('');
      alert('بە سەرکەوتوویی گەڕێندرایەوە');
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە کاتی گەڕاندنەوە');
    }
  };

  const filteredItems = items.filter(item => 
    item.name.includes(searchTerm) || item.barcode.includes(searchTerm)
  );

  if (loading) return <div>چاوەڕێبە...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Undo2 className="text-indigo-600" /> گەڕانەوەی کاڵا (لە مارکێتەوە بۆ کۆگا)
        </h2>

        <form onSubmit={handleReturn} className="space-y-4 max-w-2xl">
          <div>
            <label className="block text-sm text-slate-600 mb-1">ناوی مارکێت</label>
            <input
              type="text"
              required
              list="markets-list"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              value={marketName}
              onChange={(e) => setMarketName(e.target.value)}
            />
            <datalist id="markets-list">
              {markets.map(m => <option key={m.id} value={m.name} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1">گەڕان بۆ کاڵا (ناو یان بارکۆد)</label>
            <div className="relative">
              <input
                type="text"
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="گەڕان..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-3 top-2.5 text-slate-400" size={20} />
            </div>
          </div>

          {searchTerm && (
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
              {filteredItems.map(item => (
                <div 
                  key={item.id} 
                  className={`p-3 border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${selectedItem?.id === item.id ? 'bg-indigo-50' : ''}`}
                  onClick={() => setSelectedItem(item)}
                >
                  <div className="font-bold">{item.name}</div>
                  <div className="text-xs text-slate-500 font-mono" dir="ltr">{item.barcode}</div>
                </div>
              ))}
            </div>
          )}

          {selectedItem && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-4">
              <div className="flex-1">
                <div className="text-sm text-slate-500">کاڵای هەڵبژێردراو</div>
                <div className="font-bold">{selectedItem.name}</div>
              </div>
              <div className="flex items-center gap-2">
                <select 
                  className="px-3 py-2 border border-slate-200 rounded-lg outline-none"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as any)}
                >
                  <option value="piece">دانە</option>
                  {selectedItem.packetRatio > 0 && <option value="packet">پاکەت</option>}
                  {selectedItem.ratio > 0 && <option value="carton">کارتۆن</option>}
                </select>
                <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-2 py-1 bg-white">
                  <button type="button" onClick={() => setQuantity(String(Math.max(1, Number(quantity) - 1)))} className="px-3 text-xl font-bold text-slate-500 hover:text-indigo-600 focus:outline-none">-</button>
                  <input
                    type="number"
                    required
                    min="1"
                    className="w-16 text-center outline-none bg-transparent"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    dir="ltr"
                  />
                  <button type="button" onClick={() => setQuantity(String(Number(quantity) + 1))} className="px-3 text-xl font-bold text-slate-500 hover:text-indigo-600 focus:outline-none">+</button>
                </div>
              </div>
            </div>
          )}

          <div className="pt-4">
            <button
              type="submit"
              disabled={!selectedItem || !quantity || !marketName}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-50"
            >
              گەڕاندنەوە بۆ کۆگا
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
