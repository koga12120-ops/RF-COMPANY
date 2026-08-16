import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

# Replace the "کاڵا هەڵبژێردراوەکان" section
pattern = re.compile(r"<h4 className=\"font-semibold text-slate-800 mb-4 text-sm\">کاڵا هەڵبژێردراوەکان</h4>\s*<div className=\"h-64 overflow-y-auto space-y-2 pr-2\">[\s\S]*?(?=<div className=\"pt-4 border-t border-slate-200 mt-4 flex items-center justify-between\">)", re.MULTILINE)

replacement = """<h4 className="font-semibold text-slate-800 mb-4 text-sm">کاڵا هەڵبژێردراوەکان (لیستی داخڵکردن)</h4>
                <div className="h-64 overflow-y-auto pr-2 border border-slate-200 rounded-lg">
                  {selectedItems.length === 0 ? (
                    <div className="text-center text-slate-500 py-8 text-sm">هیچ کاڵایەک نەخراوەتە سەبەتەکەوە</div>
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
                        {selectedItems.map((si, index) => {
                          const barcode = si.item.barcode || '-';
                          const ratio = si.item.ratio || 1;
                          const cartonQty = (si.quantity / ratio).toFixed(2);
                          const cartonPrice = (si.item.sellingPrice * ratio).toLocaleString();
                          const total = (si.item.sellingPrice * si.quantity).toLocaleString();
                          return (
                            <tr key={si.item.id} className="hover:bg-slate-50">
                              <td className="p-2">{index + 1}</td>
                              <td className="p-2 font-mono text-xs" dir="ltr">{barcode}</td>
                              <td className="p-2 font-medium text-slate-800">{si.item.name}</td>
                              <td className="p-2 text-center">
                                <input 
                                  type="number" 
                                  min="1"
                                  className="w-16 outline-none text-center border border-slate-200 rounded p-1"
                                  value={si.quantity}
                                  onChange={(e) => handleUpdateItemQuantity(si.item.id, Number(e.target.value))}
                                  dir="ltr"
                                />
                              </td>
                              <td className="p-2 text-center">{cartonQty}</td>
                              <td className="p-2 text-center font-mono" dir="ltr">{si.item.sellingPrice.toLocaleString()}</td>
                              <td className="p-2 text-center font-mono" dir="ltr">{cartonPrice}</td>
                              <td className="p-2 text-center font-bold text-indigo-600 font-mono" dir="ltr">{total}</td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItemFromOrder(si.item.id)}
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
                """

new_content = pattern.sub(replacement, content)

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(new_content)

