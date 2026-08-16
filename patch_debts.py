import re

with open('src/components/views/DebtsView.tsx', 'r') as f:
    content = f.read()

# Add suggestions state
if "const [suggestions, setSuggestions] = useState<any[]>([]);" not in content:
    content = content.replace(
        "const [relatedEntityId, setRelatedEntityId] = useState('');",
        "const [relatedEntityId, setRelatedEntityId] = useState('');\n  const [suggestions, setSuggestions] = useState<any[]>([]);"
    )

old_effect = """  useEffect(() => {
    const q = query(collection(db, 'transactions'), where('type', '==', type));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const debtsData: Transaction[] = [];
      snapshot.forEach((doc) => {
        debtsData.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      setDebts(debtsData.sort((a, b) => b.date - a.date));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);"""

new_effect = """  useEffect(() => {
    const q = query(collection(db, 'transactions'), where('type', '==', type));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const debtsData: Transaction[] = [];
      snapshot.forEach((doc) => {
        debtsData.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      setDebts(debtsData.sort((a, b) => b.date - a.date));
      setLoading(false);
    });

    const collectionName = type.includes('company') ? 'companies' : 'markets';
    const qSuggestions = query(collection(db, collectionName));
    const unsubSuggestions = onSnapshot(qSuggestions, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setSuggestions(data);
    });

    return () => {
      unsubscribe();
      unsubSuggestions();
    };
  }, [type]);"""
if "unsubSuggestions" not in content:
    content = content.replace(old_effect, new_effect)

old_input = """            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              value={relatedEntityId}
              onChange={(e) => setRelatedEntityId(e.target.value)}
            />"""

new_input = """            <input
              type="text"
              required
              list={`suggestions-${type}`}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              value={relatedEntityId}
              onChange={(e) => setRelatedEntityId(e.target.value)}
            />
            <datalist id={`suggestions-${type}`}>
              {suggestions.map(s => <option key={s.id} value={s.name} />)}
            </datalist>"""
content = content.replace(old_input, new_input)

with open('src/components/views/DebtsView.tsx', 'w') as f:
    f.write(content)
