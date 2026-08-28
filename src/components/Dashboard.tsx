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
  ShieldAlert,
  FileText,
  Send,
  Home,
  ArrowRight,
  Sparkles,
  ChevronLeft
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
import WarehouseOrdersView from './views/WarehouseOrdersView';
import AdminCashvanView from './views/AdminCashvanView';
import ReturnsView from './views/ReturnsView';
import RepScheduleView from './views/RepScheduleView';
import AdminScheduleView from './views/AdminScheduleView';
import { Truck, Undo2, ClipboardList, Calendar } from 'lucide-react';

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
    
    let ordersCount = 0;
    let reqsCount = 0;

    const updateTotals = () => {
      const total = ordersCount + reqsCount;
      setPendingOrdersCount(total);
      if (total > prevCountRef.current) {
        // Play notification sound
        try {
          const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
          audio.play().catch(e => console.log('Audio play prevented by browser'));
        } catch(e) {}
      }
      prevCountRef.current = total;
    };

    const qOrders = query(collection(db, 'orders'), where('status', '==', 'pending'));
    const unsubOrders = onSnapshot(
      qOrders,
      (snapshot) => {
        ordersCount = snapshot.size;
        updateTotals();
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'orders');
      }
    );

    const qReqs = query(collection(db, 'cashvan_requisitions'), where('status', '==', 'pending'));
    const unsubReqs = onSnapshot(
      qReqs,
      (snapshot) => {
        reqsCount = snapshot.size;
        updateTotals();
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'cashvan_requisitions');
      }
    );

    return () => {
      unsubOrders();
      unsubReqs();
    };
  }, [role]);

  const adminMenu = [
    { id: 'inventory', label: 'داخڵکردن و کۆگا', icon: Package },
    { id: 'stock_history', label: 'مێژووی هاتنی کاڵا', icon: History },
    { id: 'returns', label: 'گەڕاوەی کاڵا', icon: Undo2 },
    { id: 'admin_cashvan', label: 'حساباتی مەندووب و کاشڤان', icon: Truck },
    { id: 'companies_group', label: 'کۆمپانیا و حیسابات', icon: Building2 },
    { id: 'markets_group', label: 'مارکێت و حیسابات', icon: Store },
    { id: 'ledger', label: 'دەفتەری حیسابات', icon: Calculator },
    { id: 'reps', label: 'لیستی مەندووبەکان', icon: Users },
  ];

  const warehouseMenu = [
    { id: 'inventory', label: 'داخڵکردن و کۆگا', icon: Package },
    { id: 'stock_history', label: 'مێژووی هاتنی کاڵا', icon: History },
    { id: 'returns', label: 'گەڕاوەی کاڵا', icon: Undo2 },
    { id: 'warehouse_orders', label: 'داواکارییەکان', icon: ClipboardList },
    { id: 'admin_schedule', label: 'خشتەی سەردانی مارکێت', icon: Calendar },
  ];

  const repMenu = [
    { id: 'rep_sales', label: 'فرۆشتن', icon: Store, desc: 'خشتەی هەفتانە و سەردانی مارکێتەکان' },
    { id: 'rep_sales_info', label: 'زانیاری لەسەر فرۆشەکان', icon: FileText, desc: 'کۆی فرۆش بە کارتۆن و پارە' },
    { id: 'rep_cashvan_preorder', label: 'تەڵەبیەی پێشوەختەی کاشڤان', icon: Send, desc: 'داواکاری لە کۆگای سەرەکی' },
  ];

  const menu = role === 'admin' ? adminMenu : role === 'warehouse' ? warehouseMenu : repMenu;

  const isStaffRep = role === 'sales_rep' || role === 'cashvan';
  const isAdminOrWarehouse = role === 'admin' || role === 'warehouse';

  // Initialize active tab if empty or obsolete (For admin and warehouse, default to first tab; For sales_rep and cashvan, keep empty so they land on the 3-button board)
  if (!activeTab && menu.length > 0 && isAdminOrWarehouse) {
    setActiveTab(menu[0].id);
  } else if (isStaffRep && (activeTab === 'orders' || activeTab === 'cashvan_sales')) {
    setActiveTab(activeTab === 'cashvan_sales' ? 'rep_cashvan_preorder' : 'rep_sales');
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'inventory': return <InventoryView role={role} />;
      case 'admin_cashvan': return <AdminCashvanView />;
      case 'warehouse_orders': return <WarehouseOrdersView />;
      case 'warehouse_cashvan': return <WarehouseOrdersView />;
      case 'admin_schedule':
      case 'schedule': return <AdminScheduleView />;
      case 'cashvan_sales': return <CashvanSalesView onlyPreorder={isStaffRep} />;
      case 'rep_schedule': return <RepScheduleView />;
      case 'stock_history': return <StockHistoryView />;
      case 'companies_group': return <CompaniesGroupView />;
      case 'markets_group': return <MarketsGroupView />;
      case 'ledger': return <LedgerView />;
      case 'returns': return <ReturnsView role={role} />;
      case 'reps': return <RepsView />;
      case 'debts': return <DebtsView />;
      case 'cash': return <CashView />;
      case 'orders': return <OrdersView role={role} initialTab="schedule" />;
      case 'rep_sales': return <OrdersView role={role} initialTab="schedule" onTabChange={(tab) => {
        if (tab === 'info') setActiveTab('rep_sales_info');
      }} />;
      case 'rep_sales_info': return <OrdersView role={role} initialTab="info" onTabChange={(tab) => {
        if (tab === 'schedule') setActiveTab('rep_sales');
      }} />;
      case 'rep_cashvan_preorder': return <CashvanSalesView onlyPreorder={true} />;
      default: {
        if (isStaffRep) {
          return (
            <div className="max-w-5xl mx-auto py-4 sm:py-8 px-3 sm:px-6">
              {/* 3 Main Action Cards - Large, prominent and beautiful on all devices including iOS/Mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                {/* 1. فرۆشتن */}
                <button
                  type="button"
                  onClick={() => setActiveTab('rep_sales')}
                  className="group bg-white hover:bg-indigo-50/70 p-6 sm:p-8 rounded-3xl border-2 border-slate-200 hover:border-indigo-500 shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col justify-between items-stretch gap-5 active:scale-[0.98] text-right"
                >
                  <div className="flex flex-col items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                      <Store size={30} />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                        فرۆشتن
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
                        خشتەی هەفتانەی سەردان، فرۆشی کاشڤان و قەرز
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-indigo-600 font-bold text-xs sm:text-sm">
                    <span>چوونە ناو فرۆشتن</span>
                    <div className="p-2 bg-indigo-50 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition">
                      <ChevronLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </button>

                {/* 2. زانیاری لەسەر فرۆشەکان */}
                <button
                  type="button"
                  onClick={() => setActiveTab('rep_sales_info')}
                  className="group bg-white hover:bg-emerald-50/70 p-6 sm:p-8 rounded-3xl border-2 border-slate-200 hover:border-emerald-500 shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col justify-between items-stretch gap-5 active:scale-[0.98] text-right"
                >
                  <div className="flex flex-col items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                      <FileText size={30} />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-black text-slate-900 group-hover:text-emerald-600 transition-colors">
                        زانیاری لەسەر فرۆشەکان
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
                        کۆی فرۆش بە کارتۆن و بڕی فرۆشتن بە پارە
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-emerald-600 font-bold text-xs sm:text-sm">
                    <span>بینینی ڕاپۆرت و ئامار</span>
                    <div className="p-2 bg-emerald-50 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition">
                      <ChevronLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </button>

                {/* 3. تەڵەبیەی پێشوەختەی کاشڤان */}
                <button
                  type="button"
                  onClick={() => setActiveTab('rep_cashvan_preorder')}
                  className="group bg-white hover:bg-amber-50/70 p-6 sm:p-8 rounded-3xl border-2 border-slate-200 hover:border-amber-500 shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col justify-between items-stretch gap-5 active:scale-[0.98] text-right"
                >
                  <div className="flex flex-col items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                      <Send size={30} />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-black text-slate-900 group-hover:text-amber-600 transition-colors">
                        تەڵەبیەی پێشوەختەی کاشڤان
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
                        داواکردنی پێشوەختەی کاڵا لە کۆگای سەرەکی
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-amber-600 font-bold text-xs sm:text-sm">
                    <span>داواکردن بۆ ناو ڤان</span>
                    <div className="p-2 bg-amber-50 rounded-xl group-hover:bg-amber-600 group-hover:text-white transition">
                      <ChevronLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </button>
              </div>
            </div>
          );
        }
        return null;
      }
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
      {isAdminOrWarehouse && (
        <header className="hidden lg:flex h-16 bg-white border-b border-slate-200 items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-200 bg-white">
              <img src="/LOGO1.jpg" alt="Logo" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display = 'none'} />
            </div>
            <h1 className="text-xl font-bold text-slate-800">کۆمپانیای RF</h1>
          </div>
          <div className="flex items-center gap-4">
            {/* Theme Switcher */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-full border border-slate-200 mr-4">
              <button 
                onClick={() => setTheme('light')} 
                className={`w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center ${theme === 'light' ? 'border-indigo-600 scale-110 shadow-sm ring-2 ring-indigo-200' : 'border-transparent opacity-70 hover:opacity-100'} bg-white text-slate-800`}
                title="سپی / ڕووناک"
              >
                <span className="text-[10px]">☀️</span>
              </button>
              <button 
                onClick={() => setTheme('dark')} 
                className={`w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center ${theme === 'dark' ? 'border-indigo-600 scale-110 shadow-sm ring-2 ring-indigo-200' : 'border-transparent opacity-70 hover:opacity-100'} bg-slate-900 text-yellow-300`}
                title="ڕەش / تاریک"
              >
                <span className="text-[10px]">🌙</span>
              </button>
              <button 
                onClick={() => setTheme('sepia')} 
                className={`w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center ${theme === 'sepia' ? 'border-indigo-600 scale-110 shadow-sm ring-2 ring-indigo-200' : 'border-transparent opacity-70 hover:opacity-100'} bg-[#fef3c7] text-amber-900`}
                title="زەردباو (Sepia)"
              >
                <span className="text-[10px]">📜</span>
              </button>
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
      {isAdminOrWarehouse && (
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
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full border border-slate-200">
              <button 
                onClick={() => setTheme('light')} 
                className={`w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center ${theme === 'light' ? 'border-indigo-600 scale-110 shadow-sm ring-1 ring-indigo-200' : 'border-transparent opacity-70'} bg-white text-slate-800`}
                title="سپی"
              >
                <span className="text-[9px]">☀️</span>
              </button>
              <button 
                onClick={() => setTheme('dark')} 
                className={`w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center ${theme === 'dark' ? 'border-indigo-600 scale-110 shadow-sm ring-1 ring-indigo-200' : 'border-transparent opacity-70'} bg-slate-900 text-yellow-300`}
                title="ڕەش"
              >
                <span className="text-[9px]">🌙</span>
              </button>
              <button 
                onClick={() => setTheme('sepia')} 
                className={`w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center ${theme === 'sepia' ? 'border-indigo-600 scale-110 shadow-sm ring-1 ring-indigo-200' : 'border-transparent opacity-70'} bg-[#fef3c7] text-amber-900`}
                title="زەردباو"
              >
                <span className="text-[9px]">📜</span>
              </button>
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
      {isStaffRep && (
        <header className="bg-white border-b border-slate-200 px-4 py-3 shrink-0 z-20 shadow-2xs">
          <div className="max-w-7xl mx-auto flex flex-row items-center justify-between gap-3">
            {/* Logo & Info */}
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

            {/* Header Center / Action Buttons */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Theme Switcher (ڕەش / زەرد / سپی) - هەمیشە بەردەستە */}
              <div className="flex items-center gap-1 sm:gap-1.5 bg-slate-100 p-1 sm:p-1.5 rounded-full border border-slate-200 shadow-2xs" title="گۆڕینی ڕووکاری سیستەم (سپی / تاریک / زەرد)">
                <button 
                  type="button"
                  onClick={() => setTheme('light')} 
                  className={`w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center ${theme === 'light' ? 'border-indigo-600 scale-110 shadow-sm ring-2 ring-indigo-200' : 'border-slate-300 opacity-70 hover:opacity-100'} bg-white text-slate-800`}
                  title="ڕەنگی سپی / ڕووناک"
                >
                  <span className="text-[10px]">☀️</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setTheme('dark')} 
                  className={`w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center ${theme === 'dark' ? 'border-indigo-600 scale-110 shadow-sm ring-2 ring-indigo-200' : 'border-slate-700 opacity-70 hover:opacity-100'} bg-slate-900 text-yellow-300`}
                  title="ڕەنگی ڕەش / تاریک"
                >
                  <span className="text-[10px]">🌙</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setTheme('sepia')} 
                  className={`w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center ${theme === 'sepia' ? 'border-indigo-600 scale-110 shadow-sm ring-2 ring-indigo-200' : 'border-amber-300 opacity-70 hover:opacity-100'} bg-[#fef3c7] text-amber-900`}
                  title="ڕەنگی زەرد (Sepia)"
                >
                  <span className="text-[10px]">📜</span>
                </button>
              </div>

              {activeTab ? (
                <button
                  type="button"
                  onClick={() => setActiveTab('')}
                  className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Home size={15} />
                  <span>پەڕەی سەرەکی</span>
                </button>
              ) : (
                <div className="text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl hidden sm:block">
                  پەڕەی سەرەکی
                </div>
              )}

              {/* Logout */}
              <button
                onClick={onLogout}
                className="px-2.5 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl text-xs font-bold flex items-center gap-1 transition"
                title="چوونەدەرەوە"
              >
                <LogOut size={15} />
                <span className="hidden sm:inline">چوونەدەرەوە</span>
              </button>
            </div>
          </div>
        </header>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar (Only for Admin & Warehouse) */}
        {isAdminOrWarehouse && (
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
                    {(item.id === 'orders' || item.id === 'warehouse_orders') && pendingOrdersCount > 0 && (
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
