import re

def fix_units(file_path):
    with open(file_path, 'r') as f:
        content = f.read()

    piece_option = r'<option value="piece">دانە</option>'
    
    # We want to replace it with a conditional
    # A piece is available if item.sellingPrice > 0 OR it doesn't have carton/packet
    # Wait, in the item, it's called `sellingPrice`
    # For Cashvan it's `c.sellingPrice` or `si.item.sellingPrice`
    
    if "OrdersView" in file_path:
        cond = "{ (si.item.sellingPrice > 0 || si.item.wholesalePrice > 0 || (!si.item.ratio && !si.item.packetRatio)) && <option value=\"piece\">دانە</option> }"
    else:
        # Cashvan
        cond = "{ (c.sellingPrice > 0 || c.wholesalePrice > 0 || (!c.ratio && !c.packetRatio)) && <option value=\"piece\">دانە</option> }"

    content = content.replace(piece_option, cond)
    
    with open(file_path, 'w') as f:
        f.write(content)

fix_units('src/components/views/OrdersView.tsx')
fix_units('src/components/views/CashvanSalesView.tsx')
print("done")
