import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

old_print = """      <div dir="rtl" style="font-family: sans-serif; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
          <div style="text-align: center; flex: 1;">
            <h1 style="margin: 0; color: #1e293b; font-size: 42px; font-weight: 900; letter-spacing: 2px;">TAM TAM</h1>
          </div>
          <div style="text-align: right; width: 250px;">
            <img src="${window.location.origin}/LOGO1.jpg" alt="Logo" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: 5px;" onerror="this.style.display='none'" />
            <h2 style="margin: 0; color: #333; font-size: 16px;">وەسڵی کۆگا</h2>
            <p style="margin: 2px 0; font-size: 12px;">ناونیشان: هەولێر-ڕێگای کەرکوک</p>
            <p style="margin: 2px 0; font-size: 12px;">مۆبایل: 07506144894</p>
          </div>
        </div>"""

new_print = """      <div dir="rtl" style="font-family: sans-serif; padding: 20px;">
        <div style="display: flex; align-items: flex-start; margin-bottom: 20px;">
          <div style="text-align: right; width: 250px;">
            <img src="${window.location.origin}/LOGO1.jpg" alt="Logo" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: 5px;" onerror="this.style.display='none'" />
            <h2 style="margin: 0; color: #333; font-size: 16px;">وەسڵی کۆگا</h2>
            <p style="margin: 2px 0; font-size: 12px;">ناونیشان: هەولێر-ڕێگای کەرکوک</p>
            <p style="margin: 2px 0; font-size: 12px;">مۆبایل: 07506144894</p>
          </div>
          <div style="text-align: center; flex: 1; padding-top: 20px; padding-left: 250px;">
            <h1 style="margin: 0; color: #1e293b; font-size: 52px; font-weight: 900; letter-spacing: 2px;">TAM TAM</h1>
          </div>
        </div>"""
content = content.replace(old_print, new_print)

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)

with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

old_print_cv = """      <div dir="rtl" style="font-family: sans-serif; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
          <div style="text-align: center; flex: 1;">
            <h1 style="margin: 0; color: #1e293b; font-size: 42px; font-weight: 900; letter-spacing: 2px;">TAM TAM</h1>
          </div>
          <div style="text-align: right; width: 250px;">
            <img src="${window.location.origin}/LOGO1.jpg" alt="Logo" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: 5px;" onerror="this.style.display='none'" />
            <h2 style="margin: 0; color: #333; font-size: 16px;">فاتورەی کاشڤان</h2>
            <p style="margin: 2px 0; font-size: 12px;">ناونیشان: هەولێر-ڕێگای کەرکوک</p>
            <p style="margin: 2px 0; font-size: 12px;">مۆبایل: 07506144894</p>
          </div>
        </div>"""

new_print_cv = """      <div dir="rtl" style="font-family: sans-serif; padding: 20px;">
        <div style="display: flex; align-items: flex-start; margin-bottom: 20px;">
          <div style="text-align: right; width: 250px;">
            <img src="${window.location.origin}/LOGO1.jpg" alt="Logo" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: 5px;" onerror="this.style.display='none'" />
            <h2 style="margin: 0; color: #333; font-size: 16px;">فاتورەی کاشڤان</h2>
            <p style="margin: 2px 0; font-size: 12px;">ناونیشان: هەولێر-ڕێگای کەرکوک</p>
            <p style="margin: 2px 0; font-size: 12px;">مۆبایل: 07506144894</p>
          </div>
          <div style="text-align: center; flex: 1; padding-top: 20px; padding-left: 250px;">
            <h1 style="margin: 0; color: #1e293b; font-size: 52px; font-weight: 900; letter-spacing: 2px;">TAM TAM</h1>
          </div>
        </div>"""
content = content.replace(old_print_cv, new_print_cv)

with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(content)
