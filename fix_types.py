import re

with open('src/types.ts', 'r') as f:
    content = f.read()

content = content.replace(
    "export type Role = 'admin' | 'warehouse' | 'sales_rep' | null;",
    "export type Role = 'admin' | 'warehouse' | 'sales_rep' | 'cashvan' | null;"
)

content += """

export interface CashvanTransfer {
  id: string;
  cashvanName: string;
  items: {
    itemId: string;
    name: string;
    quantity: number;
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
    price: number;
  }[];
  totalAmount: number;
  status: 'pending_accounting' | 'accounted';
  date: number;
}
"""

with open('src/types.ts', 'w') as f:
    f.write(content)
