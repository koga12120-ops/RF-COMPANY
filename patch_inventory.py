import re

with open('src/components/views/InventoryView.tsx', 'r') as f:
    content = f.read()

# Add companies listener
companies_listener = """      snapshot.forEach((doc) => {
        itemsData.push({ id: doc.id, ...doc.data() } as Item);
      });
      setItems(itemsData);
      setLoading(false);
    });

    const qComp = query(collection(db, 'companies'));
    const unsubComp = onSnapshot(qComp, (snapshot) => {
      const compData: any[] = [];
      snapshot.forEach((doc) => {
        compData.push({ id: doc.id, ...doc.data() });
      });
      setCompanies(compData);
    });"""

content = content.replace("      snapshot.forEach((doc) => {\n        itemsData.push({ id: doc.id, ...doc.data() } as Item);\n      });\n      setItems(itemsData);\n      setLoading(false);\n    });", companies_listener)

# Fix handleDelete to also reset the form if the edited item is deleted
handle_del = """  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'items', id));
      if (editId === id) resetForm();
    } catch (error) {
      console.error("Error deleting document: ", error);
    }
  };"""

content = re.sub(r'  const handleDelete = async \(id: string\) => \{[\s\S]*?  \};\n', handle_del + '\n', content)

with open('src/components/views/InventoryView.tsx', 'w') as f:
    f.write(content)
