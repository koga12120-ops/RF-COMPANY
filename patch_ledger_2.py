import re

with open('src/components/views/LedgerView.tsx', 'r') as f:
    content = f.read()

# Replace timeFilter state
content = content.replace("const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month'>('day');", "const [timeFilter, setTimeFilter] = useState<'all' | 'day' | 'week' | 'month'>('day');")

# Add archiveDay state
content = content.replace("const [archiveMonth, setArchiveMonth] = useState((new Date().getMonth() + 1).toString());", "const [archiveMonth, setArchiveMonth] = useState((new Date().getMonth() + 1).toString());\n  const [archiveDay, setArchiveDay] = useState('all');")

# Replace filteredData logic
filtered_data_logic = """  const filteredData = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date;
    let isAll = false;

    if (activeTab === 'current') {
      if (timeFilter === 'all') {
        isAll = true;
      } else if (timeFilter === 'day') {
        start = startOfDay(now);
        end = endOfDay(now);
      } else if (timeFilter === 'week') {
        start = startOfWeek(now, { weekStartsOn: 6 });
        end = endOfWeek(now, { weekStartsOn: 6 });
      } else {
        start = startOfMonth(now);
        end = endOfMonth(now);
      }
    } else {
      const y = parseInt(archiveYear);
      const m = parseInt(archiveMonth) - 1;
      if (archiveDay === 'all') {
        start = startOfMonth(new Date(y, m, 1));
        end = endOfMonth(new Date(y, m, 1));
      } else {
        const d = parseInt(archiveDay);
        start = startOfDay(new Date(y, m, d));
        end = endOfDay(new Date(y, m, d));
      }
    }

    const t = transactions.filter(tr => isAll ? true : isWithinInterval(tr.date, { start: start!, end: end! }));
    const o = orders.filter(ord => ord.status === 'completed' && (isAll ? true : isWithinInterval(ord.timestamp, { start: start!, end: end! })));
    const c = cashvanSales.filter(cv => cv.status === 'accounted' && (isAll ? true : isWithinInterval(cv.timestamp, { start: start!, end: end! })));

    return { t, o, c };
  }, [activeTab, timeFilter, archiveYear, archiveMonth, archiveDay, transactions, orders, cashvanSales]);"""

# Replace the useMemo block
content = re.sub(r'const filteredData = useMemo\(\(\) => \{.*?\n  \}, \[activeTab, timeFilter, archiveYear, archiveMonth, transactions, orders, cashvanSales\]\);', filtered_data_logic, content, flags=re.DOTALL)

# Add 'all' button in current
filters_current = """        {activeTab === 'current' ? (
          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={() => setTimeFilter('all')}
              className={`px-4 py-2 rounded-lg font-bold text-sm flex-1 md:flex-none transition ${timeFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              هەمووی
            </button>
            <button
              onClick={() => setTimeFilter('day')}
              className={`px-4 py-2 rounded-lg font-bold text-sm flex-1 md:flex-none transition ${timeFilter === 'day' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              ئەمڕۆ
            </button>
            <button
              onClick={() => setTimeFilter('week')}
              className={`px-4 py-2 rounded-lg font-bold text-sm flex-1 md:flex-none transition ${timeFilter === 'week' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              ئەم هەفتەیە
            </button>
            <button
              onClick={() => setTimeFilter('month')}
              className={`px-4 py-2 rounded-lg font-bold text-sm flex-1 md:flex-none transition ${timeFilter === 'month' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              ئەم مانگە
            </button>
          </div>
        ) : ("""

content = re.sub(r'\{activeTab === \'current\' \? \(\s*<div className="flex gap-2 w-full md:w-auto">.*?</div>\s*\) : \(', filters_current, content, flags=re.DOTALL)

# Add Day select in archive
archive_filters = """        ) : (
          <div className="flex gap-4 w-full md:w-auto">
            <div className="flex-1 md:flex-none">
              <label className="block text-xs text-slate-500 mb-1">ساڵ</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                value={archiveYear}
                onChange={(e) => setArchiveYear(e.target.value)}
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 md:flex-none">
              <label className="block text-xs text-slate-500 mb-1">مانگ</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                value={archiveMonth}
                onChange={(e) => setArchiveMonth(e.target.value)}
              >
                {months.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 md:flex-none">
              <label className="block text-xs text-slate-500 mb-1">ڕۆژ</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                value={archiveDay}
                onChange={(e) => setArchiveDay(e.target.value)}
              >
                <option value="all">هەمووی</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
        )}"""

content = re.sub(r'\) : \(\s*<div className="flex gap-4 w-full md:w-auto">.*?</div>\s*\)\}', archive_filters + "\n      }", content, flags=re.DOTALL)

with open('src/components/views/LedgerView.tsx', 'w') as f:
    f.write(content)

print("done")
