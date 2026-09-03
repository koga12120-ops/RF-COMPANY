import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Role } from '../types';

export interface UserSession {
  role: Role;
  username?: string;
  name: string;
  id?: string;
  repId?: string;
  cashvanName?: string;
  accessCode?: string;
  loggedInAt: number;
}

const SESSION_KEY = 'rf_active_user_session';

export const convertNumerals = (str: string) => {
  if (!str) return '';
  const eastern = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const persian = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  let result = str;
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(eastern[i], 'g'), i.toString());
    result = result.replace(new RegExp(persian[i], 'g'), i.toString());
  }
  return result;
};

export const getStoredSession = (): UserSession | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
};

export const saveUserSession = (session: UserSession, remember: boolean = true) => {
  const json = JSON.stringify(session);
  if (remember) {
    localStorage.setItem(SESSION_KEY, json);
  }
  sessionStorage.setItem(SESSION_KEY, json);
  
  // Also keep backward-compatible keys for views relying on them
  if (session.accessCode) {
    sessionStorage.setItem('active_session_pin', session.accessCode);
  }
  if (session.repId) {
    sessionStorage.setItem('active_rep_id', session.repId);
  }
  if (session.name && session.role === 'sales_rep') {
    sessionStorage.setItem('active_rep_name', session.name);
  }
  if (session.cashvanName && session.role === 'cashvan') {
    sessionStorage.setItem('active_cashvan_name', session.cashvanName);
  }
};

export const clearUserSession = () => {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem('active_session_pin');
  sessionStorage.removeItem('active_rep_id');
  sessionStorage.removeItem('active_rep_name');
  sessionStorage.removeItem('active_cashvan_name');
};

export async function loginWithCredentials(
  identifier: string,
  secret: string
): Promise<{ success: boolean; session?: UserSession; error?: string }> {
  const cleanId = identifier.trim();
  const cleanSecret = convertNumerals(secret).trim();
  const normalizedIdLower = cleanId.toLowerCase();

  // 1. Single-code / Quick PIN login
  if (!cleanId && cleanSecret) {
    return loginWithSingleCode(cleanSecret);
  }

  // 2. Predefined Master Accounts
  // Admin Login
  if (
    (normalizedIdLower === 'admin' || normalizedIdLower === 'بەڕێوەبەر' || normalizedIdLower === 'admin1' || !cleanId) &&
    (cleanSecret === '27890' || cleanSecret === 'admin123' || cleanSecret === 'admin')
  ) {
    const session: UserSession = {
      role: 'admin',
      username: 'admin',
      name: 'بەڕێوەبەر',
      accessCode: '27890',
      loggedInAt: Date.now(),
    };
    return { success: true, session };
  }

  // Warehouse Login
  if (
    (normalizedIdLower === 'warehouse' || normalizedIdLower === 'koga' || normalizedIdLower === 'کۆگا' || normalizedIdLower === 'بەرپرسی کۆگا' || !cleanId) &&
    (cleanSecret === '35278' || cleanSecret === 'koga123')
  ) {
    const session: UserSession = {
      role: 'warehouse',
      username: 'warehouse',
      name: 'بەرپرسی کۆگا',
      accessCode: '35278',
      loggedInAt: Date.now(),
    };
    return { success: true, session };
  }

  // 3. Sales Reps Search in `reps` collection
  try {
    const repsRef = collection(db, 'reps');
    const allRepsSnap = await getDocs(repsRef);
    
    for (const docSnap of allRepsSnap.docs) {
      const rep = docSnap.data();
      const repUsername = (rep.username || '').toLowerCase().trim();
      const repName = (rep.name || '').toLowerCase().trim();
      const repPhone = (rep.phone || '').trim();
      const repCode = (rep.accessCode || '').trim();
      const repPassword = (rep.password || '').trim();

      // Check if identifier matches rep's username, name, phone, or code
      const idMatches = 
        !cleanId ||
        repUsername === normalizedIdLower ||
        repName === normalizedIdLower ||
        repPhone === cleanId ||
        docSnap.id === cleanId;

      // Check if secret matches password or accessCode
      const secretMatches = 
        cleanSecret === repCode ||
        cleanSecret === repPassword ||
        (cleanSecret === '43629' && idMatches);

      if (idMatches && secretMatches) {
        if (rep.status === 'disabled' || rep.isDeleted) {
          return { success: false, error: 'ئەم هەژمارەی مەندووب لەلایەن بەڕێوەبەرەوە ڕاگیراوە یان پەکخراوە.' };
        }

        const exactName = rep.name || cleanId || rep.username || 'مەندووب';
        const exactUsername = rep.username || cleanId || rep.name || 'مەندووب';

        const session: UserSession = {
          role: 'sales_rep',
          username: exactUsername,
          name: exactName,
          id: docSnap.id,
          repId: docSnap.id,
          accessCode: rep.accessCode || cleanSecret,
          loggedInAt: Date.now(),
        };

        // Clear any forceReauth flag
        if (rep.forceReauth) {
          await updateDoc(doc(db, 'reps', docSnap.id), { forceReauth: false });
        }

        return { success: true, session };
      }
    }
  } catch (err) {
    console.error("Error querying reps for login:", err);
  }

  // 4. Cashvans Search in `cashvans` collection
  try {
    const cashvansRef = collection(db, 'cashvans');
    const allCVSnap = await getDocs(cashvansRef);

    for (const docSnap of allCVSnap.docs) {
      const cv = docSnap.data();
      const cvUsername = (cv.username || '').toLowerCase().trim();
      const cvName = (cv.name || '').toLowerCase().trim();
      const cvPhone = (cv.phone || '').trim();
      const cvCode = (cv.accessCode || '').trim();
      const cvPassword = (cv.password || '').trim();

      const idMatches = 
        !cleanId ||
        cvUsername === normalizedIdLower ||
        cvName === normalizedIdLower ||
        cvPhone === cleanId ||
        docSnap.id === cleanId;

      const secretMatches = 
        cleanSecret === cvCode ||
        cleanSecret === cvPassword ||
        (cleanSecret === '47953' && idMatches);

      if (idMatches && secretMatches) {
        if (cv.status === 'disabled' || cv.isDeleted) {
          return { success: false, error: 'ئەم هەژمارەی کاشڤان لەلایەن بەڕێوەبەرەوە ڕاگیراوە.' };
        }

        const exactName = cv.name || cleanId || cv.username || 'کاشڤان';
        const exactUsername = cv.username || cleanId || cv.name || 'کاشڤان';

        const session: UserSession = {
          role: 'sales_rep',
          username: exactUsername,
          name: exactName,
          id: docSnap.id,
          repId: docSnap.id,
          cashvanName: exactName,
          accessCode: cv.accessCode || cleanSecret,
          loggedInAt: Date.now(),
        };

        if (cv.forceReauth) {
          await updateDoc(doc(db, 'cashvans', docSnap.id), { forceReauth: false });
        }

        return { success: true, session };
      }
    }
  } catch (err) {
    console.error("Error querying cashvans for login:", err);
  }

  // 5. Universal codes fallback
  if (cleanSecret === '43629' || cleanSecret === '47953') {
    const isCv = cleanSecret === '47953';
    const session: UserSession = {
      role: 'sales_rep',
      username: cleanId || (isCv ? 'cashvan' : 'sales_rep'),
      name: cleanId || (isCv ? 'کاشڤان' : 'مەندووب'),
      cashvanName: isCv ? (cleanId || 'کاشڤان') : undefined,
      accessCode: cleanSecret,
      loggedInAt: Date.now(),
    };
    return { success: true, session };
  }

  return { 
    success: false, 
    error: 'ناوی بەکارهێنەر یان تێپەڕەوشە (پاسوۆرد) هەڵەیە. تکایە زانیارییەکانت بپشکنە.' 
  };
}

export async function loginWithSingleCode(code: string): Promise<{ success: boolean; session?: UserSession; error?: string }> {
  const cleanCode = convertNumerals(code).trim();
  if (!cleanCode) {
    return { success: false, error: 'تکایە کۆدە ئەمنییەکە یان تێپەڕەوشە بنووسە.' };
  }

  // Static Roles
  if (cleanCode === '27890') {
    return {
      success: true,
      session: {
        role: 'admin',
        username: 'admin',
        name: 'بەڕێوەبەر',
        accessCode: '27890',
        loggedInAt: Date.now(),
      }
    };
  }

  if (cleanCode === '35278') {
    return {
      success: true,
      session: {
        role: 'warehouse',
        username: 'warehouse',
        name: 'بەرپرسی کۆگا',
        accessCode: '35278',
        loggedInAt: Date.now(),
      }
    };
  }

  if (cleanCode === '47953') {
    return {
      success: true,
      session: {
        role: 'sales_rep',
        username: 'cashvan',
        name: 'کاشڤان',
        cashvanName: 'کاشڤان',
        accessCode: '47953',
        loggedInAt: Date.now(),
      }
    };
  }

  if (cleanCode === '43629') {
    return {
      success: true,
      session: {
        role: 'sales_rep',
        username: 'sales_rep',
        name: 'مەندووب',
        accessCode: '43629',
        loggedInAt: Date.now(),
      }
    };
  }

  // Check personal code in reps
  try {
    const repsQuery = query(collection(db, 'reps'), where('accessCode', '==', cleanCode));
    const repsSnap = await getDocs(repsQuery);
    if (!repsSnap.empty) {
      const repDoc = repsSnap.docs[0];
      const repData = repDoc.data();
      if (repData.status === 'disabled' || repData.isDeleted) {
        return { success: false, error: 'ئەم هەژمارەی مەندووب لەلایەن بەڕێوەبەرەوە ڕاگیراوە.' };
      }
      return {
        success: true,
        session: {
          role: 'sales_rep',
          username: repData.username || repData.name,
          name: repData.name || 'مەندووب',
          id: repDoc.id,
          repId: repDoc.id,
          accessCode: cleanCode,
          loggedInAt: Date.now(),
        }
      };
    }
  } catch (e) {
    console.error(e);
  }

  // Check personal code in cashvans
  try {
    const cvQuery = query(collection(db, 'cashvans'), where('accessCode', '==', cleanCode));
    const cvSnap = await getDocs(cvQuery);
    if (!cvSnap.empty) {
      const cvDoc = cvSnap.docs[0];
      const cvData = cvDoc.data();
      if (cvData.status === 'disabled' || cvData.isDeleted) {
        return { success: false, error: 'ئەم هەژمارەی کاشڤان لەلایەن بەڕێوەبەرەوە ڕاگیراوە.' };
      }
      return {
        success: true,
        session: {
          role: 'sales_rep',
          username: cvData.username || cvData.name,
          name: cvData.name || 'کاشڤان',
          id: cvDoc.id,
          repId: cvDoc.id,
          cashvanName: cvData.name,
          accessCode: cleanCode,
          loggedInAt: Date.now(),
        }
      };
    }
  } catch (e) {
    console.error(e);
  }

  return { success: false, error: 'کۆدی چوونەژوورەوە هەڵەیە یان تۆمار نەکراوە.' };
}
