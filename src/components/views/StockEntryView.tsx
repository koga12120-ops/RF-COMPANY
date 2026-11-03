import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { Item, Role } from '../../types';
import {
  Plus,
  Edit2,
  PackagePlus,
  ArrowLeft,
  CheckCircle2,
  Package,
  AlertTriangle,
  Layers,
  Search,
  Sparkles,
  X,
  ArrowDownRight,
  ShieldAlert,
  Info
} from 'lucide-react';
import { updateItemAndSyncEverywhere } from '../../lib/invoiceSync';
import { findSimilarItems, SimilarItemMatch } from '../../lib/similaritySearch';

interface StockEntryViewProps {
  role: Role;
  onNavigateToInventory?: () => void;
}

export default function StockEntryView({ role, onNavigateToInventory }: StockEntryViewProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [savedSuccessMessage, setSavedSuccessMessage] = useState<string | null>(null);

  // Form state
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState('');
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [supplier, setSupplier] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [keepInvoiceInfo, setKeepInvoiceInfo] = useState(false);

  // Unified Item / Stock Addition state (سەرخستنی بڕ لەسەر هەمان ئایتم)
  const [targetExistingItem, setTargetExistingItem] = useState<Item | null>(null);
  const [dismissedSimilarity, setDismissedSimilarity] = useState(false);
  const [confirmMergeModal, setConfirmMergeModal] = useState<{ open: boolean; matchedItem: Item } | null>(null);

  // Units selection: carton, packet, or both
  const [hasCarton, setHasCarton] = useState(true);
  const [hasPacket, setHasPacket] = useState(false);

  // Carton fields
  const [cartonQuantity, setCartonQuantity] = useState('');
  const [cartonBonus, setCartonBonus] = useState(''); // دیاری / هەدیەی کارتۆن (تێچوو 0)
  const [cartonCost, setCartonCost] = useState('');
  const [cartonPrice, setCartonPrice] = useState('');
  const [cartonWholesale, setCartonWholesale] = useState('');

  // Packet fields
  const [packetQuantity, setPacketQuantity] = useState('');
  const [packetBonus, setPacketBonus] = useState(''); // دیاری / هەدیەی پاکەت (تێچوو 0)
  const [packetCost, setPacketCost] = useState('');
  const [packetPrice, setPacketPrice] = useState('');
  const [packetWholesale, setPacketWholesale] = useState('');

  const [paymentType, setPaymentType] = useState<'cash' | 'debt'>('cash');

  useEffect(() => {
    // Listen to ALL items for complete catalog similarity search
    const qAll = query(collection(db, 'items'));
    const unsubscribe = onSnapshot(
      qAll,
      (snapshot) => {
        const itemsData: Item[] = [];
        snapshot.forEach((doc) => {
          itemsData.push({ id: doc.id, ...doc.data() } as Item);
        });
        setAllItems(itemsData);
        setItems(itemsData);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'items');
      }
    );

    const qComp = query(collection(db, 'companies'));
    const unsubComp = onSnapshot(
      qComp,
      (snapshot) => {
        const compData: any[] = [];
        snapshot.forEach((doc) => {
          compData.push({ id: doc.id, ...doc.data() });
        });
        setCompanies(compData);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'companies');
      }
    );

    return () => {
      unsubscribe();
      unsubComp();
    };
  }, []);

  // Compute similar items in real time based on name or barcode
  const similarMatches = useMemo(() => {
    if (isEditing || targetExistingItem) return [];
    return findSimilarItems(name, barcode, allItems, isEditing ? editId : undefined, 38);
  }, [name, barcode, allItems, isEditing, editId, targetExistingItem]);

  // 1. Select existing item to add stock to it (یەکخستنی کاڵا بۆ ئەوەی دووبارە نەبێتەوە)
  const handleSelectExistingItemForStockAdd = (matchedItem: Item) => {
    setTargetExistingItem(matchedItem);
    setIsEditing(false);
    setEditId('');
    setName(matchedItem.name);
    setBarcode(matchedItem.barcode || '');
    if (!keepInvoiceInfo && matchedItem.supplier) {
      setSupplier(matchedItem.supplier);
    }
    
    // Determine units based on the item
    const hasC = matchedItem.unitType === 'carton' || matchedItem.unitType === 'both' || (matchedItem.cartonQuantity !== undefined && matchedItem.cartonQuantity > 0);
    const hasP = matchedItem.unitType === 'packet' || matchedItem.unitType === 'both' || (matchedItem.packetQuantity !== undefined && matchedItem.packetQuantity > 0);
    setHasCarton(hasC || !hasP);
    setHasPacket(hasP);

    // Pre-populate prices
    setCartonCost(String(matchedItem.cartonCostPrice || matchedItem.cartonPurchaseCost || matchedItem.costPrice || ''));
    setCartonPrice(String(matchedItem.cartonSellingPrice || matchedItem.sellingPrice || ''));
    setCartonWholesale(String(matchedItem.cartonWholesalePrice || matchedItem.wholesalePrice || ''));

    setPacketCost(String(matchedItem.packetCostPrice || matchedItem.packetPurchaseCost || ''));
    setPacketPrice(String(matchedItem.packetSellingPrice || ''));
    setPacketWholesale(String(matchedItem.packetWholesalePrice || ''));

    // Clear quantity inputs so user enters ONLY the new shipment quantities
    setCartonQuantity('');
    setCartonBonus('');
    setPacketQuantity('');
    setPacketBonus('');
    setDismissedSimilarity(false);
  };

  // 2. Start editing an existing item directly
  const handleStartEditExistingItem = (matchedItem: Item) => {
    setIsEditing(true);
    setEditId(matchedItem.id);
    setTargetExistingItem(null);
    setName(matchedItem.name);
    setBarcode(matchedItem.barcode || '');
    setSupplier(matchedItem.supplier || '');
    setInvoiceNo(matchedItem.invoiceNo || '');
    
    const hasC = matchedItem.unitType === 'carton' || matchedItem.unitType === 'both' || (matchedItem.cartonQuantity !== undefined && matchedItem.cartonQuantity > 0);
    const hasP = matchedItem.unitType === 'packet' || matchedItem.unitType === 'both' || (matchedItem.packetQuantity !== undefined && matchedItem.packetQuantity > 0);
    setHasCarton(hasC || !hasP);
    setHasPacket(hasP);

    setCartonQuantity(String(matchedItem.cartonQuantity || ''));
    setCartonBonus(String(matchedItem.cartonBonusQuantity || ''));
    setCartonCost(String(matchedItem.cartonCostPrice || matchedItem.cartonPurchaseCost || ''));
    setCartonPrice(String(matchedItem.cartonSellingPrice || ''));
    setCartonWholesale(String(matchedItem.cartonWholesalePrice || ''));

    setPacketQuantity(String(matchedItem.packetQuantity || ''));
    setPacketBonus(String(matchedItem.packetBonusQuantity || ''));
    setPacketCost(String(matchedItem.packetCostPrice || matchedItem.packetPurchaseCost || ''));
    setPacketPrice(String(matchedItem.packetSellingPrice || ''));
    setPacketWholesale(String(matchedItem.packetWholesalePrice || ''));
    setDismissedSimilarity(true);
  };

  // 3. Add stock to an existing item document (سەرخستنی بڕ لەسەر هەمان ئایتم)
  const handleUnifiedStockAdd = async (targetItem: Item) => {
    if (!hasCarton && !hasPacket) {
      alert('تکایە بەلایەنی کەم یەکەیەک هەڵبژێرە (کارتۆن یان پاکەت)');
      return;
    }

    const cPurchased = hasCarton ? (Number(cartonQuantity) || 0) : 0;
    const cBonus = hasCarton ? (Number(cartonBonus) || 0) : 0;
    const cTotal = cPurchased + cBonus;

    const pPurchased = hasPacket ? (Number(packetQuantity) || 0) : 0;
    const pBonus = hasPacket ? (Number(packetBonus) || 0) : 0;
    const pTotal = pPurchased + pBonus;

    const totalQtyAdded = cTotal + pTotal;
    const totalPurchasedQty = cPurchased + pPurchased;
    const totalBonusQty = cBonus + pBonus;

    if (totalQtyAdded <= 0) {
      alert('تکایە بڕی کارتۆن یان پاکەتی نوێ بنووسە بۆ سەرخستن لەسەر ئەم کاڵایە');
      return;
    }

    const cCost = hasCarton ? (Number(cartonCost) || 0) : 0;
    const cPrice = hasCarton ? (Number(cartonPrice) || 0) : 0;
    const cWholesale = hasCarton ? (Number(cartonWholesale) || 0) : 0;

    const pCost = hasPacket ? (Number(packetCost) || 0) : 0;
    const pPrice = hasPacket ? (Number(packetPrice) || 0) : 0;
    const pWholesale = hasPacket ? (Number(packetWholesale) || 0) : 0;

    const primaryCost = cCost || pCost;
    const primaryPrice = cPrice || pPrice;
    const totalCostVal = (cPurchased * cCost) + (pPurchased * pCost);
    const cleanInvoice = invoiceNo.trim();
    const cleanSupplier = supplier.trim() || targetItem.supplier || '';

    const oldCartons = targetItem.cartonQuantity || 0;
    const oldPackets = targetItem.packetQuantity || 0;
    const oldTotal = targetItem.quantity || (oldCartons + oldPackets);

    // Accumulated quantities for the unified single item
    const newCartonQuantity = hasCarton ? (oldCartons + cTotal) : oldCartons;
    const newPacketQuantity = hasPacket ? (oldPackets + pTotal) : oldPackets;
    const newTotalQuantity = oldTotal + totalQtyAdded;

    try {
      const updatedItemData: any = {
        quantity: newTotalQuantity,
        cartonQuantity: newCartonQuantity,
        packetQuantity: newPacketQuantity,
        cartonPurchasedQuantity: (targetItem.cartonPurchasedQuantity !== undefined ? targetItem.cartonPurchasedQuantity : Math.max(0, oldCartons - (targetItem.cartonBonusQuantity || 0))) + cPurchased,
        packetPurchasedQuantity: (targetItem.packetPurchasedQuantity !== undefined ? targetItem.packetPurchasedQuantity : Math.max(0, oldPackets - (targetItem.packetBonusQuantity || 0))) + pPurchased,
        cartonBonusQuantity: (targetItem.cartonBonusQuantity || 0) + cBonus,
        packetBonusQuantity: (targetItem.packetBonusQuantity || 0) + pBonus,
        updatedAt: Date.now()
      };

      if (cCost > 0) {
        updatedItemData.cartonPurchaseCost = cCost;
        updatedItemData.cartonCostPrice = cCost;
      }
      if (cPrice > 0) updatedItemData.cartonSellingPrice = cPrice;
      if (cWholesale > 0) updatedItemData.cartonWholesalePrice = cWholesale;

      if (pCost > 0) {
        updatedItemData.packetPurchaseCost = pCost;
        updatedItemData.packetCostPrice = pCost;
      }
      if (pPrice > 0) updatedItemData.packetSellingPrice = pPrice;
      if (pWholesale > 0) updatedItemData.packetWholesalePrice = pWholesale;

      if (primaryCost > 0) updatedItemData.costPrice = primaryCost;
      if (primaryPrice > 0) updatedItemData.sellingPrice = primaryPrice;
      if (cWholesale > 0 || pWholesale > 0) updatedItemData.wholesalePrice = cWholesale || pWholesale;

      if (cleanSupplier) updatedItemData.supplier = cleanSupplier;
      if (cleanInvoice) updatedItemData.invoiceNo = cleanInvoice;
      if (barcode.trim()) updatedItemData.barcode = barcode.trim();

      // Update the unified item in Firestore
      await updateDoc(doc(db, 'items', targetItem.id), updatedItemData);

      // Record in stock history
      const giftDetails = [];
      if (cBonus > 0) giftDetails.push(`${cBonus} کارتۆن دیاری`);
      if (pBonus > 0) giftDetails.push(`${pBonus} پاکەت دیاری`);
      const giftNote = giftDetails.length > 0 ? ` (+ ${giftDetails.join(' و ')} بە بێ تێچوو)` : '';

      await addDoc(collection(db, 'stock_history'), {
        itemId: targetItem.id,
        itemName: targetItem.name,
        quantityAdded: totalQtyAdded,
        purchasedQuantity: totalPurchasedQty,
        bonusQuantity: totalBonusQty,
        cartonBonus: cBonus,
        packetBonus: pBonus,
        unit: hasCarton && hasPacket ? 'both' : (hasCarton ? 'carton' : 'packet'),
        date: Date.now(),
        invoiceNo: cleanInvoice || '',
        supplier: cleanSupplier,
        notes: `سەرخستن لەسەر هەمان ئایتم${giftDetails.length > 0 ? ` - دیاری: ${giftDetails.join(' و ')}` : ''}`
      });

      // Record financial transaction
      const unitParts = [];
      if (hasCarton && cPurchased > 0) unitParts.push(`${cPurchased} کارتۆن`);
      if (hasPacket && pPurchased > 0) unitParts.push(`${pPurchased} پاکەت`);
      const unitLabel = unitParts.join(' و ') || (hasCarton ? 'کارتۆن' : 'پاکەت');

      const transactionDesc = paymentType === 'cash'
        ? (cleanInvoice ? `نەقدی کڕین (وەسڵی #${cleanInvoice}) - ${targetItem.name} (${unitLabel}${giftNote})` : `نەقدی زیادکردنی کاڵای ${targetItem.name}${giftNote}`)
        : (cleanInvoice ? `قەرزی کڕین (وەسڵی #${cleanInvoice}) - ${targetItem.name} (${unitLabel}${giftNote})` : `قەرزی زیادکردنی کاڵای ${targetItem.name}${giftNote}`);

      if (totalCostVal > 0) {
        await addDoc(collection(db, 'transactions'), {
          type: paymentType === 'cash' ? 'company_cash' : 'company_debt',
          amount: totalCostVal,
          date: Date.now(),
          description: transactionDesc,
          relatedEntityId: cleanSupplier || 'نەزانراو',
          invoiceNo: cleanInvoice || ''
        });
      }

      setSavedSuccessMessage(`بڕی نوێی (${totalQtyAdded} دانە) بە سەرکەوتوویی خرایە سەر ئایتمی «${targetItem.name}» (کۆی گشتی لە کۆگا: ${newTotalQuantity} دانە)`);
      setTimeout(() => setSavedSuccessMessage(null), 6000);
      resetForm();
    } catch (error) {
      console.error("Error adding stock to unified item: ", error);
      alert('هەڵەیەک ڕوویدا لە کاتی سەرخستنی بڕ لەسەر ئایتمەکە');
    }
  };

  // 4. Create new item document
  const executeCreateNewItem = async () => {
    if (!name.trim()) return;

    if (!hasCarton && !hasPacket) {
      alert('تکایە بەلایەنی کەم یەکەیەک هەڵبژێرە (کارتۆن یان پاکەت)');
      return;
    }

    const cPurchased = hasCarton ? (Number(cartonQuantity) || 0) : 0;
    const cBonus = hasCarton ? (Number(cartonBonus) || 0) : 0;
    const cTotal = cPurchased + cBonus;

    const pPurchased = hasPacket ? (Number(packetQuantity) || 0) : 0;
    const pBonus = hasPacket ? (Number(packetBonus) || 0) : 0;
    const pTotal = pPurchased + pBonus;

    const cCost = hasCarton ? (Number(cartonCost) || 0) : 0;
    const cPrice = hasCarton ? (Number(cartonPrice) || 0) : 0;
    const cWholesale = hasCarton ? (Number(cartonWholesale) || 0) : 0;

    const pCost = hasPacket ? (Number(packetCost) || 0) : 0;
    const pPrice = hasPacket ? (Number(packetPrice) || 0) : 0;
    const pWholesale = hasPacket ? (Number(packetWholesale) || 0) : 0;

    const totalQty = cTotal + pTotal;
    const totalPurchasedQty = cPurchased + pPurchased;
    const totalBonusQty = cBonus + pBonus;
    const totalCostVal = (cPurchased * cCost) + (pPurchased * pCost);

    const primaryCost = cCost || pCost;
    const primaryPrice = cPrice || pPrice;
    const cleanInvoice = invoiceNo.trim();

    const itemData: any = {
      name: name.trim(),
      barcode: barcode.trim(),
      supplier: supplier.trim(),
      invoiceNo: cleanInvoice,
      quantity: totalQty,
      unitType: hasCarton && hasPacket ? 'both' : (hasCarton ? 'carton' : 'packet'),
      costPrice: primaryCost,
      sellingPrice: primaryPrice,
      wholesalePrice: cWholesale || pWholesale || 0,
      
      cartonQuantity: hasCarton ? cTotal : 0,
      cartonPurchasedQuantity: hasCarton ? cPurchased : 0,
      cartonBonusQuantity: cBonus,
      cartonPurchaseCost: cCost,
      cartonCostPrice: cCost,
      cartonSellingPrice: cPrice,
      cartonWholesalePrice: cWholesale,

      packetQuantity: hasPacket ? pTotal : 0,
      packetPurchasedQuantity: hasPacket ? pPurchased : 0,
      packetBonusQuantity: pBonus,
      packetPurchaseCost: pCost,
      packetCostPrice: pCost,
      packetSellingPrice: pPrice,
      packetWholesalePrice: pWholesale,
    };

    try {
      await addDoc(collection(db, 'items'), {
        ...itemData,
        createdAt: Date.now()
      });

      if (totalQty > 0) {
        const giftDetails = [];
        if (cBonus > 0) giftDetails.push(`${cBonus} کارتۆن دیاری`);
        if (pBonus > 0) giftDetails.push(`${pBonus} پاکەت دیاری`);
        const giftNote = giftDetails.length > 0 ? ` (+ ${giftDetails.join(' و ')} بە بێ تێچوو)` : '';

        await addDoc(collection(db, 'stock_history'), {
          itemName: name.trim(),
          quantityAdded: totalQty,
          purchasedQuantity: totalPurchasedQty,
          bonusQuantity: totalBonusQty,
          cartonBonus: cBonus,
          packetBonus: pBonus,
          unit: hasCarton ? 'carton' : 'packet',
          date: Date.now(),
          invoiceNo: cleanInvoice || '',
          supplier: supplier.trim() || '',
          notes: giftDetails.length > 0 ? `دیاری: ${giftDetails.join(' و ')} (تێچوو سفر - تەواو قازانج)` : ''
        });

        const unitParts = [];
        if (hasCarton && cPurchased > 0) unitParts.push(`${cPurchased} کارتۆن`);
        if (hasPacket && pPurchased > 0) unitParts.push(`${pPurchased} پاکەت`);
        const unitLabel = unitParts.join(' و ') || (hasCarton ? 'کارتۆن' : 'پاکەت');

        const transactionDesc = paymentType === 'cash'
          ? (cleanInvoice ? `نەقدی کڕین (وەسڵی #${cleanInvoice}) - ${name.trim()} (${unitLabel}${giftNote})` : `نەقدی کڕینی کاڵای ${name.trim()}${giftNote}`)
          : (cleanInvoice ? `قەرزی کڕین (وەسڵی #${cleanInvoice}) - ${name.trim()} (${unitLabel}${giftNote})` : `قەرزی کڕینی کاڵای ${name.trim()}${giftNote}`);

        await addDoc(collection(db, 'transactions'), {
          type: paymentType === 'cash' ? 'company_cash' : 'company_debt',
          amount: totalCostVal,
          date: Date.now(),
          description: transactionDesc,
          relatedEntityId: supplier.trim() || 'نەزانراو',
          invoiceNo: cleanInvoice || ''
        });
      }

      setSavedSuccessMessage(`کاڵای «${name.trim()}» بە سەرکەوتوویی داخڵ کرا بۆ کۆگا`);
      setTimeout(() => setSavedSuccessMessage(null), 5000);
      resetForm();
    } catch (error) {
      console.error("Error saving new item: ", error);
      alert('هەڵەیەک ڕوویدا لە کاتی پاشەکەوتکردنی کاڵای نوێدا');
    }
  };

  // Main Form Submission Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // 1. If currently targeting an existing item for unified stock addition
    if (targetExistingItem) {
      await handleUnifiedStockAdd(targetExistingItem);
      return;
    }

    // 2. If actively editing an existing item
    if (isEditing) {
      if (!hasCarton && !hasPacket) {
        alert('تکایە بەلایەنی کەم یەکەیەک هەڵبژێرە (کارتۆن یان پاکەت)');
        return;
      }

      const cPurchased = hasCarton ? (Number(cartonQuantity) || 0) : 0;
      const cBonus = hasCarton ? (Number(cartonBonus) || 0) : 0;
      const cTotal = cPurchased + cBonus;

      const pPurchased = hasPacket ? (Number(packetQuantity) || 0) : 0;
      const pBonus = hasPacket ? (Number(packetBonus) || 0) : 0;
      const pTotal = pPurchased + pBonus;

      const cCost = hasCarton ? (Number(cartonCost) || 0) : 0;
      const cPrice = hasCarton ? (Number(cartonPrice) || 0) : 0;
      const cWholesale = hasCarton ? (Number(cartonWholesale) || 0) : 0;

      const pCost = hasPacket ? (Number(packetCost) || 0) : 0;
      const pPrice = hasPacket ? (Number(packetPrice) || 0) : 0;
      const pWholesale = hasPacket ? (Number(packetWholesale) || 0) : 0;

      const totalQty = cTotal + pTotal;
      const totalPurchasedQty = cPurchased + pPurchased;
      const totalBonusQty = cBonus + pBonus;
      const totalCostVal = (cPurchased * cCost) + (pPurchased * pCost);

      const primaryCost = cCost || pCost;
      const primaryPrice = cPrice || pPrice;
      const cleanInvoice = invoiceNo.trim();

      const itemData: any = {
        name: name.trim(),
        barcode: barcode.trim(),
        supplier: supplier.trim(),
        invoiceNo: cleanInvoice,
        quantity: totalQty,
        unitType: hasCarton && hasPacket ? 'both' : (hasCarton ? 'carton' : 'packet'),
        costPrice: primaryCost,
        sellingPrice: primaryPrice,
        wholesalePrice: cWholesale || pWholesale || 0,
        
        cartonQuantity: hasCarton ? cTotal : 0,
        cartonPurchasedQuantity: hasCarton ? cPurchased : 0,
        cartonBonusQuantity: cBonus,
        cartonPurchaseCost: cCost,
        cartonCostPrice: cCost,
        cartonSellingPrice: cPrice,
        cartonWholesalePrice: cWholesale,

        packetQuantity: hasPacket ? pTotal : 0,
        packetPurchasedQuantity: hasPacket ? pPurchased : 0,
        packetBonusQuantity: pBonus,
        packetPurchaseCost: pCost,
        packetCostPrice: pCost,
        packetSellingPrice: pPrice,
        packetWholesalePrice: pWholesale,
      };

      try {
        const oldItem = allItems.find(i => i.id === editId) || ({} as Item);
        const oldTotal = oldItem.quantity || 0;
        const quantityAdded = totalQty > oldTotal ? totalQty - oldTotal : 0;

        await updateItemAndSyncEverywhere({
          itemId: editId,
          oldItem,
          itemData,
          quantityAdded,
          paymentType,
          costPricePerPiece: primaryCost,
          totalCostAmount: totalCostVal,
          bonusQuantityAdded: totalBonusQty,
        });
        setSavedSuccessMessage(`کاڵای «${name.trim()}» بە سەرکەوتوویی نوێکرایەوە`);
        setTimeout(() => setSavedSuccessMessage(null), 5000);
        resetForm();
      } catch (err) {
        console.error("Error updating item: ", err);
        alert('هەڵەیەک ڕوویدا لە کاتی نوێکردنەوەی کاڵاکەدا');
      }
      return;
    }

    // 3. Duplicate Prevention Check:
    // If there is an exact match (100%) or high similarity match (>= 75%) and user hasn't dismissed:
    const highMatch = similarMatches.find(m => m.score >= 75 || m.matchType === 'barcode' || m.matchType === 'exact_name');
    if (highMatch && !dismissedSimilarity) {
      setConfirmMergeModal({ open: true, matchedItem: highMatch.item });
      return;
    }

    // 4. Otherwise proceed to create as a new item
    await executeCreateNewItem();
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditId('');
    setTargetExistingItem(null);
    setDismissedSimilarity(false);
    setConfirmMergeModal(null);
    setName('');
    setBarcode('');
    if (!keepInvoiceInfo) {
      setSupplier('');
      setInvoiceNo('');
    }
    setHasCarton(true);
    setHasPacket(false);
    setCartonQuantity('');
    setCartonBonus('');
    setCartonCost('');
    setCartonPrice('');
    setCartonWholesale('');
    setPacketQuantity('');
    setPacketBonus('');
    setPacketCost('');
    setPacketPrice('');
    setPacketWholesale('');
    setPaymentType('cash');
  };

  return (
    <div className="space-y-6" onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(e); }}>
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 text-white p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 backdrop-blur-md rounded-xl">
              <PackagePlus size={24} className="text-indigo-200" />
            </div>
            <div>
              <h2 className="text-xl font-black">داخڵکردنی کاڵا بۆ کۆگا</h2>
              <p className="text-xs text-indigo-200 mt-0.5">
                تۆمارکردنی کاڵای نوێ و کڕینی کۆمپانیا بە کارتۆن، پاکەت، دیاری و بەستنەوە بە وەسڵ
              </p>
            </div>
          </div>
        </div>

        {onNavigateToInventory && (
          <button
            type="button"
            onClick={onNavigateToInventory}
            className="px-4 py-2.5 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 border border-white/20 shadow-sm cursor-pointer"
          >
            <Package size={16} />
            <span>چوون بۆ لیستی کۆگا</span>
            <ArrowLeft size={14} />
          </button>
        )}
      </div>

      {/* Success Notification */}
      {savedSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
          <span className="text-sm font-bold">{savedSuccessMessage}</span>
        </div>
      )}

      {/* Form Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-base font-bold mb-4 text-slate-800 border-b border-slate-100 pb-3 flex items-center justify-between flex-wrap gap-2">
          <span className="flex items-center gap-2">
            {targetExistingItem ? (
              <Layers className="text-emerald-600" size={20} />
            ) : isEditing ? (
              <Edit2 className="text-amber-600" size={20} />
            ) : (
              <PackagePlus className="text-indigo-600" size={20} />
            )}
            <span>
              {targetExistingItem
                ? `سەرخستنی بڕ لەسەر ئایتمی «${targetExistingItem.name}» (یەکخستنی کاڵا)`
                : isEditing
                ? 'دەستکاریکردنی کاڵا یان نوێکردنەوەی بڕ'
                : 'داخڵکردنی کاڵای نوێ بە کارتۆن و پاکەت'}
            </span>
          </span>

          {targetExistingItem ? (
            <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-xl font-bold flex items-center gap-1.5 shadow-2xs">
              <Layers size={13} />
              <span>دۆخی سەرخستن لەسەر هەمان ئایتم</span>
            </span>
          ) : isEditing ? (
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-lg font-bold">
              دۆخی دەستکاریکردن
            </span>
          ) : (
            <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1">
              <Sparkles size={12} />
              <span>پشکنینی ئۆتۆماتیکی هاوشێوەیی چالاکە</span>
            </span>
          )}
        </h3>

        {/* Target Existing Item Info Banner */}
        {targetExistingItem && (
          <div className="mb-5 p-4 bg-emerald-50/80 border border-emerald-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-emerald-950 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-200/80 text-emerald-800 rounded-xl shrink-0">
                <Layers size={22} />
              </div>
              <div>
                <div className="font-black text-sm">
                  تۆمارکردنی بار لەسەر هەمان ئایتم: <span className="underline decoration-2 text-emerald-900">{targetExistingItem.name}</span>
                </div>
                <div className="text-xs text-emerald-800 mt-1 leading-relaxed">
                  مەوجودی ئێستا لە کۆگا: <strong>{targetExistingItem.cartonQuantity || 0} کارتۆن</strong> و <strong>{targetExistingItem.packetQuantity || 0} پاکەت</strong> (کۆی گشتی: {targetExistingItem.quantity || 0} دانە). هەر بڕێک لێرە بنووسیت کۆدەکرێتەوە و دەخرێتە سەر ئەم ئایتمە بەبێ دروستکردنی ئایتمی دووبارە.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setTargetExistingItem(null);
                setName('');
                setBarcode('');
                setCartonQuantity('');
                setPacketQuantity('');
              }}
              className="px-3.5 py-1.5 bg-white text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold hover:bg-emerald-100 transition shrink-0 cursor-pointer shadow-2xs"
            >
              پاشگەزبوونەوە لەم ئایتمە
            </button>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-600">ناوی کاڵا *</label>
                {similarMatches.length > 0 && !targetExistingItem && !isEditing && (
                  <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded-md font-bold flex items-center gap-1 animate-pulse">
                    <Sparkles size={10} />
                    <span>{similarMatches.length} هاوشێوە هەیە</span>
                  </span>
                )}
              </div>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setDismissedSimilarity(false);
                }}
                placeholder="ناوی کاڵاکە..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">بارکۆد</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                value={barcode}
                onChange={(e) => {
                  setBarcode(e.target.value);
                  setDismissedSimilarity(false);
                }}
                placeholder="بارکۆد..."
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">کۆمپانیا</label>
              <input
                type="text"
                list="entry-companies-list"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="ناوی کۆمپانیا..."
              />
              <datalist id="entry-companies-list">
                {companies.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-bold text-indigo-900 mb-1 flex items-center justify-between">
                <span>ژمارەی سەر وەسڵ (ڕەقەم وەسڵ)</span>
                <span className="text-[10px] text-indigo-600 font-normal">وەسڵی کۆمپانیا</span>
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-indigo-200 bg-indigo-50/40 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm font-bold text-indigo-950"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="وەسڵی ژمارە..."
                dir="ltr"
              />
            </div>
          </div>

          {/* Similar Items / Duplicate Prevention Panel */}
          {similarMatches.length > 0 && !dismissedSimilarity && !targetExistingItem && !isEditing && (
            <div className="bg-amber-50/80 border-2 border-amber-300 rounded-2xl p-4 space-y-3 animate-in fade-in slide-in-from-top-1 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-amber-200/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-200 text-amber-900 rounded-lg shrink-0">
                    <Sparkles size={18} className="animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-amber-950 flex items-center gap-2 flex-wrap">
                      <span>پشکنینی هاوشێوەیی (Similar Search) — ئایا ئەم کاڵایە لە کۆگادا هەیە؟</span>
                      <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full text-[10px] font-mono font-bold">
                        {similarMatches.length} ئایتم دۆزرایەوە
                      </span>
                    </h4>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      بۆ ئەوەی یەک جۆر کاڵا بە چەند بەشێکی جیا داخل نەبێت، دەتوانیت بڕی نوێ بخەیتە سەر ئەم ئایتمانە:
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDismissedSimilarity(true)}
                  className="text-[11px] font-bold text-amber-800 hover:text-amber-950 bg-amber-200/60 hover:bg-amber-200 px-3 py-1 rounded-lg transition shrink-0 flex items-center gap-1 cursor-pointer"
                  title="داخستن و بەردەوامبوون وەک کاڵای نوێ"
                >
                  <span>ئەمە کاڵایەکی نوێی سەربەخۆیە</span>
                  <X size={12} />
                </button>
              </div>

              {/* Matched Items Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {similarMatches.slice(0, 6).map(({ item, score, matchType, matchedReason }) => {
                  const isExact = score === 100 || matchType === 'exact_name' || matchType === 'barcode';

                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border bg-white transition hover:shadow-md flex flex-col justify-between gap-2.5 ${
                        isExact ? 'border-rose-400 ring-2 ring-rose-200' : 'border-amber-200 hover:border-amber-400'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              isExact
                                ? 'bg-rose-100 text-rose-800 font-black'
                                : score >= 75
                                ? 'bg-amber-100 text-amber-900 font-bold'
                                : 'bg-indigo-50 text-indigo-700'
                            }`}
                          >
                            {isExact ? '⚠️ هاوشێوەی تەواو (١٠٠٪)' : `هاوشێوەیی: ${score}٪`}
                          </span>
                          {item.barcode && (
                            <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded" dir="ltr">
                              {item.barcode}
                            </span>
                          )}
                        </div>

                        <div className="font-black text-sm text-slate-900 leading-snug">
                          {item.name}
                        </div>

                        <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                          <span>کۆمپانیا: {item.supplier || 'نادیار'}</span>
                          <span className="text-[10px] text-amber-700 font-medium">{matchedReason}</span>
                        </div>

                        {/* Current Stock */}
                        <div className="mt-2 p-2 bg-slate-50 rounded-lg text-xs space-y-0.5 border border-slate-100">
                          <div className="font-bold text-slate-700 flex items-center justify-between">
                            <span>مەوجودی ئێستا لە کۆگا:</span>
                            <span className="text-indigo-700 font-mono font-black">
                              {item.quantity || 0} دانە
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 flex items-center justify-between">
                            <span>کارتۆن: <strong>{item.cartonQuantity || 0}</strong></span>
                            <span>پاکەت: <strong>{item.packetQuantity || 0}</strong></span>
                          </div>
                          {(item.cartonSellingPrice || item.sellingPrice) && (
                            <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200 flex items-center justify-between">
                              <span>نرخی فرۆشتن:</span>
                              <span className="font-mono font-bold text-slate-700">
                                {(item.cartonSellingPrice || item.sellingPrice || 0).toLocaleString()} د.ع
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons for this item */}
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSelectExistingItemForStockAdd(item)}
                          className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 shadow-xs cursor-pointer active:scale-95"
                        >
                          <Layers size={13} />
                          <span>بڕ بخەرە سەر ئەم ئایتمە</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleStartEditExistingItem(item)}
                          className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                          title="دەستکاریکردنی ئایتمەکە"
                        >
                          <Edit2 size={12} />
                          <span>دەستکاری</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-indigo-100 transition select-none font-medium">
              <input 
                type="checkbox" 
                checked={keepInvoiceInfo} 
                onChange={(e) => setKeepInvoiceInfo(e.target.checked)} 
                className="rounded text-indigo-600 w-3.5 h-3.5 cursor-pointer" 
              />
              <span>هێشتنەوەی ناوی کۆمپانیا و ژمارەی وەسڵ بۆ داخڵکردنی خێرای کاڵاکانی تری ئەم وەسڵە</span>
            </label>
          </div>

          {/* Unit selection toggles */}
          <div className="flex items-center gap-6 border-y border-slate-100 py-3">
            <span className="text-xs font-bold text-slate-700">جۆری یەکەکانی کاڵا:</span>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={hasCarton} 
                onChange={e => setHasCarton(e.target.checked)} 
                className="rounded text-indigo-600 w-4 h-4 cursor-pointer" 
              />
              <span>کارتۆن (Carton)</span>
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={hasPacket} 
                onChange={e => setHasPacket(e.target.checked)} 
                className="rounded text-indigo-600 w-4 h-4 cursor-pointer" 
              />
              <span>پاکەت (Packet)</span>
            </label>
          </div>

          {/* Cartons & Packets Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Carton inputs */}
            {hasCarton && (
              <div className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100 space-y-3">
                <div className="font-bold text-sm text-indigo-900 flex items-center justify-between border-b border-indigo-100/80 pb-2">
                  <span>بڕ و نرخەکانی کارتۆن</span>
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-mono">Carton</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">بڕی کارتۆنی کڕدراو</label>
                    <input 
                      type="number" 
                      min="0" 
                      step="any" 
                      required={hasCarton}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none bg-white" 
                      value={cartonQuantity} 
                      onChange={(e) => setCartonQuantity(e.target.value)} 
                      placeholder="0"
                      dir="ltr" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-amber-700 mb-1 flex items-center gap-1">
                      <span>🎁 دیاری / هەدیە (تێچوو 0)</span>
                    </label>
                    <input 
                      type="number" 
                      min="0" 
                      step="any" 
                      className="w-full px-3 py-2 border border-amber-300 bg-amber-50/60 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none" 
                      value={cartonBonus} 
                      onChange={(e) => setCartonBonus(e.target.value)} 
                      placeholder="بڕی هەدیە (0)"
                      dir="ltr" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">تێچوو بۆ کارتۆنی کڕدراو</label>
                    <input 
                      type="number" 
                      min="0" 
                      step="any" 
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none bg-white" 
                      value={cartonCost} 
                      onChange={(e) => setCartonCost(e.target.value)} 
                      placeholder="0"
                      dir="ltr" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">نرخی فرۆشتن (کارتۆن)</label>
                    <input 
                      type="number" 
                      min="0" 
                      step="any" 
                      required={hasCarton} 
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none bg-white" 
                      value={cartonPrice} 
                      onChange={(e) => setCartonPrice(e.target.value)} 
                      placeholder="0"
                      dir="ltr" 
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-600 mb-1">نرخی کۆگا / کۆمەڵ (کارتۆن)</label>
                    <input 
                      type="number" 
                      min="0" 
                      step="any" 
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none bg-white" 
                      value={cartonWholesale} 
                      onChange={(e) => setCartonWholesale(e.target.value)} 
                      placeholder="0"
                      dir="ltr" 
                    />
                  </div>
                </div>

                {Number(cartonBonus) > 0 && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed font-medium">
                    <div className="flex items-center gap-1 font-bold text-amber-950 mb-0.5">
                      <span>🎁 بڕی دیاری: {cartonBonus} کارتۆن بێ تێچوو</span>
                    </div>
                    <div>
                      کۆی گشتی لە کۆگا: <strong className="font-bold">{(Number(cartonQuantity) || 0) + Number(cartonBonus)}</strong> کارتۆن دادەنرێت. پارەی کۆمپانیا تەنها بۆ <strong className="font-bold">{Number(cartonQuantity) || 0}</strong> کارتۆنی کڕدراوە ({((Number(cartonCost) || 0) * (Number(cartonQuantity) || 0)).toLocaleString()} د.ع).
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Packet inputs */}
            {hasPacket && (
              <div className="p-4 bg-emerald-50/40 rounded-2xl border border-emerald-100 space-y-3">
                <div className="font-bold text-sm text-emerald-900 flex items-center justify-between border-b border-emerald-100/80 pb-2">
                  <span>بڕ و نرخەکانی پاکەت</span>
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-mono">Packet</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">بڕی پاکەتی کڕدراو</label>
                    <input 
                      type="number" 
                      min="0" 
                      step="any" 
                      required={hasPacket}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none bg-white" 
                      value={packetQuantity} 
                      onChange={(e) => setPacketQuantity(e.target.value)} 
                      placeholder="0"
                      dir="ltr" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-amber-700 mb-1 flex items-center gap-1">
                      <span>🎁 دیاری / هەدیە (تێچوو 0)</span>
                    </label>
                    <input 
                      type="number" 
                      min="0" 
                      step="any" 
                      className="w-full px-3 py-2 border border-amber-300 bg-amber-50/60 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none" 
                      value={packetBonus} 
                      onChange={(e) => setPacketBonus(e.target.value)} 
                      placeholder="بڕی هەدیە (0)"
                      dir="ltr" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">تێچوو بۆ پاکەتی کڕدراو</label>
                    <input 
                      type="number" 
                      min="0" 
                      step="any" 
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none bg-white" 
                      value={packetCost} 
                      onChange={(e) => setPacketCost(e.target.value)} 
                      placeholder="0"
                      dir="ltr" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">نرخی فرۆشتن (پاکەت)</label>
                    <input 
                      type="number" 
                      min="0" 
                      step="any" 
                      required={hasPacket} 
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none bg-white" 
                      value={packetPrice} 
                      onChange={(e) => setPacketPrice(e.target.value)} 
                      placeholder="0"
                      dir="ltr" 
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-600 mb-1">نرخی کۆگا / کۆمەڵ (پاکەت)</label>
                    <input 
                      type="number" 
                      min="0" 
                      step="any" 
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none bg-white" 
                      value={packetWholesale} 
                      onChange={(e) => setPacketWholesale(e.target.value)} 
                      placeholder="0"
                      dir="ltr" 
                    />
                  </div>
                </div>

                {Number(packetBonus) > 0 && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed font-medium">
                    <div className="flex items-center gap-1 font-bold text-amber-950 mb-0.5">
                      <span>🎁 بڕی دیاری: {packetBonus} پاکەت بێ تێچوو</span>
                    </div>
                    <div>
                      کۆی گشتی لە کۆگا: <strong className="font-bold">{(Number(packetQuantity) || 0) + Number(packetBonus)}</strong> پاکەت دادەنرێت. پارەی کۆمپانیا تەنها بۆ <strong className="font-bold">{Number(packetQuantity) || 0}</strong> پاکەتی کڕدراوە ({((Number(packetCost) || 0) * (Number(packetQuantity) || 0)).toLocaleString()} د.ع).
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-3 border-t border-slate-100">
            <div className="flex gap-4 items-center">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="radio" 
                  checked={paymentType === 'cash'} 
                  onChange={() => setPaymentType('cash')} 
                  className="text-indigo-600 w-4 h-4 cursor-pointer" 
                />
                <span className="text-sm font-bold text-slate-700">نەقدی کۆمپانیا</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="radio" 
                  checked={paymentType === 'debt'} 
                  onChange={() => setPaymentType('debt')} 
                  className="text-indigo-600 w-4 h-4 cursor-pointer" 
                />
                <span className="text-sm font-bold text-slate-700">قەرزی کۆمپانیا</span>
              </label>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="submit"
                className={`flex-1 sm:flex-none px-6 py-2.5 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-sm text-sm cursor-pointer active:scale-95 ${
                  targetExistingItem
                    ? 'bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-300'
                    : isEditing
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {targetExistingItem ? (
                  <Layers size={16} />
                ) : isEditing ? (
                  <Edit2 size={16} />
                ) : (
                  <Plus size={16} />
                )}
                <span>
                  {targetExistingItem
                    ? 'سەرخستنی بڕ لەسەر هەمان ئایتم'
                    : isEditing
                    ? 'پاشەکەوتکردنی گۆڕانکاری'
                    : 'زیادکردنی کاڵا بۆ کۆگا'}
                </span>
              </button>

              {(isEditing || targetExistingItem) && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition font-bold text-sm cursor-pointer"
                >
                  پاشگەزبوونەوە
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Duplicate Prevention Confirmation Modal */}
      {confirmMergeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-600 pb-2 border-b border-slate-100">
              <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900">ئاگاداری: کاڵای هاوشێوە لە کۆگادا هەیە!</h3>
                <p className="text-xs text-slate-500">پشکنینی ڕێگریکردن لە دووبارە داخڵکردن</p>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2 text-xs text-slate-700">
              <div className="text-slate-800 font-medium">
                کاڵایەک بە هەمان ناو یان زۆر هاوشێوە پێشتر تۆمار کراوە:
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-amber-200 font-bold text-sm text-slate-900 flex items-center justify-between">
                <span>«{confirmMergeModal.matchedItem.name}»</span>
                {confirmMergeModal.matchedItem.barcode && (
                  <span className="font-mono text-xs text-slate-500" dir="ltr">
                    {confirmMergeModal.matchedItem.barcode}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1">
                <span>مەوجودی ئێستا: <strong>{confirmMergeModal.matchedItem.cartonQuantity || 0} کارتۆن</strong> و <strong>{confirmMergeModal.matchedItem.packetQuantity || 0} پاکەت</strong></span>
                <span>کۆمپانیا: <strong>{confirmMergeModal.matchedItem.supplier || 'نادیار'}</strong></span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              بۆ ئەوەی ئەم کاڵایە بە چەند ئایتمێکی جیاواز لە کۆگادا تۆمار نەبێت و بە یەک ئایتم کۆبکرێتەوە، پێشنیار دەکرێت بڕەکەی بخەیتە سەر ئەم ئایتمەی سەرەوە:
            </p>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const item = confirmMergeModal.matchedItem;
                  setConfirmMergeModal(null);
                  handleUnifiedStockAdd(item);
                }}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95"
              >
                <Layers size={16} />
                <span>بەڵێ، بڕەکە بخەرە سەر هەمان ئەم ئایتمە (پێشنیارکراو)</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  setConfirmMergeModal(null);
                  setDismissedSimilarity(true);
                  await executeCreateNewItem();
                }}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>نەخێر، وەک ئایتمێکی نوێ و جیاواز داخل بکرێت</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmMergeModal(null)}
                className="w-full py-2 text-slate-500 hover:text-slate-800 text-xs font-semibold transition"
              >
                پاشگەزبوونەوە و چاککردنی زانیارییەکان
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
