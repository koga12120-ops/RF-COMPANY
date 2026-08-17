import re

with open('src/components/views/InventoryView.tsx', 'r') as f:
    content = f.read()

# 1. Modify handleEdit to calculate pieces, packets, cartons and set them.
handle_edit = """  const handleEdit = (item: Item) => {
    setIsEditing(true);
    setEditId(item.id);
    setName(item.name);
    setBarcode(item.barcode);
    setSupplier(item.supplier || '');
    
    setPieceCost(item.costPrice?.toString() || '');
    setPiecePrice(item.sellingPrice?.toString() || '');
    setPieceWholesale(item.wholesalePrice?.toString() || '');
    
    setPacketRatio(item.packetRatio?.toString() || '');
    setPacketCost(item.packetCostPrice?.toString() || '');
    setPacketPrice(item.packetSellingPrice?.toString() || '');
    setPacketWholesale(item.packetWholesalePrice?.toString() || '');
    
    setCartonRatio(item.ratio?.toString() || '');
    setCartonCost(item.cartonCostPrice?.toString() || '');
    setCartonPrice(item.cartonSellingPrice?.toString() || '');
    setCartonWholesale(item.cartonWholesalePrice?.toString() || '');

    // Calculate existing quantity breakdown
    let pieces = item.quantity || 0;
    const cRatio = item.ratio || 0;
    const pRatio = item.packetRatio || 0;
    let cartons = 0;
    let packets = 0;
    
    if (cRatio > 0) {
      cartons = Math.floor(pieces / cRatio);
      pieces = pieces % cRatio;
    }
    if (pRatio > 0) {
      packets = Math.floor(pieces / pRatio);
      pieces = pieces % pRatio;
    }
    
    setPieceQuantity(pieces ? pieces.toString() : '0');
    setPacketQuantity(packets ? packets.toString() : '0');
    setCartonQuantity(cartons ? cartons.toString() : '0');
    
    setPaymentType('cash');

    setShowPacket(!!item.packetRatio || !!item.packetCostPrice || !!item.packetSellingPrice);
    setShowCarton(!!item.ratio || !!item.cartonCostPrice || !!item.cartonSellingPrice);
    setShowPiece(!!item.costPrice || !!item.sellingPrice);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };"""

content = re.sub(r'  const handleEdit = \(item: Item\) => \{[\s\S]*?window.scrollTo\(\{ top: 0, behavior: \'smooth\' \}\);\n  \};\n', handle_edit + '\n', content)

# 2. Modify handleSubmit to use absolute total quantity and quantityAdded
submit_logic = """    let totalPieces = (Number(pieceQuantity) || 0) +
                           ((Number(packetQuantity) || 0) * (pRatio || 1)) +
                           ((Number(cartonQuantity) || 0) * (cRatio || 1));

    const itemData: any = {
      name,
      barcode,
      supplier,
      
      costPrice: Number(pieceCost) || 0,
      sellingPrice: Number(piecePrice) || 0,
      wholesalePrice: Number(pieceWholesale) || 0,
      packetRatio: pRatio,
      packetCostPrice: Number(packetCost) || 0,
      packetSellingPrice: Number(packetPrice) || 0,
      packetWholesalePrice: Number(packetWholesale) || 0,
      ratio: cRatio,
      cartonCostPrice: Number(cartonCost) || 0,
      cartonSellingPrice: Number(cartonPrice) || 0,
      cartonWholesalePrice: Number(cartonWholesale) || 0,
    };

    let costPricePerPiece = itemData.costPrice || (pRatio ? itemData.packetCostPrice / pRatio : 0) || (cRatio ? itemData.cartonCostPrice / cRatio : 0);

    try {
      if (supplier && !companies.find(c => c.name === supplier)) {
        await addDoc(collection(db, 'companies'), { name: supplier, location: '', phone: '', type: 'warehouse', createdAt: Date.now() });
      }
      
      if (isEditing) {
        const oldItem = items.find(i => i.id === editId);
        const oldQuantity = oldItem ? (oldItem.quantity || 0) : 0;
        const quantityAdded = totalPieces - oldQuantity;
        
        // سیستمە پێشکەوتووەکەی حساباتی تێچوو (Weighted Average Cost)
        if (quantityAdded > 0 && oldQuantity > 0 && oldItem) {
          const oldCost = oldItem.costPrice || 0;
          const newCost = costPricePerPiece;
          
          if (oldCost > 0 && newCost > 0) {
            const totalOldValue = oldQuantity * oldCost;
            const totalNewValue = quantityAdded * newCost;
            const avgCost = (totalOldValue + totalNewValue) / (oldQuantity + quantityAdded);
            
            itemData.costPrice = Number(avgCost.toFixed(2));
            if (pRatio > 0) itemData.packetCostPrice = Number((avgCost * pRatio).toFixed(2));
            if (cRatio > 0) itemData.cartonCostPrice = Number((avgCost * cRatio).toFixed(2));
            
            // Update cost for transactions
            costPricePerPiece = itemData.costPrice; 
          }
        }

        itemData.quantity = totalPieces; // Set absolute new stock
        
        await updateDoc(doc(db, 'items', editId), itemData);
        
        if (quantityAdded > 0) {
          await addDoc(collection(db, 'stock_history'), {
            itemId: editId,
            itemName: name,
            quantityAdded,
            date: Date.now()
          });
          
          await addDoc(collection(db, 'transactions'), {
            type: paymentType === 'cash' ? 'company_cash' : 'company_debt',
            amount: costPricePerPiece * quantityAdded,
            date: Date.now(),
            description: paymentType === 'cash' ? `نەقدی زیادکردنی کاڵای ${name}` : `قەرزی زیادکردنی کاڵای ${name}`,
            relatedEntityId: supplier || 'نەزانراو'
          });
        }
      } else {
        itemData.quantity = totalPieces;
        const docRef = await addDoc(collection(db, 'items'), { ...itemData, createdAt: Date.now() });
        
        if (totalPieces > 0) {
          await addDoc(collection(db, 'stock_history'), {
            itemId: docRef.id,
            itemName: name,
            quantityAdded: totalPieces,
            date: Date.now()
          });
          
          await addDoc(collection(db, 'transactions'), {
            type: paymentType === 'cash' ? 'company_cash' : 'company_debt',
            amount: costPricePerPiece * totalPieces,
            date: Date.now(),
            description: paymentType === 'cash' ? `نەقدی کڕینی کاڵای ${name}` : `قەرزی کڕینی کاڵای ${name}`,
            relatedEntityId: supplier || 'نەزانراو'
          });
        }

      }"""

content = re.sub(r'    let totalPiecesToAdd =[\s\S]*?      \} else \{\n        itemData\.quantity = totalPiecesToAdd;[\s\S]*?      \}', submit_logic, content)

with open('src/components/views/InventoryView.tsx', 'w') as f:
    f.write(content)
