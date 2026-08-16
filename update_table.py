import re

with open('src/components/views/InventoryView.tsx', 'r') as f:
    content = f.read()

old_thead = """              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">ناوی کاڵا</th>
                  <th className="px-4 py-3 font-semibold">کۆمپانیا</th>
                  <th className="px-4 py-3 font-semibold">بارکۆد</th>
                  <th className="px-4 py-3 font-semibold">تێچوو</th>
                  <th className="px-4 py-3 font-semibold">فرۆشتن</th>
                  <th className="px-4 py-3 font-semibold">ژمارە</th>
                  <th className="px-4 py-3 font-semibold">قازانجی سافی</th>
                  <th className="px-4 py-3 font-semibold">کردارەکان</th>
                </tr>
              </thead>"""

new_thead = """              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
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
              </thead>"""

content = content.replace(old_thead, new_thead)

old_tr = """                  <tr key={item.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-4 font-medium text-slate-900">{item.name}</td>
                    <td className="px-4 py-4 font-medium text-slate-600">{item.supplier || '-'}</td>
                    <td className="px-4 py-4 text-slate-500 font-mono text-xs" dir="ltr">{item.barcode || '-'}</td>
                    <td className="px-4 py-4 text-slate-900" dir="ltr">{item.costPrice.toLocaleString()}</td>
                    <td className="px-4 py-4 text-slate-900" dir="ltr">{item.sellingPrice.toLocaleString()}</td>
                    <td className="px-4 py-4 text-slate-900 font-medium" dir="ltr">
                      <span className={`${item.quantity < 10 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'} px-2 py-1 rounded text-xs font-bold`}>
                        {item.quantity} دانە
                      </span>
                    </td>
                    <td className="px-4 py-4 text-green-600 font-bold" dir="ltr">{(item.sellingPrice - item.costPrice).toLocaleString()}</td>
                    <td className="px-4 py-4">"""

new_tr = """                  <tr key={item.id} className="hover:bg-slate-50/50 transition">
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
                    <td className="px-4 py-4">"""

content = content.replace(old_tr, new_tr)

with open('src/components/views/InventoryView.tsx', 'w') as f:
    f.write(content)

