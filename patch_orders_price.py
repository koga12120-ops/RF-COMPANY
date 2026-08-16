import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

calc_price_fn = """  const calcPrice = (item: Item, unit: string) => {
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
"""

content = content.replace("  const getPriceByUnit = (item: Item, unit: string) => {\n    if (unit === 'carton') return item.cartonSellingPrice || (item.sellingPrice * (item.ratio || 1));\n    if (unit === 'packet') return item.packetSellingPrice || (item.sellingPrice * (item.packetRatio || 1));\n    return item.sellingPrice || 0;\n  };", calc_price_fn)

content = re.sub(
    r"const price = curr\.unit === 'carton' \? \(curr\.item\.cartonSellingPrice \|\| \(curr\.item\.sellingPrice \* \(curr\.item\.ratio \|\| 1\)\)\) : \(curr\.unit === 'packet' \? \(curr\.item\.packetSellingPrice \|\| \(curr\.item\.sellingPrice \* \(curr\.item\.packetRatio \|\| 1\)\)\) : curr\.item\.sellingPrice\);",
    "const price = calcPrice(curr.item, curr.unit);",
    content
)

content = re.sub(
    r"price: si\.unit === 'carton' \? \(si\.item\.cartonSellingPrice \|\| \(si\.item\.sellingPrice \* \(si\.item\.ratio \|\| 1\)\)\) : \(si\.unit === 'packet' \? \(si\.item\.packetSellingPrice \|\| \(si\.item\.sellingPrice \* \(si\.item\.packetRatio \|\| 1\)\)\) : si\.item\.sellingPrice\)",
    "price: calcPrice(si.item, si.unit)",
    content
)

content = content.replace("const getPriceByUnit = (item: Item, unit: string) => {", "")

content = re.sub(
    r'<span dir="ltr">\{item\.sellingPrice\}</span></div>',
    '<span dir="ltr">{calcPrice(item, "piece")}</span></div>',
    content
)


with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)
