import re

# In OrdersView.tsx
with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

content = re.sub(
    r"let displayMarkets = markets;.*?displayMarkets = markets\.filter\(m => validMarketIds\.has\(m\.id\)\);\n  }",
    "let displayMarkets = markets;",
    content,
    flags=re.DOTALL
)

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)


# In CashvanSalesView.tsx
with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

content = re.sub(
    r"const displayMarkets = markets\.filter\(m => validMarketIds\.has\(m\.id\)\);",
    "const displayMarkets = markets;",
    content
)

with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(content)

print("done")
