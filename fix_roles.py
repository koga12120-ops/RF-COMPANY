import re

with open('src/components/PinEntry.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "} else if (normalizedPin === '43629') {",
    "} else if (normalizedPin === '43629') {\n        await onSuccess('sales_rep');\n      } else if (normalizedPin === '47953') {\n        await onSuccess('cashvan');"
)

with open('src/components/PinEntry.tsx', 'w') as f:
    f.write(content)

with open('src/App.tsx', 'r') as f:
    app_content = f.read()

app_content = app_content.replace(
    "if (newRole === 'sales_rep') {",
    "if (newRole === 'sales_rep') {\n        await addDoc(collection(db, 'reps'), {\n          name: user.displayName || user.email,\n          phone: '',\n          totalSales: 0,\n          totalProfit: 0,\n          uid: user.uid\n        });\n      }\n      if (newRole === 'cashvan') {"
)

with open('src/App.tsx', 'w') as f:
    f.write(app_content)

with open('src/components/Dashboard.tsx', 'r') as f:
    dash_content = f.read()

dash_content = dash_content.replace(
    "{role === 'admin' ? 'بەڕێوەبەر' : role === 'warehouse' ? 'کارمەندی کۆگا' : 'مەندووب'}",
    "{role === 'admin' ? 'بەڕێوەبەر' : role === 'warehouse' ? 'بەشی کۆگا' : role === 'cashvan' ? 'کاشڤان' : 'مەندووب'}"
)

with open('src/components/Dashboard.tsx', 'w') as f:
    f.write(dash_content)
