with open('src/components/Dashboard.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "{ id: 'orders', label: 'ئۆردەرەکان', icon: ShoppingCart },",
    "{ id: 'orders', label: 'تەسفییەکردن', icon: ShoppingCart },"
)
# Wait, this would replace all occurrences, but warehouse has "ئۆردەرەکان" as well? Let's check.
