import React, { useState } from 'react';
import CompaniesView from './CompaniesView';
import DebtsView from './DebtsView';
import CashView from './CashView';
import PaidDebtsView from './PaidDebtsView';

export default function CompaniesGroupView() {
  const [activeSubTab, setActiveSubTab] = useState<'companies' | 'debts' | 'cash' | 'paid'>('companies');

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
      </div>

      <div className="mt-4">
        {activeSubTab === 'companies' && <CompaniesView />}
        {activeSubTab === 'debts' && <DebtsView type="company_debt" targetName="کۆمپانیا" />}
        {activeSubTab === 'cash' && <CashView type="company_cash" targetName="کۆمپانیا" />}
        {activeSubTab === 'paid' && <PaidDebtsView type="company_paid_debt" />}
      </div>
    </div>
  );
}
