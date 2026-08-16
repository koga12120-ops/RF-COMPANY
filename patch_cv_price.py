import re

with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

calc_price_fn = """
  const calcPrice = (item: any, unit: string, marketName: string) => {
    const isWholesale = markets.find(m => m.name === marketName)?.type === 'warehouse';
    if (isWholesale) {
      if (unit === 'carton') return item.cartonWholesalePrice || item.cartonSellingPrice || ((item.wholesalePrice || item.sellingPrice) * (item.ratio || 1));
      if (unit === 'packet') return item.packetWholesalePrice || item.packetSellingPrice || ((item.wholesalePrice || item.sellingPrice) * (item.packetRatio || 1));
      return item.wholesalePrice || item.sellingPrice || 0;
    } else {
      if (unit === 'carton') return item.cartonSellingPrice || (item.sellingPrice * (item.ratio || 1));
      if (unit === 'packet') return item.packetSellingPrice || (item.sellingPrice * (item.packetRatio || 1));
      return item.sellingPrice || 0;
    }
  };

  useEffect(() => {
    setCart(prev => prev.map(p => ({ ...p, finalPrice: calcPrice(p, p.unit || 'piece', selectedMarket) })));
  }, [selectedMarket, markets]);
"""

content = content.replace("  const addToCart = (item: any) => {", calc_price_fn + "  const addToCart = (item: any) => {")

content = content.replace("return [...prev, { ...item, cartQty: 1, finalPrice: item.sellingPrice, unit: 'piece' }];", "return [...prev, { ...item, cartQty: 1, finalPrice: calcPrice(item, 'piece', selectedMarket), unit: 'piece' }];")

content = re.sub(
    r"const price = newUnit === 'carton' \? \(item\.cartonSellingPrice \|\| item\.sellingPrice \* \(item\.ratio \|\| 1\)\) : \s*\(newUnit === 'packet' \? \(item\.packetSellingPrice \|\| item\.sellingPrice \* \(item\.packetRatio \|\| 1\)\) : \s*item\.sellingPrice\);",
    "const price = calcPrice(item, newUnit, selectedMarket);",
    content
)


with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(content)

