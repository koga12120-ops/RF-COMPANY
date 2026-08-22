import React, { useState } from 'react';
import { Lock, UserCheck, KeyRound, AlertTriangle, CheckCircle2, X, Send } from 'lucide-react';
import { Role } from '../types';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, getDocs, collection, query, where, updateDoc } from 'firebase/firestore';

interface PinEntryProps {
  onSuccess: (role: Role) => void;
  onLogout: () => void;
  initialNotice?: string;
  onClearNotice?: () => void;
}

export default function PinEntry({ onSuccess, onLogout, initialNotice, onClearNotice }: PinEntryProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState(initialNotice || '');
  const [loading, setLoading] = useState(false);

  // Sync initialNotice if it changes
  React.useEffect(() => {
    if (initialNotice) {
      setInfoMessage(initialNotice);
    }
  }, [initialNotice]);

  // Rep Registration modal states
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [repName, setRepName] = useState(auth.currentUser?.displayName || '');
  const [repPhone, setRepPhone] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
    if (onClearNotice) onClearNotice();
    setLoading(true);

    // Convert Eastern Arabic/Persian/Kurdish numerals to standard Latin numerals
    const convertNumerals = (str: string) => {
      const eastern = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
      const persian = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
      let result = str;
      for (let i = 0; i < 10; i++) {
        result = result.replace(new RegExp(eastern[i], 'g'), i.toString());
        result = result.replace(new RegExp(persian[i], 'g'), i.toString());
      }
      return result;
    };

    const normalizedPin = convertNumerals(pin).trim();
    const currentUser = auth.currentUser;

    try {
      // 1. Check if user is banned/deleted in database
      if (currentUser) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists() && (userDoc.data()?.isDeleted || userDoc.data()?.status === 'banned')) {
          setError('ئەم هەژمارە لەلایەن بەڕێوەبەرەوە سڕدراوەتەوە و دەستڕاگەیشتنت بە سیستەم نەماوە.');
          setPin('');
          return;
        }
      }

      // Static Roles
      if (normalizedPin === '27890') {
        sessionStorage.setItem('active_session_pin', '27890');
        await onSuccess('admin');
        return;
      } else if (normalizedPin === '35278') {
        sessionStorage.setItem('active_session_pin', '35278');
        await onSuccess('warehouse');
        return;
      } else if (normalizedPin === '47953') {
        sessionStorage.setItem('active_session_pin', '47953');
        await onSuccess('cashvan');
        return;
      } 
      
      // Initial Sales Rep Request Code (43629)
      if (normalizedPin === '43629') {
        if (!currentUser) {
          setError('تکایە سەرەتا بە هەژمار بچۆ ژوورەوە');
          return;
        }

        // Check if user already registered in reps
        const repDoc = await getDoc(doc(db, 'reps', currentUser.uid));
        if (repDoc.exists()) {
          const repData = repDoc.data();
          if (repData.accessCode && repData.status === 'active') {
            setInfoMessage('بەڕێوەبەر کۆدی تایبەتی بۆ داناویت. تکایە کۆدە ٥ ژمارەییە تایبەتەکەت لێبدە بۆ چوونەژوورەوە.');
          } else {
            setInfoMessage('داواکارییەکەت لە چاوەڕوانیدایە. تکایە داوا لە بەڕێوەبەر بکە لە لیستی مەندووبەکان کۆدی تایبەتت بۆ دابنێت.');
          }
        } else {
          // Open registration form to submit name and phone to admin
          setShowRegisterModal(true);
        }
        setPin('');
        return;
      }

      // Check for Personal Rep Access Code (assigned by Admin)
      const repsQuery = query(collection(db, 'reps'), where('accessCode', '==', normalizedPin));
      const repsSnap = await getDocs(repsQuery);

      if (!repsSnap.empty) {
        const repDocSnap = repsSnap.docs[0];
        const repData = repDocSnap.data();

        if (repData.status === 'disabled' || repData.isDeleted) {
          setError('ئەم کۆدە لەلایەن بەڕێوەبەرەوە ڕاگیراوە یان پەک خراوە.');
          setPin('');
          return;
        }

        // Save active session PIN
        sessionStorage.setItem('active_session_pin', normalizedPin);

        if (currentUser) {
          // Sync with users collection and clear any forceReauth
          await setDoc(doc(db, 'users', currentUser.uid), {
            role: 'sales_rep',
            accessCode: normalizedPin,
            forceReauth: false,
            lastReauthAt: Date.now(),
            name: repData.name || currentUser.displayName || currentUser.email,
            phone: repData.phone || '',
            email: currentUser.email || '',
            status: 'active',
            isDeleted: false
          }, { merge: true });

          // Update rep doc with uid/email and clear forceReauth
          await updateDoc(doc(db, 'reps', repDocSnap.id), {
            uid: currentUser.uid,
            email: currentUser.email || '',
            status: 'active',
            forceReauth: false
          });
        }

        await onSuccess('sales_rep');
        return;
      }

      // Check for Cashvan Personal Access Code (assigned by Admin)
      const cashvansQuery = query(collection(db, 'cashvans'), where('accessCode', '==', normalizedPin));
      const cashvansSnap = await getDocs(cashvansQuery);

      if (!cashvansSnap.empty) {
        const cvDocSnap = cashvansSnap.docs[0];
        const cvData = cvDocSnap.data();

        if (cvData.status === 'disabled' || cvData.isDeleted) {
          setError('ئەم کۆدە لەلایەن بەڕێوەبەرەوە ڕاگیراوە یان پەک خراوە.');
          setPin('');
          return;
        }

        sessionStorage.setItem('active_session_pin', normalizedPin);

        if (currentUser) {
          await setDoc(doc(db, 'users', currentUser.uid), {
            role: 'cashvan',
            accessCode: normalizedPin,
            forceReauth: false,
            lastReauthAt: Date.now(),
            name: cvData.name || currentUser.displayName || currentUser.email,
            phone: cvData.phone || '',
            email: currentUser.email || '',
            status: 'active',
            isDeleted: false
          }, { merge: true });

          await updateDoc(doc(db, 'cashvans', cvDocSnap.id), {
            uid: currentUser.uid,
            email: currentUser.email || '',
            status: 'active',
            forceReauth: false
          });
        }

        await onSuccess('cashvan');
        return;
      }

      setError('تێپەڕەوشە (کۆدی ئەمنی) هەڵەیە. تکایە کۆدی دروست بنووسە.');
      setPin('');
    } catch (err: any) {
      console.error(err);
      setError('هەڵەیەک ڕوویدا لە کاتی پشتڕاستکردنەوە');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterRep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repName.trim() || !repPhone.trim()) return;

    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setIsRegistering(true);
    try {
      // 1. Create Rep Profile in reps collection
      await setDoc(doc(db, 'reps', currentUser.uid), {
        id: currentUser.uid,
        uid: currentUser.uid,
        name: repName.trim(),
        phone: repPhone.trim(),
        email: currentUser.email || '',
        accessCode: '', // Waiting for admin to set
        status: 'pending',
        totalSales: 0,
        totalProfit: 0,
        createdAt: Date.now()
      }, { merge: true });

      // 2. Set user record in users collection
      await setDoc(doc(db, 'users', currentUser.uid), {
        uid: currentUser.uid,
        name: repName.trim(),
        phone: repPhone.trim(),
        email: currentUser.email || '',
        role: null, // role will be assigned once admin sets code
        status: 'pending',
        accessCode: '',
        isDeleted: false,
        createdAt: Date.now()
      }, { merge: true });

      setShowRegisterModal(false);
      setInfoMessage('داواکارییەکەت بە سەرکەوتوویی تۆمارکرا! ناوت لە لیستی مەندووبەکان لای بەڕێوەبەر دەردەکەوێت، تکایە داوای لێبکە کۆدی تایبەتت بۆ دابنێت تا بتوانیت بچیتە ژوورەوە.');
    } catch (err) {
      console.error(err);
      setError('هەڵەیەک ڕوویدا لە کاتی تۆمارکردنی داواکاری');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50" dir="rtl">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border border-slate-100">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-slate-100 shadow-sm">
            <img src="/LOGO1.jpg" alt="Logo" className="w-full h-full object-cover" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-center mb-1 text-slate-800">
          کۆدی ئەمنی داخڵ بکە
        </h2>
        <p className="text-center text-xs text-slate-500 mb-6">
          کۆدی ٥ ژمارەیی ئەمنی تایبەت بە کارەکەت بنووسە
        </p>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-xs font-medium text-center border border-red-100 flex items-center justify-center gap-1.5">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {infoMessage && (
          <div className="bg-amber-50 text-amber-800 p-3.5 rounded-xl mb-4 text-xs font-medium border border-amber-200 flex items-start gap-2 leading-relaxed">
            <KeyRound size={18} className="shrink-0 text-amber-600 mt-0.5" />
            <span>{infoMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              required
              disabled={loading}
              className="w-full px-4 py-3.5 text-center tracking-[0.8em] text-2xl border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition font-mono font-bold text-slate-900 disabled:opacity-50 disabled:bg-slate-50"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              dir="ltr"
              placeholder="•••••"
              maxLength={5}
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white py-3 rounded-xl hover:bg-slate-800 transition font-bold disabled:opacity-50 shadow-sm"
          >
            {loading ? 'چاوەڕێبە...' : 'پشتڕاستکردنەوە'}
          </button>
        </form>

        <button 
          onClick={onLogout}
          className="mt-6 w-full text-xs text-slate-400 hover:text-slate-700 underline text-center block"
        >
          چوونەدەرەوە لە هەژمار
        </button>
      </div>

      {/* Rep First-Time Registration Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200" dir="rtl">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
              <h3 className="font-bold text-indigo-900 text-base flex items-center gap-2">
                <UserCheck className="text-indigo-600" size={20} />
                تۆمارکردنی ناوی مەندووب
              </h3>
              <button 
                onClick={() => setShowRegisterModal(false)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
                disabled={isRegistering}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRegisterRep} className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                بەخێربێیت. تکایە ناوی تەواو و ژمارەی تەلەفۆنت بنووسە بۆ ئەوەی ناوت لە لیستی مەندووبەکان تۆماربێت و بەڕێوەبەر کۆدی تایبەتت بۆ دابنێت.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ناوی سیانی مەندووب</label>
                <input
                  type="text"
                  required
                  value={repName}
                  onChange={(e) => setRepName(e.target.value)}
                  placeholder="بۆ نموونە: ئارام ئەحمەد کەریم"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ژمارەی مۆبایل</label>
                <input
                  type="tel"
                  required
                  value={repPhone}
                  onChange={(e) => setRepPhone(e.target.value)}
                  placeholder="07XXXXXXXXX"
                  dir="ltr"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono text-right"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isRegistering}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 text-sm shadow-sm disabled:opacity-50"
                >
                  <Send size={16} />
                  <span>{isRegistering ? 'خەریکی ناردنە...' : 'ناردنی داواکاری بۆ بەڕێوەبەر'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  disabled={isRegistering}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-sm"
                >
                  پاشگەزبوونەوە
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
