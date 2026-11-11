import { collection, doc, getDocs, query, where, writeBatch, addDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';
import { Item, StockHistory, Transaction } from '../types';
import { normalizeKurdishArabicText } from './similaritySearch';

export interface SyncItemParams {
  itemId: string;
  oldItem: Item;
  itemData: Partial<Item> & Record<string, any>;
  quantityAdded: number;
  paymentType: 'cash' | 'debt';
  costPricePerPiece: number;
  totalCostAmount?: number;
  bonusQuantityAdded?: number;
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
  totalCostAmount,
  bonusQuantityAdded = 0,
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
        bonusQuantity: bonusQuantityAdded,
        purchasedQuantity: Math.max(0, quantityAdded - bonusQuantityAdded),
        date: Date.now(),
        invoiceNo: cleanNewInvoice || '',
        supplier: newSupplier || '',
        notes: bonusQuantityAdded > 0 ? `دیاری: ${bonusQuantityAdded} بە بێ تێچوو` : ''
      });

      const actualCost = totalCostAmount !== undefined ? totalCostAmount : costPricePerPiece * Math.max(0, quantityAdded - bonusQuantityAdded);

      const giftSuffix = bonusQuantityAdded > 0 ? ` (+ ${bonusQuantityAdded} دیاری بە بێ تێچوو)` : '';
      const transactionDesc =
        paymentType === 'cash'
          ? cleanNewInvoice
            ? `نەقدی کڕین (وەسڵی #${cleanNewInvoice}) - ${newName}${giftSuffix}`
            : `نەقدی زیادکردنی کاڵای ${newName}${giftSuffix}`
          : cleanNewInvoice
          ? `قەرزی کڕین (وەسڵی #${cleanNewInvoice}) - ${newName}${giftSuffix}`
          : `قەرزی زیادکردنی کاڵای ${newName}${giftSuffix}`;

      await addDoc(collection(db, 'transactions'), {
        type: paymentType === 'cash' ? 'company_cash' : 'company_debt',
        amount: actualCost,
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

export interface StockAdjustmentItem {
  itemId?: string;
  name: string;
  quantity: number;
  giftQuantity?: number;
  unit?: 'carton' | 'packet';
}

/**
 * Deducts stock from warehouse `items` collection.
 * Matches by itemId or normalized product name across warehouse batches.
 */
export async function deductWarehouseStock(itemsToDeduct: StockAdjustmentItem[]) {
  if (!itemsToDeduct || itemsToDeduct.length === 0) return;

  try {
    const itemsSnap = await getDocs(collection(db, 'items'));
    const allWhDocs: Array<{ id: string; data: any; ref: any }> = [];
    itemsSnap.forEach(d => allWhDocs.push({ id: d.id, data: d.data(), ref: d.ref }));

    for (const reqItem of itemsToDeduct) {
      let remainingNeeded = (reqItem.quantity || 0) + (reqItem.giftQuantity || 0);
      if (remainingNeeded <= 0) continue;

      const unit = reqItem.unit || 'carton';
      const cleanReqName = normalizeKurdishArabicText((reqItem.name || '').replace(/\(هەدیە\)/g, '').trim()).toLowerCase();

      // Find matching items: first by id if available, else by normalized name
      const matchingDocs = allWhDocs.filter(d => {
        if (reqItem.itemId && d.id === reqItem.itemId) return true;
        const dName = normalizeKurdishArabicText((d.data.name || '').trim()).toLowerCase();
        return dName === cleanReqName;
      });

      if (matchingDocs.length === 0) {
        console.warn('deductWarehouseStock: No matching warehouse item found for', reqItem.name, reqItem.itemId);
        continue;
      }

      // Prioritize batches that actually have available stock for the requested unit
      matchingDocs.sort((a, b) => {
        const aTotal = a.data.quantity || 0;
        const bTotal = b.data.quantity || 0;
        const aBatchQty = unit === 'packet'
          ? (a.data.packetQuantity !== undefined ? a.data.packetQuantity : aTotal)
          : (a.data.cartonQuantity !== undefined ? a.data.cartonQuantity : aTotal);
        const bBatchQty = unit === 'packet'
          ? (b.data.packetQuantity !== undefined ? b.data.packetQuantity : bTotal)
          : (b.data.cartonQuantity !== undefined ? b.data.cartonQuantity : bTotal);

        if (aBatchQty > 0 && bBatchQty <= 0) return -1;
        if (bBatchQty > 0 && aBatchQty <= 0) return 1;
        return (a.data.createdAt || 0) - (b.data.createdAt || 0);
      });

      for (const mDoc of matchingDocs) {
        if (remainingNeeded <= 0) break;
        const curData = mDoc.data;
        const curTotalQty = curData.quantity || 0;
        const curCartonQty = curData.cartonQuantity !== undefined ? curData.cartonQuantity : curTotalQty;
        const curPacketQty = curData.packetQuantity !== undefined ? curData.packetQuantity : curTotalQty;

        const availableInBatch = unit === 'packet' ? curPacketQty : curCartonQty;
        if (availableInBatch <= 0) {
          continue; // skip batches with zero stock so they do not swallow remainingNeeded
        }

        const deductAmount = Math.min(remainingNeeded, availableInBatch);
        if (deductAmount <= 0) continue;

        const newTotalQty = Math.max(0, curTotalQty - deductAmount);
        const updates: any = { quantity: newTotalQty };

        if (unit === 'carton') {
          updates.cartonQuantity = Math.max(0, curCartonQty - deductAmount);
          if (curData.cartonPurchasedQuantity !== undefined) {
            updates.cartonPurchasedQuantity = Math.max(0, curData.cartonPurchasedQuantity - deductAmount);
          }
        } else if (unit === 'packet') {
          updates.packetQuantity = Math.max(0, curPacketQty - deductAmount);
          if (curData.packetPurchasedQuantity !== undefined) {
            updates.packetPurchasedQuantity = Math.max(0, curData.packetPurchasedQuantity - deductAmount);
          }
        }

        await updateDoc(mDoc.ref, updates);
        mDoc.data.quantity = updates.quantity;
        if (updates.cartonQuantity !== undefined) mDoc.data.cartonQuantity = updates.cartonQuantity;
        if (updates.packetQuantity !== undefined) mDoc.data.packetQuantity = updates.packetQuantity;
        if (updates.cartonPurchasedQuantity !== undefined) mDoc.data.cartonPurchasedQuantity = updates.cartonPurchasedQuantity;
        if (updates.packetPurchasedQuantity !== undefined) mDoc.data.packetPurchasedQuantity = updates.packetPurchasedQuantity;

        remainingNeeded -= deductAmount;
      }

      // If stock was lower than requested or all batches were 0, deduct whatever is left from the first batch
      if (remainingNeeded > 0 && matchingDocs.length > 0) {
        const primaryDoc = matchingDocs[0];
        const curData = primaryDoc.data;
        const curTotalQty = curData.quantity || 0;
        const curCartonQty = curData.cartonQuantity !== undefined ? curData.cartonQuantity : curTotalQty;
        const curPacketQty = curData.packetQuantity !== undefined ? curData.packetQuantity : curTotalQty;

        const updates: any = { quantity: Math.max(0, curTotalQty - remainingNeeded) };
        if (unit === 'carton') {
          updates.cartonQuantity = Math.max(0, curCartonQty - remainingNeeded);
          if (curData.cartonPurchasedQuantity !== undefined) {
            updates.cartonPurchasedQuantity = Math.max(0, curData.cartonPurchasedQuantity - remainingNeeded);
          }
        } else if (unit === 'packet') {
          updates.packetQuantity = Math.max(0, curPacketQty - remainingNeeded);
          if (curData.packetPurchasedQuantity !== undefined) {
            updates.packetPurchasedQuantity = Math.max(0, curData.packetPurchasedQuantity - remainingNeeded);
          }
        }

        await updateDoc(primaryDoc.ref, updates);
        primaryDoc.data.quantity = updates.quantity;
        if (updates.cartonQuantity !== undefined) primaryDoc.data.cartonQuantity = updates.cartonQuantity;
        if (updates.packetQuantity !== undefined) primaryDoc.data.packetQuantity = updates.packetQuantity;
        if (updates.cartonPurchasedQuantity !== undefined) primaryDoc.data.cartonPurchasedQuantity = updates.cartonPurchasedQuantity;
        if (updates.packetPurchasedQuantity !== undefined) primaryDoc.data.packetPurchasedQuantity = updates.packetPurchasedQuantity;
        remainingNeeded = 0;
      }
    }
  } catch (error) {
    console.error('Error deducting warehouse stock:', error);
    handleFirestoreError(error, OperationType.UPDATE, 'items');
    throw error;
  }
}

/**
 * Restores stock back to warehouse `items` collection (e.g. when an order is deleted or cancelled).
 */
export async function restoreWarehouseStock(itemsToRestore: StockAdjustmentItem[]) {
  if (!itemsToRestore || itemsToRestore.length === 0) return;

  try {
    const itemsSnap = await getDocs(collection(db, 'items'));
    const allWhDocs: Array<{ id: string; data: any; ref: any }> = [];
    itemsSnap.forEach(d => allWhDocs.push({ id: d.id, data: d.data(), ref: d.ref }));

    for (const reqItem of itemsToRestore) {
      const quantityToRestore = (reqItem.quantity || 0) + (reqItem.giftQuantity || 0);
      if (quantityToRestore <= 0) continue;

      const unit = reqItem.unit || 'carton';
      const cleanReqName = normalizeKurdishArabicText((reqItem.name || '').replace(/\(هەدیە\)/g, '').trim()).toLowerCase();

      // Find matching item batch (preferably by itemId or first matching name)
      let targetDoc = allWhDocs.find(d => reqItem.itemId && d.id === reqItem.itemId);
      if (!targetDoc) {
        targetDoc = allWhDocs.find(d => {
          const dName = normalizeKurdishArabicText((d.data.name || '').trim()).toLowerCase();
          return dName === cleanReqName;
        });
      }

      if (targetDoc) {
        const curData = targetDoc.data;
        const curTotalQty = curData.quantity || 0;
        const newTotalQty = curTotalQty + quantityToRestore;
        const updates: any = { quantity: newTotalQty };

        if (unit === 'carton') {
          const curCarton = curData.cartonQuantity !== undefined ? curData.cartonQuantity : curTotalQty;
          updates.cartonQuantity = curCarton + quantityToRestore;
          if (curData.cartonPurchasedQuantity !== undefined) {
            updates.cartonPurchasedQuantity = curData.cartonPurchasedQuantity + quantityToRestore;
          }
        } else if (unit === 'packet') {
          const curPacket = curData.packetQuantity !== undefined ? curData.packetQuantity : curTotalQty;
          updates.packetQuantity = curPacket + quantityToRestore;
          if (curData.packetPurchasedQuantity !== undefined) {
            updates.packetPurchasedQuantity = curData.packetPurchasedQuantity + quantityToRestore;
          }
        }

        await updateDoc(targetDoc.ref, updates);
        targetDoc.data.quantity = updates.quantity;
        if (updates.cartonQuantity !== undefined) targetDoc.data.cartonQuantity = updates.cartonQuantity;
        if (updates.packetQuantity !== undefined) targetDoc.data.packetQuantity = updates.packetQuantity;
        if (updates.cartonPurchasedQuantity !== undefined) targetDoc.data.cartonPurchasedQuantity = updates.cartonPurchasedQuantity;
        if (updates.packetPurchasedQuantity !== undefined) targetDoc.data.packetPurchasedQuantity = updates.packetPurchasedQuantity;
      }
    }
  } catch (error) {
    console.error('Error restoring warehouse stock:', error);
    handleFirestoreError(error, OperationType.UPDATE, 'items');
    throw error;
  }
}
