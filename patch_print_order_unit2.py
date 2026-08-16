import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

old_html_items = """              return `
                <tr>
                  <td style="padding: 8px; border: 1px solid #ccc;">${index + 1}</td>
                  <td style="padding: 8px; border: 1px solid #ccc; font-family: monospace;">${barcode}</td>
                  <td style="padding: 8px; border: 1px solid #ccc; text-align: right;">${item.name}</td>
                  <td style="padding: 8px; border: 1px solid #ccc;">${item.quantity}</td>
                  <td style="padding: 8px; border: 1px solid #ccc;">${cartonQty}</td>
                  <td style="padding: 8px; border: 1px solid #ccc;">${item.price.toLocaleString()}</td>
                  <td style="padding: 8px; border: 1px solid #ccc;">${cartonPrice}</td>
                  <td style="padding: 8px; border: 1px solid #ccc; font-weight: bold;">${(item.price * item.quantity).toLocaleString()}</td>
                </tr>
              `;"""

new_html_items = """              const unitLabel = item.unit === 'carton' ? 'کارتۆن' : 'دانە';
              return `
                <tr>
                  <td style="padding: 8px; border: 1px solid #ccc;">${index + 1}</td>
                  <td style="padding: 8px; border: 1px solid #ccc; font-family: monospace;">${barcode}</td>
                  <td style="padding: 8px; border: 1px solid #ccc; text-align: right;">${item.name}</td>
                  <td style="padding: 8px; border: 1px solid #ccc;">${item.quantity} ${unitLabel}</td>
                  <td style="padding: 8px; border: 1px solid #ccc;">${cartonQty}</td>
                  <td style="padding: 8px; border: 1px solid #ccc;">${item.price.toLocaleString()}</td>
                  <td style="padding: 8px; border: 1px solid #ccc;">${cartonPrice}</td>
                  <td style="padding: 8px; border: 1px solid #ccc; font-weight: bold;">${(item.price * item.quantity).toLocaleString()}</td>
                </tr>
              `;"""
              
if old_html_items in content:
    content = content.replace(old_html_items, new_html_items)

# Now check the React render for the Warehouse view
old_react_items = """                              <div className="font-bold text-slate-800" dir="ltr">{item.quantity}</div>"""
new_react_items = """                              <div className="font-bold text-slate-800" dir="ltr">{item.quantity} {item.unit === 'carton' ? 'کارتۆن' : 'دانە'}</div>"""

content = content.replace(old_react_items, new_react_items)

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)

