import re

with open('src/components/views/LedgerView.tsx', 'r') as f:
    content = f.read()

# Replace the array of green types to include company debts where appropriate? Wait.
# 'company_cash' and 'paid_company_debt' are EXPENSES (money out).
# 'expense' is money out.
# So green: ['income', 'cash', 'paid_debt']
# red: ['expense', 'company_cash', 'paid_company_debt']
# orange: ['debt', 'company_debt']

old_class = """['income', 'cash', 'paid_debt'].includes(t.type) ? 'bg-green-100 text-green-700' : 
                          t.type === 'expense' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'"""

new_class = """['income', 'cash', 'paid_debt'].includes(t.type) ? 'bg-green-100 text-green-700' : 
                          ['expense', 'company_cash', 'paid_company_debt'].includes(t.type) ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'"""

content = content.replace(old_class, new_class)

old_text = """t.type === 'income' ? 'داهات' :
                           t.type === 'expense' ? 'خەرجی' :
                           t.type === 'cash' ? 'نەقد' :
                           t.type === 'paid_debt' ? 'واسڵکراو' : 'قەرز'"""

new_text = """t.type === 'income' ? 'داهات' :
                           t.type === 'expense' ? 'خەرجی' :
                           t.type === 'cash' ? 'نەقد فرۆشتن' :
                           t.type === 'company_cash' ? 'نەقد کڕین' :
                           t.type === 'paid_debt' ? 'قەرزی وەرگیراو' : 
                           t.type === 'paid_company_debt' ? 'قەرزی دراو' : 
                           t.type === 'company_debt' ? 'قەرزی کۆمپانیا' : 'قەرزی مارکێت'"""

content = content.replace(old_text, new_text)

old_color = """['income', 'cash', 'paid_debt'].includes(t.type) ? 'text-green-600' : t.type === 'expense' ? 'text-red-600' : 'text-slate-900'"""

new_color = """['income', 'cash', 'paid_debt'].includes(t.type) ? 'text-green-600' : ['expense', 'company_cash', 'paid_company_debt'].includes(t.type) ? 'text-red-600' : 'text-slate-900'"""

content = content.replace(old_color, new_color)

with open('src/components/views/LedgerView.tsx', 'w') as f:
    f.write(content)
