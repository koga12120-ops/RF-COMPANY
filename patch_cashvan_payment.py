import re

with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

# Add paymentType state
content = content.replace("const [selectedMarket, setSelectedMarket] = useState<string>('');", "const [selectedMarket, setSelectedMarket] = useState<string>('');\n  const [paymentType, setPaymentType] = useState<'cash'|'debt'>('cash');")

# Add paymentType to saleData
content = content.replace("status: 'pending_accounting'", "status: 'pending_accounting',\n        paymentType")

# Add paymentType toggle in UI
ui_toggle = """              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentType('cash')}
                  className={`flex-1 py-2 rounded-lg font-bold transition ${paymentType === 'cash' ? 'bg-green-100 text-green-700 ring-2 ring-green-500' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                >
                  نەقد
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentType('debt')}
                  className={`flex-1 py-2 rounded-lg font-bold transition ${paymentType === 'debt' ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-500' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                >
                  قەرز
                </button>
              </div>"""

content = content.replace("</datalist>\n              </div>", "</datalist>\n              </div>\n" + ui_toggle)

# When updating/editing, restore paymentType (Optional, but let's default to cash or whatever)

with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(content)

print("patched CashvanSalesView")
