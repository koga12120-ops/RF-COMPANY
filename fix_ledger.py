import re

with open('src/components/views/LedgerView.tsx', 'r') as f:
    content = f.read()

orig_labels = """                          {t.type === 'income' ? 'داهات' : 
                           t.type === 'expense' ? 'خەرجی' : 
                           t.type === 'return_expense' ? 'گەڕانەوە' : 
                           t.type === 'cash' ? 'نەقد' :
                           t.type === 'paid_debt' ? 'واسڵکراو' : 'قەرز'}"""

new_labels = """                          {t.type === 'income' ? 'داهات' : 
                           t.type === 'expense' ? 'خەرجی' : 
                           t.type === 'return_expense' ? 'گەڕانەوە' : 
                           t.type === 'cash' ? 'نەقد' :
                           t.type === 'paid_debt' ? 'واسڵکراو' : 
                           t.type === 'company_cash' ? 'نەقدی کۆمپانیا' :
                           t.type === 'company_paid_debt' ? 'پاردانەوە' :
                           t.type === 'company_debt' ? 'قەرزی کۆمپانیا' : 'قەرز'}"""

content = content.replace(orig_labels, new_labels)

with open('src/components/views/LedgerView.tsx', 'w') as f:
    f.write(content)

