import { collection, doc, getDocs, query, where, writeBatch, addDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';
import { Item, StockHistory, Transaction } from '../types';

export interface SyncItemParams {
  itemId: string;
  oldItem: Item;
  itemData: Partial<Item> & Record<string, any>;
  quantityAdded: number;
  paymentType: 'cash' | 'debt';
  costPricePerPiece: number;
}

/**
 * Updates an item and propagates any changes to invoiceNo, name, and supplier
 * across all stock_history and transactions in Firestore.
 */
export async function updateItemAndSyncEverywhere({
  itemId,
  oldItem,
  itemData,
  quantityAdded,
  paymentType,
  costPricePerPiece,
}: SyncItemParams) {
  try {
    const cleanNewInvoice = (itemData.invoiceNo || '').trim();
    const cleanOldInvoice = (oldItem.invoiceNo || '').trim();
    const oldName = (oldItem.name || '').trim();
    const newName = (itemData.name || oldItem.name || '').trim();
    const oldSupplier = (oldItem.supplier || '').trim();
    const newSupplier = (itemData.supplier || oldItem.supplier || '').trim();

    const invoiceChanged = cleanNewInvoice !== cleanOldInvoice;
    const nameChanged = oldName !== newName;
    const supplierChanged = oldSupplier !== newSupplier;

    // 1. Update the item document
    await updateDoc(doc(db, 'items', itemId), itemData);

    // 2. If new stock was added in this edit turn, record history and transaction
    if (quantityAdded > 0) {
      await addDoc(collection(db, 'stock_history'), {
        itemId,
        itemName: newName,
        quantityAdded,
        date: Date.now(),
        invoiceNo: cleanNewInvoice || '',
        supplier: newSupplier || '',
      });

      const transactionDesc =
        paymentType === 'cash'
          ? cleanNewInvoice
            ? `نەقدی کڕین (وەسڵی #${cleanNewInvoice}) - ${newName}`
            : `نەقدی زیادکردنی کاڵای ${newName}`
          : cleanNewInvoice
          ? `قەرزی کڕین (وەسڵی #${cleanNewInvoice}) - ${newName}`
          : `قەرزی زیادکردنی کاڵای ${newName}`;

      await addDoc(collection(db, 'transactions'), {
        type: paymentType === 'cash' ? 'company_cash' : 'company_debt',
        amount: costPricePerPiece * quantityAdded,
        date: Date.now(),
        description: transactionDesc,
        relatedEntityId: newSupplier || 'نەزانراو',
        invoiceNo: cleanNewInvoice || '',
      });
    }

    // 3. If invoiceNo, name, or supplier changed, propagate globally
    if (invoiceChanged || nameChanged || supplierChanged) {
      // A. Update matching stock_history
      const historySnap = await getDocs(collection(db, 'stock_history'));
      const historyBatch = writeBatch(db);
      let historyUpdatesCount = 0;

      historySnap.forEach((d) => {
        const hData = d.data() as StockHistory;
        const isExactItem = hData.itemId === itemId;
        const isMatchingNameAndOldInvoice =
          hData.itemName === oldName &&
          (!cleanOldInvoice || hData.invoiceNo === cleanOldInvoice);

        if (isExactItem || isMatchingNameAndOldInvoice) {
          const updates: any = {};
          if (invoiceChanged) updates.invoiceNo = cleanNewInvoice;
          if (nameChanged) updates.itemName = newName;
          if (supplierChanged) updates.supplier = newSupplier;

          if (Object.keys(updates).length > 0) {
            historyBatch.update(doc(db, 'stock_history', d.id), updates);
            historyUpdatesCount++;
          }
        }
      });

      if (historyUpdatesCount > 0) {
        await historyBatch.commit();
      }

      // B. Update matching transactions
      const transSnap = await getDocs(collection(db, 'transactions'));
      const transBatch = writeBatch(db);
      let transUpdatesCount = 0;

      transSnap.forEach((d) => {
        const tData = d.data() as Transaction;
        const tDesc = tData.description || '';
        const tInvoice = (tData.invoiceNo || '').trim();
        const tEntity = (tData.relatedEntityId || '').trim();

        const matchInvoice = cleanOldInvoice && tInvoice === cleanOldInvoice;
        const matchEntity =
          (oldSupplier && tEntity === oldSupplier) || (newSupplier && tEntity === newSupplier);
        const matchNameInDesc = oldName && tDesc.includes(oldName);
        const matchOldInvoiceInDesc =
          cleanOldInvoice && tDesc.includes(`وەسڵی #${cleanOldInvoice}`);

        // If this transaction belongs to this item or this invoice
        if ((matchInvoice && (matchEntity || matchNameInDesc)) || matchNameInDesc || matchOldInvoiceInDesc) {
          const updates: any = {};
          if (invoiceChanged) {
            updates.invoiceNo = cleanNewInvoice;
          }
          if (supplierChanged && (!tEntity || tEntity === oldSupplier)) {
            updates.relatedEntityId = newSupplier;
          }

          // Update description if name or invoice changed
          let updatedDesc = tDesc;
          if (cleanOldInvoice && cleanNewInvoice && tDesc.includes(`وەسڵی #${cleanOldInvoice}`)) {
            updatedDesc = updatedDesc.replace(`وەسڵی #${cleanOldInvoice}`, `وەسڵی #${cleanNewInvoice}`);
          } else if (cleanNewInvoice && !tDesc.includes(`وەسڵی #`)) {
            if (tDesc.includes('نەقدی کڕین') || tDesc.includes('قەرزی کڕین') || tDesc.includes('زیادکردنی')) {
              updatedDesc = `${updatedDesc} (وەسڵی #${cleanNewInvoice})`;
            }
          }
          if (nameChanged && oldName && updatedDesc.includes(oldName)) {
            updatedDesc = updatedDesc.replaceAll(oldName, newName);
          }

          if (updatedDesc !== tDesc) {
            updates.description = updatedDesc;
          }

          if (Object.keys(updates).length > 0) {
            transBatch.update(doc(db, 'transactions', d.id), updates);
            transUpdatesCount++;
          }
        }
      });

      if (transUpdatesCount > 0) {
        await transBatch.commit();
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'items');
    throw error;
  }
}

/**
 * Propagates changes made directly to a stock history entry's invoice or quantity
 */
export async function syncHistoryInvoice({
  historyId,
  itemId,
  oldInvoiceNo,
  newInvoiceNo,
  itemName,
  supplier,
}: {
  historyId: string;
  itemId?: string;
  oldInvoiceNo?: string;
  newInvoiceNo: string;
  itemName?: string;
  supplier?: string;
}) {
  try {
    const cleanNewInvoice = newInvoiceNo.trim();
    const cleanOldInvoice = (oldInvoiceNo || '').trim();

    // 1. Update this specific stock_history
    await updateDoc(doc(db, 'stock_history', historyId), {
      invoiceNo: cleanNewInvoice,
    });

    // 2. If itemId is provided, update item's invoiceNo
    if (itemId) {
      await updateDoc(doc(db, 'items', itemId), {
        invoiceNo: cleanNewInvoice,
      });
    } else if (itemName) {
      const qItem = query(collection(db, 'items'), where('name', '==', itemName));
      const snap = await getDocs(qItem);
      snap.forEach(async (d) => {
        await updateDoc(doc(db, 'items', d.id), {
          invoiceNo: cleanNewInvoice,
        });
      });
    }

    // 3. Propagate to transactions
    const transSnap = await getDocs(collection(db, 'transactions'));
    const transBatch = writeBatch(db);
    let transUpdates = 0;

    transSnap.forEach((d) => {
      const tData = d.data() as Transaction;
      const tDesc = tData.description || '';
      const tInvoice = (tData.invoiceNo || '').trim();

      const matchOldInvoice = cleanOldInvoice && tInvoice === cleanOldInvoice;
      const matchName = itemName && tDesc.includes(itemName);
      const matchInvoiceInDesc = cleanOldInvoice && tDesc.includes(`وەسڵی #${cleanOldInvoice}`);

      if (matchOldInvoice || (matchName && (!tInvoice || matchInvoiceInDesc))) {
        const updates: any = { invoiceNo: cleanNewInvoice };
        let updatedDesc = tDesc;
        if (cleanOldInvoice && tDesc.includes(`وەسڵی #${cleanOldInvoice}`)) {
          updatedDesc = updatedDesc.replace(`وەسڵی #${cleanOldInvoice}`, `وەسڵی #${cleanNewInvoice}`);
          updates.description = updatedDesc;
        }
        transBatch.update(doc(db, 'transactions', d.id), updates);
        transUpdates++;
      }
    });

    if (transUpdates > 0) {
      await transBatch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'stock_history');
    throw error;
  }
}
