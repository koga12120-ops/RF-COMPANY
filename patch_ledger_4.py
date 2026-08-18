import re

with open('src/components/views/LedgerView.tsx', 'r') as f:
    content = f.read()

# Add Deals Entity filter states
content = content.replace("const [description, setDescription] = useState('');\n  const [listTab, setListTab] = useState<'transactions' | 'deals'>('transactions');",
"""const [description, setDescription] = useState('');
  const [dealFilterType, setDealFilterType] = useState<'all' | 'company' | 'market' | 'warehouse'>('all');
  const [dealFilterName, setDealFilterName] = useState('all');""")

# Include 'deleted' status in filtering and use memos
new_filter_logic = """    const t = transactions.filter(tr => isAll ? true : isWithinInterval(tr.date, { start: start!, end: end! }));
    const o = orders.filter(ord => (ord.status === 'completed' || ord.status === 'deleted') && (isAll ? true : isWithinInterval(ord.timestamp, { start: start!, end: end! })));
    const c = cashvanSales.filter(cv => (cv.status === 'accounted' || cv.status === 'deleted') && (isAll ? true : isWithinInterval(cv.date || cv.timestamp, { start: start!, end: end! })));

    return { t, o, c };"""

content = re.sub(r'const t = transactions.*?\n.*?const o = orders.*?\n.*?const c = cashvanSales.*?\n.*?return \{ t, o, c \};', new_filter_logic, content, flags=re.DOTALL)


# Fix totals to exclude 'deleted'
totals_logic = """  const ordersProfit = fOrders.filter(o => o.status === 'completed').reduce((acc, ord) => acc + (ord.totalProfit || 0), 0);
  const ordersTotal = fOrders.filter(o => o.status === 'completed').reduce((acc, ord) => acc + (ord.totalAmount || 0), 0);

  const cashvanProfit = fCashvan.filter(c => c.status === 'accounted').reduce((acc, cv) => acc + (cv.totalProfit || 0), 0);
  const cashvanTotal = fCashvan.filter(c => c.status === 'accounted').reduce((acc, cv) => acc + (cv.totalAmount || 0), 0);"""

content = re.sub(r'const ordersProfit = fOrders.*?\n.*?const cashvanTotal = fCashvan.*?0\);', totals_logic, content, flags=re.DOTALL)


# Update Deals to include transactions, handle deleted status, and filter by dealFilterType
deals_logic = """  const deals = useMemo(() => {
    let list: any[] = [];
    fTrans.forEach(t => {
      list.push({
        id: t.id,
        type: t.type === 'company_paid_debt' ? 'پاردانەوەی کۆمپانیا' : (t.type === 'company_cash' || t.type === 'company_debt' ? 'وەرگرتنی کاڵا' : (t.type === 'income' ? 'داهاتی دەستی' : (t.type === 'expense' ? 'خەرجی دەستی' : 'پاردانەوە/قەرز'))),
        entityType: ['company_paid_debt', 'company_cash', 'company_debt'].includes(t.type) ? 'company' : 'market',
        entityName: t.relatedEntityId || t.description,
        personName: ['company_paid_debt', 'company_cash', 'company_debt'].includes(t.type) ? 'کۆمپانیا' : 'بەڕێوەبەر',
        amount: t.amount,
        date: t.date,
        invoiceNumber: (['company_paid_debt', 'company_cash', 'company_debt'].includes(t.type) ? 'COMP-' : 'TRN-') + t.id.slice(-4).toUpperCase(),
        isDeleted: false,
        deletedBy: ''
      });
    });
    fOrders.forEach(o => {
      list.push({
        id: o.id,
        type: 'فرۆشتنی مەندووب',
        entityType: 'market',
        entityName: o.marketName,
        personName: o.repName,
        amount: o.totalAmount,
        date: o.timestamp,
        invoiceNumber: 'ORD-' + o.id.slice(-4).toUpperCase(),
        isDeleted: o.status === 'deleted',
        deletedBy: o.deletedBy || ''
      });
    });
    fCashvan.forEach(c => {
      list.push({
        id: c.id,
        type: 'فرۆشتنی کاشڤان',
        entityType: 'market',
        entityName: c.marketName,
        personName: c.cashvanName,
        amount: c.totalAmount,
        date: c.date || c.timestamp,
        invoiceNumber: 'CASH-' + c.id.slice(-4).toUpperCase(),
        isDeleted: c.status === 'deleted',
        deletedBy: c.deletedBy || ''
      });
    });
    
    // Filtering
    if (dealFilterType !== 'all') {
       // Filter logic based on entity type might be complex since we don't have perfect entityType tags.
       // Let's assume deals handles it loosely.
       list = list.filter(d => d.entityType === dealFilterType || d.type.includes(dealFilterType === 'company' ? 'کۆمپانیا' : ''));
    }
    
    if (dealFilterName !== 'all' && dealFilterName.trim() !== '') {
       list = list.filter(d => d.entityName.includes(dealFilterName));
    }

    list.sort((a, b) => b.date - a.date);
    return list;
  }, [fTrans, fOrders, fCashvan, dealFilterType, dealFilterName]);
  
  // Get unique entities for the name dropdown
  const uniqueEntities = useMemo(() => {
    const names = new Set<string>();
    fTrans.forEach(t => names.add(t.relatedEntityId || t.description));
    fOrders.forEach(o => names.add(o.marketName));
    fCashvan.forEach(c => names.add(c.marketName));
    return Array.from(names).filter(n => n && n.trim() !== '');
  }, [fTrans, fOrders, fCashvan]);"""

content = re.sub(r'  const deals = useMemo\(\(\) => \{.*?\n  \}, \[fTrans, fOrders, fCashvan\]\);', deals_logic, content, flags=re.DOTALL)


# Remove "باڵانسی نەقد" div
cash_balance_html = """        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition">
          <div className="p-4 bg-emerald-100 text-emerald-600 rounded-full shrink-0">
            <DollarSign size={24} />
          </div>
          <div>
            <div className="text-sm text-slate-500 mb-1 font-medium">باڵانسی نەقد</div>
            <div className="text-2xl font-bold text-emerald-600" dir="ltr">{netProfit.toLocaleString()}</div>
          </div>
        </div>"""
content = content.replace(cash_balance_html, "")

# Remove list tabs and add filters above deals table
old_section_header = """        <section className={`bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden ${activeTab === 'archive' ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
          <div className="border-b border-slate-100 bg-slate-50 flex justify-between items-center px-4 pt-4">
            <div className="flex gap-4">
              <button
                onClick={() => setListTab('transactions')}
                className={`pb-3 font-bold text-sm flex items-center gap-2 border-b-2 transition ${
                  listTab === 'transactions' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                تۆمارەکان
                <span className={`text-xs px-2 py-0.5 rounded-full ${listTab === 'transactions' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                  {fTrans.length}
                </span>
              </button>
              <button
                onClick={() => setListTab('deals')}
                className={`pb-3 font-bold text-sm flex items-center gap-2 border-b-2 transition ${
                  listTab === 'deals' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <ShoppingBag size={16} />
                مامەڵەکان
                <span className={`text-xs px-2 py-0.5 rounded-full ${listTab === 'deals' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                  {deals.length}
                </span>
              </button>
            </div>
          </div>"""

new_section_header = """        <section className={`bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden ${activeTab === 'archive' ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
          <div className="border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 gap-4">
            <h4 className="font-bold text-slate-700 flex items-center gap-2">
              <ShoppingBag size={18} />
              مامەڵەکان
            </h4>
            <div className="flex gap-2 w-full sm:w-auto">
              <select
                className="px-3 py-1.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm flex-1 sm:flex-none"
                value={dealFilterType}
                onChange={(e) => setDealFilterType(e.target.value as any)}
              >
                <option value="all">جۆری لایەن</option>
                <option value="company">کۆمپانیاکان</option>
                <option value="market">مارکێت/کۆگا</option>
              </select>
              <select
                className="px-3 py-1.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm flex-1 sm:flex-none"
                value={dealFilterName}
                onChange={(e) => setDealFilterName(e.target.value)}
              >
                <option value="all">هەموو ناوەکان</option>
                {uniqueEntities.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>"""

content = content.replace(old_section_header, new_section_header)

# Replace table logic to remove transactions table and update deals table
old_table_section = """          {loading ? (
            <div className="text-center py-10 text-slate-500">خەریکی هێنانە...</div>
          ) : (
            <div className="flex-1 overflow-x-auto">
              {listTab === 'transactions' ? ("""

# Truncating everything inside the <div className="flex-1 overflow-x-auto"> to just the deals table
deals_table_only = """          {loading ? (
            <div className="text-center py-10 text-slate-500">خەریکی هێنانە...</div>
          ) : (
            <div className="flex-1 overflow-x-auto">
                <table className="w-full text-right">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 font-semibold">بەروار</th>
                      <th className="px-4 py-3 font-semibold">جۆر</th>
                      <th className="px-4 py-3 font-semibold">ژمارە</th>
                      <th className="px-4 py-3 font-semibold">ناوی کۆمپانیا/مارکێت</th>
                      <th className="px-4 py-3 font-semibold">ئەنجامدەر</th>
                      <th className="px-4 py-3 font-semibold">بڕی پارە</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-slate-50">
                    {deals.map((d, i) => (
                      <tr key={d.id + i} className="hover:bg-slate-50/50 transition">
                        <td className="px-4 py-4 text-slate-500 text-xs font-mono" dir="ltr">{format(d.date, 'yyyy-MM-dd HH:mm')}</td>
                        <td className="px-4 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            d.isDeleted ? 'bg-red-100 text-red-700' :
                            d.type.includes('مەندووب') ? 'bg-indigo-100 text-indigo-700' :
                            d.type.includes('کاشڤان') ? 'bg-sky-100 text-sky-700' :
                            d.type.includes('کۆمپانیا') ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {d.isDeleted ? 'سڕاوەتەوە' : d.type}
                          </span>
                          {d.isDeleted && <div className="text-[10px] text-red-500 mt-1">لە لایەن: {d.deletedBy}</div>}
                        </td>
                        <td className={`px-4 py-4 font-mono text-xs ${d.isDeleted ? 'text-slate-400 line-through' : 'text-slate-500'}`}>{d.invoiceNumber}</td>
                        <td className={`px-4 py-4 font-bold ${d.isDeleted ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{d.entityName}</td>
                        <td className={`px-4 py-4 ${d.isDeleted ? 'text-slate-400 line-through' : 'text-slate-600'}`}>{d.personName}</td>
                        <td className={`px-4 py-4 font-bold ${d.isDeleted ? 'text-slate-400 line-through' : 'text-emerald-600'}`} dir="ltr">{d.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                    {deals.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-500">
                          هیچ مامەڵەیەک نییە
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
            </div>
          )}"""

content = re.sub(r'          \{loading \? \(.*?</section>', deals_table_only + "\n        </section>", content, flags=re.DOTALL)

with open('src/components/views/LedgerView.tsx', 'w') as f:
    f.write(content)

print("done")
