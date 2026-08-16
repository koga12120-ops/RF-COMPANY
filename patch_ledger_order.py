import re

with open('src/components/views/LedgerView.tsx', 'r') as f:
    content = f.read()

# Change total income label
old_cards = """        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-green-100 text-green-600 rounded-full shrink-0">
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="text-sm text-slate-500 mb-1">کۆی داهات</div>
            <div className="text-2xl font-bold text-slate-800" dir="ltr">{totalIncome.toLocaleString()}</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-red-100 text-red-600 rounded-full shrink-0">
            <TrendingDown size={24} />
          </div>
          <div>
            <div className="text-sm text-slate-500 mb-1">کۆی خەرجی</div>
            <div className="text-2xl font-bold text-slate-800" dir="ltr">{totalExpense.toLocaleString()}</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-indigo-100 text-indigo-600 rounded-full shrink-0">
            <DollarSign size={24} />
          </div>
          <div>
            <div className="text-sm text-slate-500 mb-1">قازانجی سافی</div>
            <div className="text-2xl font-bold text-indigo-600" dir="ltr">{netProfit.toLocaleString()}</div>
          </div>
        </div>"""

new_cards = """        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-indigo-100 text-indigo-600 rounded-full shrink-0">
            <DollarSign size={24} />
          </div>
          <div>
            <div className="text-sm text-slate-500 mb-1">قازانجی سافی</div>
            <div className="text-2xl font-bold text-indigo-600" dir="ltr">{netProfit.toLocaleString()}</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-red-100 text-red-600 rounded-full shrink-0">
            <TrendingDown size={24} />
          </div>
          <div>
            <div className="text-sm text-slate-500 mb-1">کۆی خەرجی</div>
            <div className="text-2xl font-bold text-slate-800" dir="ltr">{totalExpense.toLocaleString()}</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-green-100 text-green-600 rounded-full shrink-0">
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="text-sm text-slate-500 mb-1">کۆی فرۆش</div>
            <div className="text-2xl font-bold text-slate-800" dir="ltr">{totalIncome.toLocaleString()}</div>
          </div>
        </div>"""

content = content.replace(old_cards, new_cards)

with open('src/components/views/LedgerView.tsx', 'w') as f:
    f.write(content)

