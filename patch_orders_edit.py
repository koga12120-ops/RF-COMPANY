import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

# Make Delete available to everyone
content = content.replace("{role === 'admin' && (\n                    <button\n                      onClick={() => handleDeleteOrder(order.id)}", "{true && (\n                    <button\n                      onClick={() => handleDeleteOrder(order.id)}")

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)
print("done")
