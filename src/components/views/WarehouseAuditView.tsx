import React, { useState, useEffect, useMemo } from 'react';
import { collection, doc, deleteDoc, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';
import { Item, Role } from '../../types';
import { 
  Boxes, Search, Package, Printer, ChevronDown, ChevronUp, 
  Building2, Calendar, PackagePlus, Edit2, Trash2, ArrowRight,
  TrendingUp, Layers, CheckCircle2, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import ConfirmModal from '../common/ConfirmModal';
import { updateItemAndSyncEverywhere } from '../../lib/invoiceSync';
import { printWarehouseStockSummaryPopup } from '../../lib/statementPrinter';
import { normalizeKurdishArabicText } from '../../lib/similaritySearch';

interface WarehouseAuditViewProps {
  role: Role;
  onNavigateToEntry?: () => void;
  onNavigateToInventory?: () => void;
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
  latestCartonWholesalePrice?: number;
  latestPacketWholesalePrice?: number;
  suppliers: string[];
  invoicesCount: number;
  items: Item[];
  totalValueSelling: number;
  totalValueCost: number;
  lastUpdated: number;
}

export default function WarehouseAuditView({ 
  role, 
  onNavigateToEntry, 
  onNavigateToInventory 
}: WarehouseAuditViewProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
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

    const unsubComp = onSnapshot(
      collection(db, 'companies'),
      (snapshot) => {
        const comps: any[] = [];
        snapshot.forEach((doc) => comps.push({ id: doc.id, ...doc.data() }));
        setCompanies(comps);
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

  const handleEditClick = (item: Item) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditSupplier(item.supplier || '');
    setEditInvoiceNo(item.invoiceNo || '');

    const hasC = !!item.cartonCostPrice || !!item.cartonSellingPrice || (item.cartonQuantity !== undefined && item.cartonQuantity > 0) || item.unitType === 'carton';
    const hasP = !!item.packetCostPrice || !!item.packetSellingPrice || (item.packetQuantity !== undefined && item.packetQuantity > 0) || item.unitType === 'packet';
    setEditHasCarton(hasC || (!hasC && !hasP));
    setEditHasPacket(hasP);

    setEditCartonCost(item.cartonCostPrice || item.cartonPurchaseCost || item.costPrice ? (item.cartonCostPrice || item.cartonPurchaseCost || item.costPrice)!.toString() : '');
    setEditCartonPrice(item.cartonSellingPrice || item.sellingPrice ? (item.cartonSellingPrice || item.sellingPrice)!.toString() : '');
    setEditCartonWholesale(item.cartonWholesalePrice || item.wholesalePrice ? (item.cartonWholesalePrice || item.wholesalePrice)!.toString() : '');
    
    const totalCartonsVal = item.cartonQuantity !== undefined ? item.cartonQuantity : (item.unitType === 'carton' ? (item.quantity || 0) : 0);
    const bonusCartonsVal = item.cartonBonusQuantity || (item.unitType === 'carton' ? (item.bonusQuantity || 0) : 0) || 0;
    setEditCartonQuantity((Math.max(0, totalCartonsVal - bonusCartonsVal)).toString());
    setEditCartonBonus(bonusCartonsVal > 0 ? bonusCartonsVal.toString() : '');

    setEditPacketCost(item.packetCostPrice || item.packetPurchaseCost ? (item.packetCostPrice || item.packetPurchaseCost)!.toString() : '');
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

  const toggleAggregatedExpand = (key: string) => {
    setExpandedAggregated(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Filter items with first-letter priority
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
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    return result;
  }, [items, searchTerm, filterSupplier]);

  // Aggregate items by Name (کۆی کاڵاکان بە کارتۆن - بۆ نمونە: ٥٠ کارتۆن بوشاری ترێ)
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
      const cWholesale = item.cartonWholesalePrice || item.wholesalePrice || 0;
      const pWholesale = item.packetWholesalePrice || 0;

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
          latestCartonWholesalePrice: cWholesale,
          latestPacketWholesalePrice: pWholesale,
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
        if (cWholesale > 0) ag.latestCartonWholesalePrice = cWholesale;
        if (pWholesale > 0) ag.latestPacketWholesalePrice = pWholesale;

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

  const grandTotalCartons = useMemo(() => aggregatedItems.reduce((acc, a) => acc + a.totalCartons, 0), [aggregatedItems]);
  const grandTotalBonusCartons = useMemo(() => aggregatedItems.reduce((acc, a) => acc + a.totalCartonBonus, 0), [aggregatedItems]);
  const grandTotalPackets = useMemo(() => aggregatedItems.reduce((acc, a) => acc + a.totalPackets, 0), [aggregatedItems]);
  const grandTotalBonusPackets = useMemo(() => aggregatedItems.reduce((acc, a) => acc + a.totalPacketBonus, 0), [aggregatedItems]);
  const grandTotalEstimatedWholesale = useMemo(() => {
    return aggregatedItems.reduce((acc, a) => {
      const cVal = a.totalCartons * (a.latestCartonWholesalePrice || a.latestCartonSellingPrice || 0);
      const pVal = a.totalPackets * (a.latestPacketWholesalePrice || a.latestPacketSellingPrice || 0);
      return acc + cVal + pVal;
    }, 0);
  }, [aggregatedItems]);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
            <Boxes size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">جەردی کۆگا</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                کۆی هەموو کاڵاکان بە کارتۆن
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              جەرد و هەژماری کۆی کاڵاکانی کۆگا بە یەکەی کارتۆن و پاکەت بێ جیاوازی وەسڵەکان
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handlePrintStockSummary}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs hover:shadow-md transition active:scale-[0.98]"
          >
            <Printer size={16} />
            <span>چاپکردنی لیستی گشتی</span>
          </button>
          
          {onNavigateToEntry && (
            <button
              type="button"
              onClick={onNavigateToEntry}
              className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs sm:text-sm font-bold border border-indigo-200 transition"
              title="داخڵکردنی کاڵای نوێ"
            >
              <PackagePlus size={16} />
              <span className="hidden md:inline">داخڵکردنی کاڵا</span>
            </button>
          )}

          {onNavigateToInventory && (
            <button
              type="button"
              onClick={onNavigateToInventory}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              title="بینینی بەشە کۆگا بەپێی وەسڵ"
            >
              <span>بەپێی وەسڵ</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Item Types */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
            <Layers size={22} />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-slate-500 font-medium truncate">جۆری کاڵاکان</div>
            <div className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
              {aggregatedItems.length}
            </div>
            <div className="text-[11px] text-slate-400">ئایتمی جیاواز لە کۆگا</div>
          </div>
        </div>

        {/* Total Cartons */}
        <div className="bg-white p-4 rounded-2xl border border-indigo-200 shadow-xs flex items-center gap-3.5 bg-linear-to-br from-indigo-50/40 to-white">
          <div className="w-11 h-11 bg-indigo-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow-xs">
            <Boxes size={22} />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-indigo-800 font-bold truncate">کۆی گشتی کارتۆن</div>
            <div className="text-xl sm:text-2xl font-black text-indigo-700 tracking-tight" dir="ltr">
              {grandTotalCartons.toLocaleString()}
            </div>
            {grandTotalBonusCartons > 0 && (
              <div className="text-[11px] text-emerald-600 font-bold">
                +{grandTotalBonusCartons.toLocaleString()} کارتۆنی دیاری
              </div>
            )}
          </div>
        </div>

        {/* Total Packets */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
            <Package size={22} />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-slate-500 font-medium truncate">کۆی گشتی پاکەت</div>
            <div className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight" dir="ltr">
              {grandTotalPackets.toLocaleString()}
            </div>
            {grandTotalBonusPackets > 0 && (
              <div className="text-[11px] text-emerald-600 font-bold">
                +{grandTotalBonusPackets.toLocaleString()} پاکەتی دیاری
              </div>
            )}
          </div>
        </div>

        {/* Estimated Wholesale Value */}
        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-xs flex items-center gap-3.5 bg-linear-to-br from-amber-50/30 to-white">
          <div className="w-11 h-11 bg-amber-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow-xs">
            <TrendingUp size={22} />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-amber-900 font-bold truncate">بەهای تەواوی کۆگا (کۆ)</div>
            <div className="text-lg sm:text-xl font-black text-amber-800 tracking-tight" dir="ltr">
              {grandTotalEstimatedWholesale.toLocaleString()}
            </div>
            <div className="text-[11px] text-amber-700/80">دیناری عێراقی</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="گەڕان بەپێی ناوی کاڵا (لە یەکەم پیتەوە)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition"
          />
          <Search size={18} className="absolute right-3.5 top-3 text-slate-400" />
        </div>

        <div className="flex items-center gap-2">
          {uniqueSuppliers.length > 0 && (
            <select
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="">هەموو کۆمپانیاکان ({uniqueSuppliers.length})</option>
              {uniqueSuppliers.map((s, idx) => (
                <option key={idx} value={s}>{s}</option>
              ))}
            </select>
          )}

          <div className="text-xs font-bold text-slate-600 px-3 py-2 bg-slate-100 rounded-xl whitespace-nowrap">
            {aggregatedItems.length} کاڵا دۆزرایەوە
          </div>
        </div>
      </div>

      {/* Main Aggregated Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-bold">خەریکی بارکردنی زانیارییەکانە...</div>
        ) : aggregatedItems.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
              <Boxes size={28} />
            </div>
            <p className="text-slate-600 font-bold text-sm">هیچ کاڵایەک نەدۆزرایەوە</p>
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-xs text-indigo-600 font-bold hover:underline"
              >
                سڕینەوەی وشەی گەڕان
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-xs font-bold uppercase">
                  <th className="py-3.5 px-4">ناوی کاڵا</th>
                  <th className="py-3.5 px-4 text-center">کۆی کارتۆن</th>
                  <th className="py-3.5 px-4 text-center">کۆی پاکەت</th>
                  <th className="py-3.5 px-4">نرخی فرۆشتن (کارتۆن / پاکەت)</th>
                  <th className="py-3.5 px-4">کۆمپانیاکانی سەرچاوە</th>
                  <th className="py-3.5 px-4 text-center">ژمارەی وەسڵ</th>
                  <th className="py-3.5 px-4 text-left">کردار</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {aggregatedItems.map((ag) => {
                  const isExpanded = !!expandedAggregated[ag.key];
                  return (
                    <React.Fragment key={ag.key}>
                      <tr 
                        className={`hover:bg-slate-50/70 transition-colors cursor-pointer ${isExpanded ? 'bg-indigo-50/20' : ''}`}
                        onClick={() => toggleAggregatedExpand(ag.key)}
                      >
                        {/* Name */}
                        <td className="py-4 px-4 font-black text-slate-900">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                              <Package size={16} />
                            </div>
                            <div>
                              <div className="font-black text-slate-900 text-sm sm:text-base">
                                {ag.name}
                              </div>
                              <div className="text-[11px] text-slate-400 font-normal">
                                دواین نوێکردنەوە: {ag.lastUpdated ? format(ag.lastUpdated, 'yyyy-MM-dd') : 'نەزانراو'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Total Cartons */}
                        <td className="py-4 px-4 text-center">
                          <div className="inline-flex flex-col items-center">
                            <span className="font-mono font-black text-base sm:text-lg text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-100" dir="ltr">
                              {ag.totalCartons.toLocaleString()} کارتۆن
                            </span>
                            {ag.totalCartonBonus > 0 && (
                              <span className="text-[10px] text-emerald-600 font-bold mt-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                {ag.totalCartonBonus} دیاری
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Total Packets */}
                        <td className="py-4 px-4 text-center">
                          {ag.totalPackets > 0 ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="font-mono font-bold text-sm text-slate-800 bg-slate-100 px-2.5 py-1 rounded-xl" dir="ltr">
                                {ag.totalPackets.toLocaleString()} پاکەت
                              </span>
                              {ag.totalPacketBonus > 0 && (
                                <span className="text-[10px] text-emerald-600 font-bold mt-0.5">
                                  {ag.totalPacketBonus} دیاری
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 font-mono">-</span>
                          )}
                        </td>

                        {/* Selling Prices */}
                        <td className="py-4 px-4 font-mono">
                          <div className="space-y-0.5">
                            {ag.latestCartonSellingPrice ? (
                              <div className="text-slate-800 font-bold">
                                <span className="text-[11px] text-slate-400 ml-1">کارتۆن:</span>
                                {ag.latestCartonSellingPrice.toLocaleString()} د.ع
                              </div>
                            ) : null}
                            {ag.latestPacketSellingPrice ? (
                              <div className="text-slate-600 text-xs">
                                <span className="text-[11px] text-slate-400 ml-1">پاکەت:</span>
                                {ag.latestPacketSellingPrice.toLocaleString()} د.ع
                              </div>
                            ) : null}
                            {!ag.latestCartonSellingPrice && !ag.latestPacketSellingPrice && (
                              <span className="text-slate-400 text-xs">دیاری نەکراوە</span>
                            )}
                          </div>
                        </td>

                        {/* Suppliers */}
                        <td className="py-4 px-4">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {ag.suppliers.length > 0 ? (
                              ag.suppliers.map((s, idx) => (
                                <span key={idx} className="inline-block text-[11px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                                  {s}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 text-xs">کۆگا</span>
                            )}
                          </div>
                        </td>

                        {/* Invoices Count */}
                        <td className="py-4 px-4 text-center">
                          <span className="font-bold text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
                            {ag.invoicesCount} وەسڵ
                          </span>
                        </td>

                        {/* Actions / Expand */}
                        <td className="py-4 px-4 text-left">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAggregatedExpand(ag.key);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 transition"
                          >
                            <span>{isExpanded ? 'داخستن' : 'وەسڵەکان'}</span>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Sub-items (Batches from separate invoices) */}
                      {isExpanded && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={7} className="p-4 sm:p-5">
                            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <h4 className="text-xs font-black text-slate-700 flex items-center gap-2">
                                  <Layers size={14} className="text-indigo-600" />
                                  <span>وەسڵ و بارەکانی «{ag.name}» کە ئەم کۆیەیان دروستکردووە ({ag.items.length})</span>
                                </h4>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  کۆی دەستاودەست: {ag.totalCartons} کارتۆن
                                </span>
                              </div>

                              <div className="divide-y divide-slate-100">
                                {ag.items.map((subItem) => {
                                  const cQ = subItem.cartonQuantity !== undefined ? subItem.cartonQuantity : (subItem.unitType === 'carton' ? (subItem.quantity || 0) : 0);
                                  const cB = subItem.cartonBonusQuantity || 0;
                                  const pQ = subItem.packetQuantity || 0;
                                  const pB = subItem.packetBonusQuantity || 0;

                                  return (
                                    <div key={subItem.id} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                                      <div className="flex items-center gap-3">
                                        <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-[10px]">
                                          #
                                        </div>
                                        <div>
                                          <div className="font-bold text-slate-800 flex items-center gap-2">
                                            <span>وەسڵی: {subItem.invoiceNo ? `#${subItem.invoiceNo}` : 'بێ ژمارە'}</span>
                                            <span className="text-slate-400">|</span>
                                            <span className="text-slate-600 font-medium">{subItem.supplier || 'کۆمپانیا'}</span>
                                          </div>
                                          <div className="text-[11px] text-slate-400 mt-0.5">
                                            بەروار: {subItem.createdAt ? format(subItem.createdAt, 'yyyy-MM-dd HH:mm') : 'نادیار'}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                                        <div className="font-mono text-xs">
                                          {cQ > 0 && (
                                            <span className="font-bold text-indigo-700 ml-2">
                                              {cQ} کارتۆن {cB > 0 ? `(${cB} دیاری)` : ''}
                                            </span>
                                          )}
                                          {pQ > 0 && (
                                            <span className="font-medium text-slate-600">
                                              {pQ} پاکەت {pB > 0 ? `(${pB} دیاری)` : ''}
                                            </span>
                                          )}
                                        </div>

                                        {(role === 'admin' || role === 'warehouse') && (
                                          <div className="flex items-center gap-1.5">
                                            <button
                                              type="button"
                                              onClick={() => handleEditClick(subItem)}
                                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                              title="دەستکاری کردنی ئەم بارە"
                                            >
                                              <Edit2 size={14} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setDeletingItem(subItem)}
                                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                              title="سڕینەوەی ئەم وەسڵە"
                                            >
                                              <Trash2 size={14} />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
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

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-slate-900 text-lg">دەستکاریکردنی کاڵا لە کۆگا</h3>
                <p className="text-xs text-slate-500">دەستکاری بڕ و نرخەکانی ئەم وەسڵە</p>
              </div>
              <button 
                type="button" 
                onClick={() => setEditingItem(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-slate-700 font-bold mb-1">ناوی کاڵا</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">کۆمپانیا / دابینکەر</label>
                  <input
                    type="text"
                    value={editSupplier}
                    onChange={(e) => setEditSupplier(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">ژمارەی وەسڵ</label>
                  <input
                    type="text"
                    value={editInvoiceNo}
                    onChange={(e) => setEditInvoiceNo(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              {/* Units checkboxes */}
              <div className="p-3 bg-slate-50 rounded-2xl flex items-center gap-4">
                <span className="font-bold text-slate-700">یەکە:</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editHasCarton}
                    onChange={(e) => setEditHasCarton(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="font-bold text-slate-800">کارتۆن</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editHasPacket}
                    onChange={(e) => setEditHasPacket(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="font-bold text-slate-800">پاکەت</span>
                </label>
              </div>

              {/* Carton details */}
              {editHasCarton && (
                <div className="p-3.5 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3">
                  <div className="font-bold text-indigo-900 text-xs">زانیاری کارتۆن:</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">بڕی کڕدراو</label>
                      <input
                        type="number"
                        value={editCartonQuantity}
                        onChange={(e) => setEditCartonQuantity(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-center font-bold"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">دیاری (بۆنەس)</label>
                      <input
                        type="number"
                        value={editCartonBonus}
                        onChange={(e) => setEditCartonBonus(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-center font-bold text-emerald-600"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">تێچوو (کڕین)</label>
                      <input
                        type="number"
                        value={editCartonCost}
                        onChange={(e) => setEditCartonCost(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-center font-bold"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">نرخی فرۆشتن</label>
                      <input
                        type="number"
                        value={editCartonPrice}
                        onChange={(e) => setEditCartonPrice(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-center font-bold"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Packet details */}
              {editHasPacket && (
                <div className="p-3.5 bg-emerald-50/40 rounded-2xl border border-emerald-100 space-y-3">
                  <div className="font-bold text-emerald-900 text-xs">زانیاری پاکەت:</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">بڕی کڕدراو</label>
                      <input
                        type="number"
                        value={editPacketQuantity}
                        onChange={(e) => setEditPacketQuantity(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-center font-bold"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">دیاری (بۆنەس)</label>
                      <input
                        type="number"
                        value={editPacketBonus}
                        onChange={(e) => setEditPacketBonus(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-center font-bold text-emerald-600"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">تێچوو (کڕین)</label>
                      <input
                        type="number"
                        value={editPacketCost}
                        onChange={(e) => setEditPacketCost(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-center font-bold"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">نرخی فرۆشتن</label>
                      <input
                        type="number"
                        value={editPacketPrice}
                        onChange={(e) => setEditPacketPrice(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-center font-bold"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition shadow-xs disabled:opacity-50"
                >
                  {isSavingEdit ? 'خەریکی پاشەکەوتکردنە...' : 'پاشەکەوتکردنی گۆڕانکاری'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deletingItem && (
        <ConfirmModal
          isOpen={true}
          title="سڕینەوەی ئەم بارە لە کۆگا"
          message={`ئایا دڵنیایت لە سڕینەوەی «${deletingItem.name}» (وەسڵی #${deletingItem.invoiceNo || 'بێ ژمارە'}) لە کۆگا؟ ئەم کردارە ناگەڕێتەوە.`}
          confirmText="بەڵێ، بیسڕەوە"
          cancelText="پاشگەزبوونەوە"
          onConfirm={confirmDeleteItem}
          onClose={() => setDeletingItem(null)}
        />
      )}
    </div>
  );
}
