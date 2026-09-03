import React, { useState, useEffect } from 'react';
import { db, auth } from './lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { Role } from './types';
import { getStoredSession, clearUserSession, saveUserSession, UserSession } from './lib/authService';

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [role, setRoleState] = useState<Role>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string>('');

  useEffect(() => {
    // Initialize theme
    const savedTheme = localStorage.getItem('app-theme') || 'light';
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark', 'theme-sepia');
    root.classList.add(`theme-${savedTheme}`);

    // Try background anonymous auth for Firebase if needed
    try {
      signInAnonymously(auth).catch((err) => {
        // Fallback or offline
        console.log("Firebase background session initialized");
      });
    } catch (e) {
      // Ignored
    }

    // Check stored session
    const stored = getStoredSession();
    if (stored && stored.role) {
      setSession(stored);
      setRoleState(stored.role);
    }
    setLoading(false);
  }, []);

  // Real-time security sync for active session (e.g. if admin disables rep or changes password)
  useEffect(() => {
    if (!session) return;

    let unsubDoc: (() => void) | null = null;

    if (session.role === 'sales_rep' && session.repId) {
      unsubDoc = onSnapshot(doc(db, 'reps', session.repId), (docSnap) => {
        if (docSnap.exists()) {
          const repData = docSnap.data();
          if (repData.isDeleted || repData.status === 'disabled') {
            handleLogout('ئەم هەژمارەی مەندووب لەلایەن بەڕێوەبەرەوە ڕاگیراوە یان سڕدراوەتەوە.');
            return;
          }
          if (repData.forceReauth) {
            handleLogout('تێپەڕەوشەی چوونەژوورەوە لەلایەن بەڕێوەبەرەوە گۆڕدراوە. تکایە دووبارە بچۆ ژوورەوە.');
            return;
          }
          // If password/code changed
          if (session.accessCode && repData.accessCode && repData.accessCode !== session.accessCode) {
            handleLogout('کۆدی چوونەژوورەوە لەلایەن بەڕێوەبەرەوە نوێکراوەتەوە. تکایە بە کۆدە نوێیەکەت بچۆ ژوورەوە.');
            return;
          }
        }
      }, (err) => {
        console.error("Error listening to rep status:", err);
      });
    } else if (session.role === 'cashvan' && session.id) {
      unsubDoc = onSnapshot(doc(db, 'cashvans', session.id), (docSnap) => {
        if (docSnap.exists()) {
          const cvData = docSnap.data();
          if (cvData.isDeleted || cvData.status === 'disabled') {
            handleLogout('ئەم هەژمارەی کاشڤان لەلایەن بەڕێوەبەرەوە ڕاگیراوە.');
            return;
          }
          if (cvData.forceReauth) {
            handleLogout('تێپەڕەوشە لەلایەن بەڕێوەبەرەوە نوێکراوەتەوە. تکایە دووبارە بچۆ ژوورەوە.');
            return;
          }
        }
      }, (err) => {
        console.error("Error listening to cashvan status:", err);
      });
    }

    return () => {
      if (unsubDoc) unsubDoc();
    };
  }, [session?.id, session?.repId, session?.role, session?.accessCode]);

  const handleLoginSuccess = (newSession: UserSession) => {
    setNotice('');
    setSession(newSession);
    setRoleState(newSession.role);
    saveUserSession(newSession);
  };

  const handleLogout = (customNotice?: string) => {
    clearUserSession();
    setSession(null);
    setRoleState(null);
    if (customNotice) {
      setNotice(customNotice);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!role || !session) {
    return (
      <div>
        {notice && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[90%] bg-amber-500 text-white px-4 py-3 rounded-2xl shadow-xl font-bold text-xs text-center animate-bounce">
            {notice}
          </div>
        )}
        <Login onSuccess={handleLoginSuccess} />
      </div>
    );
  }

  return <Dashboard role={role} onLogout={() => handleLogout()} />;
}
