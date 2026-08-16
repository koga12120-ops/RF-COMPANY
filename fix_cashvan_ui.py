import re

with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

# Replace the cart list rendering with a table
pattern = re.compile(r"<div className=\"flex-1 overflow-y-auto space-y-3 mb-4 pr-2\">.*?<div className=\"pt-4 border-t border-slate-100 mt-auto\">", re.MULTILINE | re.DOTALL)

replacement = """<div className="flex-1 overflow-y-auto mb-4 pr-2 border border-slate-200 rounded-lg">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col justify-center items-center text-slate-400 space-y-2 py-10">
                <Search size={40} className="text-slate-200" />
                <p>هیچ کاڵایەک لە فاتیرەدا نییە</p>
              </div>
            ) : (
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-100 text-slate-600 sticky top-0">
                  <tr>
                    <th className="p-2 border-b">ژ</th>
                    <th className="p-2 border-b">کۆدی کاڵا</th>
                    <th className="p-2 border-b">ناوی کاڵا</th>
                    <th className="p-2 border-b text-center">عددی مەواد</th>
                    <th className="p-2 border-b text-center">کۆی کارتۆن</th>
                    <th className="p-2 border-b text-center">نرخی تاک</th>
                    <th className="p-2 border-b text-center">نرخی کارتۆن</th>
                    <th className="p-2 border-b text-center">کۆی گشتی</th>
                    <th className="p-2 border-b text-center">سڕینەوە</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {cart.map((c, index) => {
                    const barcode = c.barcode || '-';
                    const ratio = c.ratio || 1;
                    const cartonQty = (c.cartQty / ratio).toFixed(2);
                    const cartonPrice = (c.finalPrice * ratio).toLocaleString();
                    const total = (c.finalPrice * c.cartQty).toLocaleString();
                    return (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="p-2">{index + 1}</td>
                        <td className="p-2 font-mono text-xs" dir="ltr">{barcode}</td>
                        <td className="p-2 font-medium text-slate-800">{c.name}</td>
                        <td className="p-2 text-center">
                          <input 
                            type="number" 
                            min="1"
                            max={c.quantity}
                            className="w-16 outline-none text-center border border-slate-200 rounded p-1"
                            value={c.cartQty}
                            onChange={(e) => updateCartQty(c.id, parseInt(e.target.value) || 0)}
                            dir="ltr"
                          />
                        </td>
                        <td className="p-2 text-center">{cartonQty}</td>
                        <td className="p-2 text-center">
                          <input 
                            type="number" 
                            min="0"
                            className="w-20 outline-none text-center border border-slate-200 rounded p-1 font-mono"
                            value={c.finalPrice}
                            onChange={(e) => updateCartPrice(c.id, parseInt(e.target.value) || 0)}
                            dir="ltr"
                          />
                        </td>
                        <td className="p-2 text-center font-mono" dir="ltr">{cartonPrice}</td>
                        <td className="p-2 text-center font-bold text-indigo-600 font-mono" dir="ltr">{total}</td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => updateCartQty(c.id, 0)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded transition"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          
          <div className="pt-4 border-t border-slate-100 mt-auto">"""

new_content = pattern.sub(replacement, content)

with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(new_content)
