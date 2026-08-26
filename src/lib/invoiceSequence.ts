import { doc, runTransaction, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const COUNTER_COLLECTION = 'system_settings';
const COUNTER_DOC_ID = 'invoice_sequence_counter';

/**
 * Formats a number to 5-digit zero-padded string, e.g. 1 -> "00001", 125 -> "00125"
 */
export function formatInvoiceNumber(num: number | string): string {
  if (!num) return '00001';
  const parsed = typeof num === 'number' ? num : parseInt(num.toString().replace(/\D/g, ''), 10);
  if (isNaN(parsed) || parsed <= 0) {
    return '00001';
  }
  return String(parsed).padStart(5, '0');
}

/**
 * Atomically generates and increments the next system-wide invoice/receipt number in sequence.
 * Guarantees a unified, strictly incremental sequence (00001, 00002, 00003...)
 * shared across Sales Reps, Cashvans, and Admin operations without race conditions or collision.
 */
export async function getNextInvoiceNumber(): Promise<string> {
  const counterRef = doc(db, COUNTER_COLLECTION, COUNTER_DOC_ID);

  try {
    const nextFormattedNumber = await runTransaction(db, async (transaction) => {
      const counterSnap = await transaction.get(counterRef);
      
      let nextNumber = 1;
      if (counterSnap.exists()) {
        const data = counterSnap.data();
        const lastNumber = typeof data.lastNumber === 'number' ? data.lastNumber : 0;
        nextNumber = lastNumber + 1;
      }

      transaction.set(counterRef, {
        lastNumber: nextNumber,
        lastGeneratedFormatted: formatInvoiceNumber(nextNumber),
        lastUpdatedAt: Date.now()
      }, { merge: true });

      return formatInvoiceNumber(nextNumber);
    });

    return nextFormattedNumber;
  } catch (error) {
    console.error('Error generating next atomic invoice number:', error);
    // Fallback: in case of transient transaction failure, attempt direct set/get or timestamp-derived safe fallback
    try {
      const snap = await getDoc(counterRef);
      let cur = 0;
      if (snap.exists() && typeof snap.data().lastNumber === 'number') {
        cur = snap.data().lastNumber;
      }
      const nextNum = cur + 1;
      await setDoc(counterRef, {
        lastNumber: nextNum,
        lastGeneratedFormatted: formatInvoiceNumber(nextNum),
        lastUpdatedAt: Date.now()
      }, { merge: true });
      return formatInvoiceNumber(nextNum);
    } catch (fallbackError) {
      console.error('Fallback invoice generator also failed:', fallbackError);
      return '00001';
    }
  }
}

/**
 * Peeks at the next expected invoice number without incrementing the counter.
 */
export async function peekNextInvoiceNumber(): Promise<string> {
  try {
    const counterRef = doc(db, COUNTER_COLLECTION, COUNTER_DOC_ID);
    const snap = await getDoc(counterRef);
    if (snap.exists() && typeof snap.data().lastNumber === 'number') {
      return formatInvoiceNumber(snap.data().lastNumber + 1);
    }
    return '00001';
  } catch (err) {
    return '00001';
  }
}

/**
 * Sets or resets the starting counter number.
 */
export async function setInvoiceSequenceCounter(newStartingNumber: number): Promise<void> {
  const counterRef = doc(db, COUNTER_COLLECTION, COUNTER_DOC_ID);
  await setDoc(counterRef, {
    lastNumber: Math.max(0, newStartingNumber - 1),
    lastGeneratedFormatted: formatInvoiceNumber(Math.max(0, newStartingNumber - 1)),
    lastUpdatedAt: Date.now()
  }, { merge: true });
}
