import re

with open('src/components/views/InventoryView.tsx', 'r') as f:
    content = f.read()

# Add state for companies
if "const [companies, setCompanies] = useState<any[]>([]);" not in content:
    content = content.replace(
        "const [supplier, setSupplier] = useState('');",
        "const [supplier, setSupplier] = useState('');\n  const [companies, setCompanies] = useState<any[]>([]);"
    )

# Add fetch for companies
old_effect = """  useEffect(() => {
    const q = query(collection(db, 'items'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemsData: Item[] = [];
      snapshot.forEach((doc) => {
        itemsData.push({ id: doc.id, ...doc.data() } as Item);
      });
      setItems(itemsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);"""

new_effect = """  useEffect(() => {
    const q = query(collection(db, 'items'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemsData: Item[] = [];
      snapshot.forEach((doc) => {
        itemsData.push({ id: doc.id, ...doc.data() } as Item);
      });
      setItems(itemsData);
      setLoading(false);
    });

    const qCompanies = query(collection(db, 'companies'));
    const unsubCompanies = onSnapshot(qCompanies, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setCompanies(data);
    });

    return () => {
      unsubscribe();
      unsubCompanies();
    };
  }, []);"""
if "unsubCompanies" not in content:
    content = content.replace(old_effect, new_effect)

# Update input for supplier
old_input = """            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            />"""
new_input = """            <input
              type="text"
              list="companies-list"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            />
            <datalist id="companies-list">
              {companies.map(c => <option key={c.id} value={c.name} />)}
            </datalist>"""
content = content.replace(old_input, new_input)

with open('src/components/views/InventoryView.tsx', 'w') as f:
    f.write(content)
