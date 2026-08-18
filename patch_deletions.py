import re

# Update CashvanSalesView.tsx
with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "const handleDeleteSale = async (sale: any) => {",
    "const handleDeleteSale = async (sale: any, isEdit: boolean = false) => {"
)
content = content.replace(
    "await deleteDoc(doc(db, 'cashvan_sales', sale.id));",
    "if (isEdit) { await deleteDoc(doc(db, 'cashvan_sales', sale.id)); } else { await updateDoc(doc(db, 'cashvan_sales', sale.id), { status: 'deleted', deletedBy: userName }); }"
)
content = content.replace(
    "await handleDeleteSale(sale);",
    "await handleDeleteSale(sale, true);"
)

with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(content)

# Update OrdersView.tsx
with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "const handleDeleteOrder = async (id: string) => {",
    "const handleDeleteOrder = async (id: string, isEdit: boolean = false) => {"
)
content = content.replace(
    "await deleteDoc(doc(db, 'orders', id));",
    "if (isEdit) { await deleteDoc(doc(db, 'orders', id)); } else { const userName = auth.currentUser?.displayName || auth.currentUser?.email || 'نەزانراو'; await updateDoc(doc(db, 'orders', id), { status: 'deleted', deletedBy: userName }); }"
)
content = content.replace(
    "await handleDeleteOrder(order.id);",
    "await handleDeleteOrder(order.id, true);"
)

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)

print("done")
