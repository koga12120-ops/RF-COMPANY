import re

# OrdersView.tsx
with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

old_loop = """      snapshot.forEach(doc => {
        oldDebt += doc.data().amount || 0;
      });"""

new_loop = """      snapshot.forEach(doc => {
        const data = doc.data();
        if (!data.date || data.date < order.timestamp) {
          oldDebt += data.amount || 0;
        }
      });"""

if old_loop in content:
    content = content.replace(old_loop, new_loop)
    with open('src/components/views/OrdersView.tsx', 'w') as f:
        f.write(content)
    print("OrdersView patched for date filter")

# CashvanSalesView.tsx
with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

old_loop_cv = """      snapshot.forEach(doc => {
        oldDebt += doc.data().amount || 0;
      });"""

new_loop_cv = """      snapshot.forEach(doc => {
        const data = doc.data();
        if (!data.date || data.date < sale.date) {
          oldDebt += data.amount || 0;
        }
      });"""

if old_loop_cv in content:
    content = content.replace(old_loop_cv, new_loop_cv)
    with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
        f.write(content)
    print("CashvanSalesView patched for date filter")
    
