import re

# OrdersView.tsx
try:
    with open('src/components/views/OrdersView.tsx', 'r') as f:
        content = f.read()

    old_orders_header = """        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="margin: 0; color: #1e293b; font-size: 24px;">کۆمپانیای RF</h1>"""
    new_orders_header = """        <div style="text-align: center; margin-bottom: 20px;">
          <img src="/LOGO1.jpg" alt="Logo" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: 10px;" />
          <h1 style="margin: 0; color: #1e293b; font-size: 24px;">کۆمپانیای RF</h1>"""
    
    if old_orders_header in content:
        content = content.replace(old_orders_header, new_orders_header)
        with open('src/components/views/OrdersView.tsx', 'w') as f:
            f.write(content)
        print("Updated OrdersView.tsx")
    else:
        print("OrdersView.tsx header not found")
except Exception as e:
    print(f"Error OrdersView: {e}")

# CashvanSalesView.tsx
try:
    with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
        content = f.read()

    old_cashvan_header = """        <body>
          <div class="center bold" style="font-size:16px;">کۆمپانیای RF</div>"""
    new_cashvan_header = """        <body>
          <div class="center">
            <img src="/LOGO1.jpg" alt="Logo" style="width: 60px; height: 60px; object-fit: contain; margin-bottom: 5px;" />
          </div>
          <div class="center bold" style="font-size:16px;">کۆمپانیای RF</div>"""
          
    if old_cashvan_header in content:
        content = content.replace(old_cashvan_header, new_cashvan_header)
        with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
            f.write(content)
        print("Updated CashvanSalesView.tsx")
    else:
        print("CashvanSalesView.tsx header not found")
except Exception as e:
    print(f"Error CashvanSalesView: {e}")

