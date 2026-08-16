import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

# Update role checks to include cashvan
content = content.replace("role === 'sales_rep' || role === 'admin'", "role === 'sales_rep' || role === 'admin' || role === 'cashvan'")

# Fix title: "بەشی ئۆردەرەکان" for rep, maybe "کاشڤان نەقدە" for cashvan?
content = content.replace(
    "{role === 'admin' ? 'تەسفییەکردن' : 'بەشی ئۆردەرەکان'}", 
    "{role === 'admin' ? 'تەسفییەکردن' : role === 'cashvan' ? 'کاشڤان نەقدە' : 'بەشی ئۆردەرەکان'}"
)

# And repName -> sales rep name or cashvan name. The field name is "ناوی مەندووب". Let's change it to "ناوی مەندووب / کاشڤان" if cashvan.
content = content.replace("<label className=\"block text-sm text-slate-600 mb-1\">ناوی مەندووب</label>", "<label className=\"block text-sm text-slate-600 mb-1\">{role === 'cashvan' ? 'ناوی کاشڤان' : 'ناوی مەندووب'}</label>")

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)
