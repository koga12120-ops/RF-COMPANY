import re

with open('src/components/views/AdminCashvanView.tsx', 'r') as f:
    content = f.read()

new_func = """  const handleDeleteSale = async (id: string) => {
    if (window.confirm('دڵنیایت لە سڕینەوەی ئەم وەسڵە؟')) {
      try {
        await deleteDoc(doc(db, 'cashvan_sales', id));
      } catch (error: any) {
        console.error(error);
        alert('هەڵەیەک ڕوویدا لە کاتی سڕینەوە: ' + error.message);
      }
    }
  };"""

content = re.sub(r'  const handleDeleteSale = async \(id: string\) => \{\n    if \(window\.confirm\([^)]+\)\) \{\n      await deleteDoc\(doc\(db, \'cashvan_sales\', id\)\);\n    \}\n  \};\n', new_func + '\n', content)

with open('src/components/views/AdminCashvanView.tsx', 'w') as f:
    f.write(content)

print("done")
