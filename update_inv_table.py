import re

with open('src/components/views/InventoryView.tsx', 'r') as f:
    content = f.read()

# Add formatStock function right above the return statement
old_return = "  return ("
new_return = """  const formatStock = (item: Item) => {
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

  return ("""
content = content.replace(old_return, new_return)

old_table = """            <table className="w-full text-right">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">ناوی کاڵا</th>
                  <th className="px-4 py-3 font-semibold">کۆمپانیا</th>
                  <th className="px-4 py-3 font-semibold">بارکۆد</th>
                  <th className="px-4 py-3 font-semibold">تێچووی کارتۆن</th>
                  <th className="px-4 py-3 font-semibold">فرۆشتنی عدد</th>
                  <th className="px-4 py-3 font-semibold">ماوە (کارتۆن / دانە)</th>
                  <th className="px-4 py-3 font-semibold">قازانجی عدد</th>
                  <th className="px-4 py-3 font-semibold">کردارەکان</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-50">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-4 font-medium text-slate-900">{item.name}</td>
                    <td className="px-4 py-4 font-medium text-slate-600">{item.supplier || '-'}</td>
                    <td className="px-4 py-4 text-slate-500 font-mono text-xs" dir="ltr">{item.barcode || '-'}</td>
                    <td className="px-4 py-4 text-slate-900" dir="ltr">{((item.costPrice || 0) * (item.ratio || 1)).toLocaleString()}</td>
                    <td className="px-4 py-4 text-slate-900" dir="ltr">{(item.sellingPrice || 0).toLocaleString()}</td>
                    <td className="px-4 py-4 text-slate-900 font-medium" dir="ltr">
                      <span className={`${item.quantity < (item.ratio || 1) ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'} px-2 py-1 rounded text-xs font-bold`}>
                        {Math.floor((item.quantity || 0) / (item.ratio || 1))} کارتۆن و {(item.quantity || 0) % (item.ratio || 1)} دانە
                      </span>
                    </td>
                    <td className="px-4 py-4 text-green-600 font-bold" dir="ltr">{((item.sellingPrice || 0) - (item.costPrice || 0)).toLocaleString()}</td>
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
                    <td colSpan={9} className="text-center py-8 text-slate-500">
                      هیچ کاڵایەک نەدۆزرایەوە
                    </td>
                  </tr>
                )}
              </tbody>
            </table>"""

new_table = """            <table className="w-full text-right">
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
            </table>"""

content = content.replace(old_table, new_table)

with open('src/components/views/InventoryView.tsx', 'w') as f:
    f.write(content)
