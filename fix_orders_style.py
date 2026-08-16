import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

# Replace the card styling
old_card_class = 'className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4"'
new_card_class = 'className={`p-5 rounded-2xl shadow-sm border flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${order.status === \\\'pending\\\' ? \\\'bg-red-50 border-red-200\\\' : \\\'bg-green-50 border-green-200\\\'}`}'

content = content.replace(old_card_class, new_card_class)

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)
