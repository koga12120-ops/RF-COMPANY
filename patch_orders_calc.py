import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

calc_price = """  const calcPrice = (item: Item, unit: string) => {
    if (!item) return 0;
    const isWholesale = markets.find(m => m.name === marketName)?.type === 'warehouse';
    if (isWholesale) {
      if (unit === 'carton') return item.cartonWholesalePrice || item.cartonSellingPrice || (((item.wholesalePrice || item.sellingPrice || 0)) * (item.ratio || 1));
      if (unit === 'packet') return item.packetWholesalePrice || item.packetSellingPrice || (((item.wholesalePrice || item.sellingPrice || 0)) * (item.packetRatio || 1));
      return item.wholesalePrice || item.sellingPrice || 0;
    } else {
      if (unit === 'carton') return item.cartonSellingPrice || ((item.sellingPrice || 0) * (item.ratio || 1));
      if (unit === 'packet') return item.packetSellingPrice || ((item.sellingPrice || 0) * (item.packetRatio || 1));
      return item.sellingPrice || 0;
    }
  };"""

content = re.sub(r'  const calcPrice = \(item: Item, unit: string\) => \{[\s\S]*?  \};\n', calc_price + '\n', content)

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)
