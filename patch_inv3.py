import re

with open('src/components/views/InventoryView.tsx', 'r') as f:
    content = f.read()

# Add states
content = content.replace(
    "const [piecePrice, setPiecePrice] = useState('');",
    "const [piecePrice, setPiecePrice] = useState('');\n  const [pieceWholesale, setPieceWholesale] = useState('');"
)
content = content.replace(
    "const [packetPrice, setPacketPrice] = useState('');",
    "const [packetPrice, setPacketPrice] = useState('');\n  const [packetWholesale, setPacketWholesale] = useState('');"
)
content = content.replace(
    "const [cartonPrice, setCartonPrice] = useState('');",
    "const [cartonPrice, setCartonPrice] = useState('');\n  const [cartonWholesale, setCartonWholesale] = useState('');"
)

# Update handleSubmit
item_data_replacement = """
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
"""
content = re.sub(
    r'costPrice: Number\(pieceCost\) \|\| 0,\s*sellingPrice: Number\(piecePrice\) \|\| 0,\s*packetRatio: pRatio,\s*packetCostPrice: Number\(packetCost\) \|\| 0,\s*packetSellingPrice: Number\(packetPrice\) \|\| 0,\s*ratio: cRatio,\s*cartonCostPrice: Number\(cartonCost\) \|\| 0,\s*cartonSellingPrice: Number\(cartonPrice\) \|\| 0,',
    item_data_replacement,
    content
)

# Update handleEdit
content = content.replace(
    "setPiecePrice(item.sellingPrice?.toString() || '');",
    "setPiecePrice(item.sellingPrice?.toString() || '');\n    setPieceWholesale(item.wholesalePrice?.toString() || '');"
)
content = content.replace(
    "setPacketPrice(item.packetSellingPrice?.toString() || '');",
    "setPacketPrice(item.packetSellingPrice?.toString() || '');\n    setPacketWholesale(item.packetWholesalePrice?.toString() || '');"
)
content = content.replace(
    "setCartonPrice(item.cartonSellingPrice?.toString() || '');",
    "setCartonPrice(item.cartonSellingPrice?.toString() || '');\n    setCartonWholesale(item.cartonWholesalePrice?.toString() || '');"
)

# Update resetForm
content = content.replace(
    "setPiecePrice('');",
    "setPiecePrice('');\n    setPieceWholesale('');"
)
content = content.replace(
    "setPacketPrice('');",
    "setPacketPrice('');\n    setPacketWholesale('');"
)
content = content.replace(
    "setCartonPrice('');",
    "setCartonPrice('');\n    setCartonWholesale('');"
)

# Add inputs to Piece Group
piece_inputs = """
                <div>
                  <label className="block text-xs text-gray-500 mb-1">نرخی فرۆشتن بۆ دانە</label>
                  <input type="number" min="0" step="any" required={showPiece} className="w-full px-2 py-1.5 border rounded-md text-sm" value={piecePrice} onChange={(e) => setPiecePrice(e.target.value)} dir="ltr" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">نرخی کۆگا (کۆمەڵ)</label>
                  <input type="number" min="0" step="any" className="w-full px-2 py-1.5 border rounded-md text-sm" value={pieceWholesale} onChange={(e) => setPieceWholesale(e.target.value)} dir="ltr" />
                </div>
"""
content = re.sub(
    r'<div>\s*<label className="block text-xs text-gray-500 mb-1">نرخی فرۆشتن بۆ دانە</label>\s*<input type="number" min="0" step="any" required=\{showPiece\} className="w-full px-2 py-1\.5 border rounded-md text-sm" value=\{piecePrice\} onChange=\{\(e\) => setPiecePrice\(e\.target\.value\)\} dir="ltr" />\s*</div>',
    piece_inputs,
    content
)

# Add inputs to Packet Group
packet_inputs = """
                <div>
                  <label className="block text-xs text-gray-500 mb-1">نرخی فرۆشتنی پاکەت</label>
                  <input type="number" min="0" step="any" required={showPacket} className="w-full px-2 py-1.5 border rounded-md text-sm" value={packetPrice} onChange={(e) => setPacketPrice(e.target.value)} dir="ltr" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">نرخی کۆگا (پاکەت)</label>
                  <input type="number" min="0" step="any" className="w-full px-2 py-1.5 border rounded-md text-sm" value={packetWholesale} onChange={(e) => setPacketWholesale(e.target.value)} dir="ltr" />
                </div>
"""
content = re.sub(
    r'<div>\s*<label className="block text-xs text-gray-500 mb-1">نرخی فرۆشتنی پاکەت</label>\s*<input type="number" min="0" step="any" required=\{showPacket\} className="w-full px-2 py-1\.5 border rounded-md text-sm" value=\{packetPrice\} onChange=\{\(e\) => setPacketPrice\(e\.target\.value\)\} dir="ltr" />\s*</div>',
    packet_inputs,
    content
)

# Add inputs to Carton Group
carton_inputs = """
                <div>
                  <label className="block text-xs text-gray-500 mb-1">نرخی فرۆشتنی کارتۆن</label>
                  <input type="number" min="0" step="any" required={showCarton} className="w-full px-2 py-1.5 border rounded-md text-sm" value={cartonPrice} onChange={(e) => setCartonPrice(e.target.value)} dir="ltr" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">نرخی کۆگا (کارتۆن)</label>
                  <input type="number" min="0" step="any" className="w-full px-2 py-1.5 border rounded-md text-sm" value={cartonWholesale} onChange={(e) => setCartonWholesale(e.target.value)} dir="ltr" />
                </div>
"""
content = re.sub(
    r'<div>\s*<label className="block text-xs text-gray-500 mb-1">نرخی فرۆشتنی کارتۆن</label>\s*<input type="number" min="0" step="any" required=\{showCarton\} className="w-full px-2 py-1\.5 border rounded-md text-sm" value=\{cartonPrice\} onChange=\{\(e\) => setCartonPrice\(e\.target\.value\)\} dir="ltr" />\s*</div>',
    carton_inputs,
    content
)

# Update Trash buttons
content = content.replace(
    "setPiecePrice(''); setPieceQuantity('');",
    "setPiecePrice(''); setPieceWholesale(''); setPieceQuantity('');"
)
content = content.replace(
    "setPacketPrice(''); }",
    "setPacketPrice(''); setPacketWholesale(''); }"
)
content = content.replace(
    "setCartonPrice(''); }",
    "setCartonPrice(''); setCartonWholesale(''); }"
)

with open('src/components/views/InventoryView.tsx', 'w') as f:
    f.write(content)
