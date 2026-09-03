export type Role = 'admin' | 'warehouse' | 'sales_rep' | 'cashvan' | null;

export interface UserState {
  role: Role;
  isAuthenticated: boolean;
}

export interface Item {
  id: string;
  name: string;
  barcode: string;
  quantity: number; // بڕی بەردەست لە کۆگا (بە کارتۆن یان پاکەت)
  unitType?: 'carton' | 'packet' | 'both'; // یەکەی سەرەکی
  supplier?: string;
  invoiceNo?: string; // ژمارەی وەسڵ یان دەفتەر وەسڵی کۆمپانیا
  createdAt?: number;
  
  costPrice: number; // تێچووی سەرەکی
  sellingPrice: number; // نرخی فرۆشتنی سەرەکی
  wholesalePrice?: number; // نرخی کۆگا
  
  packetCostPrice?: number;
  packetSellingPrice?: number;
  packetWholesalePrice?: number;
  packetQuantity?: number;

  cartonCostPrice?: number;
  cartonSellingPrice?: number;
  cartonWholesalePrice?: number;
  cartonQuantity?: number;

  // Backward compatibility fields
  ratio?: number;
  packetRatio?: number;
  price?: number;
  cartonPrice?: number;
  packetPrice?: number;
  pieceSellingPrice?: number;
  [key: string]: any;
}

export interface Market {
  id: string;
  name: string;
  location: string;
  phone: string;
  type?: 'market' | 'warehouse'; // مارکێت یان کۆگا
  createdAt: number;
}

export interface StockHistory {
  id: string;
  itemId: string;
  itemName: string;
  quantityAdded: number;
  unit?: 'carton' | 'packet';
  date: number;
  invoiceNo?: string; // ژمارەی سەر وەسڵ
  supplier?: string;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense' | 'debt' | 'cash' | 'paid_debt' | 'company_debt' | 'company_cash' | 'company_paid_debt' | 'return_expense' | 'market_debt' | 'market_paid_debt';
  amount: number;
  date: number; // timestamp
  description: string;
  relatedEntityId?: string; // e.g. market name or person name
  profitReversal?: number;
  invoiceNo?: string; // ژمارەی دەفتەر وەسڵ
  collectorName?: string; // مەندووب، کاشڤان، یان کەسی وەرگر
  repName?: string;
  cashvanName?: string;
  receivedBy?: string;
}

export interface SalesRep {
  id: string;
  name: string;
  username?: string; // ناوی بەکارهێنەر بۆ چوونەژوورەوە
  password?: string; // تێپەڕەوشە / پاسوۆرد
  phone: string;
  email?: string;
  uid?: string;
  accessCode?: string; // کۆدی ئەمنی تایبەت یان پاسوۆرد
  status?: 'active' | 'pending' | 'disabled';
  totalSales: number;
  totalProfit: number;
  createdAt?: number;
}

export interface CashvanAccount {
  id: string;
  name: string;
  username?: string;
  password?: string;
  accessCode?: string;
  phone?: string;
  status?: 'active' | 'pending' | 'disabled';
  totalSales?: number;
  totalProfit?: number;
  createdAt?: number;
}


export interface OrderItem {
  itemId: string;
  name: string;
  quantity: number;
  giftQuantity?: number;
  unit?: 'carton' | 'packet';
  price: number;
  totalPrice?: number;
  isGift?: boolean;
}

export interface Order {
  id: string;
  invoiceId?: string;
  invoiceNo?: string; // ژمارەی ڕیزبەندی وەسڵ (00001, 00002...)
  repName: string;
  marketName: string;
  location: string;
  totalAmount: number;
  totalProfit?: number;
  items: OrderItem[];
  status: 'pending' | 'printed' | 'completed' | 'deleted';
  paymentStatus?: 'cash' | 'debt';
  paymentType?: 'cash' | 'debt';
  timestamp: number;
  fulfilledAt?: number;
  deletedBy?: string;
  deletedAt?: number;
}

export interface Company {
  id: string;
  name: string;
  location: string;
  phone: string;
  createdAt: number;
}

export interface CashvanRequisitionItem {
  itemId: string;
  name: string;
  quantity: number;
  unit: 'carton' | 'packet';
  price?: number;
}

export interface CashvanRequisition {
  id: string;
  requisitionNo?: string;
  cashvanName: string;
  cashvanId?: string;
  items: CashvanRequisitionItem[];
  notes?: string;
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  createdAt: number;
  completedAt?: number;
  preparedBy?: string;
}

export interface CashvanTransferItem {
  itemId: string;
  name: string;
  quantity: number;
  unit?: 'carton' | 'packet';
  price: number;
  barcode?: string;
}

export interface CashvanTransfer {
  id: string;
  transferNo?: string;
  cashvanName: string;
  cashvanId?: string;
  items: CashvanTransferItem[];
  totalValue: number;
  date: number;
  notes?: string;
  requisitionId?: string;
}

export interface CashvanSale {
  id: string;
  invoiceNo?: string; // ژمارەی ڕیزبەندی وەسڵ (00001, 00002...)
  invoiceId?: string;
  paymentType?: 'cash' | 'debt';
  cashvanName: string;
  marketName: string;
  items: {
    itemId: string;
    name: string;
    quantity: number;
    unit?: 'carton' | 'packet';
    price: number;
    barcode?: string;
    isGift?: boolean;
  }[];
  totalAmount: number;
  totalProfit?: number;
  status: 'pending_accounting' | 'accounted' | 'deleted';
  date: number;
  deletedBy?: string;
  deletedAt?: number;
}

export interface CashvanReturnItem {
  itemId: string;
  name: string;
  quantity: number;
  unit?: 'carton' | 'packet';
  price: number;
  barcode?: string;
}

export interface CashvanReturn {
  id: string;
  returnNo?: string;
  cashvanName: string;
  cashvanId?: string;
  items: CashvanReturnItem[];
  totalValue: number;
  date: number;
  notes?: string;
  receivedBy?: string;
  lastEditedAt?: number;
}

