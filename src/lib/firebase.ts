import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
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
export const db = getFirestore(app, "ai-studio-f66079c3-ae49-4e9b-bc72-73185f3acfd5");
export const auth = getAuth(app);
