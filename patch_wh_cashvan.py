import re

with open('src/components/views/WarehouseCashvanView.tsx', 'r') as f:
    content = f.read()

old_setDoc = """          await setDoc(cInvRef, {
            cashvanName: selectedCashvan,
            itemId: cartItem.item.id,
            name: cartItem.item.name,
            quantity: cartItem.quantity,
            price: cartItem.item.costPrice,
            sellingPrice: cartItem.item.sellingPrice,
            barcode: cartItem.item.barcode,
            ratio: cartItem.item.ratio || 1
          });"""

new_setDoc = """          await setDoc(cInvRef, {
            cashvanName: selectedCashvan,
            itemId: cartItem.item.id,
            name: cartItem.item.name,
            quantity: cartItem.quantity,
            barcode: cartItem.item.barcode,
            
            costPrice: cartItem.item.costPrice,
            sellingPrice: cartItem.item.sellingPrice,
            
            packetRatio: cartItem.item.packetRatio || 0,
            packetCostPrice: cartItem.item.packetCostPrice || 0,
            packetSellingPrice: cartItem.item.packetSellingPrice || 0,
            
            ratio: cartItem.item.ratio || 1,
            cartonCostPrice: cartItem.item.cartonCostPrice || 0,
            cartonSellingPrice: cartItem.item.cartonSellingPrice || 0
          });"""
content = content.replace(old_setDoc, new_setDoc)

with open('src/components/views/WarehouseCashvanView.tsx', 'w') as f:
    f.write(content)
