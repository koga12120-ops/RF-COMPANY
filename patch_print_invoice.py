import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

content = re.sub(r'printOrder\(order\)', r'printOrder(order, String(orders.length - index).padStart(6, \'0\'))', content)
content = re.sub(r'const printOrder = async \(order: Order\) => \{', r'const printOrder = async (order: Order, invoiceId: string) => {', content)
content = content.replace("order.id.slice(-6).toUpperCase()", "invoiceId")

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)

with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

content = re.sub(r'printReceipt\(sale, sale\.id\)', r'printReceipt(sale, String(sales.length - index).padStart(6, \'0\'))', content)

with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(content)
print("done")
