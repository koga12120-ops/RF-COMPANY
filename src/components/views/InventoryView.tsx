import React, { useState, useEffect, useMemo } from 'react';
import { collection, doc, deleteDoc, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { Item, Role } from '../../types';
import { Plus, Search, Edit2, Trash2, Package, Printer, ChevronDown, ChevronUp, FileText, List, Building2, Calendar, Layers, PackagePlus, ArrowRight, Boxes } from 'lucide-react';
import { format } from 'date-fns';
import ConfirmModal from '../common/ConfirmModal';
import { updateItemAndSyncEverywhere } from '../../lib/invoiceSync';
import { printWarehouseInvoicePopup, printWarehouseStockSummaryPopup } from '../../lib/statementPrinter';
import { normalizeKurdishArabicText } from '../../lib/similaritySearch';

interface InventoryViewProps {
  role: Role;
  onNavigateToEntry?: () => void;
}

interface InvoiceGroup {
  id: string;
  invoiceNo: string;
  supplier: string;
  date: number;
  items: Item[];
  totalCartons: number;
  totalCartonBonus: number;
  totalPackets: number;
  totalPacketBonus: number;
  totalCost: number;
  totalSelling: number;
}

interface AggregatedStockItem {
  key: string;
  name: string;
  totalCartons: number;
  totalCartonPurchased: number;
  totalCartonBonus: number;
  totalPackets: number;
  totalPacketPurchased: number;
  totalPacketBonus: number;
  latestCartonSellingPrice?: number;
  latestPacketSellingPrice?: number;
  latestCartonCostPrice?: number;
  latestPacketCostPrice?: number;
  suppliers: string[];
  invoicesCount: number;
  items: Item[];
  totalValueSelling: number;
  totalValueCost: number;
  lastUpdated: number;
}

export default function InventoryView({ role, onNavigateToEntry }: InventoryViewProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [sortDate, setSortDate] = useState<'desc' | 'asc'>('desc');
  
  // Three viewing modes: 'total_stock' (کۆی کاڵاکان بە کارتۆن), 'invoice' (بەپێی وەسڵ), 'item' (ئایتم ئایتم)
  const [viewMode, setViewMode] = useState<'total_stock' | 'invoice' | 'item'>('total_stock');
  const [expandedInvoices, setExpandedInvoices] = useState<Record<string, boolean>>({});
  const [expandedAggregated, setExpandedAggregated] = useState<Record<string, boolean>>({});

  // Deleting item modal state
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);

  // Edit item modal state
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editName, setEditName] = useState('');
  const [editSupplier, setEditSupplier] = useState('');
  const [editInvoiceNo, setEditInvoiceNo] = useState('');
  const [editHasCarton, setEditHasCarton] = useState(true);
  const [editHasPacket, setEditHasPacket] = useState(false);
  const [editCartonQuantity, setEditCartonQuantity] = useState('');
  const [editCartonBonus, setEditCartonBonus] = useState('');
  const [editCartonCost, setEditCartonCost] = useState('');
  const [editCartonPrice, setEditCartonPrice] = useState('');
  const [editCartonWholesale, setEditCartonWholesale] = useState('');
  const [editPacketQuantity, setEditPacketQuantity] = useState('');
  const [editPacketBonus, setEditPacketBonus] = useState('');
  const [editPacketCost, setEditPacketCost] = useState('');
  const [editPacketPrice, setEditPacketPrice] = useState('');
  const [editPacketWholesale, setEditPacketWholesale] = useState('');
  const [editPaymentType, setEditPaymentType] = useState<'cash' | 'debt'>('cash');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'items'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const itemsData: Item[] = [];
        snapshot.forEach((doc) => {
          itemsData.push({ id: doc.id, ...doc.data() } as Item);
        });
        setItems(itemsData);
        setLoading(false);
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

  const formatStock = (item: Item) => {
    const parts = [];
    const cTotal = item.cartonQuantity !== undefined ? item.cartonQuantity : (item.unitType === 'carton' ? (item.quantity || 0) : 0);
    const cBonus = item.cartonBonusQuantity || (item.unitType === 'carton' ? (item.bonusQuantity || 0) : 0) || 0;
    const cPurchased = item.cartonPurchasedQuantity !== undefined ? item.cartonPurchasedQuantity : Math.max(0, cTotal - cBonus);

    const pTotal = item.packetQuantity !== undefined ? item.packetQuantity : (item.unitType === 'packet' ? (item.quantity || 0) : 0);
    const pBonus = item.packetBonusQuantity || (item.unitType === 'packet' ? (item.bonusQuantity || 0) : 0) || 0;
    const pPurchased = item.packetPurchasedQuantity !== undefined ? item.packetPurchasedQuantity : Math.max(0, pTotal - pBonus);

    if (item.cartonQuantity !== undefined || item.packetQuantity !== undefined) {
      if (cTotal > 0) {
        if (cBonus > 0) {
          parts.push(`${cPurchased.toLocaleString()} + ${cBonus.toLocaleString()} هەدیە کارتۆن`);
        } else {
          parts.push(`${cPurchased.toLocaleString()} کارتۆن`);
        }
      }
      if (pTotal > 0) {
        if (pBonus > 0) {
          parts.push(`${pPurchased.toLocaleString()} + ${pBonus.toLocaleString()} هەدیە پاکەت`);
        } else {
          parts.push(`${pPurchased.toLocaleString()} پاکەت`);
        }
      }
      if (parts.length === 0) {
        return `${item.quantity || 0} ${item.packetSellingPrice && !item.cartonSellingPrice ? 'پاکەت' : 'کارتۆن'}`;
      }
    } else {
      if ((item.quantity || 0) > 0) {
        if (item.packetSellingPrice && !item.cartonSellingPrice) {
          parts.push(`${item.quantity} پاکەت`);
        } else {
          parts.push(`${item.quantity} کارتۆن`);
        }
      } else {
        parts.push('0');
      }
    }
    return parts.join(' و ');
  };

  const openEditModal = (item: Item) => {
    setEditingItem(item);
    setEditName(item.name || '');
    setEditSupplier(item.supplier || '');
    setEditInvoiceNo(item.invoiceNo || '');

    const isCarton = !!item.cartonCostPrice || !!item.cartonSellingPrice || (item.cartonQuantity !== undefined && item.cartonQuantity > 0) || (!item.packetCostPrice && !item.packetSellingPrice);
    const isPacket = !!item.packetCostPrice || !!item.packetSellingPrice || (item.packetQuantity !== undefined && item.packetQuantity > 0);

    setEditHasCarton(isCarton);
    setEditHasPacket(isPacket);

    const initialCartonCost = item.cartonPurchaseCost !== undefined
      ? item.cartonPurchaseCost.toString()
      : (item.cartonCostPrice ? item.cartonCostPrice.toString() : (item.costPrice ? item.costPrice.toString() : ''));

    setEditCartonCost(initialCartonCost);
    setEditCartonPrice(item.cartonSellingPrice ? item.cartonSellingPrice.toString() : (item.sellingPrice ? item.sellingPrice.toString() : ''));
    setEditCartonWholesale(item.cartonWholesalePrice ? item.cartonWholesalePrice.toString() : (item.wholesalePrice ? item.wholesalePrice.toString() : ''));
    
    const totalCartonsVal = item.cartonQuantity !== undefined ? item.cartonQuantity : (item.quantity || 0);
    const bonusCartonsVal = item.cartonBonusQuantity || 0;
    setEditCartonQuantity((Math.max(0, totalCartonsVal - bonusCartonsVal)).toString());
    setEditCartonBonus(bonusCartonsVal > 0 ? bonusCartonsVal.toString() : '');

    const initialPacketCost = item.packetPurchaseCost !== undefined
      ? item.packetPurchaseCost.toString()
      : (item.packetCostPrice ? item.packetCostPrice.toString() : '');

    setEditPacketCost(initialPacketCost);
    setEditPacketPrice(item.packetSellingPrice ? item.packetSellingPrice.toString() : '');
    setEditPacketWholesale(item.packetWholesalePrice ? item.packetWholesalePrice.toString() : '');
    
    const totalPacketsVal = item.packetQuantity !== undefined ? item.packetQuantity : 0;
    const bonusPacketsVal = item.packetBonusQuantity || 0;
    setEditPacketQuantity((Math.max(0, totalPacketsVal - bonusPacketsVal)).toString());
    setEditPacketBonus(bonusPacketsVal > 0 ? bonusPacketsVal.toString() : '');

    setEditPaymentType('cash');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editName.trim()) return;

    setIsSavingEdit(true);
    try {
      const cPurchased = editHasCarton ? (Number(editCartonQuantity) || 0) : 0;
      const cBonus = editHasCarton ? (Number(editCartonBonus) || 0) : 0;
      const cTotal = cPurchased + cBonus;

      const pPurchased = editHasPacket ? (Number(editPacketQuantity) || 0) : 0;
      const pBonus = editHasPacket ? (Number(editPacketBonus) || 0) : 0;
      const pTotal = pPurchased + pBonus;

      const cCost = editHasCarton ? (Number(editCartonCost) || 0) : 0;
      const cPrice = editHasCarton ? (Number(editCartonPrice) || 0) : 0;
      const cWholesale = editHasCarton ? (Number(editCartonWholesale) || 0) : 0;

      const pCost = editHasPacket ? (Number(editPacketCost) || 0) : 0;
      const pPrice = editHasPacket ? (Number(editPacketPrice) || 0) : 0;
      const pWholesale = editHasPacket ? (Number(editPacketWholesale) || 0) : 0;

      const totalQty = cTotal + pTotal;
      const totalCostVal = (cPurchased * cCost) + (pPurchased * pCost);
      const totalBonusQty = cBonus + pBonus;

      const primaryCost = cCost || pCost;
      const primaryPrice = cPrice || pPrice;
      const cleanInvoice = editInvoiceNo.trim();

      const itemData: any = {
        name: editName.trim(),
        supplier: editSupplier.trim(),
        invoiceNo: cleanInvoice,
        quantity: totalQty,
        unitType: editHasCarton && editHasPacket ? 'both' : (editHasCarton ? 'carton' : 'packet'),
        costPrice: primaryCost,
        sellingPrice: primaryPrice,
        wholesalePrice: cWholesale || pWholesale || 0,
        
        cartonQuantity: editHasCarton ? cTotal : 0,
        cartonPurchasedQuantity: editHasCarton ? cPurchased : 0,
        cartonBonusQuantity: cBonus,
        cartonPurchaseCost: cCost,
        cartonCostPrice: cCost,
        cartonSellingPrice: cPrice,
        cartonWholesalePrice: cWholesale,

        packetQuantity: editHasPacket ? pTotal : 0,
        packetPurchasedQuantity: editHasPacket ? pPurchased : 0,
        packetBonusQuantity: pBonus,
        packetPurchaseCost: pCost,
        packetCostPrice: pCost,
        packetSellingPrice: pPrice,
        packetWholesalePrice: pWholesale,
      };

      const oldTotal = editingItem.quantity || 0;
      const quantityAdded = totalQty > oldTotal ? totalQty - oldTotal : 0;

      await updateItemAndSyncEverywhere({
        itemId: editingItem.id,
        oldItem: editingItem,
        itemData,
        quantityAdded,
        paymentType: editPaymentType,
        costPricePerPiece: primaryCost,
        totalCostAmount: totalCostVal,
        bonusQuantityAdded: totalBonusQty,
      });

      setEditingItem(null);
    } catch (error) {
      console.error("Error updating item: ", error);
      alert('هەڵەیەک ڕوویدا لە کاتی پاشەکەوتکردندا');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const confirmDeleteItem = async () => {
    if (!deletingItem) return;
    try {
      await deleteDoc(doc(db, 'items', deletingItem.id));
      setDeletingItem(null);
    } catch (error) {
      console.error("Error deleting item: ", error);
      alert('هەڵەیەک ڕوویدا لە کاتی سڕینەوەی کاڵا');
    }
  };

  const toggleInvoiceExpand = (key: string) => {
    setExpandedInvoices(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Filter items by search and supplier with first-letter prefix prioritization
  const filteredItems = useMemo(() => {
    const rawQuery = searchTerm.trim();
    const normQuery = normalizeKurdishArabicText(rawQuery);

    let result = items.filter(item => {
      const supplierMatches = filterSupplier ? item.supplier === filterSupplier : true;
      if (!supplierMatches) return false;
      if (!normQuery) return true;

      const normName = normalizeKurdishArabicText(item.name || '');
      const normInvoice = normalizeKurdishArabicText(item.invoiceNo || '');
      const normSupplier = normalizeKurdishArabicText(item.supplier || '');

      return (
        normName.includes(normQuery) ||
        normInvoice.includes(normQuery) ||
        normSupplier.includes(normQuery)
      );
    });

    result.sort((a, b) => {
      if (normQuery) {
        const normNameA = normalizeKurdishArabicText(a.name || '');
        const normNameB = normalizeKurdishArabicText(b.name || '');
        const aStarts = normNameA.startsWith(normQuery);
        const bStarts = normNameB.startsWith(normQuery);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        const aWordStarts = normNameA.split(/\s+/).some(w => w.startsWith(normQuery));
        const bWordStarts = normNameB.split(/\s+/).some(w => w.startsWith(normQuery));
        if (aWordStarts && !bWordStarts) return -1;
        if (!aWordStarts && bWordStarts) return 1;
      }

      const dateA = a.createdAt || 0;
      const dateB = b.createdAt || 0;
      return sortDate === 'desc' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [items, searchTerm, filterSupplier, sortDate]);

  // Group items by Invoice Number and Supplier for the "بەپێی وەسڵ" view
  const invoiceGroups: InvoiceGroup[] = useMemo(() => {
    const map = new Map<string, InvoiceGroup>();

    filteredItems.forEach(item => {
      const invNo = item.invoiceNo && item.invoiceNo.trim() ? item.invoiceNo.trim() : 'بێ ژمارەی وەسڵ';
      const supp = item.supplier && item.supplier.trim() ? item.supplier.trim() : 'کۆمپانیای نەزانراو';
      const key = `${invNo}___${supp}`;

      const cTotal = item.cartonQuantity !== undefined ? item.cartonQuantity : (item.unitType === 'carton' ? (item.quantity || 0) : 0);
      const cBonus = item.cartonBonusQuantity || (item.unitType === 'carton' ? (item.bonusQuantity || 0) : 0) || 0;
      const cPurchased = item.cartonPurchasedQuantity !== undefined ? item.cartonPurchasedQuantity : Math.max(0, cTotal - cBonus);

      const pTotal = item.packetQuantity !== undefined ? item.packetQuantity : (item.unitType === 'packet' ? (item.quantity || 0) : 0);
      const pBonus = item.packetBonusQuantity || (item.unitType === 'packet' ? (item.bonusQuantity || 0) : 0) || 0;
      const pPurchased = item.packetPurchasedQuantity !== undefined ? item.packetPurchasedQuantity : Math.max(0, pTotal - pBonus);

      const cCost = item.cartonCostPrice || item.cartonPurchaseCost || item.costPrice || 0;
      const pCost = item.packetCostPrice || item.packetPurchaseCost || 0;
      const cSell = item.cartonSellingPrice || item.sellingPrice || 0;
      const pSell = item.packetSellingPrice || 0;

      // دیاری بە پارەی ٠ حساب دەکرێت، تەنها بڕی کڕدراو لێکدانی تێچوو دەکرێت
      const itemCost = (cPurchased * cCost) + (pPurchased * pCost);
      const itemSelling = (cTotal * cSell) + (pTotal * pSell);
      const itemDate = item.createdAt || Date.now();

      if (!map.has(key)) {
        map.set(key, {
          id: key,
          invoiceNo: invNo,
          supplier: supp,
          date: itemDate,
          items: [item],
          totalCartons: cPurchased,
          totalCartonBonus: cBonus,
          totalPackets: pPurchased,
          totalPacketBonus: pBonus,
          totalCost: itemCost,
          totalSelling: itemSelling
        });
      } else {
        const group = map.get(key)!;
        group.items.push(item);
        group.totalCartons += cPurchased;
        group.totalCartonBonus += cBonus;
        group.totalPackets += pPurchased;
        group.totalPacketBonus += pBonus;
        group.totalCost += itemCost;
        group.totalSelling += itemSelling;
        if (itemDate > group.date) {
          group.date = itemDate;
        }
      }
    });

    const groups = Array.from(map.values());
    groups.sort((a, b) => {
      return sortDate === 'desc' ? b.date - a.date : a.date - b.date;
    });

    return groups;
  }, [filteredItems, sortDate]);

  const toggleAggregatedExpand = (key: string) => {
    setExpandedAggregated(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Group items by Item Name for the requested "کۆی کاڵاکان بە کارتۆن" view
  // کۆی هەموو وەسڵەکان بۆ هەر ئایتمێک پێکەوە کۆدەکاتەوە (بۆ نمونە: ٥٠ کارتۆن بوشاری ترێ)
  const aggregatedItems: AggregatedStockItem[] = useMemo(() => {
    const map = new Map<string, AggregatedStockItem>();

    filteredItems.forEach(item => {
      const rawName = (item.name || '').trim();
      if (!rawName) return;
      const normKey = normalizeKurdishArabicText(rawName).toLowerCase();

      const cTotal = item.cartonQuantity !== undefined ? item.cartonQuantity : (item.unitType === 'carton' ? (item.quantity || 0) : 0);
      const cBonus = item.cartonBonusQuantity || (item.unitType === 'carton' ? (item.bonusQuantity || 0) : 0) || 0;
      const cPurchased = item.cartonPurchasedQuantity !== undefined ? item.cartonPurchasedQuantity : Math.max(0, cTotal - cBonus);

      const pTotal = item.packetQuantity !== undefined ? item.packetQuantity : (item.unitType === 'packet' ? (item.quantity || 0) : 0);
      const pBonus = item.packetBonusQuantity || (item.unitType === 'packet' ? (item.bonusQuantity || 0) : 0) || 0;
      const pPurchased = item.packetPurchasedQuantity !== undefined ? item.packetPurchasedQuantity : Math.max(0, pTotal - pBonus);

      const cCost = item.cartonCostPrice || item.cartonPurchaseCost || item.costPrice || 0;
      const pCost = item.packetCostPrice || item.packetPurchaseCost || 0;
      const cSell = item.cartonSellingPrice || item.sellingPrice || 0;
      const pSell = item.packetSellingPrice || 0;

      const itemCost = (cPurchased * cCost) + (pPurchased * pCost);
      const itemSelling = (cTotal * cSell) + (pTotal * pSell);
      const itemDate = item.createdAt || 0;

      if (!map.has(normKey)) {
        map.set(normKey, {
          key: normKey,
          name: rawName,
          totalCartons: cTotal,
          totalCartonPurchased: cPurchased,
          totalCartonBonus: cBonus,
          totalPackets: pTotal,
          totalPacketPurchased: pPurchased,
          totalPacketBonus: pBonus,
          latestCartonSellingPrice: cSell,
          latestPacketSellingPrice: pSell,
          latestCartonCostPrice: cCost,
          latestPacketCostPrice: pCost,
          suppliers: item.supplier && item.supplier.trim() ? [item.supplier.trim()] : [],
          invoicesCount: 1,
          items: [item],
          totalValueSelling: itemSelling,
          totalValueCost: itemCost,
          lastUpdated: itemDate
        });
      } else {
        const ag = map.get(normKey)!;
        ag.totalCartons += cTotal;
        ag.totalCartonPurchased += cPurchased;
        ag.totalCartonBonus += cBonus;
        ag.totalPackets += pTotal;
        ag.totalPacketPurchased += pPurchased;
        ag.totalPacketBonus += pBonus;
        ag.invoicesCount += 1;
        ag.items.push(item);
        ag.totalValueSelling += itemSelling;
        ag.totalValueCost += itemCost;

        if (cSell > 0) ag.latestCartonSellingPrice = cSell;
        if (pSell > 0) ag.latestPacketSellingPrice = pSell;
        if (cCost > 0) ag.latestCartonCostPrice = cCost;
        if (pCost > 0) ag.latestPacketCostPrice = pCost;

        if (item.supplier && item.supplier.trim() && !ag.suppliers.includes(item.supplier.trim())) {
          ag.suppliers.push(item.supplier.trim());
        }
        if (itemDate > ag.lastUpdated) {
          ag.lastUpdated = itemDate;
        }
      }
    });

    const list = Array.from(map.values());
    list.sort((a, b) => a.name.localeCompare(b.name, 'ckb'));
    return list;
  }, [filteredItems]);

  const handlePrintStockSummary = () => {
    printWarehouseStockSummaryPopup({
      items: aggregatedItems.map(ag => ({
        name: ag.name,
        totalCartons: ag.totalCartons,
        totalCartonBonus: ag.totalCartonBonus,
        totalPackets: ag.totalPackets,
        totalPacketBonus: ag.totalPacketBonus,
        latestCartonSellingPrice: ag.latestCartonSellingPrice,
        latestPacketSellingPrice: ag.latestPacketSellingPrice,
        suppliers: ag.suppliers,
        invoicesCount: ag.invoicesCount
      })),
      totalCartonsAll: aggregatedItems.reduce((acc, a) => acc + a.totalCartons, 0),
      totalCartonBonusAll: aggregatedItems.reduce((acc, a) => acc + a.totalCartonBonus, 0),
      totalPacketsAll: aggregatedItems.reduce((acc, a) => acc + a.totalPackets, 0),
      totalPacketBonusAll: aggregatedItems.reduce((acc, a) => acc + a.totalPacketBonus, 0),
      date: Date.now()
    });
  };

  const uniqueSuppliers = Array.from(new Set(items.map(i => i.supplier).filter(Boolean)));

  // Calculate totals
  const totalItemsCount = items.length;
  const totalPurchasedCartons = items.reduce((acc, i) => {
    const cTotal = i.cartonQuantity || (i.unitType === 'carton' ? (i.quantity || 0) : 0);
    const cBonus = i.cartonBonusQuantity || 0;
    return acc + Math.max(0, cTotal - cBonus);
  }, 0);
  const totalCartonBonusCount = items.reduce((acc, i) => acc + (i.cartonBonusQuantity || 0), 0);

  const totalPurchasedPackets = items.reduce((acc, i) => {
    const pTotal = i.packetQuantity || 0;
    const pBonus = i.packetBonusQuantity || 0;
    return acc + Math.max(0, pTotal - pBonus);
  }, 0);
  const totalPacketBonusCount = items.reduce((acc, i) => acc + (i.packetBonusQuantity || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Package size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>بەشی کۆگا</span>
                <span className="text-xs font-normal text-slate-500">({totalItemsCount} کاڵا تۆمارکراوە)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                چاودێریکردنی کاڵاکان بە کارتۆن و پاکەت، و وردەکاری بەپێی وەسڵ و چاپکردن
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Warehouse quick stats pill */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-bold">
            <span>کۆی کۆگا:</span>
            <span className="text-indigo-700 font-mono">
              {totalCartonBonusCount > 0
                ? `${totalPurchasedCartons.toLocaleString()} + ${totalCartonBonusCount.toLocaleString()} هەدیە کارتۆن`
                : `${totalPurchasedCartons.toLocaleString()} کارتۆن`}
            </span>
            {(totalPurchasedPackets > 0 || totalPacketBonusCount > 0) && (
              <>
                <span>و</span>
                <span className="text-emerald-700 font-mono">
                  {totalPacketBonusCount > 0
                    ? `${totalPurchasedPackets.toLocaleString()} + ${totalPacketBonusCount.toLocaleString()} هەدیە پاکەت`
                    : `${totalPurchasedPackets.toLocaleString()} پاکەت`}
                </span>
              </>
            )}
          </div>

          {onNavigateToEntry && (
            <button
              onClick={onNavigateToEntry}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer ml-auto md:ml-0"
            >
              <PackagePlus size={16} />
              <span>داخڵکردنی کاڵای نوێ</span>
            </button>
          )}
        </div>
      </div>

      {/* View Switcher & Filters */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          
          {/* The 3 viewing modes: (کۆی کاڵاکان بە کارتۆن) و (بەپێی وەسڵ) و (ئایتم ئایتم) */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl w-full sm:w-auto flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setViewMode('total_stock')}
              className={`flex-1 sm:flex-none px-3.5 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                viewMode === 'total_stock'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Boxes size={15} />
              <span>کۆی کاڵاکان بە کارتۆن</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-50 text-indigo-700 font-mono font-bold">
                {aggregatedItems.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('invoice')}
              className={`flex-1 sm:flex-none px-3.5 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                viewMode === 'invoice'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText size={15} />
              <span>بەپێی وەسڵ</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-50 text-indigo-700 font-mono font-bold">
                {invoiceGroups.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('item')}
              className={`flex-1 sm:flex-none px-3.5 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                viewMode === 'item'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List size={15} />
              <span>ئایتم ئایتم (وەجبەکان)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-50 text-indigo-700 font-mono font-bold">
                {filteredItems.length}
              </span>
            </button>
          </div>

          {/* Search, Company Filter, Sort */}
          <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap">
            <select
              className="px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-semibold bg-white cursor-pointer"
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
            >
              <option value="">هەموو کۆمپانیاکان</option>
              {uniqueSuppliers.map((sup, i) => (
                <option key={i} value={sup as string}>{sup}</option>
              ))}
            </select>

            <select
              className="px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-semibold bg-white cursor-pointer"
              value={sortDate}
              onChange={(e) => setSortDate(e.target.value as 'desc' | 'asc')}
            >
              <option value="desc">نوێترین بەروار</option>
              <option value="asc">کۆنترین بەروار</option>
            </select>

            <div className="relative flex-1 sm:w-64">
              <input
                type="text"
                placeholder="گەڕان بەپێی ناوی کاڵا، کۆمپانیا، وەسڵ..."
                className="w-full pr-9 pl-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute right-3 top-2.5 text-slate-400" size={15} />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-400 text-sm">خەریکی هێنانی زانیارییەکانی کۆگایە...</div>
        ) : viewMode === 'total_stock' ? (
          /* ========================================================================= */
          /* 1. VIEW MODE: (کۆی کاڵاکان بە کارتۆن) - Total Aggregated Stock by Item Name */
          /* ========================================================================= */
          <div className="space-y-4 p-4">
            {/* Action Bar for Total Stock */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-indigo-50/70 border border-indigo-100 p-3.5 rounded-xl">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600 text-white rounded-lg shrink-0">
                  <Boxes size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-indigo-950">
                    کۆی بەردەستی کاڵاکان بەپێی کارتۆن (بێ دابەشبوون بەسەر وەسڵەکان)
                  </h3>
                  <p className="text-xs text-indigo-700 mt-0.5">
                    لەم پەڕەیەدا کۆی هەموو وەسڵەکان بۆ هەر کاڵایەک کۆکراوەتەوە (بۆ نمونە ئەگەر بە چەند جار هاتبێت لێرە کۆی گشتی کارتۆنەکان دەبینیت)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handlePrintStockSummary}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
              >
                <Printer size={15} className="text-indigo-600" />
                <span>چاپکردنی لیستی گشتی کۆگا</span>
              </button>
            </div>

            {aggregatedItems.length === 0 ? (
              <div className="text-center py-14 text-slate-400 text-sm">
                هیچ کاڵایەک نەدۆزرایەوە بەم فلتەر و گەڕانە
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3.5 w-12 text-center">#</th>
                      <th className="px-4 py-3.5 text-sm">ناوی کاڵا</th>
                      <th className="px-4 py-3.5 text-center text-sm font-black text-indigo-950">کۆی کارتۆن لە کۆگا</th>
                      <th className="px-4 py-3.5 text-center">کۆی پاکەت لە کۆگا</th>
                      <th className="px-4 py-3.5">نرخی فرۆشتن</th>
                      <th className="px-4 py-3.5">کۆمپانیا و وەجبەکان</th>
                      <th className="px-4 py-3.5 text-center w-28">وردەکاری وەسڵ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {aggregatedItems.map((ag, idx) => {
                      const isExpanded = !!expandedAggregated[ag.key];
                      const isLowStock = ag.totalCartons > 0 && ag.totalCartons <= 5;

                      return (
                        <React.Fragment key={ag.key}>
                          <tr className={`hover:bg-slate-50/70 transition ${isExpanded ? 'bg-indigo-50/20' : ''}`}>
                            <td className="px-4 py-3.5 text-center font-mono text-slate-400 font-bold">
                              {idx + 1}
                            </td>
                            
                            <td className="px-4 py-3.5 font-bold text-slate-900">
                              <div className="text-sm font-black text-slate-900">{ag.name}</div>
                              {ag.invoicesCount > 1 && (
                                <span className="inline-block mt-0.5 text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-bold border border-indigo-100">
                                  {ag.invoicesCount} وەسڵی جیاواز کۆکراوەتەوە
                                </span>
                              )}
                            </td>

                            {/* Carton Total: prominent and clear */}
                            <td className="px-4 py-3.5 text-center">
                              {ag.totalCartons > 0 ? (
                                <div className="inline-flex flex-col items-center">
                                  <span className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl font-black text-sm bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs font-mono" dir="rtl">
                                    {ag.totalCartonBonus > 0 ? (
                                      <span>
                                        {ag.totalCartonPurchased.toLocaleString()} + {ag.totalCartonBonus.toLocaleString()} هەدیە کارتۆن
                                      </span>
                                    ) : (
                                      <span>{ag.totalCartons.toLocaleString()} کارتۆن</span>
                                    )}
                                  </span>
                                  {isLowStock && (
                                    <span className="text-[10px] text-amber-600 font-bold mt-1">
                                      کەم ماوە
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  سفر (نەماوە)
                                </span>
                              )}
                            </td>

                            {/* Packet Total */}
                            <td className="px-4 py-3.5 text-center">
                              {ag.totalPackets > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-xs bg-slate-100 text-slate-800 border border-slate-200 font-mono" dir="rtl">
                                  {ag.totalPacketBonus > 0 ? (
                                    <span>
                                      {ag.totalPacketPurchased.toLocaleString()} + {ag.totalPacketBonus.toLocaleString()} هەدیە پاکەت
                                    </span>
                                  ) : (
                                    <span>{ag.totalPackets.toLocaleString()} پاکەت</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-mono">-</span>
                              )}
                            </td>

                            {/* Selling Price */}
                            <td className="px-4 py-3.5">
                              <div className="flex flex-col gap-0.5 text-xs font-mono font-bold" dir="ltr">
                                {ag.latestCartonSellingPrice ? (
                                  <span className="text-indigo-700">
                                    ک: {ag.latestCartonSellingPrice.toLocaleString()} د.ع
                                  </span>
                                ) : null}
                                {ag.latestPacketSellingPrice ? (
                                  <span className="text-emerald-700">
                                    پ: {ag.latestPacketSellingPrice.toLocaleString()} د.ع
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            {/* Suppliers */}
                            <td className="px-4 py-3.5 text-slate-600">
                              <div className="font-semibold text-xs">
                                {ag.suppliers.length > 0 ? ag.suppliers.join('، ') : 'کۆمپانیای نەزانراو'}
                              </div>
                            </td>

                            {/* Expand / View Invoices */}
                            <td className="px-4 py-3.5 text-center">
                              <button
                                type="button"
                                onClick={() => toggleAggregatedExpand(ag.key)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 mx-auto cursor-pointer ${
                                  isExpanded
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                              >
                                <span>{isExpanded ? 'داخستن' : 'وەسڵەکان'}</span>
                                {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              </button>
                            </td>
                          </tr>

                          {/* Expanded sub-table showing underlying invoices */}
                          {isExpanded && (
                            <tr className="bg-indigo-50/30">
                              <td colSpan={7} className="p-3">
                                <div className="bg-white rounded-xl border border-indigo-100 p-3 shadow-2xs">
                                  <div className="text-xs font-bold text-indigo-900 mb-2 flex items-center gap-2">
                                    <FileText size={14} className="text-indigo-600" />
                                    <span>وردەکاری ئەو وەسڵانەی ئەم {ag.totalCartons} کارتۆنەیان پێک هێناوە:</span>
                                  </div>
                                  <table className="w-full text-right text-xs">
                                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                                      <tr>
                                        <th className="p-2">ژمارەی وەسڵ</th>
                                        <th className="p-2">کۆمپانیا</th>
                                        <th className="p-2">بەروار</th>
                                        <th className="p-2">بڕی ماوە لەم وەسڵە</th>
                                        <th className="p-2">تێچوو</th>
                                        <th className="p-2">فرۆشتن</th>
                                        <th className="p-2 text-center">کردار</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {ag.items.map(subItem => (
                                        <tr key={subItem.id} className="hover:bg-slate-50/50">
                                          <td className="p-2 font-mono font-bold text-indigo-700" dir="ltr">
                                            #{subItem.invoiceNo || 'بێ وەسڵ'}
                                          </td>
                                          <td className="p-2 text-slate-800 font-medium">
                                            {subItem.supplier || '-'}
                                          </td>
                                          <td className="p-2 font-mono text-slate-500" dir="ltr">
                                            {format(subItem.createdAt || Date.now(), 'yyyy/MM/dd')}
                                          </td>
                                          <td className="p-2 font-bold text-emerald-700 font-mono" dir="rtl">
                                            {formatStock(subItem)}
                                          </td>
                                          <td className="p-2 font-mono text-slate-600" dir="ltr">
                                            {subItem.cartonCostPrice ? `${subItem.cartonCostPrice.toLocaleString()} ک` : '-'}
                                          </td>
                                          <td className="p-2 font-mono text-slate-800 font-bold" dir="ltr">
                                            {subItem.cartonSellingPrice ? `${subItem.cartonSellingPrice.toLocaleString()} ک` : '-'}
                                          </td>
                                          <td className="p-2 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                              <button
                                                type="button"
                                                onClick={() => openEditModal(subItem)}
                                                className="p-1 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded transition"
                                                title="دەستکاریکردن"
                                              >
                                                <Edit2 size={13} />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setDeletingItem(subItem)}
                                                className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition"
                                                title="سڕینەوە"
                                              >
                                                <Trash2 size={13} />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : viewMode === 'item' ? (
          /* ========================================================= */
          /* 2. VIEW MODE: (ئایتم ئایتم) - Item by Item Table           */
          /* ========================================================= */
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3">ناوی کاڵا</th>
                  <th className="px-4 py-3">کۆمپانیا و وەسڵ</th>
                  <th className="px-4 py-3">نرخی فرۆشتن (کارتۆن / پاکەت)</th>
                  <th className="px-4 py-3">تێچوو</th>
                  <th className="px-4 py-3">ماوە لە کۆگا</th>
                  <th className="px-4 py-3 text-center w-28">کردارەکان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3 font-bold text-slate-800">
                      <div className="text-sm">{item.name}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-600">
                      <div className="font-bold text-slate-800">{item.supplier || '-'}</div>
                      {item.invoiceNo && (
                        <span className="inline-block mt-0.5 text-[11px] font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100 font-bold" dir="ltr">
                          وەسڵ: #{item.invoiceNo}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-800 font-bold" dir="ltr">
                      <div className="flex flex-col gap-0.5 text-xs">
                        {(item.cartonSellingPrice || item.cartonCostPrice || (!item.packetSellingPrice && item.sellingPrice)) ? (
                          <span className="text-indigo-700 font-mono">
                            ک: {(item.cartonSellingPrice || item.sellingPrice || 0).toLocaleString()} د.ع
                          </span>
                        ) : null}
                        {item.packetSellingPrice ? (
                          <span className="text-emerald-700 font-mono">
                            پ: {(item.packetSellingPrice || 0).toLocaleString()} د.ع
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs" dir="ltr">
                      <div className="flex flex-col gap-0.5">
                        {item.cartonCostPrice ? <span>ک: {item.cartonCostPrice.toLocaleString()}</span> : null}
                        {item.packetCostPrice ? <span>پ: {item.packetCostPrice.toLocaleString()}</span> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-900 font-bold" dir="ltr">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`${(item.quantity || 0) <= 0 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'} px-2.5 py-1 rounded-lg text-xs font-bold inline-block`}>
                          {formatStock(item)}
                        </span>
                        {((item.cartonBonusQuantity && item.cartonBonusQuantity > 0) || (item.packetBonusQuantity && item.packetBonusQuantity > 0)) ? (
                          <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-bold flex items-center gap-1" dir="rtl">
                            <span>🎁</span>
                            <span>{item.cartonBonusQuantity ? `${item.cartonBonusQuantity} کارتۆن` : ''} {item.packetBonusQuantity ? `${item.packetBonusQuantity} پاکەت` : ''} دیاری</span>
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEditModal(item)}
                          className="text-indigo-600 font-bold text-xs px-2.5 py-1 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                        >
                          دەستکاری
                        </button>
                        <button
                          onClick={() => setDeletingItem(item)}
                          className="text-rose-600 font-bold text-xs px-2.5 py-1 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        >
                          سڕینەوە
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      هیچ کاڵایەک نەدۆزرایەوە
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* ========================================================================= */
          /* 2. VIEW MODE: (بەپێی وەسڵ) - By Invoice with Print & Company Name replaced */
          /* ========================================================================= */
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 w-36">ڕەقەم وەسڵ</th>
                  <th className="px-4 py-3">ناوی کۆمپانیا</th>
                  <th className="px-4 py-3">بەروار</th>
                  <th className="px-4 py-3 text-center">ژمارەی کاڵاکان</th>
                  <th className="px-4 py-3">کۆی ماوە لە کۆگا</th>
                  <th className="px-4 py-3">کۆی تێچووی وەسڵ</th>
                  <th className="px-4 py-3 text-center w-36">کردارەکان (چاپ)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoiceGroups.map(group => {
                  const isExpanded = !!expandedInvoices[group.id];

                  return (
                    <React.Fragment key={group.id}>
                      <tr className="hover:bg-indigo-50/40 transition">
                        {/* 1. ڕەقەم وەسڵ */}
                        <td className="px-4 py-3.5 font-mono">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-50 text-indigo-800 border border-indigo-200">
                              #{group.invoiceNo}
                            </span>
                          </div>
                        </td>

                        {/* 2. ناوی کۆمپانیا (لە جیاتی ناوی ئایتم) */}
                        <td className="px-4 py-3.5">
                          <div className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                            <Building2 size={15} className="text-indigo-600 shrink-0" />
                            <span>{group.supplier}</span>
                          </div>
                        </td>

                        {/* 3. بەروار */}
                        <td className="px-4 py-3.5 text-slate-500 font-mono" dir="ltr">
                          <div className="flex items-center gap-1 text-slate-700">
                            <Calendar size={13} className="text-slate-400" />
                            <span>{format(group.date, 'yyyy-MM-dd')}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">{format(group.date, 'HH:mm')}</span>
                        </td>

                        {/* 4. ژمارەی کاڵاکان */}
                        <td className="px-4 py-3.5 text-center">
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                            {group.items.length} جۆر کاڵا
                          </span>
                        </td>

                        {/* 5. کۆی ماوە لە کۆگا */}
                        <td className="px-4 py-3.5 text-slate-800 font-bold" dir="ltr">
                          <div className="flex flex-col gap-0.5 text-xs">
                            {(group.totalCartons > 0 || group.totalCartonBonus > 0) && (
                              <span className="text-indigo-700 font-mono">
                                {group.totalCartonBonus > 0
                                  ? `${group.totalCartons.toLocaleString()} + ${group.totalCartonBonus.toLocaleString()} هەدیە کارتۆن`
                                  : `${group.totalCartons.toLocaleString()} کارتۆن`}
                              </span>
                            )}
                            {(group.totalPackets > 0 || group.totalPacketBonus > 0) && (
                              <span className="text-emerald-700 font-mono">
                                {group.totalPacketBonus > 0
                                  ? `${group.totalPackets.toLocaleString()} + ${group.totalPacketBonus.toLocaleString()} هەدیە پاکەت`
                                  : `${group.totalPackets.toLocaleString()} پاکەت`}
                              </span>
                            )}
                            {group.totalCartons === 0 && group.totalCartonBonus === 0 && group.totalPackets === 0 && group.totalPacketBonus === 0 && (
                              <span className="text-slate-400">0</span>
                            )}
                          </div>
                        </td>

                        {/* 6. کۆی تێچووی وەسڵ */}
                        <td className="px-4 py-3.5 text-slate-900 font-mono font-black text-sm" dir="ltr">
                          {group.totalCost > 0 ? (
                            <span>{group.totalCost.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">د.ع</span></span>
                          ) : (
                            <span className="text-slate-400 text-xs font-normal">-</span>
                          )}
                        </td>

                        {/* 7. کردارەکان: چاپی یەک ڕەقەم وەسڵ لە بەرامبەر هەر وەسڵێک + بینینی کاڵاکان */}
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {/* PRINT THIS SINGLE INVOICE BUTTON */}
                            <button
                              type="button"
                              onClick={() => {
                                printWarehouseInvoicePopup({
                                  invoiceNo: group.invoiceNo,
                                  supplier: group.supplier,
                                  date: group.date,
                                  items: group.items,
                                  totalCartons: group.totalCartons,
                                  totalCartonBonus: group.totalCartonBonus,
                                  totalPackets: group.totalPackets,
                                  totalPacketBonus: group.totalPacketBonus,
                                  totalCost: group.totalCost
                                });
                              }}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                              title={`چاپکردنی وەسڵی #${group.invoiceNo} هی ${group.supplier}`}
                            >
                              <Printer size={14} />
                              <span>چاپ</span>
                            </button>

                            {/* TOGGLE EXPAND ITEMS */}
                            <button
                              type="button"
                              onClick={() => toggleInvoiceExpand(group.id)}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                              title={isExpanded ? 'شاردنەوەی کاڵاکان' : 'پیشاندانی کاڵاکانی ئەم وەسڵە'}
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* EXPANDED ROW: Shows the items inside this invoice */}
                      {isExpanded && (
                        <tr className="bg-indigo-50/20 border-y border-indigo-100/60">
                          <td colSpan={7} className="p-3 sm:p-4">
                            <div className="bg-white rounded-xl border border-indigo-100 p-3 shadow-xs space-y-2">
                              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                                <span className="font-bold text-xs text-indigo-900 flex items-center gap-1.5">
                                  <Layers size={14} className="text-indigo-600" />
                                  <span>کاڵاکانی نێو وەسڵی #{group.invoiceNo} ({group.supplier})</span>
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  کۆی {group.items.length} جۆر کاڵا لەم وەسڵەدان
                                </span>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-right text-xs">
                                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                                    <tr>
                                      <th className="px-3 py-2 w-10 text-center">#</th>
                                      <th className="px-3 py-2">ناوی کاڵا</th>
                                      <th className="px-3 py-2">ماوە لە کۆگا</th>
                                      <th className="px-3 py-2">تێچوو</th>
                                      <th className="px-3 py-2">فرۆشتن</th>
                                      <th className="px-3 py-2 text-center w-24">کردارەکان</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {group.items.map((it, idx) => (
                                      <tr key={it.id} className="hover:bg-slate-50/60">
                                        <td className="px-3 py-2 text-center font-mono text-slate-400">{idx + 1}</td>
                                        <td className="px-3 py-2 font-bold text-slate-800">{it.name}</td>
                                        <td className="px-3 py-2 font-bold text-slate-800" dir="ltr">
                                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-bold">
                                            {formatStock(it)}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 text-slate-600 font-mono" dir="ltr">
                                          {it.cartonCostPrice ? `${it.cartonCostPrice.toLocaleString()} ک` : '-'}
                                        </td>
                                        <td className="px-3 py-2 text-indigo-700 font-mono font-bold" dir="ltr">
                                          {it.cartonSellingPrice ? `${it.cartonSellingPrice.toLocaleString()} ک` : '-'}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                          <div className="flex items-center justify-center gap-1.5">
                                            <button
                                              onClick={() => openEditModal(it)}
                                              className="text-indigo-600 font-bold text-xs px-2 py-0.5 hover:bg-indigo-50 rounded transition cursor-pointer"
                                            >
                                              دەستکاری
                                            </button>
                                            <button
                                              onClick={() => setDeletingItem(it)}
                                              className="text-rose-600 font-bold text-xs px-2 py-0.5 hover:bg-rose-50 rounded transition cursor-pointer"
                                            >
                                              سڕینەوە
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {invoiceGroups.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      هیچ وەسڵێک نەدۆزرایەوە
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <Edit2 size={18} className="text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-sm">
                  دەستکاریکردنی کاڵا: {editingItem.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">ناوی کاڵا *</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">کۆمپانیا</label>
                  <input
                    type="text"
                    list="edit-companies-list"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editSupplier}
                    onChange={(e) => setEditSupplier(e.target.value)}
                  />
                  <datalist id="edit-companies-list">
                    {companies.map(c => <option key={c.id} value={c.name} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-bold text-indigo-900 mb-1">ژمارەی وەسڵ (ڕەقەم وەسڵ)</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-indigo-200 bg-indigo-50/40 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editInvoiceNo}
                    onChange={(e) => setEditInvoiceNo(e.target.value)}
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Units toggles */}
              <div className="flex items-center gap-4 py-2 border-y border-slate-100 text-xs font-bold">
                <span>یەکەکان:</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editHasCarton}
                    onChange={(e) => setEditHasCarton(e.target.checked)}
                    className="rounded text-indigo-600 cursor-pointer"
                  />
                  <span>کارتۆن</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editHasPacket}
                    onChange={(e) => setEditHasPacket(e.target.checked)}
                    className="rounded text-indigo-600 cursor-pointer"
                  />
                  <span>پاکەت</span>
                </label>
              </div>

              {/* Carton details */}
              {editHasCarton && (
                <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 space-y-2">
                  <span className="text-xs font-bold text-indigo-900">زانیارییەکانی کارتۆن</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">بڕی کارتۆن</label>
                      <input
                        type="number"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white"
                        value={editCartonQuantity}
                        onChange={(e) => setEditCartonQuantity(e.target.value)}
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-amber-700 mb-0.5">🎁 دیاری</label>
                      <input
                        type="number"
                        className="w-full px-2.5 py-1.5 border border-amber-300 bg-amber-50 rounded-lg text-xs font-bold"
                        value={editCartonBonus}
                        onChange={(e) => setEditCartonBonus(e.target.value)}
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">تێچوو</label>
                      <input
                        type="number"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white"
                        value={editCartonCost}
                        onChange={(e) => setEditCartonCost(e.target.value)}
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">نرخی فرۆشتن</label>
                      <input
                        type="number"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white"
                        value={editCartonPrice}
                        onChange={(e) => setEditCartonPrice(e.target.value)}
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Packet details */}
              {editHasPacket && (
                <div className="p-3 bg-emerald-50/40 rounded-xl border border-emerald-100 space-y-2">
                  <span className="text-xs font-bold text-emerald-900">زانیارییەکانی پاکەت</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">بڕی پاکەت</label>
                      <input
                        type="number"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white"
                        value={editPacketQuantity}
                        onChange={(e) => setEditPacketQuantity(e.target.value)}
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-amber-700 mb-0.5">🎁 دیاری</label>
                      <input
                        type="number"
                        className="w-full px-2.5 py-1.5 border border-amber-300 bg-amber-50 rounded-lg text-xs font-bold"
                        value={editPacketBonus}
                        onChange={(e) => setEditPacketBonus(e.target.value)}
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">تێچوو</label>
                      <input
                        type="number"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white"
                        value={editPacketCost}
                        onChange={(e) => setEditPacketCost(e.target.value)}
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">نرخی فرۆشتن</label>
                      <input
                        type="number"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white"
                        value={editPacketPrice}
                        onChange={(e) => setEditPacketPrice(e.target.value)}
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition font-bold text-xs cursor-pointer"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Edit2 size={14} />
                  <span>{isSavingEdit ? 'خەریکی پاشەکەوتکردنە...' : 'پاشەکەوتکردنی گۆڕانکاری'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Item Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        onConfirm={confirmDeleteItem}
        title="سڕینەوەی کاڵا لە کۆگا"
        message="ئایا دڵنیایت لە سڕینەوەی ئەم کاڵایە لە کۆگادا؟ ئەم کردارە هەڵناوەشێتەوە."
        itemName={deletingItem?.name}
        details={deletingItem ? [
          { label: 'بڕی ماوە لە کۆگا', value: formatStock(deletingItem) },
          { label: 'کۆمپانیا', value: deletingItem.supplier || '-' },
          { label: 'ژمارەی وەسڵ', value: deletingItem.invoiceNo ? `#${deletingItem.invoiceNo}` : '-' }
        ] : []}
      />
    </div>
  );
}
