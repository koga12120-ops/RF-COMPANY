import re

# Fix OrdersView.tsx
with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

orders_logic = """  let displayMarkets = markets;
  if (role === 'sales_rep') {
    const activeDays = todayIndex === -1 ? WEEK_DAYS : WEEK_DAYS.slice(0, todayIndex + 1);
    const validMarketIds = new Set<string>();

    activeDays.forEach(day => {
      const dayMarkets = repSchedule[day] || [];
      dayMarkets.forEach(mId => {
        if (day === currentDayStr || !repVisits[mId]) {
          validMarketIds.add(mId);
        }
      });
    });

    displayMarkets = markets.filter(m => validMarketIds.has(m.id));
  }"""

content = content.replace("  let displayMarkets = markets;", orders_logic)

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)


# Fix CashvanSalesView.tsx
with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "const displayMarkets = markets;",
    "const displayMarkets = markets.filter(m => validMarketIds.has(m.id));"
)

with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(content)

print("done")
