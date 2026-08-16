import re

with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

old_receipt = """        <body>
          <div class="center">
            <img src="${window.location.origin}/LOGO1.jpg" alt="Logo" style="width: 60px; height: 60px; object-fit: contain; margin-bottom: 5px;" />
          </div>
          <div class="center bold" style="font-size:16px;">کۆمپانیای RF</div>
          <div class="center">کاشڤان: ${sale.cashvanName}</div>
          <div style="margin-top:10px;">فاتیرەی ژمارە: ${invoiceId.slice(-6).toUpperCase()}</div>
          <div>کڕیار: ${sale.marketName}</div>
          <div>بەروار: ${format(sale.date, 'yyyy/MM/dd HH:mm')}</div>"""

new_receipt = """        <body>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
            <div style="text-align: right; width: 100px;">
              <img src="${window.location.origin}/LOGO1.jpg" alt="Logo" style="width: 50px; height: 50px; object-fit: contain; margin-bottom: 5px;" onerror="this.style.display='none'" />
              <div class="bold" style="font-size:12px;">کۆمپانیای RF</div>
              <div style="font-size:10px;">07506144894</div>
            </div>
            <div style="text-align: center; flex: 1; padding-top: 10px;">
              <h1 style="margin: 0; color: #1e293b; font-size: 28px; font-weight: 900;">TAM TAM</h1>
            </div>
          </div>
          <hr style="border:0; border-top:1px dashed #ccc; margin:5px 0;" />
          <div class="center">کاشڤان: ${sale.cashvanName}</div>
          <div style="margin-top:5px;">فاتیرەی ژمارە: ${invoiceId.slice(-6).toUpperCase()}</div>
          <div>کڕیار: ${sale.marketName}</div>
          <div>بەروار: ${format(sale.date, 'yyyy/MM/dd HH:mm')}</div>"""
content = content.replace(old_receipt, new_receipt)

old_table_body = """            <tbody>
              ${sale.items.map((item: any) => `
                <tr>
                  <td>${item.name}</td>
                  <td class="center">${item.quantity}</td>
                  <td class="center">${item.price}</td>
                  <td style="text-align:left">${item.quantity * item.price}</td>
                </tr>
              `).join('')}
            </tbody>"""

new_table_body = """            <tbody>
              ${sale.items.map((item: any) => {
                const unitLabel = item.unit === 'carton' ? 'کار' : (item.unit === 'packet' ? 'پاک' : 'دان');
                return `
                <tr>
                  <td>${item.name}</td>
                  <td class="center">${item.quantity}/${unitLabel}</td>
                  <td class="center">${item.price}</td>
                  <td style="text-align:left">${item.quantity * item.price}</td>
                </tr>
                `;
              }).join('')}
            </tbody>"""
content = content.replace(old_table_body, new_table_body)

with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(content)
