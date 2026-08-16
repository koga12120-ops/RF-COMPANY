import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

old_table_body = """            ${order.items.map((item, index) => {
              const globalItem = items.find(i => i.id === item.itemId);
              const barcode = globalItem?.barcode || '-';
              const ratio = globalItem?.ratio || 1;
              const cartonQty = (item.quantity / ratio).toFixed(2);
              const cartonPrice = (item.price * ratio).toLocaleString();
              const unitLabel = item.unit === 'carton' ? 'کارتۆن' : 'دانە';
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
              `;
            }).join('')}"""

new_table_body = """            ${order.items.map((item, index) => {
              const globalItem = items.find(i => i.id === item.itemId);
              const barcode = globalItem?.barcode || '-';
              const ratio = globalItem?.ratio || 1;
              const cartonQty = (item.quantity / ratio).toFixed(2);
              const cartonPrice = (item.price * ratio).toLocaleString();
              const unitLabel = item.unit === 'carton' ? 'کار' : (item.unit === 'packet' ? 'پاک' : 'دان');
              return `
                <tr>
                  <td style="padding: 8px; border: 1px solid #ccc;">${index + 1}</td>
                  <td style="padding: 8px; border: 1px solid #ccc; font-family: monospace;">${barcode}</td>
                  <td style="padding: 8px; border: 1px solid #ccc; text-align: right;">${item.name}</td>
                  <td style="padding: 8px; border: 1px solid #ccc;">${item.quantity}/${unitLabel}</td>
                  <td style="padding: 8px; border: 1px solid #ccc;">${cartonQty}</td>
                  <td style="padding: 8px; border: 1px solid #ccc;">${item.price.toLocaleString()}</td>
                  <td style="padding: 8px; border: 1px solid #ccc;">${cartonPrice}</td>
                  <td style="padding: 8px; border: 1px solid #ccc; font-weight: bold;">${(item.price * item.quantity).toLocaleString()}</td>
                </tr>
              `;
            }).join('')}"""
content = content.replace(old_table_body, new_table_body)

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)
