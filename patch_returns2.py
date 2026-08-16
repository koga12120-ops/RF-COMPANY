import re

with open('src/components/views/ReturnsView.tsx', 'r') as f:
    content = f.read()

old_ui = """              <div className="flex items-center gap-2">
                <select 
                  className="px-3 py-2 border border-slate-200 rounded-lg outline-none"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as 'piece'|'carton')}
                >
                  <option value="piece">دانە</option>
                  <option value="carton">کارتۆن</option>
                </select>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="بڕ"
                  className="w-24 px-3 py-2 border border-slate-200 rounded-lg outline-none text-center"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>"""

new_ui = """              <div className="flex items-center gap-2">
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
              </div>"""
content = content.replace(old_ui, new_ui)

with open('src/components/views/ReturnsView.tsx', 'w') as f:
    f.write(content)
