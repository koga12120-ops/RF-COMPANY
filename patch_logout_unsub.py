import re

# Update App.tsx
with open('src/App.tsx', 'r') as f:
    content = f.read()

content = content.replace("    setTimeout(async () => {\n      await signOut(auth);\n    }, 10);", "    setTimeout(async () => {\n      await signOut(auth);\n    }, 500);")

with open('src/App.tsx', 'w') as f:
    f.write(content)


# Update InventoryView.tsx
with open('src/components/views/InventoryView.tsx', 'r') as f:
    content = f.read()

content = content.replace("  return () => unsubscribe();", "  return () => { unsubscribe(); unsubComp(); };")

with open('src/components/views/InventoryView.tsx', 'w') as f:
    f.write(content)

print("done")
