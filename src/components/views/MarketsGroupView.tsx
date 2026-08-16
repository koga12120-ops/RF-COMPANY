import React, { useState } from 'react';
import MarketsView from './MarketsView';
import DebtsView from './DebtsView';
import CashView from './CashView';
import PaidDebtsView from './PaidDebtsView';
import AdminScheduleView from './AdminScheduleView';

export default function MarketsGroupView() {
  const [activeSubTab, setActiveSubTab] = useState<'markets' | 'debts' | 'cash' | 'paid' | 'schedule'>('markets');

  return (
    <div className="space-y-4">
      <div className="flex space-x-2 space-x-reverse bg-white p-2 rounded-xl shadow-sm border border-slate-200">
        <button
          onClick={() => setActiveSubTab('markets')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition ${activeSubTab === 'markets' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          مارکێتەکان
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
        <button
          onClick={() => setActiveSubTab('schedule')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition ${activeSubTab === 'schedule' ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          خشتەی سەردان
        </button>
      </div>

      <div className="mt-4">
        {activeSubTab === 'markets' && <MarketsView />}
        {activeSubTab === 'debts' && <DebtsView />}
        {activeSubTab === 'cash' && <CashView />}
        {activeSubTab === 'paid' && <PaidDebtsView type="paid_debt" />}
        {activeSubTab === 'schedule' && <AdminScheduleView />}
      </div>
    </div>
  );
}
