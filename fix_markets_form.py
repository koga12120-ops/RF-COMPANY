import re

with open('src/components/views/MarketsView.tsx', 'r') as f:
    content = f.read()

orig_form = """<form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm text-slate-600 mb-1">ناوی مارکێت / شوێن</label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>"""

new_form = """<form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm text-slate-600 mb-1">ناوی شوێن</label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">جۆری کڕیار</label>
            <select
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as 'market' | 'warehouse')}
            >
              <option value="market">مارکێت (فرۆشتن بە نرخی ئاسایی)</option>
              <option value="warehouse">کۆگا/جوملە (فرۆشتن بە نرخی کۆگا)</option>
            </select>
          </div>"""

content = content.replace(orig_form, new_form)

with open('src/components/views/MarketsView.tsx', 'w') as f:
    f.write(content)
