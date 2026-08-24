import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, deleteDoc, doc, setDoc, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { SalesRep } from '../../types';
import { 
  Users, 
  KeyRound, 
  ShieldCheck, 
  Edit2, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Save, 
  Mail, 
  Copy, 
  Check,
  Plus,
  Search,
  Sparkles
} from 'lucide-react';
import ConfirmModal from '../common/ConfirmModal';
import { renameRepOrCashvan } from '../../lib/syncHelper';

export default function RepsView() {
  const [reps, setReps] = useState<SalesRep[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Delete modal
  const [deletingItem, setDeletingItem] = useState<{ id: string; name: string; phone?: string; accessCode?: string; totalSales?: number; uid?: string } | null>(null);

  // Edit Rep Info modal
  const [editingItem, setEditingItem] = useState<{ id: string; name: string; phone?: string; uid?: string } | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Add New Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCode, setNewCode] = useState('');
  const [isSavingNew, setIsSavingNew] = useState(false);

  // Manage PIN Code modal
  const [codeModalItem, setCodeModalItem] = useState<{ id: string; name: string; phone?: string; email?: string; accessCode?: string; uid?: string } | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [isProcessingCode, setIsProcessingCode] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => {
    const qReps = query(collection(db, 'reps'));
    const unsubReps = onSnapshot(
      qReps,
      (snapshot) => {
        const repsData: SalesRep[] = [];
        snapshot.forEach((docSnap) => {
          repsData.push({ id: docSnap.id, ...docSnap.data() } as SalesRep);
        });
        repsData.sort((a, b) => {
          if (!a.accessCode && b.accessCode) return -1;
          if (a.accessCode && !b.accessCode) return 1;
          return (a.name || '').localeCompare(b.name || '');
        });
        setReps(repsData);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'reps');
      }
    );

    return () => {
      unsubReps();
    };
  }, []);

  const generateRandomPin = () => {
    const randomCode = Math.floor(10000 + Math.random() * 90000).toString();
    setInputCode(randomCode);
  };

  const handleOpenCodeModal = (item: any) => {
    setCodeModalItem({ ...item });
    setInputCode(item.accessCode || '');
  };

  const handleSavePinCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeModalItem) return;
    if (!inputCode || inputCode.length !== 5) {
      alert('تکایە کۆدێکی دروستی ٥ ژمارەیی بنووسە');
      return;
    }

    setIsProcessingCode(true);
    try {
      const trimmedCode = inputCode.trim();

      // 1. Update in reps collection
      await setDoc(doc(db, 'reps', codeModalItem.id), {
        accessCode: trimmedCode,
        status: 'active'
      }, { merge: true });

      // 2. Set or update credentials in users collection
      const userUid = codeModalItem.uid || codeModalItem.id;
      await setDoc(doc(db, 'users', userUid), {
        role: 'sales_rep',
        accessCode: trimmedCode,
        status: 'active',
        name: codeModalItem.name,
        phone: codeModalItem.phone || '',
        updatedAt: Date.now()
      }, { merge: true });

      showToast(`کۆدی چوونەژوورەوە بۆ مەندووب (${codeModalItem.name}) بە سەرکەوتوویی جێگیر کرا: [${trimmedCode}]`);
      setCodeModalItem(null);
    } catch (error) {
      console.error('Error setting PIN code:', error);
      alert('هەڵەیەک ڕوویدا لە کاتی پاشەکەوتکردنی کۆدی ئەمنی');
    } finally {
      setIsProcessingCode(false);
    }
  };

  const handleEditInfo = (item: any) => {
    setEditingItem(item);
    setEditName(item.name || '');
    setEditPhone(item.phone || '');
  };

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editName.trim()) return;

    setIsSavingEdit(true);
    try {
      const oldName = editingItem.name;
      const newNameTrimmed = editName.trim();
      const newPhoneTrimmed = editPhone.trim();

      // 1. Sync name globally across all system records if name was modified
      if (oldName !== newNameTrimmed) {
        await renameRepOrCashvan(oldName, newNameTrimmed, { isRep: true, entityId: editingItem.id, phone: newPhoneTrimmed });
      }

      // 2. Update rep doc
      await setDoc(doc(db, 'reps', editingItem.id), {
        name: newNameTrimmed,
        phone: newPhoneTrimmed
      }, { merge: true });

      // 3. Update user doc if exists
      const userUid = editingItem.uid || editingItem.id;
      if (userUid) {
        await setDoc(doc(db, 'users', userUid), {
          name: newNameTrimmed,
          phone: newPhoneTrimmed
        }, { merge: true });
      }

      showToast(`زانیارییەکانی مەندووب (${newNameTrimmed}) لە سەرانسەری سیستەمدا نوێکرایەوە.`);
      setEditingItem(null);
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە کاتی پاشەکەوتکردنی زانیاری');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleAddNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsSavingNew(true);
    try {
      const trimmedN = newName.trim();
      const trimmedP = newPhone.trim();
      const trimmedC = newCode.trim();

      // Create in collection
      const docRef = await addDoc(collection(db, 'reps'), {
        name: trimmedN,
        phone: trimmedP,
        accessCode: trimmedC || null,
        status: trimmedC ? 'active' : 'pending',
        totalSales: 0,
        totalProfit: 0,
        createdAt: Date.now()
      });

      // If code was entered, create user record as well
      if (trimmedC) {
        await setDoc(doc(db, 'users', docRef.id), {
          role: 'sales_rep',
          accessCode: trimmedC,
          status: 'active',
          name: trimmedN,
          phone: trimmedP,
          isDeleted: false
        }, { merge: true });
      }

      showToast(`مەندووب (${trimmedN}) بە سەرکەوتوویی زیادکرا.`);
      setShowAddModal(false);
      setNewName('');
      setNewPhone('');
      setNewCode('');
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە کاتی زیادکردن');
    } finally {
      setIsSavingNew(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingItem) return;
    try {
      const itemUid = deletingItem.uid || deletingItem.id;

      // 1. Remove from collection
      await deleteDoc(doc(db, 'reps', deletingItem.id));

      // 2. Disable user access
      if (itemUid) {
        await setDoc(doc(db, 'users', itemUid), {
          role: null,
          status: 'banned',
          accessCode: '',
          isDeleted: true,
          bannedAt: Date.now()
        }, { merge: true });

        // Remove schedule
        try {
          await deleteDoc(doc(db, 'schedules', itemUid));
        } catch (e) {}
      }

      showToast(`مەندووب (${deletingItem.name}) سڕدرایەوە و دەستڕاگەیشتنی بە سیستەم پەک خرا.`);
      setDeletingItem(null);
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە کاتی سڕینەوە');
    }
  };

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredList = reps.filter(item => {
    const nameMatch = (item.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const phoneMatch = (item.phone || '').includes(searchTerm);
    return nameMatch || phoneMatch;
  });

  const activeRepsCount = reps.filter(r => r.accessCode && r.status !== 'disabled').length;
  const pendingRepsCount = reps.filter(r => !r.accessCode || r.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 font-bold text-sm animate-in fade-in slide-in-from-top-4">
          <Sparkles size={18} />
          <span>{notification}</span>
        </div>
      )}

      {/* Header Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Users size={24} />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">کۆی مەندووبەکان</div>
            <div className="text-2xl font-bold text-slate-800 font-mono mt-0.5">{reps.length}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <ShieldCheck size={24} />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">مەندووبی خاوەن کۆد (چالاک)</div>
            <div className="text-2xl font-bold text-emerald-600 font-mono mt-0.5">{activeRepsCount}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <KeyRound size={24} />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">چاوەڕوانی دانانی کۆد</div>
            <div className="text-2xl font-bold text-amber-600 font-mono mt-0.5">{pendingRepsCount}</div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        {/* Top bar with search and add button */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Users size={20} className="text-indigo-600" />
              <span>لیستی مەندووبەکان ({reps.length})</span>
            </h2>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="گەڕان لە مەندووبەکان..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={() => {
                setNewName('');
                setNewPhone('');
                setNewCode('');
                setShowAddModal(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shrink-0 shadow-xs"
            >
              <Plus size={16} />
              <span>زیادکردنی مەندووب</span>
            </button>
          </div>
        </div>

        {/* Global Rename Alert Notification Banner */}
        <div className="bg-indigo-50/60 border-b border-indigo-100 px-4 py-2.5 text-xs text-indigo-900 flex items-center gap-2">
          <Sparkles size={16} className="text-indigo-600 shrink-0" />
          <span>
            <strong>تێبینی سیستەم:</strong> کاتێک ناوی مەندووبێک دەگۆڕیت، ناوەکە ڕاستەوخۆ لای مەندووب، سەرجەم وەسڵ و پسوڵەکان، ئۆردەرەکان، و کۆگا بە شێوەی ئۆتۆماتیک نوێ دەبێتەوە.
          </span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500 font-medium">خەریکی هێنانە...</div>
        ) : (
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">ناوی مەندووب</th>
                  <th className="px-5 py-3.5 font-semibold">تەلەفۆن</th>
                  <th className="px-5 py-3.5 font-semibold">دۆخ</th>
                  <th className="px-5 py-3.5 font-semibold">کۆدی ئەمنی چوونەژوورەوە</th>
                  <th className="px-5 py-3.5 font-semibold">کۆی فرۆش</th>
                  <th className="px-5 py-3.5 font-semibold text-center">کردارەکان</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {filteredList.map(item => {
                  const hasCode = !!item.accessCode;
                  const isPending = !hasCode || item.status === 'pending';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <Users size={16} className="text-indigo-600" />
                          <span>{item.name || 'مەندووبی بێ ناو'}</span>
                        </div>
                        {item.email && (
                          <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-1" dir="ltr">
                            <Mail size={12} /> {item.email}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 text-slate-600 font-mono text-xs" dir="ltr">
                        {item.phone || '-'}
                      </td>

                      <td className="px-5 py-4">
                        {isPending ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 flex items-center gap-1 w-fit">
                            <AlertTriangle size={12} />
                            چاوەڕوانی کۆدە
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 flex items-center gap-1 w-fit">
                            <CheckCircle2 size={12} />
                            چالاکە
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {hasCode ? (
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1.5 bg-slate-900 text-amber-400 font-mono font-bold tracking-widest text-sm rounded-lg shadow-2xs">
                              {item.accessCode}
                            </span>
                            <button
                              onClick={() => handleCopyCode(item.accessCode!, item.id)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                              title="کۆپیکردنی کۆد"
                            >
                              {copiedId === item.id ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleOpenCodeModal(item)}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
                          >
                            <KeyRound size={14} />
                            <span>دانانی کۆد</span>
                          </button>
                        )}
                      </td>

                      <td className="px-5 py-4 text-slate-900 font-bold font-mono" dir="ltr">
                        {(item.totalSales || 0).toLocaleString()} د.ع
                      </td>

                      <td className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenCodeModal(item)}
                            className="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs rounded-lg transition flex items-center gap-1"
                            title="دانان یان گۆڕینی کۆد"
                          >
                            <KeyRound size={14} />
                            <span>{hasCode ? 'گۆڕینی کۆد' : 'دانانی کۆد'}</span>
                          </button>

                          <button
                            onClick={() => handleEditInfo(item)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition"
                            title="گۆڕینی ناو و زانیاری لە هەموو سیستەم"
                          >
                            <Edit2 size={16} />
                          </button>

                          <button
                            onClick={() => setDeletingItem({ ...item })}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="سڕینەوە"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredList.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Users size={32} className="text-slate-300" />
                        <span>هیچ مەندووبێک نەدۆزرایەوە</span>
                        <span className="text-xs text-slate-400">
                          دەتوانیت بە دوگمەی سەرەوە ناوی نوێ زیاد بکەیت.
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add New Rep Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200" dir="rtl">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
              <h3 className="font-bold text-indigo-900 text-base flex items-center gap-2">
                <Plus className="text-indigo-600" size={20} />
                زیادکردنی مەندووبی نوێ
              </h3>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
                disabled={isSavingNew}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddNew} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ناوی مەندووب *</label>
                <input
                  type="text"
                  required
                  placeholder="بۆ نموونە: مەندووب کاروان"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ژمارەی مۆبایل</label>
                <input
                  type="tel"
                  dir="ltr"
                  placeholder="0750 000 0000"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">کۆدی چوونەژوورەوەی ئەمنی (ئارەزوومەندانە - ٥ ژمارە)</label>
                <input
                  type="text"
                  maxLength={5}
                  dir="ltr"
                  placeholder="48291"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono tracking-widest"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isSavingNew || !newName.trim()}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <Save size={18} />
                  <span>{isSavingNew ? 'خەریکی پاشەکەوتکردنە...' : 'پاشەکەوتکردن'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={isSavingNew}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-sm"
                >
                  پاشگەزبوونەوە
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set / Change PIN Code Modal */}
      {codeModalItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200" dir="rtl">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
              <h3 className="font-bold text-indigo-900 text-base flex items-center gap-2">
                <KeyRound className="text-indigo-600" size={20} />
                دانان و گۆڕینی کۆدی ئەمنی مەندووب
              </h3>
              <button 
                onClick={() => setCodeModalItem(null)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
                disabled={isProcessingCode}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePinCode} className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">ناوی مەندووب:</span>
                  <span className="font-bold text-slate-800">{codeModalItem.name}</span>
                </div>
                {codeModalItem.phone && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">مۆبایل:</span>
                    <span className="font-mono text-slate-700" dir="ltr">{codeModalItem.phone}</span>
                  </div>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-sm font-bold text-slate-700">کۆدی چوونەژوورەوەی تایبەت (٥ ژمارە)</label>
                  <button
                    type="button"
                    onClick={generateRandomPin}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 transition"
                  >
                    <RefreshCw size={12} />
                    دروستکردنی کۆدی ئۆتۆماتیک
                  </button>
                </div>

                <input
                  type="text"
                  required
                  maxLength={5}
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  placeholder="48291"
                  className="w-full px-4 py-3 text-center tracking-[0.6em] text-2xl border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono font-bold text-slate-800 bg-white"
                  dir="ltr"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  disabled={isProcessingCode || !inputCode.trim()}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <Save size={18} />
                  <span>{isProcessingCode ? 'خەریکی پاشەکەوتکردنە...' : 'پاشەکەوتکردنی کۆد'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCodeModalItem(null)}
                  disabled={isProcessingCode}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  پاشگەزبوونەوە
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Info Modal with Global Rename */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200" dir="rtl">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
              <h3 className="font-bold text-indigo-900 text-base flex items-center gap-2">
                <Edit2 size={18} className="text-indigo-600" />
                گۆڕینی ناوی مەندووب لە سەرانسەری سیستەم
              </h3>
              <button 
                onClick={() => setEditingItem(null)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
                disabled={isSavingEdit}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveInfo} className="p-6 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 leading-relaxed">
                بە گۆڕینی ئەم ناوە، سیستەمەکە ڕاستەوخۆ ناوەکە لە <strong>سەرجەم وەسڵەکان، ئۆردەرەکان، و حیسابات</strong> نوێ دەکاتەوە.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ناوی نوێ *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-indigo-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-slate-900"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ژمارەی تەلەفۆن</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  dir="ltr"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isSavingEdit || !editName.trim()}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <Save size={18} />
                  <span>{isSavingEdit ? 'خەریکی نوێکردنەوە لە هەموو لایەک...' : 'نوێکردنەوە لە سەرانسەری سیستەم'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  disabled={isSavingEdit}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-sm"
                >
                  پاشگەزبوونەوە
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        onConfirm={confirmDelete}
        title="سڕینەوەی مەندووب"
        message={`ئایا دڵنیایت لە سڕینەوەی (${deletingItem?.name})؟ بە سڕینەوەی، دەستڕاگەیشتنی بە سیستەم ڕادەگیرێت.`}
        itemName={deletingItem?.name}
        details={deletingItem ? [
          { label: 'ژمارەی مۆبایل', value: deletingItem.phone || '-' },
          { label: 'کۆدی ئەمنی', value: deletingItem.accessCode || 'دیاری نەکراوە' },
          { label: 'کۆی فرۆش', value: `${(deletingItem.totalSales || 0).toLocaleString()} د.ع` }
        ] : []}
      />
    </div>
  );
}
