import re

with open('src/components/PinEntry.tsx', 'r') as f:
    content = f.read()

old_pin_icon = """        <div className="flex justify-center mb-6">
          <div className="bg-slate-100 p-4 rounded-full text-slate-700">
            <Lock size={40} />
          </div>
        </div>"""
new_pin_icon = """        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-slate-100 shadow-sm">
            <img src="/LOGO1.jpg" alt="Logo" className="w-full h-full object-cover" />
          </div>
        </div>"""

if old_pin_icon in content:
    content = content.replace(old_pin_icon, new_pin_icon)
    with open('src/components/PinEntry.tsx', 'w') as f:
        f.write(content)
    print("PinEntry updated")
else:
    print("PinEntry icon not found")

