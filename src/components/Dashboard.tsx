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
  History,
  Lock,
  Unlock,
  KeyRound,
  ShieldAlert
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
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import StockHistoryView from './views/StockHistoryView';

interface DashboardProps {
  role: Role;
  onLogout: () => void;
}

export default function Dashboard({ role, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'sepia'>(() => {
    return (localStorage.getItem('app-theme') as any) || 'light';
  });
  const [isAdminLocked, setIsAdminLocked] = useState<boolean>(() => {
    return sessionStorage.getItem('admin_system_locked') === 'true';
  });
  const [unlockCode, setUnlockCode] = useState('');
  const [lockError, setLockError] = useState('');

  const normalizeDigits = (str: string) => {
    const kurdishDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return str
      .replace(/[٠-٩]/g, d => kurdishDigits.indexOf(d).toString())
      .replace(/[۰-۹]/g, d => persianDigits.indexOf(d).toString())
      .trim();
  };

  const handleUnlock = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = normalizeDigits(unlockCode);
    if (cleanCode === '969899') {
      setIsAdminLocked(false);
      sessionStorage.removeItem('admin_system_locked');
      setUnlockCode('');
      setLockError('');
    } else {
      setLockError('کۆدی قوفڵکردن هەڵەیە، تکایە دووبارە هەوڵبدەرەوە');
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark', 'theme-sepia');
    root.classList.add(`theme-${theme}`);
    localStorage.setItem('app-theme', theme);
  }, [theme]);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const prevCountRef = useRef(0);

  useEffect(() => {
    if (role !== 'admin' && role !== 'warehouse') return;
    const q = query(collection(db, 'orders'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
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
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'orders');
      }
    );
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
    { id: 'orders', label: 'تەڵەبیە', icon: ShoppingCart },
    { id: 'cashvan_sales', label: 'کاشڤان', icon: Truck },
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

      {/* For Admin and Warehouse: Desktop Header */}
      {role !== 'sales_rep' && (
        <header className="hidden lg:flex h-16 bg-white border-b border-slate-200 items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-200 bg-white">
              <img src="/LOGO1.jpg" alt="Logo" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display = 'none'} />
            </div>
            <h1 className="text-xl font-bold text-slate-800">کۆمپانیای RF</h1>
          </div>
          <div className="flex items-center gap-4">
            {/* Theme Switcher */}
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-full border border-slate-200 mr-4">
              <button 
                onClick={() => setTheme('light')} 
                className={`w-6 h-6 rounded-full border-2 ${theme === 'light' ? 'border-indigo-500 scale-110 shadow-sm' : 'border-transparent'} bg-white`}
                title="سپی"
              />
              <button 
                onClick={() => setTheme('dark')} 
                className={`w-6 h-6 rounded-full border-2 ${theme === 'dark' ? 'border-indigo-500 scale-110 shadow-sm' : 'border-transparent'} bg-slate-800`}
                title="ڕەش"
              />
              <button 
                onClick={() => setTheme('sepia')} 
                className={`w-6 h-6 rounded-full border-2 ${theme === 'sepia' ? 'border-indigo-500 scale-110 shadow-sm' : 'border-transparent'} bg-[#fef3c7]`}
                title="زەردباو"
              />
            </div>

            {/* Lock Button for Admin */}
            {role === 'admin' && (
              <button
                onClick={() => {
                  setIsAdminLocked(true);
                  sessionStorage.setItem('admin_system_locked', 'true');
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 rounded-xl transition-all border border-slate-200 shadow-2xs text-xs font-bold active:scale-95"
                title="قوفڵکردنی سیستەمی بەڕێوەبەر"
              >
                <Lock size={15} className="text-slate-600 group-hover:text-rose-600" />
                <span className="text-[11px]">قوفڵ</span>
              </button>
            )}

            <div className="flex flex-col items-end">
              <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                {role === 'admin' ? 'بەڕێوەبەر' : 'بەشی کۆگا'}
              </span>
              <span className="text-sm font-medium">{menu.find(m => m.id === activeTab)?.label}</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center text-slate-500">
              <Users size={20} />
            </div>
          </div>
        </header>
      )}

      {/* For Admin and Warehouse: Mobile header */}
      {role !== 'sales_rep' && (
        <header className="lg:hidden bg-white shadow-sm border-b px-4 py-3 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-slate-200 bg-white">
              <img src="/LOGO1.jpg" alt="Logo" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display = 'none'} />
            </div>
            <h2 className="font-semibold text-slate-800 text-lg">
              {menu.find(m => m.id === activeTab)?.label}
            </h2>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Theme Switcher (Mobile) */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-full border border-slate-200">
              <button 
                onClick={() => setTheme('light')} 
                className={`w-5 h-5 rounded-full border-2 ${theme === 'light' ? 'border-indigo-500 scale-110 shadow-sm' : 'border-transparent'} bg-white`}
              />
              <button 
                onClick={() => setTheme('dark')} 
                className={`w-5 h-5 rounded-full border-2 ${theme === 'dark' ? 'border-indigo-500 scale-110 shadow-sm' : 'border-transparent'} bg-slate-800`}
              />
              <button 
                onClick={() => setTheme('sepia')} 
                className={`w-5 h-5 rounded-full border-2 ${theme === 'sepia' ? 'border-indigo-500 scale-110 shadow-sm' : 'border-transparent'} bg-[#fef3c7]`}
              />
            </div>

            {/* Lock Button for Admin on Mobile */}
            {role === 'admin' && (
              <button
                onClick={() => {
                  setIsAdminLocked(true);
                  sessionStorage.setItem('admin_system_locked', 'true');
                }}
                className="p-2 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 rounded-lg border border-slate-200 active:scale-95 transition"
                title="قوفڵکردنی سیستەم"
              >
                <Lock size={17} />
              </button>
            )}

            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -mr-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <Menu size={24} />
            </button>
          </div>
        </header>
      )}

      {/* For Sales Rep and Cashvan: Dedicated Top Button Navigation Bar (No Menu/Drawer needed!) */}
      {role === 'sales_rep' && (
        <header className="bg-white border-b border-slate-200 px-4 py-3 shrink-0 z-20 shadow-2xs">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            {/* Logo & Info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 border border-slate-200 bg-white">
                  <img src="/LOGO1.jpg" alt="Logo" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display = 'none'} />
                </div>
                <div>
                  <h1 className="text-sm font-black text-slate-800 leading-tight">کۆمپانیای RF</h1>
                  <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                    سیستەمی مەندووب و کاشڤان
                  </span>
                </div>
              </div>

              {/* Theme & Logout on Mobile */}
              <div className="flex md:hidden items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full border border-slate-200">
                  <button onClick={() => setTheme('light')} className={`w-4 h-4 rounded-full ${theme === 'light' ? 'ring-2 ring-indigo-500' : ''} bg-white`} />
                  <button onClick={() => setTheme('dark')} className={`w-4 h-4 rounded-full ${theme === 'dark' ? 'ring-2 ring-indigo-500' : ''} bg-slate-800`} />
                  <button onClick={() => setTheme('sepia')} className={`w-4 h-4 rounded-full ${theme === 'sepia' ? 'ring-2 ring-indigo-500' : ''} bg-[#fef3c7]`} />
                </div>
                <button
                  onClick={onLogout}
                  className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-xs font-bold flex items-center gap-1"
                  title="چوونەدەرەوە"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>

            {/* BUTTON TABS (وەک دوگمە نەوەک مینو) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              {repMenu.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`
                      flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap
                      ${isActive 
                        ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300 scale-[1.02]' 
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 border border-slate-200'}
                    `}
                  >
                    <Icon size={16} className={isActive ? 'text-white' : 'text-slate-600'} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-full border border-slate-200">
                <button onClick={() => setTheme('light')} className={`w-5 h-5 rounded-full border-2 ${theme === 'light' ? 'border-indigo-500 scale-110 shadow-sm' : 'border-transparent'} bg-white`} title="سپی" />
                <button onClick={() => setTheme('dark')} className={`w-5 h-5 rounded-full border-2 ${theme === 'dark' ? 'border-indigo-500 scale-110 shadow-sm' : 'border-transparent'} bg-slate-800`} title="ڕەش" />
                <button onClick={() => setTheme('sepia')} className={`w-5 h-5 rounded-full border-2 ${theme === 'sepia' ? 'border-indigo-500 scale-110 shadow-sm' : 'border-transparent'} bg-[#fef3c7]`} title="زەردباو" />
              </div>

              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition"
              >
                <LogOut size={16} />
                <span>چوونەدەرەوە</span>
              </button>
            </div>
          </div>
        </header>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar (Only for Admin & Warehouse) */}
        {role !== 'sales_rep' && (
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
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {renderContent()}
        </main>
      </div>

      {/* Admin Lock Screen Overlay */}
      {role === 'admin' && isAdminLocked && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner ring-4 ring-rose-100/50">
              <Lock size={28} />
            </div>
            
            <h2 className="text-lg font-black text-slate-800 mb-1">سیستەمی بەڕێوەبەر قوفڵ دراوە</h2>
            <p className="text-xs text-slate-500 mb-5">تکایە کۆدی ئەمنی بنووسە بۆ کردنەوەی سیستەم</p>
            
            <form onSubmit={handleUnlock} className="space-y-3.5">
              <div>
                <div className="relative">
                  <input
                    type="password"
                    value={unlockCode}
                    onChange={(e) => {
                      setUnlockCode(e.target.value);
                      setLockError('');
                    }}
                    placeholder="کۆدی ٦ ژمارەیی..."
                    autoFocus
                    className="w-full text-center text-xl tracking-widest font-mono py-2.5 px-4 bg-slate-50 border-2 border-slate-200 focus:border-indigo-600 rounded-xl outline-hidden font-bold transition text-slate-800 placeholder:text-slate-300 placeholder:text-sm placeholder:tracking-normal"
                  />
                  <KeyRound className="absolute right-3.5 top-3 text-slate-400" size={18} />
                </div>
                {lockError && (
                  <p className="text-xs font-bold text-rose-600 mt-2 bg-rose-50 p-2 rounded-xl border border-rose-100">
                    {lockError}
                  </p>
                )}
              </div>

              {/* Number Keypad for touch and click */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((btn) => (
                  <button
                    key={btn}
                    type="button"
                    onClick={() => {
                      if (btn === 'C') {
                        setUnlockCode('');
                        setLockError('');
                      } else if (btn === '⌫') {
                        setUnlockCode(prev => prev.slice(0, -1));
                        setLockError('');
                      } else {
                        setUnlockCode(prev => prev + btn);
                        setLockError('');
                      }
                    }}
                    className="py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-mono font-bold text-base rounded-xl transition active:scale-95 shadow-2xs"
                  >
                    {btn}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-bold text-xs transition shadow-sm flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
              >
                <Unlock size={16} />
                <span>کردنەوەی سیستەم</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
