import re

with open('src/types.ts', 'r') as f:
    content = f.read()

old_item = """export interface Item {
  id: string;
  name: string;
  barcode: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  ratio: number;
  supplier?: string;
  createdAt?: number;
}"""

new_item = """export interface Item {
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
}"""

content = content.replace(old_item, new_item)

content = content.replace("'piece' | 'carton'", "'piece' | 'packet' | 'carton'")

with open('src/types.ts', 'w') as f:
    f.write(content)
