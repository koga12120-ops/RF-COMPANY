import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  getFirestore,
  Firestore
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  projectId: "gen-lang-client-0426672400",
  appId: "1:145664249414:web:dac653c3e3b2f1b3488447",
  apiKey: "AIzaSyBrDGAtRgSRNPwm2b_QXcgSisvnB2u4xfM",
  authDomain: "gen-lang-client-0426672400.firebaseapp.com",
  storageBucket: "gen-lang-client-0426672400.firebasestorage.app",
  messagingSenderId: "145664249414",
};

export const app = initializeApp(firebaseConfig);

const DB_ID = "ai-studio-f66079c3-ae49-4e9b-bc72-73185f3acfd5";

let firestoreInstance: Firestore;

try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, DB_ID);
} catch {
  try {
    firestoreInstance = initializeFirestore(app, {
      localCache: memoryLocalCache()
    }, DB_ID);
  } catch {
    firestoreInstance = getFirestore(app, DB_ID);
  }
}

export const db = firestoreInstance;
export const auth = getAuth(app);
