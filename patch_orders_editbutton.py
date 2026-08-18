import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

edit_btn = """                  {true && (
                    <button
                      onClick={() => handleEditOrder(order)}
                      className="p-2.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                      title="دەستکاری"
                    >
                      <Edit2 size={20} />
                    </button>
                  )}
                  {true && ("""

content = content.replace("{true && (", edit_btn, 1)

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)
print("done")
