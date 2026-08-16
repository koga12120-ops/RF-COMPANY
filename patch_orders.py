import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

# Add reps state
if "const [reps, setReps] = useState<any[]>([]);" not in content:
    content = content.replace(
        "const [markets, setMarkets] = useState<Market[]>([]);",
        "const [markets, setMarkets] = useState<Market[]>([]);\n  const [reps, setReps] = useState<any[]>([]);"
    )

old_effect = """    const qMarkets = query(collection(db, 'markets'));
    const unsubMarkets = onSnapshot(qMarkets, (snapshot) => {
      const marketsData: Market[] = [];
      snapshot.forEach((doc) => {
        marketsData.push({ id: doc.id, ...doc.data() } as Market);
      });
      setMarkets(marketsData);
      setLoading(false);
    });

    return () => {
      unsubOrders();
      unsubItems();
      unsubMarkets();
    };
  }, []);"""

new_effect = """    const qMarkets = query(collection(db, 'markets'));
    const unsubMarkets = onSnapshot(qMarkets, (snapshot) => {
      const marketsData: Market[] = [];
      snapshot.forEach((doc) => {
        marketsData.push({ id: doc.id, ...doc.data() } as Market);
      });
      setMarkets(marketsData);
      setLoading(false);
    });

    const qReps = query(collection(db, 'reps'));
    const unsubReps = onSnapshot(qReps, (snapshot) => {
      const repsData: any[] = [];
      snapshot.forEach(doc => repsData.push({ id: doc.id, ...doc.data() }));
      setReps(repsData);
    });

    return () => {
      unsubOrders();
      unsubItems();
      unsubMarkets();
      unsubReps();
    };
  }, []);"""
if "unsubReps" not in content:
    content = content.replace(old_effect, new_effect)

old_input = """                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition"
                    value={repName}
                    onChange={(e) => setRepName(e.target.value)}
                  />"""

new_input = """                  <input
                    type="text"
                    required
                    list="reps-list"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition"
                    value={repName}
                    onChange={(e) => setRepName(e.target.value)}
                  />
                  <datalist id="reps-list">
                    {reps.map(r => <option key={r.id} value={r.name} />)}
                  </datalist>"""
if 'list="reps-list"' not in content:
    content = content.replace(old_input, new_input)

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)
