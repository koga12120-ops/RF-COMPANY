import re

with open('src/components/views/InventoryView.tsx', 'r') as f:
    content = f.read()

# Replace states
old_states = """  const [barcode, setBarcode] = useState('');
  const [cartonCostPrice, setCartonCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [cartonQuantity, setCartonQuantity] = useState('');
  const [ratio, setRatio] = useState('');
  const [supplier, setSupplier] = useState('');"""

new_states = """  const [barcode, setBarcode] = useState('');
  const [supplier, setSupplier] = useState('');

  const [pieceCost, setPieceCost] = useState('');
  const [piecePrice, setPiecePrice] = useState('');
  const [pieceQuantity, setPieceQuantity] = useState('');

  const [packetRatio, setPacketRatio] = useState('');
  const [packetCost, setPacketCost] = useState('');
  const [packetPrice, setPacketPrice] = useState('');
  const [packetQuantity, setPacketQuantity] = useState('');

  const [cartonRatio, setCartonRatio] = useState('');
  const [cartonCost, setCartonCost] = useState('');
  const [cartonPrice, setCartonPrice] = useState('');
  const [cartonQuantity, setCartonQuantity] = useState('');"""
content = content.replace(old_states, new_states)

# Replace handleSubmit
old_submit = """  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedRatio = Number(ratio) || 1;
    const newQuantity = Math.round(Number(cartonQuantity) * parsedRatio); // Total pieces
    const costPricePerPiece = Number(cartonCostPrice) / parsedRatio; // Cost per piece
    
    const itemData = {
      name,
      barcode,
      costPrice: costPricePerPiece,
      sellingPrice: Number(sellingPrice),
      quantity: newQuantity,
      ratio: parsedRatio,
      supplier,
    };"""

new_submit = """  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const pRatio = Number(packetRatio) || 0;
    const cRatio = Number(cartonRatio) || 0;
    
    let totalPiecesToAdd = (Number(pieceQuantity) || 0) + 
                           ((Number(packetQuantity) || 0) * (pRatio || 1)) + 
                           ((Number(cartonQuantity) || 0) * (cRatio || 1));

    const itemData: any = {
      name,
      barcode,
      supplier,
      costPrice: Number(pieceCost) || 0,
      sellingPrice: Number(piecePrice) || 0,
      packetRatio: pRatio,
      packetCostPrice: Number(packetCost) || 0,
      packetSellingPrice: Number(packetPrice) || 0,
      ratio: cRatio,
      cartonCostPrice: Number(cartonCost) || 0,
      cartonSellingPrice: Number(cartonPrice) || 0,
    };"""
content = content.replace(old_submit, new_submit)

# Also fix the update logic for quantity
old_update_logic = """        const oldQuantity = oldItem ? oldItem.quantity : 0;
        
        await updateDoc(doc(db, 'items', editId), itemData);
        
        if (newQuantity > oldQuantity) {
          const quantityAdded = newQuantity - oldQuantity;
          await addDoc(collection(db, 'stock_history'), {"""

new_update_logic = """        const oldQuantity = oldItem ? oldItem.quantity : 0;
        itemData.quantity = oldQuantity + totalPiecesToAdd; // Add to existing stock
        
        await updateDoc(doc(db, 'items', editId), itemData);
        
        if (totalPiecesToAdd > 0) {
          const quantityAdded = totalPiecesToAdd;
          await addDoc(collection(db, 'stock_history'), {"""
content = content.replace(old_update_logic, new_update_logic)

# Replace add logic
old_add_logic = """      } else {
        const docRef = await addDoc(collection(db, 'items'), { ...itemData, createdAt: Date.now() });
        await addDoc(collection(db, 'stock_history'), {
          itemId: docRef.id,
          itemName: name,
          quantityAdded: newQuantity,
          date: Date.now()
        });"""

new_add_logic = """      } else {
        itemData.quantity = totalPiecesToAdd;
        const docRef = await addDoc(collection(db, 'items'), { ...itemData, createdAt: Date.now() });
        await addDoc(collection(db, 'stock_history'), {
          itemId: docRef.id,
          itemName: name,
          quantityAdded: totalPiecesToAdd,
          date: Date.now()
        });"""
content = content.replace(old_add_logic, new_add_logic)

# handleEdit
old_edit = """  const handleEdit = (item: Item) => {
    setIsEditing(true);
    setEditId(item.id);
    setName(item.name);
    setBarcode(item.barcode);
    setCartonCostPrice(String(item.costPrice * item.ratio));
    setSellingPrice(String(item.sellingPrice));
    setCartonQuantity(String(Math.floor(item.quantity / item.ratio)));
    setRatio(String(item.ratio));
    setSupplier(item.supplier || '');
  };"""

new_edit = """  const handleEdit = (item: Item) => {
    setIsEditing(true);
    setEditId(item.id);
    setName(item.name);
    setBarcode(item.barcode);
    setSupplier(item.supplier || '');
    
    setPieceCost(String(item.costPrice || ''));
    setPiecePrice(String(item.sellingPrice || ''));
    setPieceQuantity('0');

    setPacketRatio(String(item.packetRatio || ''));
    setPacketCost(String(item.packetCostPrice || ''));
    setPacketPrice(String(item.packetSellingPrice || ''));
    setPacketQuantity('0');

    setCartonRatio(String(item.ratio || ''));
    setCartonCost(String(item.cartonCostPrice || ''));
    setCartonPrice(String(item.cartonSellingPrice || ''));
    setCartonQuantity('0');
  };"""
content = content.replace(old_edit, new_edit)

# resetForm
old_reset = """  const resetForm = () => {
    setIsEditing(false);
    setEditId('');
    setName('');
    setBarcode('');
    setCartonCostPrice('');
    setSellingPrice('');
    setCartonQuantity('');
    setRatio('');
    setSupplier('');
  };"""

new_reset = """  const resetForm = () => {
    setIsEditing(false);
    setEditId('');
    setName('');
    setBarcode('');
    setSupplier('');
    setPieceCost('');
    setPiecePrice('');
    setPieceQuantity('');
    setPacketRatio('');
    setPacketCost('');
    setPacketPrice('');
    setPacketQuantity('');
    setCartonRatio('');
    setCartonCost('');
    setCartonPrice('');
    setCartonQuantity('');
  };"""
content = content.replace(old_reset, new_reset)

with open('src/components/views/InventoryView.tsx', 'w') as f:
    f.write(content)
