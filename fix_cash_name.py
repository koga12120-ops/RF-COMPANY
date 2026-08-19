import re

with open('src/components/views/CashView.tsx', 'r') as f:
    content = f.read()

content = content.replace("cash.reduce", "cashSales.reduce")
content = content.replace("printTransaction(c)", "printTransaction(sale)")
content = content.replace("onClick={() => handleDelete(sale.id)}", "onClick={() => printTransaction(sale)}\n                          className=\"p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition\"\n                          title=\"چاپکردن\"\n                        >\n                          <Printer size={16} />\n                        </button>\n                        <button\n                          onClick={() => handleDelete(sale.id)}")

with open('src/components/views/CashView.tsx', 'w') as f:
    f.write(content)

print("done")
