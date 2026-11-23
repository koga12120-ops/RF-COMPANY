import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface CompanySettings {
  name: string;
  brand: string;
  phone: string;
  address: string;
}

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  name: 'کۆمپانیای RF',
  brand: 'بریکاری فەرمی TAM TAM',
  phone: '07506144894 - 07783890464',
  address: 'هەولێر - عێراق'
};

const safeGetItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSetItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage access errors in restricted iframes
  }
};

const getInitialName = () => {
  const stored = safeGetItem('company_name');
  if (!stored || stored.includes('TAM TAM')) return DEFAULT_COMPANY_SETTINGS.name;
  return stored;
};

const getInitialPhone = () => {
  const stored = safeGetItem('company_phone');
  if (!stored || stored === '0750 456 7890' || stored === '07506144894') return DEFAULT_COMPANY_SETTINGS.phone;
  return stored;
};

let cachedSettings: CompanySettings = {
  name: getInitialName(),
  brand: safeGetItem('company_brand') || DEFAULT_COMPANY_SETTINGS.brand,
  phone: getInitialPhone(),
  address: safeGetItem('company_address') || DEFAULT_COMPANY_SETTINGS.address
};

export function getCompanySettings(): CompanySettings {
  return { ...cachedSettings };
}

export async function fetchCompanySettings(): Promise<CompanySettings> {
  try {
    const docRef = doc(db, 'system_settings', 'company_profile');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      cachedSettings = {
        name: data.name || cachedSettings.name,
        brand: data.brand || cachedSettings.brand,
        phone: data.phone || cachedSettings.phone,
        address: data.address || cachedSettings.address
      };
      safeSetItem('company_name', cachedSettings.name);
      safeSetItem('company_brand', cachedSettings.brand);
      safeSetItem('company_phone', cachedSettings.phone);
      safeSetItem('company_address', cachedSettings.address);
    }
  } catch (e) {
    console.warn('Could not load company settings from firestore:', e);
  }
  return cachedSettings;
}

export async function saveCompanySettings(newSettings: Partial<CompanySettings>): Promise<CompanySettings> {
  cachedSettings = {
    ...cachedSettings,
    ...newSettings
  };
  safeSetItem('company_name', cachedSettings.name);
  safeSetItem('company_brand', cachedSettings.brand);
  safeSetItem('company_phone', cachedSettings.phone);
  safeSetItem('company_address', cachedSettings.address);

  try {
    const docRef = doc(db, 'system_settings', 'company_profile');
    await setDoc(docRef, cachedSettings, { merge: true });
  } catch (e) {
    console.error('Could not save company settings to firestore:', e);
  }

  return cachedSettings;
}
