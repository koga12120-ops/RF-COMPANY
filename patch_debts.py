import re

def patch_view(filename, type_name):
    with open(filename, 'r') as f:
        content = f.read()

    # Add Printer icon
    if 'Printer' not in content:
        content = content.replace("import { Plus, Check, Trash2 }", "import { Plus, Check, Trash2, Printer }")
        content = content.replace("import { Plus, Trash2 }", "import { Plus, Trash2, Printer }")
        content = content.replace("import { Search, Plus, Trash2 }", "import { Search, Plus, Trash2, Printer }")

    # Calculate Total
    # Need to find the header div and add the total.
    # We will search for <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50">
    # or similar and add the total
    
    total_snippet = """<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          {type === 'company_debt' ? 'قەرزی کۆمپانیاکان' : 'قەرزی لای بازاڕ'}
        </h2>
        <div className="bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100">
          <span className="text-sm text-indigo-600 font-bold">کۆی گشتی: </span>
          <span className="text-lg font-bold text-indigo-700" dir="ltr">
            {debts.reduce((acc, curr) => acc + (curr.amount || 0), 0).toLocaleString()} د.ع
          </span>
        </div>
      </div>"""
    
    # Let's write a generic patcher using python
