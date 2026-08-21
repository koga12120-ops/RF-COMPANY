import { 
  collection, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  doc, 
  setDoc 
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * Renames a Sales Rep or Cashvan everywhere in the database:
 * - reps collection
 * - cashvans collection
 * - users collection (so logged in rep/cashvan immediately sees new name)
 * - orders collection (repName field and on receipts)
 * - cashvan_sales collection (cashvanName field and on receipts)
 * - cashvan_transfers collection (cashvanName field and on receipts)
 * - cashvan_inventory collection (cashvanName field)
 * - cashvan_requisitions collection (cashvanName field)
 * - transactions collection (relatedEntityId & descriptions)
 */
export async function renameRepOrCashvan(
  oldName: string, 
  newName: string, 
  options?: {
    entityId?: string;
    uid?: string;
    phone?: string;
    isCashvan?: boolean;
    isRep?: boolean;
  }
) {
  const trimmedOld = (oldName || '').trim();
  const trimmedNew = (newName || '').trim();
  if (!trimmedNew) return;

  const isNameChanged = trimmedOld !== '' && trimmedOld !== trimmedNew;

  // 1. Update in `reps` collection
  try {
    if (options?.entityId) {
      try {
        await updateDoc(doc(db, 'reps', options.entityId), {
          name: trimmedNew,
          ...(options.phone !== undefined ? { phone: options.phone.trim() } : {})
        });
      } catch (e) {
        // Document may not be in reps
      }
    }
    if (isNameChanged) {
      const repsSnap = await getDocs(query(collection(db, 'reps'), where('name', '==', trimmedOld)));
      for (const d of repsSnap.docs) {
        await updateDoc(doc(db, 'reps', d.id), {
          name: trimmedNew,
          ...(options?.phone !== undefined ? { phone: options.phone.trim() } : {})
        });
      }
    }
  } catch (err) {
    console.error('Error updating reps:', err);
  }

  // 2. Update in `cashvans` collection
  try {
    if (options?.entityId) {
      try {
        await updateDoc(doc(db, 'cashvans', options.entityId), {
          name: trimmedNew,
          ...(options.phone !== undefined ? { phone: options.phone.trim() } : {})
        });
      } catch (e) {
        // Document may not be in cashvans
      }
    }
    if (isNameChanged) {
      const cvSnap = await getDocs(query(collection(db, 'cashvans'), where('name', '==', trimmedOld)));
      for (const d of cvSnap.docs) {
        await updateDoc(doc(db, 'cashvans', d.id), {
          name: trimmedNew,
          ...(options?.phone !== undefined ? { phone: options.phone.trim() } : {})
        });
      }
    }
  } catch (err) {
    console.error('Error updating cashvans:', err);
  }

  // 3. Update in `users` collection
  try {
    if (options?.uid) {
      await setDoc(doc(db, 'users', options.uid), {
        name: trimmedNew,
        ...(options.phone !== undefined ? { phone: options.phone.trim() } : {})
      }, { merge: true });
    }
    if (isNameChanged) {
      const usersSnap = await getDocs(query(collection(db, 'users'), where('name', '==', trimmedOld)));
      for (const d of usersSnap.docs) {
        await updateDoc(doc(db, 'users', d.id), {
          name: trimmedNew,
          ...(options?.phone !== undefined ? { phone: options.phone.trim() } : {})
        });
      }
    }
  } catch (err) {
    console.error('Error updating users:', err);
  }

  // If name didn't change, we can stop here
  if (!isNameChanged) return;

  // 4. Update all `orders` where repName == trimmedOld
  try {
    const ordersSnap = await getDocs(query(collection(db, 'orders'), where('repName', '==', trimmedOld)));
    for (const d of ordersSnap.docs) {
      await updateDoc(doc(db, 'orders', d.id), { repName: trimmedNew });
    }
  } catch (err) {
    console.error('Error updating orders:', err);
  }

  // 5. Update all `cashvan_sales` where cashvanName == trimmedOld
  try {
    const salesSnap = await getDocs(query(collection(db, 'cashvan_sales'), where('cashvanName', '==', trimmedOld)));
    for (const d of salesSnap.docs) {
      await updateDoc(doc(db, 'cashvan_sales', d.id), { cashvanName: trimmedNew });
    }
  } catch (err) {
    console.error('Error updating cashvan_sales:', err);
  }

  // 6. Update all `cashvan_transfers` where cashvanName == trimmedOld
  try {
    const transfersSnap = await getDocs(query(collection(db, 'cashvan_transfers'), where('cashvanName', '==', trimmedOld)));
    for (const d of transfersSnap.docs) {
      await updateDoc(doc(db, 'cashvan_transfers', d.id), { cashvanName: trimmedNew });
    }
  } catch (err) {
    console.error('Error updating cashvan_transfers:', err);
  }

  // 7. Update all `cashvan_inventory` where cashvanName == trimmedOld
  try {
    const invSnap = await getDocs(query(collection(db, 'cashvan_inventory'), where('cashvanName', '==', trimmedOld)));
    for (const d of invSnap.docs) {
      await updateDoc(doc(db, 'cashvan_inventory', d.id), { cashvanName: trimmedNew });
    }
  } catch (err) {
    console.error('Error updating cashvan_inventory:', err);
  }

  // 8. Update all `cashvan_requisitions` where cashvanName == trimmedOld
  try {
    const reqSnap = await getDocs(query(collection(db, 'cashvan_requisitions'), where('cashvanName', '==', trimmedOld)));
    for (const d of reqSnap.docs) {
      await updateDoc(doc(db, 'cashvan_requisitions', d.id), { cashvanName: trimmedNew });
    }
  } catch (err) {
    console.error('Error updating cashvan_requisitions:', err);
  }

  // 9. Update all `transactions` where relatedEntityId == trimmedOld
  try {
    const transSnap = await getDocs(query(collection(db, 'transactions'), where('relatedEntityId', '==', trimmedOld)));
    for (const d of transSnap.docs) {
      const data = d.data();
      const newDesc = data.description ? data.description.replaceAll(trimmedOld, trimmedNew) : data.description;
      await updateDoc(doc(db, 'transactions', d.id), { 
        relatedEntityId: trimmedNew,
        description: newDesc
      });
    }
  } catch (err) {
    console.error('Error updating transactions:', err);
  }
}
