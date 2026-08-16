import re

with open('src/components/views/CompaniesGroupView.tsx', 'r') as f:
    content = f.read()

content = content.replace("import CashView from './CashView';", "import CashView from './CashView';\nimport PaidDebtsView from './PaidDebtsView';")

old_tabs = """  const [activeSubTab, setActiveSubTab] = useState<'companies' | 'debts' | 'cash'>('companies');

  return (
    <div className="space-y-4">
      <div className="flex space-x-2 space-x-reverse bg-white p-2 rounded-xl shadow-sm border border-slate-200">
        <button
          onClick={() => setActiveSubTab('companies')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition ${activeSubTab === 'companies' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          کۆمپانیاکان
        </button>
        <button
          onClick={() => setActiveSubTab('debts')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition ${activeSubTab === 'debts' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          قەرزەکان
        </button>
        <button
          onClick={() => setActiveSubTab('cash')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition ${activeSubTab === 'cash' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          نەقدەکان
        </button>
      </div>"""

new_tabs = """  const [activeSubTab, setActiveSubTab] = useState<'companies' | 'debts' | 'cash' | 'paid'>('companies');

  return (
    <div className="space-y-4">
      <div className="flex space-x-2 space-x-reverse bg-white p-2 rounded-xl shadow-sm border border-slate-200">
        <button
          onClick={() => setActiveSubTab('companies')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition ${activeSubTab === 'companies' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          کۆمپانیاکان
        </button>
        <button
          onClick={() => setActiveSubTab('debts')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition ${activeSubTab === 'debts' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          قەرزەکان
        </button>
        <button
          onClick={() => setActiveSubTab('cash')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition ${activeSubTab === 'cash' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          نەقدەکان
        </button>
        <button
          onClick={() => setActiveSubTab('paid')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition ${activeSubTab === 'paid' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          قەرزە دراوەکان
        </button>
      </div>"""
content = content.replace(old_tabs, new_tabs)

old_views = """      <div className="mt-4">
        {activeSubTab === 'companies' && <CompaniesView />}
        {activeSubTab === 'debts' && <DebtsView type="company_debt" targetName="کۆمپانیا" />}
        {activeSubTab === 'cash' && <CashView type="company_cash" targetName="کۆمپانیا" />}
      </div>"""

new_views = """      <div className="mt-4">
        {activeSubTab === 'companies' && <CompaniesView />}
        {activeSubTab === 'debts' && <DebtsView type="company_debt" targetName="کۆمپانیا" />}
        {activeSubTab === 'cash' && <CashView type="company_cash" targetName="کۆمپانیا" />}
        {activeSubTab === 'paid' && <PaidDebtsView type="company_paid_debt" />}
      </div>"""
content = content.replace(old_views, new_views)

with open('src/components/views/CompaniesGroupView.tsx', 'w') as f:
    f.write(content)
