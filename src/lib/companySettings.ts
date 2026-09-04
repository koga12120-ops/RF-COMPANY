import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface CompanySettings {
  name: string;
  brand: string;
  phone: string;
  address: string;
}

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  name: 'کۆمپانیای TAM TAM',
  brand: 'TAM TAM',
  phone: '0750 456 7890',
  address: 'هەولێر - عێراق'
};

let cachedSettings: CompanySettings = {
  name: localStorage.getItem('company_name') || DEFAULT_COMPANY_SETTINGS.name,
  brand: localStorage.getItem('company_brand') || DEFAULT_COMPANY_SETTINGS.brand,
  phone: localStorage.getItem('company_phone') || DEFAULT_COMPANY_SETTINGS.phone,
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
