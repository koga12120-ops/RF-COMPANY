import { collection, doc, getDoc, getDocs, query, where, writeBatch, addDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';
import { Item, StockHistory, Transaction } from '../types';
import { normalizeKurdishArabicText } from './similaritySearch';

export interface SyncItemParams {
  itemId: string;
  oldItem: Item;
  itemData: Partial<Item> & Record<string, any>;
  quantityAdded: number;
  paymentType?: 'cash' | 'debt';
  costPricePerPiece: number;
  totalCostAmount?: number;
  bonusQuantityAdded?: number;
  syncFinancials?: boolean;
  invoiceDate?: number;
}

/**
 * Finds the matching company purchase transaction (company_cash or company_debt) for a warehouse item batch.
 */
export function findMatchingCompanyTransaction(
  item: Item,
  transactions: Array<Transaction & { id: string }>
): (Transaction & { id: string }) | undefined {
  const companyTxs = transactions.filter(
    (t) => t.type === 'company_cash' || t.type === 'company_debt'
  );

  // 1. Exact itemId match
  const byId = companyTxs.find((t) => t.itemId && t.itemId === item.id);
  if (byId) return byId;

  // 2. Fallback match by normalized name + invoiceNo + supplier + closest timestamp
  const cleanInv = (item.invoiceNo || '').trim();
  const cleanSupp = (item.supplier || '').trim();
  const normName = normalizeKurdishArabicText((item.name || '').trim()).toLowerCase();
  if (!normName) return undefined;

  const candidates = companyTxs.filter((t) => {
    const tInv = (t.invoiceNo || '').trim();
    const tDesc = t.description || '';
    const normDesc = normalizeKurdishArabicText(tDesc).toLowerCase();
    const tEnt = (t.relatedEntityId || '').trim();

    const nameMatch = normDesc.includes(normName);
    if (!nameMatch) return false;

    const invMatch = cleanInv
      ? tInv === cleanInv || tDesc.includes(`#${cleanInv}`)
      : !tInv;
    if (!invMatch) return false;

    const suppMatch =
      !cleanSupp ||
      !tEnt ||
      tEnt === cleanSupp ||
      tEnt === 'کۆگا' ||
      tEnt === 'نەزانراو' ||
      tEnt === (item.name || '').trim();

    return suppMatch;
  });

  if (candidates.length === 0) return undefined;

  const itemTime = item.createdAt || 0;
  candidates.sort((a, b) => Math.abs((a.date || 0) - itemTime) - Math.abs((b.date || 0) - itemTime));
  return candidates[0];
}

/**
 * Finds the matching stock_history record for a warehouse item batch.
 */
export function findMatchingStockHistoryDoc(
  item: Item,
  histories: Array<StockHistory & { id: string }>
): (StockHistory & { id: string }) | undefined {
  const byId = histories.find((h) => h.itemId && h.itemId === item.id);
  if (byId) return byId;

  const cleanInv = (item.invoiceNo || '').trim();
  const cleanSupp = (item.supplier || '').trim();
  const normName = normalizeKurdishArabicText((item.name || '').trim()).toLowerCase();
  if (!normName) return undefined;

  const candidates = histories.filter((h) => {
    const hName = normalizeKurdishArabicText((h.itemName || '').trim()).toLowerCase();
    if (hName !== normName) return false;

    const hInv = (h.invoiceNo || '').trim();
    const invMatch = cleanInv ? hInv === cleanInv : !hInv;
    if (!invMatch) return false;

    const hSupp = (h.supplier || '').trim();
    return !cleanSupp || !hSupp || hSupp === cleanSupp;
  });

  if (candidates.length === 0) return undefined;

  const itemTime = item.createdAt || 0;
  candidates.sort((a, b) => Math.abs((a.date || 0) - itemTime) - Math.abs((b.date || 0) - itemTime));
  return candidates[0];
}

/**
 * Updates an item and propagates changes cleanly across stock_history and transactions in Firestore.
 * When syncFinancials is true (full warehouse item edit), updates the existing stock_history and
 * company_cash/company_debt transaction in place (preventing duplicates and preserving debt/cash status).
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
  syncFinancials = false,
  invoiceDate,
}: SyncItemParams) {
  try {
    const cleanNewInvoice = (itemData.invoiceNo !== undefined ? itemData.invoiceNo : oldItem.invoiceNo || '').trim();
    const cleanOldInvoice = (oldItem.invoiceNo || '').trim();
    const oldName = (oldItem.name || '').trim();
    const newName = (itemData.name || oldItem.name || '').trim();
    const oldSupplier = (oldItem.supplier || '').trim();
    const newSupplier = (itemData.supplier !== undefined ? itemData.supplier : oldItem.supplier || '').trim();

    const invoiceChanged = cleanNewInvoice !== cleanOldInvoice;
    const nameChanged = oldName !== newName;
    const supplierChanged = oldSupplier !== newSupplier;

    const itemPayload: Record<string, any> = { ...itemData };
    if (invoiceDate !== undefined && invoiceDate > 0) {
      itemPayload.createdAt = invoiceDate;
    }

    // 1. Update the item document
    await updateDoc(doc(db, 'items', itemId), itemPayload);

    if (syncFinancials) {
      // Load stock_history and transactions to update the matching batch record cleanly in place
      const [historySnap, transSnap] = await Promise.all([
        getDocs(collection(db, 'stock_history')),
        getDocs(collection(db, 'transactions')),
      ]);

      const allHistories: Array<StockHistory & { id: string }> = [];
      historySnap.forEach((d) => allHistories.push({ id: d.id, ...(d.data() as Omit<StockHistory, 'id'>) }));

      const allTransactions: Array<Transaction & { id: string }> = [];
      transSnap.forEach((d) => allTransactions.push({ id: d.id, ...(d.data() as Omit<Transaction, 'id'>) }));

      const matchedHistory = findMatchingStockHistoryDoc({ ...oldItem, id: itemId }, allHistories);
      const matchedTx = findMatchingCompanyTransaction({ ...oldItem, id: itemId }, allTransactions);

      // Compute old batch quantities & cost to detect if partial sales had occurred before this edit
      const oldCTotal = oldItem.cartonQuantity !== undefined ? oldItem.cartonQuantity : (oldItem.unitType === 'carton' ? (oldItem.quantity || 0) : 0);
      const oldCBonus = oldItem.cartonBonusQuantity || (oldItem.unitType === 'carton' ? (oldItem.bonusQuantity || 0) : 0) || 0;
      const oldCPurchased = oldItem.cartonPurchasedQuantity !== undefined ? oldItem.cartonPurchasedQuantity : Math.max(0, oldCTotal - oldCBonus);

      const oldPTotal = oldItem.packetQuantity !== undefined ? oldItem.packetQuantity : (oldItem.unitType === 'packet' ? (oldItem.quantity || 0) : 0);
      const oldPBonus = oldItem.packetBonusQuantity || (oldItem.unitType === 'packet' ? (oldItem.bonusQuantity || 0) : 0) || 0;
      const oldPPurchased = oldItem.packetPurchasedQuantity !== undefined ? oldItem.packetPurchasedQuantity : Math.max(0, oldPTotal - oldPBonus);

      const oldPurchasedTotal = oldCPurchased + oldPPurchased;
      const oldCCost = oldItem.cartonCostPrice || oldItem.cartonPurchaseCost || oldItem.costPrice || 0;
      const oldPCost = oldItem.packetCostPrice || oldItem.packetPurchaseCost || 0;
      const oldCostTotal = (oldCPurchased * oldCCost) + (oldPPurchased * oldPCost);

      const newCPurchased = Number(itemData.cartonPurchasedQuantity ?? 0);
      const newCBonus = Number(itemData.cartonBonusQuantity ?? 0);
      const newPPurchased = Number(itemData.packetPurchasedQuantity ?? 0);
      const newPBonus = Number(itemData.packetBonusQuantity ?? 0);
      const newCCost = Number(itemData.cartonCostPrice ?? itemData.cartonPurchaseCost ?? 0);
      const newPCost = Number(itemData.packetCostPrice ?? itemData.packetPurchaseCost ?? 0);

      let alreadySoldCartons = 0;
      let alreadySoldPackets = 0;
      if (matchedTx && matchedHistory && (matchedTx.amount || 0) > oldCostTotal + 1) {
        const histPurchased = matchedHistory.purchasedQuantity ?? matchedHistory.quantityAdded ?? 0;
        const extraSold = Math.max(0, histPurchased - oldPurchasedTotal);
        if (extraSold > 0) {
          if (oldItem.unitType === 'packet' && newCPurchased === 0) {
            alreadySoldPackets = extraSold;
          } else {
            alreadySoldCartons = extraSold;
          }
        }
      }

      const effectiveCartonPurchased = newCPurchased + alreadySoldCartons;
      const effectivePacketPurchased = newPPurchased + alreadySoldPackets;
      const effectiveTotalPurchased = effectiveCartonPurchased + effectivePacketPurchased;
      const effectiveTotalBonus = newCBonus + newPBonus;
      const effectiveTotalQty = effectiveTotalPurchased + effectiveTotalBonus;
      const effectiveTotalCost = (effectiveCartonPurchased * newCCost) + (effectivePacketPurchased * newPCost);

      const giftDetails: string[] = [];
      if (newCBonus > 0) giftDetails.push(`${newCBonus} کارتۆن دیاری`);
      if (newPBonus > 0) giftDetails.push(`${newPBonus} پاکەت دیاری`);
      const giftNote = giftDetails.length > 0 ? ` (+ ${giftDetails.join(' و ')} بە بێ تێچوو)` : '';

      const effectiveDate = invoiceDate || matchedTx?.date || matchedHistory?.date || oldItem.createdAt || Date.now();

      // Update or add stock_history
      const historyPayload: Record<string, any> = {
        itemId,
        itemName: newName,
        quantityAdded: effectiveTotalQty,
        purchasedQuantity: effectiveTotalPurchased,
        bonusQuantity: effectiveTotalBonus,
        cartonBonus: newCBonus,
        packetBonus: newPBonus,
        unit: itemData.unitType || oldItem.unitType || 'carton',
        date: effectiveDate,
        invoiceNo: cleanNewInvoice,
        supplier: newSupplier,
        notes: giftDetails.length > 0 ? `دیاری: ${giftDetails.join(' و ')} (تێچوو سفر - تەواو قازانج)` : '',
      };

      if (matchedHistory) {
        await updateDoc(doc(db, 'stock_history', matchedHistory.id), historyPayload);
      } else if (effectiveTotalQty > 0) {
        await addDoc(collection(db, 'stock_history'), historyPayload);
      }

      // Remove any duplicate stock_history docs explicitly tagged with the same itemId
      for (const h of allHistories) {
        if (h.itemId === itemId && matchedHistory && h.id !== matchedHistory.id) {
          await deleteDoc(doc(db, 'stock_history', h.id));
        }
      }

      // Resolve payment type: explicit choice > existing tx type > 'cash'
      const resolvedPaymentType: 'cash' | 'debt' =
        paymentType || (matchedTx?.type === 'company_debt' ? 'debt' : 'cash');
      const transType = resolvedPaymentType === 'cash' ? 'company_cash' : 'company_debt';

      const unitParts: string[] = [];
      if (effectiveCartonPurchased > 0) unitParts.push(`${effectiveCartonPurchased} کارتۆن`);
      if (effectivePacketPurchased > 0) unitParts.push(`${effectivePacketPurchased} پاکەت`);
      const unitLabel = unitParts.join(' و ') || ((itemData.unitType || oldItem.unitType) === 'packet' ? 'پاکەت' : 'کارتۆن');

      const transactionDesc =
        resolvedPaymentType === 'cash'
          ? cleanNewInvoice
            ? `نەقدی کڕین (وەسڵی #${cleanNewInvoice}) - ${newName} (${unitLabel}${giftNote})`
            : `نەقدی کڕینی کاڵای ${newName}${giftNote}`
          : cleanNewInvoice
            ? `قەرزی کڕین (وەسڵی #${cleanNewInvoice}) - ${newName} (${unitLabel}${giftNote})`
            : `قەرزی کڕینی کاڵای ${newName}${giftNote}`;

      const txPayload: Record<string, any> = {
        itemId,
        type: transType,
        amount: effectiveTotalCost,
        date: effectiveDate,
        description: transactionDesc,
        relatedEntityId: newSupplier || newName || 'کۆگا',
        invoiceNo: cleanNewInvoice,
      };

      if (matchedTx) {
        await updateDoc(doc(db, 'transactions', matchedTx.id), txPayload);
      } else if (effectiveTotalCost > 0 || effectiveTotalQty > 0) {
        await addDoc(collection(db, 'transactions'), txPayload);
      }

      // Clean up any duplicate company transactions explicitly tagged with the same itemId
      for (const t of allTransactions) {
        if (
          t.itemId === itemId &&
          (t.type === 'company_cash' || t.type === 'company_debt') &&
          matchedTx &&
          t.id !== matchedTx.id
        ) {
          await deleteDoc(doc(db, 'transactions', t.id));
        }
      }

      return;
    }

    // Legacy / metadata-only propagation (e.g. changing invoiceNo from CompaniesView)
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
        notes: bonusQuantityAdded > 0 ? `دیاری: ${bonusQuantityAdded} بە بێ تێچوو` : '',
      });

      const actualCost = totalCostAmount !== undefined ? totalCostAmount : costPricePerPiece * Math.max(0, quantityAdded - bonusQuantityAdded);
      const giftSuffix = bonusQuantityAdded > 0 ? ` (+ ${bonusQuantityAdded} دیاری بە بێ تێچوو)` : '';
      const resolvedPay = paymentType || 'cash';
      const transactionDesc =
        resolvedPay === 'cash'
          ? cleanNewInvoice
            ? `نەقدی کڕین (وەسڵی #${cleanNewInvoice}) - ${newName}${giftSuffix}`
            : `نەقدی زیادکردنی کاڵای ${newName}${giftSuffix}`
          : cleanNewInvoice
            ? `قەرزی کڕین (وەسڵی #${cleanNewInvoice}) - ${newName}${giftSuffix}`
            : `قەرزی زیادکردنی کاڵای ${newName}${giftSuffix}`;

      await addDoc(collection(db, 'transactions'), {
        itemId,
        type: resolvedPay === 'cash' ? 'company_cash' : 'company_debt',
        amount: actualCost,
        date: Date.now(),
        description: transactionDesc,
        relatedEntityId: newSupplier || 'نەزانراو',
        invoiceNo: cleanNewInvoice || '',
      });
    }

    if (invoiceChanged || nameChanged || supplierChanged) {
      const [historySnap, transSnap] = await Promise.all([
        getDocs(collection(db, 'stock_history')),
        getDocs(collection(db, 'transactions')),
      ]);

      const allHistories: Array<StockHistory & { id: string }> = [];
      historySnap.forEach((d) => allHistories.push({ id: d.id, ...(d.data() as Omit<StockHistory, 'id'>) }));
      const matchedHistory = findMatchingStockHistoryDoc({ ...oldItem, id: itemId }, allHistories);

      if (matchedHistory) {
        const updates: any = { itemId };
        if (invoiceChanged) updates.invoiceNo = cleanNewInvoice;
        if (nameChanged) updates.itemName = newName;
        if (supplierChanged) updates.supplier = newSupplier;
        await updateDoc(doc(db, 'stock_history', matchedHistory.id), updates);
      }

      const allTransactions: Array<Transaction & { id: string }> = [];
      transSnap.forEach((d) => allTransactions.push({ id: d.id, ...(d.data() as Omit<Transaction, 'id'>) }));
      const matchedTx = findMatchingCompanyTransaction({ ...oldItem, id: itemId }, allTransactions);

      if (matchedTx) {
        const updates: any = { itemId };
        if (invoiceChanged) updates.invoiceNo = cleanNewInvoice;
        if (supplierChanged) updates.relatedEntityId = newSupplier || 'کۆگا';
        let updatedDesc = matchedTx.description || '';
        if (cleanOldInvoice && cleanNewInvoice && updatedDesc.includes(`وەسڵی #${cleanOldInvoice}`)) {
          updatedDesc = updatedDesc.replace(`وەسڵی #${cleanOldInvoice}`, `وەسڵی #${cleanNewInvoice}`);
        } else if (cleanNewInvoice && !updatedDesc.includes(`وەسڵی #`)) {
          updatedDesc = `${updatedDesc} (وەسڵی #${cleanNewInvoice})`;
        }
        if (nameChanged && oldName && updatedDesc.includes(oldName)) {
          updatedDesc = updatedDesc.replaceAll(oldName, newName);
        }
        if (updatedDesc !== matchedTx.description) updates.description = updatedDesc;
        await updateDoc(doc(db, 'transactions', matchedTx.id), updates);
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

      const matchById = itemId && tData.itemId === itemId;
      const matchOldInvoice = cleanOldInvoice && tInvoice === cleanOldInvoice;
      const matchName = itemName && tDesc.includes(itemName);
      const matchInvoiceInDesc = cleanOldInvoice && tDesc.includes(`وەسڵی #${cleanOldInvoice}`);

      if (matchById || matchOldInvoice || (matchName && (!tInvoice || matchInvoiceInDesc))) {
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

function stripGiftSuffix(name?: string): string {
  return (name || '').replace(/\(هەدیە\)/g, '').trim();
}

function extractRawVanItemId(vanName: string, itemId?: string): string {
  const idStr = (itemId || '').trim();
  if (!idStr) return '';
  const cleanVan = vanName.trim();
  const prefix = `${cleanVan}_`;
  if (idStr.toLowerCase().startsWith(prefix.toLowerCase())) {
    return idStr.slice(prefix.length);
  }
  return idStr;
}

function aggregateCashvanSaleItems(vanName: string, itemsList: any[] = []) {
  const map = new Map<string, { itemId: string; rawItemId: string; name: string; normName: string; unit: 'carton' | 'packet'; barcode: string; price: number; qty: number }>();
  for (const it of itemsList) {
    const qty = (Number(it.quantity) || 0) + (Number(it.giftQuantity) || 0);
    if (qty <= 0) continue;
    const rawItemId = extractRawVanItemId(vanName, it.itemId || it.id);
    const cleanName = stripGiftSuffix(it.name);
    const normName = normalizeKurdishArabicText(cleanName).toLowerCase();
    const key = rawItemId ? `id:${rawItemId}` : `name:${normName}`;
    const existing = map.get(key);
    if (existing) {
      existing.qty = Math.round((existing.qty + qty) * 1000) / 1000;
      if (!existing.price && it.price) existing.price = Number(it.price) || 0;
      if (!existing.barcode && it.barcode && it.barcode !== '-') existing.barcode = it.barcode;
    } else {
      map.set(key, {
        itemId: (it.itemId || it.id || '').trim(),
        rawItemId,
        name: cleanName,
        normName,
        unit: it.unit === 'packet' ? 'packet' : 'carton',
        barcode: it.barcode && it.barcode !== '-' ? it.barcode : '',
        price: Number(it.price) || 0,
        qty: Math.round(qty * 1000) / 1000,
      });
    }
  }
  return map;
}

async function applyCashvanInventoryDeltas(
  vanName: string,
  deltas: Array<{ itemId?: string; rawItemId?: string; name?: string; normName?: string; unit?: 'carton' | 'packet'; barcode?: string; price?: number; delta: number }>,
  catalogItems?: Item[]
) {
  const cleanVan = (vanName || '').trim();
  if (!cleanVan || deltas.length === 0) return;
  const cleanVanLower = cleanVan.toLowerCase();

  const invSnap = await getDocs(collection(db, 'cashvan_inventory'));
  const vanDocs: Array<{ id: string; data: any; ref: any }> = [];
  invSnap.forEach((d) => {
    const data = d.data();
    const docVan = (data.cashvanName || '').trim().toLowerCase();
    if (docVan === cleanVanLower || d.id.toLowerCase().startsWith(`${cleanVanLower}_`)) {
      vanDocs.push({ id: d.id, data, ref: d.ref });
    }
  });

  let resolvedCatalog = catalogItems;

  for (const entry of deltas) {
    if (!entry.delta) continue;
    const cleanName = stripGiftSuffix(entry.name);
    const normName = entry.normName || normalizeKurdishArabicText(cleanName).toLowerCase();
    const rawId = entry.rawItemId || extractRawVanItemId(cleanVan, entry.itemId);

    const matched = vanDocs.find((d) => {
      const dItemId = (d.data.itemId || '').trim();
      const dRawId = extractRawVanItemId(cleanVan, dItemId);
      if (rawId && (dItemId === rawId || dRawId === rawId || d.id === `${cleanVan}_${rawId}` || d.id.toLowerCase() === `${cleanVanLower}_${rawId.toLowerCase()}`)) {
        return true;
      }
      if (entry.itemId && (dItemId === entry.itemId || d.id === entry.itemId)) {
        return true;
      }
      const dNormName = normalizeKurdishArabicText(stripGiftSuffix(d.data.name)).toLowerCase();
      return !!normName && dNormName === normName;
    });

    if (matched) {
      const curQty = Number(matched.data.quantity || 0);
      const newQty = Math.max(0, Math.round((curQty + entry.delta) * 1000) / 1000);
      await updateDoc(matched.ref, {
        quantity: newQty,
        cashvanName: matched.data.cashvanName || cleanVan,
        lastUpdated: Date.now(),
      });
      matched.data.quantity = newQty;
    } else if (entry.delta > 0) {
      if (!resolvedCatalog) {
        const itemsSnap = await getDocs(collection(db, 'items'));
        resolvedCatalog = [];
        itemsSnap.forEach((d) => resolvedCatalog!.push({ ...(d.data() as Item), id: d.id }));
      }

      const catItem = resolvedCatalog.find((i) =>
        (rawId && i.id === rawId) ||
        (entry.itemId && i.id === entry.itemId) ||
        (normName && normalizeKurdishArabicText((i.name || '').trim()).toLowerCase() === normName)
      );

      const finalItemId = rawId || catItem?.id || '';
      const newDocId = `${cleanVan}_${finalItemId || Date.now()}`;
      const unit = entry.unit || (catItem?.packetSellingPrice && !catItem?.cartonSellingPrice ? 'packet' : 'carton');
      const restoredQty = Math.round(entry.delta * 1000) / 1000;

      const newDocRef = doc(db, 'cashvan_inventory', newDocId);
      const payload = {
        cashvanName: cleanVan,
        itemId: finalItemId,
        name: catItem?.name || cleanName || 'کاڵا',
        quantity: restoredQty,
        unit,
        barcode: catItem?.barcode || entry.barcode || '',
        costPrice: unit === 'packet' ? (catItem?.packetCostPrice || catItem?.costPrice || 0) : (catItem?.cartonCostPrice || catItem?.costPrice || 0),
        sellingPrice: unit === 'packet' ? (catItem?.packetSellingPrice || catItem?.sellingPrice || entry.price || 0) : (catItem?.cartonSellingPrice || catItem?.sellingPrice || entry.price || 0),
        wholesalePrice: unit === 'packet' ? (catItem?.packetWholesalePrice || catItem?.wholesalePrice || 0) : (catItem?.cartonWholesalePrice || catItem?.wholesalePrice || 0),
        cartonCostPrice: catItem?.cartonCostPrice || 0,
        cartonSellingPrice: catItem?.cartonSellingPrice || 0,
        cartonWholesalePrice: catItem?.cartonWholesalePrice || 0,
        packetCostPrice: catItem?.packetCostPrice || 0,
        packetSellingPrice: catItem?.packetSellingPrice || 0,
        packetWholesalePrice: catItem?.packetWholesalePrice || 0,
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      };

      await setDoc(newDocRef, payload, { merge: true });
      vanDocs.push({ id: newDocId, data: payload, ref: newDocRef });
    }
  }
}

/**
 * Restores sold & gift items from a deleted Cashvan sale back into `cashvan_inventory`.
 */
export async function restoreCashvanSaleInventory(vanName: string, saleItems: any[] = [], catalogItems?: Item[]) {
  if (!vanName || !saleItems || saleItems.length === 0) return;
  try {
    const agg = aggregateCashvanSaleItems(vanName, saleItems);
    const deltas = Array.from(agg.values()).map((it) => ({
      ...it,
      delta: it.qty,
    }));
    await applyCashvanInventoryDeltas(vanName, deltas, catalogItems);
  } catch (error) {
    console.error('Error restoring cashvan sale inventory:', error);
    handleFirestoreError(error, OperationType.UPDATE, 'cashvan_inventory');
    throw error;
  }
}

/**
 * Synchronizes `cashvan_inventory` when an existing Cashvan sale is edited (aggregates regular + gift lines safely).
 */
export async function syncCashvanSaleInventoryEdit(vanName: string, oldItems: any[] = [], newItems: any[] = [], catalogItems?: Item[]) {
  if (!vanName) return;
  try {
    const oldMap = aggregateCashvanSaleItems(vanName, oldItems);
    const newMap = aggregateCashvanSaleItems(vanName, newItems);
    const deltas: Array<{ itemId?: string; rawItemId?: string; name?: string; normName?: string; unit?: 'carton' | 'packet'; barcode?: string; price?: number; delta: number }> = [];

    for (const [key, oldIt] of oldMap.entries()) {
      const newIt = newMap.get(key);
      const diff = Math.round((oldIt.qty - (newIt?.qty || 0)) * 1000) / 1000;
      if (diff !== 0) {
        deltas.push({ ...oldIt, delta: diff });
      }
    }

    for (const [key, newIt] of newMap.entries()) {
      if (!oldMap.has(key) && newIt.qty > 0) {
        deltas.push({ ...newIt, delta: -newIt.qty });
      }
    }

    await applyCashvanInventoryDeltas(vanName, deltas, catalogItems);
  } catch (error) {
    console.error('Error syncing cashvan sale edit inventory:', error);
    handleFirestoreError(error, OperationType.UPDATE, 'cashvan_inventory');
    throw error;
  }
}

/**
 * Deletes all ledger transactions linked to a Cashvan sale by saleId, invoiceNo, or invoiceId.
 */
export async function deleteCashvanSaleTransactions(saleId: string, invoiceNo?: string, invoiceId?: string) {
  const deletedIds = new Set<string>();
  const invoiceKeys = Array.from(new Set([invoiceNo, invoiceId].filter((v): v is string => !!v && v.trim() !== '').map((v) => v.trim())));

  for (const inv of invoiceKeys) {
    const qInv = query(collection(db, 'transactions'), where('invoiceNo', '==', inv));
    const snapInv = await getDocs(qInv);
    for (const d of snapInv.docs) {
      if (!deletedIds.has(d.id)) {
        await deleteDoc(doc(db, 'transactions', d.id));
        deletedIds.add(d.id);
      }
    }
  }

  if (saleId) {
    const qSale = query(collection(db, 'transactions'), where('saleId', '==', saleId));
    const snapSale = await getDocs(qSale);
    for (const d of snapSale.docs) {
      if (!deletedIds.has(d.id)) {
        await deleteDoc(doc(db, 'transactions', d.id));
        deletedIds.add(d.id);
      }
    }
  }
}

