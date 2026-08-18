import re

with open('src/components/views/LedgerView.tsx', 'r') as f:
    content = f.read()

# Update uniqueEntities logic
old_entities_logic = """  const uniqueEntities = useMemo(() => {
    const names = new Set<string>();
    fTrans.forEach(t => names.add(t.relatedEntityId || t.description));
    fOrders.forEach(o => names.add(o.marketName));
    fCashvan.forEach(c => names.add(c.marketName));
    return Array.from(names).filter(n => n && n.trim() !== '');
  }, [fTrans, fOrders, fCashvan]);"""

new_entities_logic = """  const uniqueEntities = useMemo(() => {
    const entities = new Map<string, string>();
    fTrans.forEach(t => {
      const isCompany = ['company_paid_debt', 'company_cash', 'company_debt'].includes(t.type);
      const name = t.relatedEntityId || t.description;
      if (name) entities.set(name, isCompany ? 'company' : 'market');
    });
    fOrders.forEach(o => { if (o.marketName) entities.set(o.marketName, 'market'); });
    fCashvan.forEach(c => { if (c.marketName) entities.set(c.marketName, 'market'); });
    
    let list = Array.from(entities.entries()).map(([name, type]) => ({ name, type }));
    if (dealFilterType !== 'all') {
      list = list.filter(e => e.type === dealFilterType);
    }
    return list.map(e => e.name).filter(n => n && n.trim() !== '').sort();
  }, [fTrans, fOrders, fCashvan, dealFilterType]);

  const handleDeleteDeal = async (deal: any) => {
    try {
      if (deal.invoiceNumber.startsWith('COMP-') || deal.invoiceNumber.startsWith('TRN-')) {
        await deleteDoc(doc(db, 'transactions', deal.id));
      } else if (deal.invoiceNumber.startsWith('ORD-')) {
        await deleteDoc(doc(db, 'orders', deal.id));
      } else if (deal.invoiceNumber.startsWith('CASH-')) {
        await deleteDoc(doc(db, 'cashvan_sales', deal.id));
      }
    } catch (error) {
      console.error(error);
    }
  };"""

content = content.replace(old_entities_logic, new_entities_logic)

# Update the dealFilterType select to also reset the dealFilterName
old_select = """              <select
                className="px-3 py-1.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm flex-1 sm:flex-none"
                value={dealFilterType}
                onChange={(e) => setDealFilterType(e.target.value as any)}
              >"""

new_select = """              <select
                className="px-3 py-1.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm flex-1 sm:flex-none"
                value={dealFilterType}
                onChange={(e) => {
                  setDealFilterType(e.target.value as any);
                  setDealFilterName('all');
                }}
              >"""

content = content.replace(old_select, new_select)

# Add column header and cell for delete button in deals table
old_table_header = """                    <tr>
                      <th className="px-4 py-3 font-semibold">بەروار</th>
                      <th className="px-4 py-3 font-semibold">جۆر</th>
                      <th className="px-4 py-3 font-semibold">ژمارە</th>
                      <th className="px-4 py-3 font-semibold">ناوی کۆمپانیا/مارکێت</th>
                      <th className="px-4 py-3 font-semibold">ئەنجامدەر</th>
                      <th className="px-4 py-3 font-semibold">بڕی پارە</th>
                    </tr>"""

new_table_header = """                    <tr>
                      <th className="px-4 py-3 font-semibold">بەروار</th>
                      <th className="px-4 py-3 font-semibold">جۆر</th>
                      <th className="px-4 py-3 font-semibold">ژمارە</th>
                      <th className="px-4 py-3 font-semibold">ناوی کۆمپانیا/مارکێت</th>
                      <th className="px-4 py-3 font-semibold">ئەنجامدەر</th>
                      <th className="px-4 py-3 font-semibold">بڕی پارە</th>
                      <th className="px-4 py-3 font-semibold w-16"></th>
                    </tr>"""

content = content.replace(old_table_header, new_table_header)


old_table_row = """                        <td className={`px-4 py-4 font-bold ${d.isDeleted ? 'text-slate-400 line-through' : 'text-emerald-600'}`} dir="ltr">{d.amount.toLocaleString()}</td>
                      </tr>"""

new_table_row = """                        <td className={`px-4 py-4 font-bold ${d.isDeleted ? 'text-slate-400 line-through' : 'text-emerald-600'}`} dir="ltr">{d.amount.toLocaleString()}</td>
                        <td className="px-4 py-4">
                          <button
                            onClick={() => handleDeleteDeal(d)}
                            className="text-red-600 hover:bg-red-50 p-2 rounded transition"
                            title="سڕینەوە"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>"""

content = content.replace(old_table_row, new_table_row)

old_colspan = """<td colSpan={6} className="text-center py-8 text-slate-500">"""
new_colspan = """<td colSpan={7} className="text-center py-8 text-slate-500">"""
content = content.replace(old_colspan, new_colspan)

with open('src/components/views/LedgerView.tsx', 'w') as f:
    f.write(content)

print("done")
