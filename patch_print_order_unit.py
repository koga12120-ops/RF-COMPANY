import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

old_html_items = """              ${order.items.map((item, index) => `
                <tr>
                  <td style="padding: 8px; border: 1px solid #ccc;">${index + 1}</td>
                  <td style="padding: 8px; border: 1px solid #ccc;">${item.itemId.slice(-4)}</td>
                  <td style="padding: 8px; border: 1px solid #ccc;">${item.name}</td>
                  <td style="padding: 8px; border: 1px solid #ccc;">${item.quantity}</td>
                  <td style="padding: 8px; border: 1px solid #ccc;">-</td>
                  <td style="padding: 8px; border: 1px solid #ccc;">${item.price.toLocaleString()}</td>
                  <td style="padding: 8px; border: 1px solid #ccc;">-</td>
                  <td style="padding: 8px; border: 1px solid #ccc;">${(item.quantity * item.price).toLocaleString()}</td>
                </tr>
              `).join('')}"""

new_html_items = """              ${order.items.map((item, index) => {
                const unitLabel = item.unit === 'carton' ? 'کارتۆن' : 'دانە';
                return `
                <tr>
                  <td style="padding: 8px; border: 1px solid #ccc;">${index + 1}</td>
                  <td style="padding: 8px; border: 1px solid #ccc;">${item.itemId.slice(-4)}</td>
                  <td style="padding: 8px; border: 1px solid #ccc;">${item.name}</td>
                  <td style="padding: 8px; border: 1px solid #ccc;">${item.quantity} ${unitLabel}</td>
                  <td style="padding: 8px; border: 1px solid #ccc;">-</td>
                  <td style="padding: 8px; border: 1px solid #ccc;">${item.price.toLocaleString()}</td>
                  <td style="padding: 8px; border: 1px solid #ccc;">-</td>
                  <td style="padding: 8px; border: 1px solid #ccc;">${(item.quantity * item.price).toLocaleString()}</td>
                </tr>
              `}).join('')}"""
content = content.replace(old_html_items, new_html_items)

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)

