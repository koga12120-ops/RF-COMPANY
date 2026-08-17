import re
import glob

for filename in ['src/components/views/CashView.tsx', 'src/components/views/DebtsView.tsx']:
    with open(filename, 'r') as f:
        content = f.read()

    # Fix suggestions loading
    effect_code = """  useEffect(() => {
    const q = query(collection(db, 'transactions'), where('type', '==', type));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const salesData: Transaction[] = [];
      snapshot.forEach((doc) => {
        salesData.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      if(filename === 'src/components/views/CashView.tsx') {
         setCashSales(salesData.sort((a, b) => b.date - a.date));
      } else {
         setDebts(salesData.sort((a, b) => b.date - a.date));
      }
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
    
    if filename == 'src/components/views/CashView.tsx':
        effect_code = effect_code.replace("if(filename === 'src/components/views/CashView.tsx') {", "").replace("} else {", "").replace("setDebts(salesData.sort((a, b) => b.date - a.date));", "").replace("}", "")
        content = re.sub(r'  useEffect\(\(\) => \{[\s\S]*?  \}, \[\]\);', effect_code, content)
    else:
        # DebtsView already has suggestion loading, just make sure creation sets type
        pass
    
    # Fix creation setting type
    create_code = """        const collectionName = type.includes('company') ? 'companies' : 'markets';
        const docData: any = { name: relatedEntityId, location: '', phone: '', createdAt: Date.now() };
        if (collectionName === 'markets') docData.type = 'market';
        if (collectionName === 'companies') docData.type = 'warehouse';
        await addDoc(collection(db, collectionName), docData);"""
    
    content = re.sub(r'        const collectionName = type\.includes\(\'company\'\) \? \'companies\' : \'markets\';\n        await addDoc\(collection\(db, collectionName\), \{ name: relatedEntityId, location: \'\', phone: \'\', createdAt: Date\.now\(\) \}\);', create_code, content)

    with open(filename, 'w') as f:
        f.write(content)
