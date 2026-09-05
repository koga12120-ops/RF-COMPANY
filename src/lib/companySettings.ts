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
  phone: '07506144894',
  address: 'هەولێر - عێراق'
};

const getInitialName = () => {
  const stored = localStorage.getItem('company_name');
  if (!stored || stored.includes('TAM TAM')) return DEFAULT_COMPANY_SETTINGS.name;
  return stored;
};

const getInitialPhone = () => {
  const stored = localStorage.getItem('company_phone');
  if (!stored || stored === '0750 456 7890') return DEFAULT_COMPANY_SETTINGS.phone;
  return stored;
};

let cachedSettings: CompanySettings = {
  name: getInitialName(),
  brand: localStorage.getItem('company_brand') || DEFAULT_COMPANY_SETTINGS.brand,
  phone: getInitialPhone(),
  address: localStorage.getItem('company_address') || DEFAULT_COMPANY_SETTINGS.address
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
      localStorage.setItem('company_name', cachedSettings.name);
      localStorage.setItem('company_brand', cachedSettings.brand);
      localStorage.setItem('company_phone', cachedSettings.phone);
      localStorage.setItem('company_address', cachedSettings.address);
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
  localStorage.setItem('company_name', cachedSettings.name);
  localStorage.setItem('company_brand', cachedSettings.brand);
  localStorage.setItem('company_phone', cachedSettings.phone);
  localStorage.setItem('company_address', cachedSettings.address);

  try {
    const docRef = doc(db, 'system_settings', 'company_profile');
    await setDoc(docRef, cachedSettings, { merge: true });
  } catch (e) {
    console.error('Could not save company settings to firestore:', e);
  }

  return cachedSettings;
}
