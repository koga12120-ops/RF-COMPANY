import React, { useState, useEffect, useRef } from 'react';
import { Role } from '../types';
import { 
  Package, 
  Calculator, 
  Users, 
  CreditCard, 
  Banknote, 
  CheckCircle, 
  ShoppingCart,
  LogOut,
  Menu,
  X,
  Store,
  History
} from 'lucide-react';
import InventoryView from './views/InventoryView';
import LedgerView from './views/LedgerView';
import RepsView from './views/RepsView';
import DebtsView from './views/DebtsView';
import CashView from './views/CashView';
import OrdersView from './views/OrdersView';
import MarketsGroupView from './views/MarketsGroupView';
import CompaniesGroupView from './views/CompaniesGroupView';
import { Building2 } from 'lucide-react';
import CashvanSalesView from './views/CashvanSalesView';
import WarehouseCashvanView from './views/WarehouseCashvanView';
import AdminCashvanView from './views/AdminCashvanView';
import ReturnsView from './views/ReturnsView';
import RepScheduleView from './views/RepScheduleView';
import { Truck, Undo2 } from 'lucide-react';

import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import StockHistoryView from './views/StockHistoryView';

interface DashboardProps {
  role: Role;
  onLogout: () => void;
}

export default function Dashboard({ role, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const prevCountRef = useRef(0);

  useEffect(() => {
    if (role !== 'admin' && role !== 'warehouse') return;
    const q = query(collection(db, 'orders'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const count = snapshot.size;
      setPendingOrdersCount(count);
      
      if (count > prevCountRef.current) {
        // Play notification sound
        try {
          const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
          audio.play().catch(e => console.log('Audio play prevented by browser'));
        } catch(e) {}
      }
      prevCountRef.current = count;
    });
    return () => unsubscribe();
  }, [role]);

  const adminMenu = [
    { id: 'inventory', label: 'داخڵکردن و کۆگا', icon: Package },
    { id: 'stock_history', label: 'مێژووی هاتنی کاڵا', icon: History },
    { id: 'returns', label: 'گەڕاوەی کاڵا', icon: Undo2 },
    { id: 'orders', label: 'تەسفییەی پێشەکی مەندووب', icon: ShoppingCart },
    { id: 'admin_cashvan', label: 'کاشڤان', icon: Truck },
    { id: 'companies_group', label: 'کۆمپانیا و حیسابات', icon: Building2 },
    { id: 'markets_group', label: 'مارکێت و حیسابات', icon: Store },
    { id: 'ledger', label: 'دەفتەری حیسابات', icon: Calculator },
    { id: 'reps', label: 'لیستی مەندووبەکان', icon: Users },
  ];

  const warehouseMenu = [
    { id: 'inventory', label: 'داخڵکردن و کۆگا', icon: Package },
    { id: 'stock_history', label: 'مێژووی هاتنی کاڵا', icon: History },
    { id: 'returns', label: 'گەڕاوەی کاڵا', icon: Undo2 },
    { id: 'orders', label: 'ئۆردەرەکانی پێشەکی', icon: ShoppingCart },
    { id: 'warehouse_cashvan', label: 'پێدان بە مەندووب (بۆ نەقدە)', icon: Truck },
  ];

  const repMenu = [
    { id: 'orders', label: 'ئۆردەری پێشەکی (قەرز/نەقد)', icon: ShoppingCart },
    { id: 'cashvan_sales', label: 'فرۆشتنی نەقدی ڕاستەوخۆ', icon: Truck },
    { id: 'rep_schedule', label: 'خشتەی سەردانەکان', icon: Store },
  ];

  const menu = role === 'admin' ? adminMenu : role === 'warehouse' ? warehouseMenu : repMenu;

  // Initialize active tab if empty
  if (!activeTab && menu.length > 0) {
    setActiveTab(menu[0].id);
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'inventory': return <InventoryView role={role} />;
      case 'admin_cashvan': return <AdminCashvanView />;
      case 'warehouse_cashvan': return <WarehouseCashvanView />;
      case 'cashvan_sales': return <CashvanSalesView />;
      case 'rep_schedule': return <RepScheduleView />;
      case 'stock_history': return <StockHistoryView />;
      case 'companies_group': return <CompaniesGroupView />;
      case 'markets_group': return <MarketsGroupView />;
      case 'ledger': return <LedgerView />;
      case 'returns': return <ReturnsView role={role} />;
      case 'reps': return <RepsView />;
      case 'debts': return <DebtsView />;
      case 'cash': return <CashView />;
      case 'orders': return <OrdersView role={role} />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] text-[#1E293B] font-sans overflow-hidden">
      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-20 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Desktop Header */}
      <header className="hidden lg:flex h-16 bg-white border-b border-slate-200 items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-200">
            <img src="/LOGO1.jpg" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">کۆمپانیای RF</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
              {role === 'admin' ? 'بەڕێوەبەر' : role === 'warehouse' ? 'بەشی کۆگا' : 'مەندووب'}
            </span>
            <span className="text-sm font-medium">{menu.find(m => m.id === activeTab)?.label}</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center text-slate-500">
            <Users size={20} />
          </div>
        </div>
      </header>

      {/* Mobile header */}
      <header className="lg:hidden bg-white shadow-sm border-b px-4 py-3 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-slate-200">
            <img src="/LOGO1.jpg" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <h2 className="font-semibold text-slate-800 text-lg">
            {menu.find(m => m.id === activeTab)?.label}
          </h2>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 -mr-2 text-slate-600 hover:bg-slate-100 rounded-lg"
        >
          <Menu size={24} />
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className={`
          fixed lg:static inset-y-0 right-0 z-30 w-64 bg-white border-l border-slate-200 flex flex-col p-4 gap-2 transition-transform duration-300
          ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        `}>
          <div className="lg:hidden p-2 mb-2 border-b border-slate-100 flex justify-between items-center">
             <div className="flex items-center gap-2">
               <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-slate-200">
                 <img src="/LOGO1.jpg" alt="Logo" className="w-full h-full object-cover" />
               </div>
               <h1 className="font-bold text-slate-800">کۆمپانیای RF</h1>
             </div>
             <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-500"><X size={20}/></button>
          </div>

          <div className="bg-indigo-50 text-indigo-700 p-3 rounded-xl flex items-center gap-3 font-semibold mb-2">
            <span className="w-2 h-2 bg-indigo-600 rounded-full"></span> داشبۆرد
          </div>
          
          <nav className="flex flex-col gap-1 overflow-y-auto">
            {menu.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`
                    w-full flex items-center justify-between p-3 rounded-lg transition-colors
                    ${isActive ? 'bg-slate-50 text-indigo-600 font-medium border border-slate-100' : 'text-slate-600 hover:bg-slate-50'}
                  `}
                >
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <Icon size={20} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
                    <span>{item.label}</span>
                  </div>
                  {item.id === 'orders' && pendingOrdersCount > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {pendingOrdersCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto flex flex-col gap-2">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-xs text-slate-500 mb-1">سێرڤەری فایەربەیس</p>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-xs font-bold text-slate-700">پەیوەستە</span>
              </div>
            </div>
            
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 p-3 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors font-medium"
            >
              <LogOut size={18} />
              <span>چوونەدەرەوە</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
