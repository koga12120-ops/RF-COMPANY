import re

with open('src/components/views/MarketsView.tsx', 'r') as f:
    content = f.read()

# Add Order type and date-fns
content = content.replace("import { Store, Plus, Edit2, Trash2 } from 'lucide-react';", "import { Store, Plus, Edit2, Trash2, History, X } from 'lucide-react';\nimport { format } from 'date-fns';\nimport { Order } from '../../types';")

# Add state for orders and selectedMarket
content = content.replace("const [editingId, setEditingId] = useState<string | null>(null);", "const [editingId, setEditingId] = useState<string | null>(null);\n  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);\n  const [orders, setOrders] = useState<Order[]>([]);")

# Fetch orders when selectedMarket changes
fetch_orders_effect = """
  useEffect(() => {
    if (!selectedMarket) return;
    const qOrders = query(collection(db, 'orders'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(qOrders, (snapshot) => {
      const data: Order[] = [];
      snapshot.forEach((doc) => {
        const order = { id: doc.id, ...doc.data() } as Order;
        if (order.marketName === selectedMarket.name) {
          data.push(order);
        }
      });
      setOrders(data);
    });
    return () => unsub();
  }, [selectedMarket]);
"""

content = content.replace("  const handleSubmit = async", fetch_orders_effect + "\n  const handleSubmit = async")

# Add a "مێژوو" button to the actions
history_btn = """                        <button
                          onClick={() => setSelectedMarket(market)}
                          className="text-slate-600 font-bold px-2 py-1 hover:bg-slate-100 rounded transition flex items-center gap-1"
                        >
                          <History size={16} /> مێژوو
                        </button>
                        <button"""
content = content.replace("<button", history_btn, 1) # Note: we'll do this safely.

import sys
content = content.replace(
"""                        <button
                          onClick={() => handleEdit(market)}""",
"""                        <button
                          onClick={() => setSelectedMarket(market)}
                          className="text-blue-600 font-bold px-2 py-1 hover:bg-blue-50 rounded transition flex items-center gap-1"
                        >
                          <History size={16} />
                        </button>
                        <button
                          onClick={() => handleEdit(market)}"""
)


# Add the modal at the end of the return statement
modal = """
      {selectedMarket && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <History size={20} className="text-indigo-600" /> مێژووی ئۆردەرەکانی {selectedMarket.name}
              </h3>
              <button 
                onClick={() => setSelectedMarket(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition text-slate-500"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto bg-slate-50/50 flex-1">
              {orders.length === 0 ? (
                <div className="text-center py-10 text-slate-500">هیچ ئۆردەرێک بوونی نییە بۆ ئەم مارکێتە</div>
              ) : (
                <div className="space-y-4">
                  {orders.map(order => (
                    <div key={order.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-100">
                        <div>
                          <div className="font-bold text-slate-800">{format(order.timestamp, 'yyyy/MM/dd HH:mm')}</div>
                          <div className="text-xs text-slate-500 mt-1">مەندووب: {order.repName}</div>
                        </div>
                        <div className="text-left">
                          <div className="font-bold text-indigo-600" dir="ltr">{order.totalAmount.toLocaleString()}</div>
                          <div className="text-xs text-slate-500 mt-1">
                            {order.status === 'completed' ? 'تەسفییە کراوە' : order.status === 'printed' ? 'چاپکراوە' : 'چاوەڕێ دەکات'}
                            {order.paymentStatus === 'cash' ? ' (نەقد)' : order.paymentStatus === 'debt' ? ' (قەرز)' : ''}
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-sm bg-slate-50 p-2 rounded-lg">
                            <span className="font-medium text-slate-700">{item.name}</span>
                            <span className="text-slate-500" dir="ltr">{item.quantity} x {item.price.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
"""

content = content.replace("    </div>\n  );\n}", modal + "    </div>\n  );\n}")

with open('src/components/views/MarketsView.tsx', 'w') as f:
    f.write(content)

