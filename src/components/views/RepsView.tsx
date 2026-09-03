import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, deleteDoc, doc, setDoc, addDoc, where, getDocs } from 'firebase/firestore';
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
  Sparkles,
  Lock,
  User,
  Power,
  Eye,
  EyeOff
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
  const [editingItem, setEditingItem] = useState<{ id: string; name: string; username?: string; phone?: string; accessCode?: string; password?: string; status?: string } | null>(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'disabled'>('active');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Add New Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isSavingNew, setIsSavingNew] = useState(false);

  // Manage Credentials Modal
  const [codeModalItem, setCodeModalItem] = useState<SalesRep | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [inputUsername, setInputUsername] = useState('');
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

  const generateRandomPin = (setter: (val: string) => void) => {
    const randomCode = Math.floor(10000 + Math.random() * 90000).toString();
    setter(randomCode);
  };

  const handleOpenCodeModal = (item: SalesRep) => {
    setCodeModalItem({ ...item });
    setInputCode(item.accessCode || item.password || '');
    setInputUsername(item.username || item.name || '');
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeModalItem) return;
    if (!inputCode.trim()) {
      alert('تکایە تێپەڕەوشە یان کۆدی چوونەژوورەوە بنووسە');
      return;
    }

    setIsProcessingCode(true);
    try {
      const trimmedCode = inputCode.trim();
      const trimmedU = inputUsername.trim() || codeModalItem.name;
      const now = Date.now();

      // 1. Update in reps collection with forceReauth flag & updated code
      await setDoc(doc(db, 'reps', codeModalItem.id), {
        username: trimmedU,
        accessCode: trimmedCode,
        password: trimmedCode,
        status: 'active',
        forceReauth: true,
        codeUpdatedAt: now
      }, { merge: true });

      // 2. Also sync to users collection
      await setDoc(doc(db, 'users', codeModalItem.id), {
        role: null,
        forceReauth: true,
        username: trimmedU,
        accessCode: trimmedCode,
        status: 'active',
        name: codeModalItem.name,
        phone: codeModalItem.phone || '',
        repId: codeModalItem.id,
        updatedAt: now
      }, { merge: true });

      showToast(`زانیارییەکانی چوونەژوورەوە بۆ مەندووب (${codeModalItem.name}) نوێکرایەوە: یوزەر [${trimmedU}] - تێپەڕەوشە [${trimmedCode}]`);
      setCodeModalItem(null);
    } catch (error) {
      console.error('Error setting credentials:', error);
      alert('هەڵەیەک ڕوویدا لە کاتی پاشەکەوتکردن');
    } finally {
      setIsProcessingCode(false);
    }
  };

  const handleEditInfo = (item: SalesRep) => {
    setEditingItem(item);
    setEditName(item.name || '');
    setEditUsername(item.username || item.name || '');
    setEditPhone(item.phone || '');
    setEditPassword(item.accessCode || item.password || '');
    setEditStatus((item.status as any) || 'active');
  };

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editName.trim()) return;

    setIsSavingEdit(true);
    try {
      const oldName = editingItem.name;
      const newNameTrimmed = editName.trim();
      const newUsernameTrimmed = editUsername.trim() || newNameTrimmed;
      const newPhoneTrimmed = editPhone.trim();
      const newPasswordTrimmed = editPassword.trim();

      // 1. Sync name globally across all system records if name was modified
      if (oldName !== newNameTrimmed) {
        await renameRepOrCashvan(oldName, newNameTrimmed, { isRep: true, entityId: editingItem.id, phone: newPhoneTrimmed });
      }

      // 2. Update rep doc
      const updateData: any = {
        name: newNameTrimmed,
        username: newUsernameTrimmed,
        phone: newPhoneTrimmed,
        status: editStatus,
      };
      if (newPasswordTrimmed) {
        updateData.accessCode = newPasswordTrimmed;
        updateData.password = newPasswordTrimmed;
      }

      await setDoc(doc(db, 'reps', editingItem.id), updateData, { merge: true });

      // 3. Update user doc if exists
      await setDoc(doc(db, 'users', editingItem.id), {
        name: newNameTrimmed,
        username: newUsernameTrimmed,
        phone: newPhoneTrimmed,
        status: editStatus,
        accessCode: newPasswordTrimmed || editingItem.accessCode || '',
      }, { merge: true });

      showToast(`زانیارییەکانی مەندووب (${newNameTrimmed}) لە سەرانسەری سیستەمدا نوێکرایەوە.`);
      setEditingItem(null);
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە کاتی پاشەکەوتکردنی زانیاری');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleToggleStatus = async (item: SalesRep) => {
    const nextStatus = item.status === 'disabled' ? 'active' : 'disabled';
    try {
      await setDoc(doc(db, 'reps', item.id), {
        status: nextStatus,
        forceReauth: nextStatus === 'disabled'
      }, { merge: true });

      await setDoc(doc(db, 'users', item.id), {
        status: nextStatus,
        forceReauth: nextStatus === 'disabled'
      }, { merge: true });

      showToast(`دۆخی مەندووب (${item.name}) گۆڕدرا بۆ: ${nextStatus === 'active' ? 'چالاک' : 'ڕاگیراو'}`);
    } catch (e) {
      console.error(e);
      alert('هەڵەیەک ڕوویدا');
    }
  };

  const handleAddNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsSavingNew(true);
    try {
      const trimmedN = newName.trim();
      const trimmedU = newUsername.trim() || trimmedN;
      const trimmedP = newPhone.trim();
      const trimmedPass = newPassword.trim() || Math.floor(10000 + Math.random() * 90000).toString();

      // Create in collection
      const docRef = await addDoc(collection(db, 'reps'), {
        name: trimmedN,
        username: trimmedU,
        phone: trimmedP,
        accessCode: trimmedPass,
        password: trimmedPass,
        status: 'active',
        totalSales: 0,
        totalProfit: 0,
        createdAt: Date.now()
      });

      // Create in users collection for authentication
      await setDoc(doc(db, 'users', docRef.id), {
        role: 'sales_rep',
        username: trimmedU,
        accessCode: trimmedPass,
        status: 'active',
        name: trimmedN,
        phone: trimmedP,
        repId: docRef.id,
        isDeleted: false
      }, { merge: true });

      showToast(`مەندووب (${trimmedN}) بە یوزەری [${trimmedU}] و تێپەڕەوشەی [${trimmedPass}] دروستکرا.`);
      setShowAddModal(false);
      setNewName('');
      setNewUsername('');
      setNewPhone('');
      setNewPassword('');
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
      // 1. Remove from collection
      await deleteDoc(doc(db, 'reps', deletingItem.id));

      // 2. Disable user access
      await setDoc(doc(db, 'users', deletingItem.id), {
        role: null,
        status: 'banned',
        isDeleted: true
      }, { merge: true });

      showToast(`مەندووب (${deletingItem.name}) سڕدرایەوە.`);
      setDeletingItem(null);
    } catch (error) {
      console.error(error);
      alert('هەڵەیەک ڕوویدا لە کاتی سڕینەوە');
    }
  };

  const handleCopyCredentials = (rep: SalesRep) => {
    const text = `زانیاری چوونەژوورەوە بۆ مەندووب: ${rep.name}\nیوزەرنەیم: ${rep.username || rep.name}\nتێپەڕەوشە: ${rep.accessCode || rep.password || '43629'}`;
    navigator.clipboard.writeText(text);
    setCopiedId(rep.id);
    setTimeout(() => setCopiedId(null), 2000);
    showToast('زانیارییەکانی یوزەر و تێپەڕەوشە کۆپیکرا.');
  };

  const filteredList = reps.filter(item => {
    const nameMatch = (item.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const userMatch = (item.username || '').toLowerCase().includes(searchTerm.toLowerCase());
    const phoneMatch = (item.phone || '').includes(searchTerm);
    return nameMatch || userMatch || phoneMatch;
  });

  const activeRepsCount = reps.filter(r => r.status !== 'disabled').length;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-emerald-400 border border-emerald-500/30 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 font-bold text-xs animate-in fade-in slide-in-from-top-4">
          <Sparkles size={16} className="text-emerald-400" />
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
            <div className="text-xs text-slate-500 font-bold">کۆی مەندووبەکان</div>
            <div className="text-2xl font-bold text-slate-800 font-mono mt-0.5">{reps.length}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <ShieldCheck size={24} />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-bold">هەژماری چالاک</div>
            <div className="text-2xl font-bold text-emerald-600 font-mono mt-0.5">{activeRepsCount}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <KeyRound size={24} />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-bold">سیستەمی چوونەژوورەوە</div>
            <div className="text-xs font-bold text-amber-800 mt-1">یوزەرنەیم و تێپەڕەوشە</div>
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
              <span>بەڕێوەبردنی هەژماری مەندووبەکان ({reps.length})</span>
            </h2>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="گەڕان بەپێی ناو، یوزەر، تەلەفۆن..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            <button
              onClick={() => {
                setNewName('');
                setNewUsername('');
                setNewPhone('');
                setNewPassword(Math.floor(10000 + Math.random() * 90000).toString());
                setShowAddModal(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shrink-0 shadow-sm"
            >
              <Plus size={16} />
              <span>دروستکردنی هەژماری مەندووب</span>
            </button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-indigo-50/70 border-b border-indigo-100 px-4 py-2.5 text-xs text-indigo-900 flex items-center gap-2">
          <ShieldCheck size={16} className="text-indigo-600 shrink-0" />
          <span>
            <strong>تایبەتمەندی نوێ:</strong> مەندووبەکان ڕاستەوخۆ بە <strong>یوزەرنەیم و تێپەڕەوشەکەیان</strong> بەبێ پێویستی بە گۆگڵ دەچنە ژوورەوە. دەتوانیت لەم خشتەیەدا تێپەڕەوشەیان بگۆڕیت یان هەژمارەکەیان ڕابگریت.
          </span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500 font-medium">خەریکی بارکردنە...</div>
        ) : (
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3.5">ناوی مەندووب</th>
                  <th className="px-5 py-3.5">یوزەرنەیم (Username)</th>
                  <th className="px-5 py-3.5">تێپەڕەوشە / کۆد</th>
                  <th className="px-5 py-3.5">تەلەفۆن</th>
                  <th className="px-5 py-3.5">دۆخی هەژمار</th>
                  <th className="px-5 py-3.5">کۆی فرۆش</th>
                  <th className="px-5 py-3.5 text-center">کردارەکان</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {filteredList.map(item => {
                  const pass = item.accessCode || item.password || '43629';
                  const isDisabled = item.status === 'disabled';

                  return (
                    <tr key={item.id} className={`hover:bg-slate-50/80 transition ${isDisabled ? 'bg-red-50/30 opacity-70' : ''}`}>
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <Users size={16} className={isDisabled ? 'text-slate-400' : 'text-indigo-600'} />
                          <span>{item.name || 'مەندووبی بێ ناو'}</span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg text-xs font-mono font-bold">
                          {item.username || item.name}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-slate-900 text-amber-400 font-mono font-bold tracking-widest text-xs rounded-lg shadow-2xs">
                            {pass}
                          </span>
                          <button
                            onClick={() => handleCopyCredentials(item)}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
                            title="کۆپیکردنی یوزەر و پاسوۆرد"
                          >
                            {copiedId === item.id ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
                          </button>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-slate-600 font-mono text-xs" dir="ltr">
                        {item.phone || '-'}
                      </td>

                      <td className="px-5 py-4">
                        {isDisabled ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 flex items-center gap-1 w-fit">
                            <AlertTriangle size={12} />
                            ڕاگیراوە
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 flex items-center gap-1 w-fit">
                            <CheckCircle2 size={12} />
                            چالاکە
                          </span>
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
                            title="گۆڕینی تێپەڕەوشە"
                          >
                            <KeyRound size={14} />
                            <span>گۆڕینی پاسوۆرد</span>
                          </button>

                          <button
                            onClick={() => handleToggleStatus(item)}
                            className={`p-1.5 rounded-lg transition ${
                              isDisabled
                                ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                            }`}
                            title={isDisabled ? 'چالاککردنەوە' : 'ڕاگرتن'}
                          >
                            <Power size={15} />
                          </button>

                          <button
                            onClick={() => handleEditInfo(item)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition"
                            title="دەستکاری زانیاری"
                          >
                            <Edit2 size={15} />
                          </button>

                          <button
                            onClick={() => setDeletingItem({ ...item })}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="سڕینەوە"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredList.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Users size={32} className="text-slate-300" />
                        <p className="font-bold text-sm">هیچ مەندووبێک نەدۆزرایەوە</p>
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
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200" dir="rtl">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50/80">
              <h3 className="font-bold text-indigo-900 text-base flex items-center gap-2">
                <Users className="text-indigo-600" size={20} />
                دروستکردنی هەژماری مەندووبی نوێ
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
                <label className="block text-xs font-bold text-slate-700 mb-1">ناوی تەواوی مەندووب *</label>
                <input
                  type="text"
                  required
                  placeholder="بۆ نموونە: ئەحمەد کەریم"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (!newUsername) setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, '_'));
                  }}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold text-slate-900"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ناوی بەکارهێنەر بۆ چوونەژوورەوە (Username)</label>
                <input
                  type="text"
                  placeholder="ahmed_rep"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ژمارەی تەلەفۆن</label>
                <input
                  type="tel"
                  placeholder="0750XXXXXXX"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-mono"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-700">تێپەڕەوشە / کۆدی چوونەژوورەوە</label>
                  <button
                    type="button"
                    onClick={() => generateRandomPin(setNewPassword)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                  >
                    <RefreshCw size={11} />
                    کۆدی ئۆتۆماتیک
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="12345"
                  dir="ltr"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-mono font-bold tracking-widest text-slate-900 bg-slate-50"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isSavingNew || !newName.trim()}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition text-xs flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <Save size={16} />
                  <span>{isSavingNew ? 'خەریکی دروستکردنە...' : 'دروستکردنی هەژمار'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={isSavingNew}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-xs"
                >
                  پاشگەزبوونەوە
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set / Change Password Modal */}
      {codeModalItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200" dir="rtl">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
              <h3 className="font-bold text-indigo-900 text-base flex items-center gap-2">
                <KeyRound className="text-indigo-600" size={20} />
                گۆڕینی تێپەڕەوشەی مەندووب
              </h3>
              <button 
                onClick={() => setCodeModalItem(null)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
                disabled={isProcessingCode}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCredentials} className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">مەندووب:</span>
                  <span className="font-bold text-slate-800">{codeModalItem.name}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ناوی بەکارهێنەر (Username)</label>
                <input
                  type="text"
                  value={inputUsername}
                  onChange={(e) => setInputUsername(e.target.value)}
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-mono font-bold"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-700">تێپەڕەوشە / پاسوۆردی نوێ</label>
                  <button
                    type="button"
                    onClick={() => generateRandomPin(setInputCode)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                  >
                    <RefreshCw size={11} />
                    کۆدی ئۆتۆماتیک
                  </button>
                </div>

                <input
                  type="text"
                  required
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  placeholder="•••••"
                  className="w-full px-4 py-3 text-center tracking-[0.4em] text-xl border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono font-bold text-slate-800 bg-white"
                  dir="ltr"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isProcessingCode || !inputCode.trim()}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 text-xs"
                >
                  <Save size={16} />
                  <span>{isProcessingCode ? 'خەریکی پاشەکەوتکردنە...' : 'پاشەکەوتکردنی پاسوۆرد'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCodeModalItem(null)}
                  disabled={isProcessingCode}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-xs"
                >
                  پاشگەزبوونەوە
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Info Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200" dir="rtl">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
              <h3 className="font-bold text-indigo-900 text-base flex items-center gap-2">
                <Edit2 size={18} className="text-indigo-600" />
                دەستکاری زانیاری مەندووب
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
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ناوی مەندووب *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-indigo-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold text-slate-900"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">یوزەرنەیم (Username)</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تێپەڕەوشە / پاسوۆرد</label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-mono font-bold tracking-wider"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ژمارەی تەلەفۆن</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">دۆخی هەژمار</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold bg-white"
                >
                  <option value="active">چالاک (دەتوانێت بچێتە ژوورەوە)</option>
                  <option value="disabled">ڕاگیراو (ناتوانێت بچێتە ژوورەوە)</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isSavingEdit || !editName.trim()}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition text-xs flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <Save size={16} />
                  <span>{isSavingEdit ? 'خەریکی پاشەکەوتکردنە...' : 'پاشەکەوتکردنی گۆڕانکارییەکان'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  disabled={isSavingEdit}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-xs"
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
        message={`ئایا دڵنیایت لە سڕینەوەی هەژماری (${deletingItem?.name})؟`}
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
