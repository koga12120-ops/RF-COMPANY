export type Role = 'admin' | 'warehouse' | 'sales_rep' | 'cashvan' | null;

export interface UserState {
  role: Role;
  isAuthenticated: boolean;
}

export interface Item {
  id: string;
  name: string;
  barcode: string;
  quantity: number;
  supplier?: string;
  createdAt?: number;
  
  costPrice: number;
  sellingPrice: number;
  
  packetRatio?: number;
  packetCostPrice?: number;
  packetSellingPrice?: number;

  ratio: number; // carton ratio
  cartonCostPrice?: number;
  cartonSellingPrice?: number;
}

export interface Market {
  id: string;
  name: string;
  location: string;
  phone: string;
  createdAt: number;
}

export interface StockHistory {
  id: string;
  itemId: string;
  itemName: string;
  quantityAdded: number;
  date: number;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense' | 'debt' | 'cash' | 'paid_debt' | 'company_debt' | 'company_cash' | 'company_paid_debt' | 'return_expense';
  amount: number;
  date: number; // timestamp
  description: string;
  relatedEntityId?: string; // e.g. market name or person name
  profitReversal?: number;
}

export interface SalesRep {
  id: string;
  name: string;
  phone: string;
  totalSales: number;
  totalProfit: number;
}

export interface OrderItem {
  itemId: string;
  name: string;
  quantity: number;
  unit?: 'piece' | 'packet' | 'carton';
  price: number;
}

export interface Order {
  id: string;
  repName: string;
  marketName: string;
  location: string;
  totalAmount: number;
  totalProfit?: number;
  items: OrderItem[];
  status: 'pending' | 'printed' | 'completed';
  paymentStatus?: 'cash' | 'debt';
  timestamp: number;
}

export interface Company {
  id: string;
  name: string;
  location: string;
  phone: string;
  createdAt: number;
}


export interface CashvanTransfer {
  id: string;
  cashvanName: string;
  items: {
    itemId: string;
    name: string;
    quantity: number;
    unit?: 'piece' | 'packet' | 'carton';
    price: number;
  }[];
  totalValue: number;
  date: number;
}

export interface CashvanSale {
  id: string;
  cashvanName: string;
  marketName: string;
  items: {
    itemId: string;
    name: string;
    quantity: number;
    unit?: 'piece' | 'packet' | 'carton';
    price: number;
  }[];
  totalAmount: number;
  totalProfit?: number;
  status: 'pending_accounting' | 'accounted';
  date: number;
}
