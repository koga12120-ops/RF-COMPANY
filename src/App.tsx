import React, { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, addDoc } from 'firebase/firestore';
import Login from './components/Login';
import PinEntry from './components/PinEntry';
import Dashboard from './components/Dashboard';
import { Role } from './types';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [role, setRoleState] = useState<Role>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        setIsAuthenticated(true);
        setUser(firebaseUser);
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists() && userDoc.data().role) {
            setRoleState(userDoc.data().role as Role);
          } else {
            setRoleState(null);
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setRoleState(null);
        }
      } else {
        setIsAuthenticated(false);
        setUser(null);
        setRoleState(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handlePinSuccess = async (newRole: Role) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { role: newRole, name: user.displayName || user.email, email: user.email, createdAt: Date.now() }, { merge: true });
      
      if (newRole === 'sales_rep') {
        await setDoc(doc(db, 'reps', user.uid), { name: user.displayName || user.email, phone: '', totalSales: 0, totalProfit: 0, uid: user.uid }, { merge: true });
      }
      if (newRole === 'cashvan') {
        await setDoc(doc(db, 'cashvans', user.uid), { name: user.displayName || user.email, phone: '', totalSales: 0, totalProfit: 0, uid: user.uid }, { merge: true });
      }
      setRoleState(newRole);
    } catch (error) {
      console.error("Error setting role:", error);
      alert("هەڵەیەک ڕوویدا لە کاتی تۆمارکردنی ڕۆڵ");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setRoleState(null);
    setUser(null);
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
    return <PinEntry onSuccess={handlePinSuccess} onLogout={handleLogout} />;
  }

  return <Dashboard role={role} onLogout={handleLogout} />;
}

