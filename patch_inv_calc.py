import re

with open('src/components/views/InventoryView.tsx', 'r') as f:
    content = f.read()

# Update autoCalculate
auto_calc_orig = """  const autoCalculate = () => {
    let pCost = Number(pieceCost) || 0;
    let pPrice = Number(piecePrice) || 0;
    const cRatio = Number(cartonRatio) || 0;
    const pktRatio = Number(packetRatio) || 0;"""

auto_calc_new = """  const autoCalculate = () => {
    let pCost = Number(pieceCost) || 0;
    let pPrice = Number(piecePrice) || 0;
    let pWholesale = Number(pieceWholesale) || 0;
    const cRatio = Number(cartonRatio) || 0;
    const pktRatio = Number(packetRatio) || 0;"""
content = content.replace(auto_calc_orig, auto_calc_new)

# Carton deductions
c_deduce_orig = """    if (pPrice === 0 && showCarton && Number(cartonPrice) > 0 && cRatio > 0) {
      pPrice = Number(cartonPrice) / cRatio;
      setPiecePrice(pPrice.toString());
    }"""
c_deduce_new = """    if (pPrice === 0 && showCarton && Number(cartonPrice) > 0 && cRatio > 0) {
      pPrice = Number(cartonPrice) / cRatio;
      setPiecePrice(pPrice.toString());
    }
    if (pWholesale === 0 && showCarton && Number(cartonWholesale) > 0 && cRatio > 0) {
      pWholesale = Number(cartonWholesale) / cRatio;
      setPieceWholesale(pWholesale.toString());
    }"""
content = content.replace(c_deduce_orig, c_deduce_new)

# Packet deductions
p_deduce_orig = """    if (pPrice === 0 && showPacket && Number(packetPrice) > 0 && pktRatio > 0) {
      pPrice = Number(packetPrice) / pktRatio;
      setPiecePrice(pPrice.toString());
    }"""
p_deduce_new = """    if (pPrice === 0 && showPacket && Number(packetPrice) > 0 && pktRatio > 0) {
      pPrice = Number(packetPrice) / pktRatio;
      setPiecePrice(pPrice.toString());
    }
    if (pWholesale === 0 && showPacket && Number(packetWholesale) > 0 && pktRatio > 0) {
      pWholesale = Number(packetWholesale) / pktRatio;
      setPieceWholesale(pWholesale.toString());
    }"""
content = content.replace(p_deduce_orig, p_deduce_new)

# Fill carton
c_fill_orig = """    if (showCarton && cRatio > 0) {
      if (!cartonCost && pCost > 0) setCartonCost((pCost * cRatio).toString());
      if (!cartonPrice && pPrice > 0) setCartonPrice((pPrice * cRatio).toString());
    }"""
c_fill_new = """    if (showCarton && cRatio > 0) {
      if (!cartonCost && pCost > 0) setCartonCost((pCost * cRatio).toString());
      if (!cartonPrice && pPrice > 0) setCartonPrice((pPrice * cRatio).toString());
      if (!cartonWholesale && pWholesale > 0) setCartonWholesale((pWholesale * cRatio).toString());
    }"""
content = content.replace(c_fill_orig, c_fill_new)

# Fill packet
p_fill_orig = """    if (showPacket && pktRatio > 0) {
      if (!packetCost && pCost > 0) setPacketCost((pCost * pktRatio).toString());
      if (!packetPrice && pPrice > 0) setPacketPrice((pPrice * pktRatio).toString());
    }"""
p_fill_new = """    if (showPacket && pktRatio > 0) {
      if (!packetCost && pCost > 0) setPacketCost((pCost * pktRatio).toString());
      if (!packetPrice && pPrice > 0) setPacketPrice((pPrice * pktRatio).toString());
      if (!packetWholesale && pWholesale > 0) setPacketWholesale((pWholesale * pktRatio).toString());
    }"""
content = content.replace(p_fill_orig, p_fill_new)

with open('src/components/views/InventoryView.tsx', 'w') as f:
    f.write(content)
