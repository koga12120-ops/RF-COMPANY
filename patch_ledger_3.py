import re

with open('src/components/views/LedgerView.tsx', 'r') as f:
    content = f.read()

# Fix cashvan interval check
old_c_filter = "const c = cashvanSales.filter(cv => cv.status === 'accounted' && (isAll ? true : isWithinInterval(cv.timestamp, { start: start!, end: end! })));"
new_c_filter = "const c = cashvanSales.filter(cv => cv.status === 'accounted' && (isAll ? true : isWithinInterval(cv.date || cv.timestamp, { start: start!, end: end! })));"
content = content.replace(old_c_filter, new_c_filter)

# Add listTab state
content = content.replace("const [description, setDescription] = useState('');", "const [description, setDescription] = useState('');\n  const [listTab, setListTab] = useState<'transactions' | 'deals'>('transactions');")

# Add ShoppingBag import if not exists
if "ShoppingBag" not in content:
    content = content.replace("Calendar, Archive, Clock } from 'lucide-react';", "Calendar, Archive, Clock, ShoppingBag } from 'lucide-react';")

# Add Deals array
deals_logic = """  const { t: fTrans, o: fOrders, c: fCashvan } = filteredData;

  const deals = useMemo(() => {
    const list: any[] = [];
    fTrans.filter(t => ['company_cash', 'company_debt', 'company_paid_debt'].includes(t.type)).forEach(t => {
      list.push({
        id: t.id,
        type: t.type === 'company_paid_debt' ? 'پاردانەوەی کۆمپانیا' : 'وەرگرتنی کاڵا',
        entityName: t.relatedEntityId || t.description,
        personName: 'کۆمپانیا',
        amount: t.amount,
        date: t.date,
        invoiceNumber: 'COMP-' + t.id.slice(-4).toUpperCase()
      });
    });
    fOrders.forEach(o => {
      list.push({
        id: o.id,
        type: 'فرۆشتنی مەندووب',
        entityName: o.marketName,
        personName: o.repName,
        amount: o.totalAmount,
        date: o.timestamp,
        invoiceNumber: 'ORD-' + o.id.slice(-4).toUpperCase()
      });
    });
    fCashvan.forEach(c => {
      list.push({
        id: c.id,
        type: 'فرۆشتنی کاشڤان',
        entityName: c.marketName,
        personName: c.cashvanName,
        amount: c.totalAmount,
        date: c.date || c.timestamp,
        invoiceNumber: 'CASH-' + c.id.slice(-4).toUpperCase()
      });
    });
    list.sort((a, b) => b.date - a.date);
    return list;
  }, [fTrans, fOrders, fCashvan]);"""

content = re.sub(r'  const { t: fTrans, o: fOrders, c: fCashvan } = filteredData;', deals_logic, content)

# Replace the transactions section header with tabs
old_header = """        <section className={`bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden ${activeTab === 'archive' ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h4 className="font-bold text-slate-700 flex items-center gap-2">تۆمارەکان</h4>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-bold">
              {fTrans.length} دانە
            </span>
          </div>"""

new_header = """        <section className={`bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden ${activeTab === 'archive' ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
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

content = content.replace(old_header, new_header)

# Replace the body of the table
old_table = """          {loading ? (
            <div className="text-center py-10 text-slate-500">خەریکی هێنانە...</div>
          ) : (
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 font-semibold">بەروار</th>
                    <th className="px-4 py-3 font-semibold">جۆر</th>
                    <th className="px-4 py-3 font-semibold">وردەکاری</th>
                    <th className="px-4 py-3 font-semibold">بڕ</th>
                    <th className="px-4 py-3 font-semibold w-16"></th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-slate-50">
                  {fTrans.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-4 text-slate-500 text-xs font-mono" dir="ltr">{format(t.date, 'yyyy-MM-dd HH:mm')}</td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          ['income', 'cash', 'paid_debt'].includes(t.type) ? 'bg-green-100 text-green-700' : 
                          ['expense', 'company_cash', 'company_paid_debt', 'return_expense'].includes(t.type) ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {t.type === 'income' ? 'داهات' :
                           t.type === 'expense' ? 'خەرجی' :
                           t.type === 'return_expense' ? 'گەڕانەوە' :
                           t.type === 'cash' ? 'نەقد' :
                           t.type === 'paid_debt' ? 'واسڵکراو' : 
                           t.type === 'company_cash' ? 'نەقدی کۆمپانیا' :
                           t.type === 'company_paid_debt' ? 'پاردانەوە' :
                           t.type === 'company_debt' ? 'قەرزی کۆمپانیا' : 'قەرز'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-900 font-medium">{t.description}</td>
                      <td className="px-4 py-4 font-bold" dir="ltr">
                        <span className={['income', 'cash', 'paid_debt'].includes(t.type) ? 'text-green-600' : ['expense', 'company_cash', 'company_paid_debt', 'return_expense'].includes(t.type) ? 'text-red-600' : 'text-slate-900'}>
                          {t.amount.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="text-red-600 hover:bg-red-50 p-2 rounded transition"
                          title="سڕینەوە"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {fTrans.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-500">
                        هیچ تۆمارێک نییە لەم ماوەیەدا
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}"""

new_table = """          {loading ? (
            <div className="text-center py-10 text-slate-500">خەریکی هێنانە...</div>
          ) : (
            <div className="flex-1 overflow-x-auto">
              {listTab === 'transactions' ? (
                <table className="w-full text-right">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 font-semibold">بەروار</th>
                      <th className="px-4 py-3 font-semibold">جۆر</th>
                      <th className="px-4 py-3 font-semibold">وردەکاری</th>
                      <th className="px-4 py-3 font-semibold">بڕ</th>
                      <th className="px-4 py-3 font-semibold w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-slate-50">
                    {fTrans.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50/50 transition">
                        <td className="px-4 py-4 text-slate-500 text-xs font-mono" dir="ltr">{format(t.date, 'yyyy-MM-dd HH:mm')}</td>
                        <td className="px-4 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            ['income', 'cash', 'paid_debt'].includes(t.type) ? 'bg-green-100 text-green-700' : 
                            ['expense', 'company_cash', 'company_paid_debt', 'return_expense'].includes(t.type) ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {t.type === 'income' ? 'داهات' :
                             t.type === 'expense' ? 'خەرجی' :
                             t.type === 'return_expense' ? 'گەڕانەوە' :
                             t.type === 'cash' ? 'نەقد' :
                             t.type === 'paid_debt' ? 'واسڵکراو' : 
                             t.type === 'company_cash' ? 'نەقدی کۆمپانیا' :
                             t.type === 'company_paid_debt' ? 'پاردانەوە' :
                             t.type === 'company_debt' ? 'قەرزی کۆمپانیا' : 'قەرز'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-900 font-medium">{t.description}</td>
                        <td className="px-4 py-4 font-bold" dir="ltr">
                          <span className={['income', 'cash', 'paid_debt'].includes(t.type) ? 'text-green-600' : ['expense', 'company_cash', 'company_paid_debt', 'return_expense'].includes(t.type) ? 'text-red-600' : 'text-slate-900'}>
                            {t.amount.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="text-red-600 hover:bg-red-50 p-2 rounded transition"
                            title="سڕینەوە"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {fTrans.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-slate-500">
                          هیچ تۆمارێک نییە لەم ماوەیەدا
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-right">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 font-semibold">بەروار</th>
                      <th className="px-4 py-3 font-semibold">جۆر</th>
                      <th className="px-4 py-3 font-semibold">ژمارەی فاتورە</th>
                      <th className="px-4 py-3 font-semibold">ناوی کۆمپانیا/مارکێت</th>
                      <th className="px-4 py-3 font-semibold">مەندووب/کاشڤان</th>
                      <th className="px-4 py-3 font-semibold">بڕی پارە</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-slate-50">
                    {deals.map(d => (
                      <tr key={d.id} className="hover:bg-slate-50/50 transition">
                        <td className="px-4 py-4 text-slate-500 text-xs font-mono" dir="ltr">{format(d.date, 'yyyy-MM-dd HH:mm')}</td>
                        <td className="px-4 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            d.type === 'فرۆشتنی مەندووب' ? 'bg-indigo-100 text-indigo-700' :
                            d.type === 'فرۆشتنی کاشڤان' ? 'bg-sky-100 text-sky-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {d.type}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-500 font-mono text-xs">{d.invoiceNumber}</td>
                        <td className="px-4 py-4 font-bold text-slate-800">{d.entityName}</td>
                        <td className="px-4 py-4 text-slate-600">{d.personName}</td>
                        <td className="px-4 py-4 font-bold text-emerald-600" dir="ltr">{d.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                    {deals.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-500">
                          هیچ مامەڵەیەک نییە لەم ماوەیەدا
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}"""

content = content.replace(old_table, new_table)

with open('src/components/views/LedgerView.tsx', 'w') as f:
    f.write(content)

print("done")
