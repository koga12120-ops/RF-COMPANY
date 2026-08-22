import React, { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import Login from './components/Login';
import PinEntry from './components/PinEntry';
import Dashboard from './components/Dashboard';
import { Role } from './types';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [role, setRoleState] = useState<Role>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [pinNotice, setPinNotice] = useState<string>('');

  useEffect(() => {
    // Initialize theme
    const savedTheme = localStorage.getItem('app-theme') || 'light';
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark', 'theme-sepia');
    root.classList.add(`theme-${savedTheme}`);
  }, []);

  useEffect(() => {
    let unsubUserDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = null;
      }

      if (firebaseUser) {
        setIsAuthenticated(true);
        setUser(firebaseUser);

        // Real-time listener for user document to catch PIN/password changes instantly
        unsubUserDoc = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          setLoading(false);
          if (docSnap.exists()) {
            const data = docSnap.data();
            const sessionPin = sessionStorage.getItem('active_session_pin');

            // 1. Check if user account was deleted or banned
            if (data.isDeleted || data.status === 'banned') {
              setRoleState(null);
              setPinNotice('ئەم هەژمارە ڕاگیراوە یان سڕدراوەتەوە لەلایەن بەڕێوەبەرەوە.');
              return;
            }

            // 2. Check if password/PIN was changed by Admin (forceReauth or accessCode mismatch)
            if (data.forceReauth || (data.role === 'sales_rep' && sessionPin && data.accessCode && data.accessCode !== sessionPin)) {
              setRoleState(null);
              sessionStorage.removeItem('active_session_pin');
              setPinNotice('تێپەڕەوشەی مەندووب لەلایەن بەڕێوەبەرەوە گۆڕدراوە. سیستەمەکە داخرا و تکایە تێپەڕەوشە تازەکەت لێبدە بۆ چوونەژوورەوە.');
              return;
            }

            // 3. Normal active role
            if (data.role) {
              setRoleState(data.role as Role);
            } else {
              setRoleState(null);
            }
          } else {
            setRoleState(null);
          }
        }, (error) => {
          console.error("Error listening to user document:", error);
          setLoading(false);
        });
      } else {
        setIsAuthenticated(false);
        setUser(null);
        setRoleState(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  const handlePinSuccess = async (newRole: Role) => {
    setPinNotice('');
    setRoleState(newRole);

    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid), { 
          role: newRole, 
          name: user.displayName || user.email, 
          email: user.email, 
          forceReauth: false,
          lastActiveAt: Date.now() 
        }, { merge: true });
        
        if (newRole === 'sales_rep') {
          await setDoc(doc(db, 'reps', user.uid), { 
            name: user.displayName || user.email, 
            uid: user.uid,
            forceReauth: false 
          }, { merge: true });
        }
        if (newRole === 'cashvan') {
          await setDoc(doc(db, 'cashvans', user.uid), { 
            name: user.displayName || user.email, 
            uid: user.uid,
            forceReauth: false 
          }, { merge: true });
        }
      } catch (error) {
        console.error("Error syncing role to user doc:", error);
      }
    }
  };

  const handleLogout = async () => {
    sessionStorage.removeItem('active_session_pin');
    setRoleState(null);
    setUser(null);
    setIsAuthenticated(false);
    setPinNotice('');
    setTimeout(async () => {
      await signOut(auth);
    }, 500);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onSuccess={() => {}} />;
  }

  if (!role) {
    return (
      <PinEntry 
        onSuccess={handlePinSuccess} 
        onLogout={handleLogout} 
        initialNotice={pinNotice}
        onClearNotice={() => setPinNotice('')}
      />
    );
  }

  return <Dashboard role={role} onLogout={handleLogout} />;
}


