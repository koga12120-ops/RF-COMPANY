import React, { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
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
    let unsubRepDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = null;
      }
      if (unsubRepDoc) {
        unsubRepDoc();
        unsubRepDoc = null;
      }

      if (firebaseUser) {
        setIsAuthenticated(true);
        setUser(firebaseUser);

        // Real-time listener for user document to catch role/ban/reauth updates
        unsubUserDoc = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          setLoading(false);
          if (docSnap.exists()) {
            const data = docSnap.data();
            const sessionPin = sessionStorage.getItem('active_session_pin');

            // 1. Check if user account was deleted or banned
            if (data.isDeleted || data.status === 'banned') {
              setRoleState(null);
              sessionStorage.removeItem('active_session_pin');
              setPinNotice('ئەم هەژمارە ڕاگیراوە یان سڕدراوەتەوە لەلایەن بەڕێوەبەرەوە.');
              return;
            }

            // 2. Check if password/PIN was changed by Admin on user record
            if (data.forceReauth) {
              setRoleState(null);
              sessionStorage.removeItem('active_session_pin');
              setPinNotice('تێپەڕەوشەی چوونەژوورەوە لەلایەن بەڕێوەبەرەوە گۆڕدراوە. سیستەمەکە داخرا، تکایە کۆدە نوێیەکەت بنووسە.');
              return;
            }

            // 3. For sales rep, attach real-time listener to the rep's document in `reps` collection
            const repId = data.repId || sessionStorage.getItem('active_rep_id');
            if (data.role === 'sales_rep' || repId) {
              if (unsubRepDoc) {
                unsubRepDoc();
                unsubRepDoc = null;
              }

              const targetRepDocId = repId || firebaseUser.uid;
              unsubRepDoc = onSnapshot(doc(db, 'reps', targetRepDocId), (repSnap) => {
                const currentSessionPin = sessionStorage.getItem('active_session_pin');
                if (repSnap.exists()) {
                  const repData = repSnap.data();

                  if (repData.isDeleted || repData.status === 'disabled') {
                    setRoleState(null);
                    sessionStorage.removeItem('active_session_pin');
                    setPinNotice('ئەم هەژمارەی مەندووب لە سیستەم ڕاگیراوە.');
                    return;
                  }

                  // If rep code changed by Admin or forceReauth was set
                  if (repData.forceReauth || (currentSessionPin && repData.accessCode && repData.accessCode !== currentSessionPin)) {
                    setRoleState(null);
                    sessionStorage.removeItem('active_session_pin');
                    setPinNotice('کۆدی چوونەژوورەوەی ئەم مەندووبە لەلایەن بەڕێوەبەرەوە گۆڕدراوە. سیستەمەکە داخرا، تکایە کۆدە نوێیەکەت بنووسە.');
                    return;
                  }

                  // If valid active session pin matches current rep accessCode
                  if (currentSessionPin && repData.accessCode && repData.accessCode === currentSessionPin && !repData.forceReauth && !data.forceReauth) {
                    setRoleState('sales_rep');
                  } else if (!currentSessionPin) {
                    // No session PIN active, force PIN entry
                    setRoleState(null);
                  }
                } else if (data.role === 'sales_rep') {
                  // Rep document not found or deleted
                  setRoleState(null);
                  sessionStorage.removeItem('active_session_pin');
                  setPinNotice('پڕۆفایلی مەندووب نەدۆزرایەوە یان سڕدراوەتەوە.');
                }
              }, (err) => {
                console.error("Error listening to rep doc:", err);
              });
              return;
            }

            // 4. Other Roles (Admin, Warehouse, Cashvan)
            if (data.role === 'admin') {
              if (sessionPin === '27890') {
                setRoleState('admin');
              } else {
                setRoleState(null);
              }
            } else if (data.role === 'warehouse') {
              if (sessionPin === '35278') {
                setRoleState('warehouse');
              } else {
                setRoleState(null);
              }
            } else if (data.role === 'cashvan') {
              if (sessionPin === '47953' || (sessionPin && data.accessCode === sessionPin)) {
                setRoleState('cashvan');
              } else {
                setRoleState(null);
              }
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
      if (unsubRepDoc) unsubRepDoc();
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
        
        const repId = sessionStorage.getItem('active_rep_id');
        if (newRole === 'sales_rep' && repId) {
          await setDoc(doc(db, 'reps', repId), { 
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
    sessionStorage.removeItem('active_rep_id');
    sessionStorage.removeItem('active_rep_name');
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


