import re

with open('src/components/Dashboard.tsx', 'r') as f:
    content = f.read()

# Add theme state to Dashboard
state_code = """export default function Dashboard({ role, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'sepia'>(() => {
    return (localStorage.getItem('app-theme') as any) || 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark', 'theme-sepia');
    root.classList.add(`theme-${theme}`);
    localStorage.setItem('app-theme', theme);
  }, [theme]);"""

content = content.replace("export default function Dashboard({ role, onLogout }: DashboardProps) {\n  const [activeTab, setActiveTab] = useState<string>('');\n  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);", state_code)

# Add circles to the header
header_code = """      {/* Desktop Header */}
      <header className="hidden lg:flex h-16 bg-white border-b border-slate-200 items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-200">
            <img src="/LOGO1.jpg" alt="Logo" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display = 'none'} />
          </div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight">سیستەمی کۆگا</h1>
        </div>
        <div className="flex items-center gap-6">
          {/* Theme Switcher */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-full border border-slate-200">
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
          </div>"""

content = re.sub(r'      \{\/\* Desktop Header \*\/\}[\s\S]*?<div className="flex items-center gap-6">', header_code, content)

# Also mobile header
mobile_header = """      {/* Mobile Header */}
      <header className="lg:hidden h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-10">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <Menu size={24} className="text-slate-700" />
          </button>
          <div className="w-8 h-8 rounded-md overflow-hidden shrink-0 border border-slate-200">
            <img src="/LOGO1.jpg" alt="Logo" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display = 'none'} />
          </div>
        </div>
        
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
        
        <div className="flex items-center gap-2">"""

content = re.sub(r'      \{\/\* Mobile Header \*\/\}[\s\S]*?<div className="flex items-center gap-2">', mobile_header, content)

with open('src/components/Dashboard.tsx', 'w') as f:
    f.write(content)
