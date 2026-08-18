import re

def fix_calc_price(file_path):
    with open(file_path, 'r') as f:
        content = f.read()

    # We want to change the else block in calcPrice
    # from:
    #      if (unit === 'carton') return item.cartonSellingPrice || ((item.sellingPrice || 0) * (item.ratio || 1));
    #      if (unit === 'packet') return item.packetSellingPrice || ((item.sellingPrice || 0) * (item.packetRatio || 1));
    #      return item.sellingPrice || 0;
    # to fallback to wholesale if selling is 0

    if "OrdersView" in file_path:
        # OrdersView
        else_block = """      if (unit === 'carton') return item.cartonSellingPrice || item.cartonWholesalePrice || ((item.sellingPrice || item.wholesalePrice || 0) * (item.ratio || 1));
      if (unit === 'packet') return item.packetSellingPrice || item.packetWholesalePrice || ((item.sellingPrice || item.wholesalePrice || 0) * (item.packetRatio || 1));
      return item.sellingPrice || item.wholesalePrice || 0;"""
    else:
        # CashvanSalesView
        else_block = """      if (unit === 'carton') return item.cartonSellingPrice || item.cartonWholesalePrice || ((item.sellingPrice || item.wholesalePrice || 0) * (item.ratio || 1));
      if (unit === 'packet') return item.packetSellingPrice || item.packetWholesalePrice || ((item.sellingPrice || item.wholesalePrice || 0) * (item.packetRatio || 1));
      return item.sellingPrice || item.wholesalePrice || 0;"""

    content = re.sub(r'if \(unit === \'carton\'\) return item\.cartonSellingPrice \|\| \(\(item\.sellingPrice \|\| 0\) \* \(item\.ratio \|\| 1\)\);\s*if \(unit === \'packet\'\) return item\.packetSellingPrice \|\| \(\(item\.sellingPrice \|\| 0\) \* \(item\.packetRatio \|\| 1\)\);\s*return item\.sellingPrice \|\| 0;', else_block, content)
    # Also CashvanSalesView has no `|| 0` in some places:
    content = re.sub(r'if \(unit === \'carton\'\) return item\.cartonSellingPrice \|\| \(item\.sellingPrice \* \(item\.ratio \|\| 1\)\);\s*if \(unit === \'packet\'\) return item\.packetSellingPrice \|\| \(item\.sellingPrice \* \(item\.packetRatio \|\| 1\)\);\s*return item\.sellingPrice \|\| 0;', else_block, content)

    with open(file_path, 'w') as f:
        f.write(content)

fix_calc_price('src/components/views/OrdersView.tsx')
fix_calc_price('src/components/views/CashvanSalesView.tsx')
print("done")
