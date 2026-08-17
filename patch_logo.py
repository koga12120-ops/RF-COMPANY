import re

with open('src/components/Dashboard.tsx', 'r') as f:
    content = f.read()

desktop_find = """          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-400 font-bold">
            RF
          </div>"""
desktop_replace = """          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-200 bg-white">
            <img src="/LOGO1.jpg" alt="Logo" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display = 'none'} />
          </div>"""

mobile_find = """          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs">
            RF
          </div>"""
mobile_replace = """          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-slate-200 bg-white">
            <img src="/LOGO1.jpg" alt="Logo" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display = 'none'} />
          </div>"""

content = content.replace(desktop_find, desktop_replace)
content = content.replace(mobile_find, mobile_replace)

with open('src/components/Dashboard.tsx', 'w') as f:
    f.write(content)

