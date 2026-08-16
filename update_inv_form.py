import re

with open('src/components/views/InventoryView.tsx', 'r') as f:
    content = f.read()

old_form = """          <div>
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
            <label className="block text-sm text-gray-600 mb-1">بارکۆد (دەستی یان سکانەر)</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">عددی کاڵا (بە کارتۆن)</label>
            <input
              type="number"
              required
              min="0"
              step="any"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={cartonQuantity}
              onChange={(e) => setCartonQuantity(e.target.value)}
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">بڕی کارتۆن (هەر کارتۆنێک چەندی تێدایە)</label>
            <input
              type="number"
              required
              min="1"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={ratio}
              onChange={(e) => setRatio(e.target.value)}
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">نرخ بە کارتۆن</label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={cartonCostPrice}
              onChange={(e) => setCartonCostPrice(e.target.value)}
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">نرخ بە تاک (بە عدد)</label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
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
          </div>"""

new_form = """          {/* Basic Info */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">ناوی کاڵا</label>
              <input type="text" required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">بارکۆد</label>
              <input type="text" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono" value={barcode} onChange={(e) => setBarcode(e.target.value)} dir="ltr" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">کۆمپانیا</label>
              <input type="text" list="companies-list" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
              <datalist id="companies-list">
                {companies.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
            </div>
          </div>

          {/* Configuration */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100 pt-4 mt-2">
            
            {/* PIECE */}
            <div className="bg-slate-50 p-4 rounded-xl space-y-3">
              <h4 className="font-bold text-slate-800 border-b border-slate-200 pb-2">دانە</h4>
              <div>
                <label className="block text-xs text-gray-600 mb-1">تێچوو (دانە)</label>
                <input type="number" step="any" min="0" required className="w-full px-3 py-1.5 border rounded-lg" value={pieceCost} onChange={(e) => setPieceCost(e.target.value)} dir="ltr" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">نرخی فرۆشتن (دانە)</label>
                <input type="number" step="any" min="0" required className="w-full px-3 py-1.5 border rounded-lg" value={piecePrice} onChange={(e) => setPiecePrice(e.target.value)} dir="ltr" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">عدد (زیادکردن بۆ کۆگا)</label>
                <input type="number" step="any" min="0" className="w-full px-3 py-1.5 border rounded-lg bg-white" value={pieceQuantity} onChange={(e) => setPieceQuantity(e.target.value)} dir="ltr" />
              </div>
            </div>

            {/* PACKET */}
            <div className="bg-slate-50 p-4 rounded-xl space-y-3">
              <h4 className="font-bold text-slate-800 border-b border-slate-200 pb-2">پاکەت</h4>
              <div>
                <label className="block text-xs text-gray-600 mb-1">یەک پاکەت چەند دانەیە؟</label>
                <input type="number" step="any" min="0" className="w-full px-3 py-1.5 border rounded-lg" value={packetRatio} onChange={(e) => setPacketRatio(e.target.value)} dir="ltr" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-600 mb-1">تێچوو (پاکەت)</label>
                  <input type="number" step="any" min="0" className="w-full px-2 py-1.5 border rounded-lg" value={packetCost} onChange={(e) => setPacketCost(e.target.value)} dir="ltr" />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-600 mb-1">فرۆشتن (پاکەت)</label>
                  <input type="number" step="any" min="0" className="w-full px-2 py-1.5 border rounded-lg" value={packetPrice} onChange={(e) => setPacketPrice(e.target.value)} dir="ltr" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">عدد (زیادکردن بۆ کۆگا)</label>
                <input type="number" step="any" min="0" className="w-full px-3 py-1.5 border rounded-lg bg-white" value={packetQuantity} onChange={(e) => setPacketQuantity(e.target.value)} dir="ltr" />
              </div>
            </div>

            {/* CARTON */}
            <div className="bg-slate-50 p-4 rounded-xl space-y-3">
              <h4 className="font-bold text-slate-800 border-b border-slate-200 pb-2">کارتۆن</h4>
              <div>
                <label className="block text-xs text-gray-600 mb-1">یەک کارتۆن چەند دانەیە؟</label>
                <input type="number" step="any" min="0" className="w-full px-3 py-1.5 border rounded-lg" value={cartonRatio} onChange={(e) => setCartonRatio(e.target.value)} dir="ltr" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-600 mb-1">تێچوو (کارتۆن)</label>
                  <input type="number" step="any" min="0" className="w-full px-2 py-1.5 border rounded-lg" value={cartonCost} onChange={(e) => setCartonCost(e.target.value)} dir="ltr" />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-600 mb-1">فرۆشتن (کارتۆن)</label>
                  <input type="number" step="any" min="0" className="w-full px-2 py-1.5 border rounded-lg" value={cartonPrice} onChange={(e) => setCartonPrice(e.target.value)} dir="ltr" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">عدد (زیادکردن بۆ کۆگا)</label>
                <input type="number" step="any" min="0" className="w-full px-3 py-1.5 border rounded-lg bg-white" value={cartonQuantity} onChange={(e) => setCartonQuantity(e.target.value)} dir="ltr" />
              </div>
            </div>
          </div>"""

content = content.replace(old_form, new_form)

with open('src/components/views/InventoryView.tsx', 'w') as f:
    f.write(content)
