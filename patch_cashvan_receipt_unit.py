import re

with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

old_html_items = """              ${sale.items.map((item: any) => `
                <tr>
                  <td>${item.name}</td>
                  <td class="center">${item.quantity}</td>
                  <td class="center">${item.price.toLocaleString()}</td>
                  <td style="text-align:left">${(item.quantity * item.price).toLocaleString()}</td>
                </tr>
              `).join('')}"""

new_html_items = """              ${sale.items.map((item: any) => {
                const unitLabel = item.unit === 'carton' ? 'کارتۆن' : 'دانە';
                return `
                <tr>
                  <td>${item.name}</td>
                  <td class="center">${item.quantity} ${unitLabel}</td>
                  <td class="center">${item.price.toLocaleString()}</td>
                  <td style="text-align:left">${(item.quantity * item.price).toLocaleString()}</td>
                </tr>
              `}).join('')}"""
content = content.replace(old_html_items, new_html_items)

with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(content)

