import re

with open('src/components/views/InventoryView.tsx', 'r') as f:
    content = f.read()

# Update state variables
content = re.sub(
    r"const \[costPrice, setCostPrice\] = useState\(''\);\s*const \[sellingPrice, setSellingPrice\] = useState\(''\);\s*const \[quantity, setQuantity\] = useState\(''\);\s*const \[ratio, setRatio\] = useState\('1'\);",
    r"const [cartonCostPrice, setCartonCostPrice] = useState('');\n  const [sellingPrice, setSellingPrice] = useState('');\n  const [cartonQuantity, setCartonQuantity] = useState('');\n  const [ratio, setRatio] = useState('');",
    content
)

# Update resetForm
old_reset = """    setCostPrice('');
    setSellingPrice('');
    setQuantity('');
    setRatio('');"""

new_reset = """    setCartonCostPrice('');
    setSellingPrice('');
    setCartonQuantity('');
    setRatio('');"""

content = content.replace(old_reset, new_reset)

# Update handleEdit
old_edit = """    setCostPrice(item.costPrice.toString());
    setSellingPrice(item.sellingPrice.toString());
    setQuantity(item.quantity.toString());
    setRatio(item.ratio.toString());"""

new_edit = """    setRatio(item.ratio?.toString() || '1');
    setCartonCostPrice(item.costPrice ? (item.costPrice * (item.ratio || 1)).toString() : '');
    setSellingPrice(item.sellingPrice?.toString() || '');
    setCartonQuantity(item.quantity ? (item.quantity / (item.ratio || 1)).toString() : '');"""

content = content.replace(old_edit, new_edit)

# Update handleSubmit
old_submit = """  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newQuantity = Number(quantity);
    const itemData = {
      name,
      barcode,
      costPrice: Number(costPrice),
      sellingPrice: Number(sellingPrice),
      quantity: newQuantity,
      ratio: Number(ratio),
      supplier,
    };"""

new_submit = """  const handleSubmit = async (e: React.FormEvent) => {
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

content = content.replace(old_submit, new_submit)

# Also need to update the cost calculation for the transaction in handleSubmit
# In handleSubmit: amount: Number(costPrice) * quantityAdded -> costPrice is not defined here anymore
old_trans = """amount: Number(costPrice) * quantityAdded,"""
new_trans = """amount: costPricePerPiece * quantityAdded,"""
content = content.replace(old_trans, new_trans)
old_trans2 = """amount: Number(costPrice) * newQuantity,"""
new_trans2 = """amount: costPricePerPiece * newQuantity,"""
content = content.replace(old_trans2, new_trans2)

# Update the form fields
old_form = """          <div>
            <label className="block text-sm text-gray-600 mb-1">تێچوو (نرخی کڕین)</label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">نرخی فرۆشتن</label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">ژمارەی کاڵا (دانە/کارتۆن)</label>
            <input
              type="number"
              required
              min="0"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              dir="ltr"
            />
          </div>"""

new_form = """          <div>
            <label className="block text-sm text-gray-600 mb-1">عددی کاڵا (بە کارتۆن)</label>
            <input
              type="number"
              required
              min="0"
              step="any"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={cartonQuantity}
              onChange={(e) => setCartonQuantity(e.target.value)}
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">بڕی کارتۆن (هەر کارتۆنێک چەندی تێدایە)</label>
            <input
              type="number"
              required
              min="1"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={ratio}
              onChange={(e) => setRatio(e.target.value)}
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">نرخ بە کارتۆن</label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={cartonCostPrice}
              onChange={(e) => setCartonCostPrice(e.target.value)}
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">نرخ بە تاک (بە عدد)</label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              dir="ltr"
            />
          </div>"""

content = content.replace(old_form, new_form)

# Let's also update the table view so it displays the ratio and cartons properly if they want? The user didn't ask to change the table, but it might be nice. 
# Wait, let's just make the changes to the form. The user specifically said "کاڵا داخڵکردن ئاوا لێبکە :" (Make item entry like this:)

with open('src/components/views/InventoryView.tsx', 'w') as f:
    f.write(content)

