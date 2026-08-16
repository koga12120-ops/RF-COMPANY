import re

with open('src/components/Login.tsx', 'r') as f:
    content = f.read()

old_login_icon = """        <div className="flex justify-center mb-8">
          <div className="bg-indigo-100 p-4 rounded-full text-indigo-600">
            <LogIn size={40} />
          </div>
        </div>"""
new_login_icon = """        <div className="flex justify-center mb-8">
          <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-slate-100 shadow-sm">
            <img src="/LOGO1.jpg" alt="Logo" className="w-full h-full object-cover" />
          </div>
        </div>"""

if old_login_icon in content:
    content = content.replace(old_login_icon, new_login_icon)
    with open('src/components/Login.tsx', 'w') as f:
        f.write(content)
    print("Login updated")
else:
    print("Login icon not found")

