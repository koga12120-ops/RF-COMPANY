import re

with open('src/components/Dashboard.tsx', 'r') as f:
    content = f.read()

# Desktop header
desktop_header = """      {/* Desktop Header */}
      <header className="hidden lg:flex h-16 bg-white border-b border-slate-200 items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-400 font-bold">
            RF
          </div>
          <h1 className="text-xl font-bold text-slate-800">کۆمپانیای RF</h1>
        </div>
        <div className="flex items-center gap-4">
          {/* Theme Switcher */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-full border border-slate-200 mr-4">
            <button 
              onClick={() => setTheme('light')} 
              className={`w-6 h-6 rounded-full border-2 ${theme === 'light' ? 'border-indigo-500 scale-110 shadow-sm' : 'border-transparent'} bg-white`}
              title="سپی"
            />
            <button 
              onClick={() => setTheme('dark')} 
              className={`w-6 h-6 rounded-full border-2 ${theme === 'dark' ? 'border-indigo-500 scale-110 shadow-sm' : 'border-transparent'} bg-slate-800`}
              title="ڕەش"
            />
            <button 
              onClick={() => setTheme('sepia')} 
              className={`w-6 h-6 rounded-full border-2 ${theme === 'sepia' ? 'border-indigo-500 scale-110 shadow-sm' : 'border-transparent'} bg-[#fef3c7]`}
              title="زەردباو"
            />
          </div>

          <div className="flex flex-col items-end">
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
              {role === 'admin' ? 'بەڕێوەبەر' : role === 'warehouse' ? 'بەشی کۆگا' : 'مەندووب'}
            </span>
            <span className="text-sm font-medium">{menu.find(m => m.id === activeTab)?.label}</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center text-slate-500">
            <Users size={20} />
          </div>
        </div>
      </header>"""

content = re.sub(r'      \{\/\* Desktop Header \*\/\}[\s\S]*?<\/header>', desktop_header, content, count=1)

mobile_header = """      {/* Mobile header */}
      <header className="lg:hidden bg-white shadow-sm border-b px-4 py-3 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs">
            RF
          </div>
          <h2 className="font-semibold text-slate-800 text-lg">
            {menu.find(m => m.id === activeTab)?.label}
          </h2>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Theme Switcher (Mobile) */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-full border border-slate-200">
            <button 
              onClick={() => setTheme('light')} 
              className={`w-5 h-5 rounded-full border-2 ${theme === 'light' ? 'border-indigo-500 scale-110 shadow-sm' : 'border-transparent'} bg-white`}
            />
            <button 
              onClick={() => setTheme('dark')} 
              className={`w-5 h-5 rounded-full border-2 ${theme === 'dark' ? 'border-indigo-500 scale-110 shadow-sm' : 'border-transparent'} bg-slate-800`}
            />
            <button 
              onClick={() => setTheme('sepia')} 
              className={`w-5 h-5 rounded-full border-2 ${theme === 'sepia' ? 'border-indigo-500 scale-110 shadow-sm' : 'border-transparent'} bg-[#fef3c7]`}
            />
          </div>

          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 -mr-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            <Menu size={24} />
          </button>
        </div>
      </header>"""

content = re.sub(r'      \{\/\* Mobile header \*\/\}[\s\S]*?<\/header>', mobile_header, content, count=1)

with open('src/components/Dashboard.tsx', 'w') as f:
    f.write(content)
