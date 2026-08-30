import React, { useState } from 'react';
import { KeyRound, AlertTriangle } from 'lucide-react';
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
        if (currentUser) {
          await setDoc(doc(db, 'users', currentUser.uid), {
            role: 'admin',
            accessCode: '27890',
            forceReauth: false,
            lastReauthAt: Date.now(),
            name: currentUser.displayName || currentUser.email || 'بەڕێوەبەر',
            email: currentUser.email || '',
            status: 'active',
            isDeleted: false
          }, { merge: true });
        }
        await onSuccess('admin');
        return;
      } else if (normalizedPin === '35278') {
        sessionStorage.setItem('active_session_pin', '35278');
        if (currentUser) {
          await setDoc(doc(db, 'users', currentUser.uid), {
            role: 'warehouse',
            accessCode: '35278',
            forceReauth: false,
            lastReauthAt: Date.now(),
            name: currentUser.displayName || currentUser.email || 'بەرپرسی کۆگا',
            email: currentUser.email || '',
            status: 'active',
            isDeleted: false
          }, { merge: true });
        }
        await onSuccess('warehouse');
        return;
      } else if (normalizedPin === '47953') {
        sessionStorage.setItem('active_session_pin', '47953');
        if (currentUser) {
          await setDoc(doc(db, 'users', currentUser.uid), {
            role: 'cashvan',
            accessCode: '47953',
            forceReauth: false,
            lastReauthAt: Date.now(),
            name: currentUser.displayName || currentUser.email || 'کاشڤان',
            email: currentUser.email || '',
            status: 'active',
            isDeleted: false
          }, { merge: true });
        }
        await onSuccess('cashvan');
        return;
      } else if (normalizedPin === '43629') {
        // Universal Sales Rep Access Code (43629)
        sessionStorage.setItem('active_session_pin', '43629');
        if (currentUser) {
          await setDoc(doc(db, 'users', currentUser.uid), {
            role: 'sales_rep',
            accessCode: '43629',
            forceReauth: false,
            lastReauthAt: Date.now(),
            name: currentUser.displayName || currentUser.email || 'مەندووب',
            email: currentUser.email || '',
            status: 'active',
            isDeleted: false
          }, { merge: true });
        }
        await onSuccess('sales_rep');
        return;
      }

      // Check for Personal Rep Access Code (assigned by Admin in RepsView)
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

        // Save active session PIN and rep info
        sessionStorage.setItem('active_session_pin', normalizedPin);
        sessionStorage.setItem('active_rep_id', repDocSnap.id);
        if (repData.name) {
          sessionStorage.setItem('active_rep_name', repData.name);
        }

        if (currentUser) {
          // Sync with users collection and clear any forceReauth
          await setDoc(doc(db, 'users', currentUser.uid), {
            role: 'sales_rep',
            accessCode: normalizedPin,
            repId: repDocSnap.id,
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

      // Check for Cashvan Personal Access Code (assigned by Admin in CashvanView)
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
        if (cvData.name) {
          sessionStorage.setItem('active_cashvan_name', cvData.name);
        }

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
    </div>
  );
}
