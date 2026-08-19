import re

def insert_total(file_path, list_name):
    with open(file_path, 'r') as f:
        content = f.read()

    # Find the title tag
    if file_path == 'src/components/views/DebtsView.tsx':
        title_search = r"(<h2 className=\"text-xl font-bold text-slate-800 mb-6\">.*?</h2\>)"
        total_snippet = r"""\1
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex justify-between items-center">
        <span className="font-bold text-slate-700">کۆی گشتی قەرزەکان:</span>
        <span className="text-xl font-bold text-amber-600" dir="ltr">{debts.reduce((acc, curr) => acc + (curr.amount || 0), 0).toLocaleString()} د.ع</span>
      </div>"""
        content = re.sub(title_search, total_snippet, content)
        
    elif file_path == 'src/components/views/PaidDebtsView.tsx':
        title_search = r"(<h2 className=\"text-xl font-bold text-slate-800 mb-6\">.*?</h2\>)"
        total_snippet = r"""\1
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex justify-between items-center">
        <span className="font-bold text-slate-700">کۆی گشتی واسڵکراوەکان:</span>
        <span className="text-xl font-bold text-green-600" dir="ltr">{debts.reduce((acc, curr) => acc + (curr.amount || 0), 0).toLocaleString()} د.ع</span>
      </div>"""
        content = re.sub(title_search, total_snippet, content)
        
    elif file_path == 'src/components/views/CashView.tsx':
        title_search = r"(<h2 className=\"text-xl font-bold text-slate-800 mb-6\">.*?</h2\>)"
        total_snippet = r"""\1
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex justify-between items-center">
        <span className="font-bold text-slate-700">کۆی گشتی نەقدەکان:</span>
        <span className="text-xl font-bold text-indigo-600" dir="ltr">{cash.reduce((acc, curr) => acc + (curr.amount || 0), 0).toLocaleString()} د.ع</span>
      </div>"""
        content = re.sub(title_search, total_snippet, content)

    with open(file_path, 'w') as f:
        f.write(content)

insert_total('src/components/views/DebtsView.tsx', 'debts')
insert_total('src/components/views/PaidDebtsView.tsx', 'debts')
insert_total('src/components/views/CashView.tsx', 'cash')
print("Totals added")
