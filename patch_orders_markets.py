import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

# Add schedule and visits state
state_code = """  const [markets, setMarkets] = useState<Market[]>([]);
  const [reps, setReps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Schedule states for Reps
  const [repSchedule, setRepSchedule] = useState<Record<string, string[]>>({});
  const [repVisits, setRepVisits] = useState<Record<string, boolean>>({});"""

content = content.replace("  const [markets, setMarkets] = useState<Market[]>([]);\n  const [reps, setReps] = useState<any[]>([]);\n  const [loading, setLoading] = useState(true);", state_code)

# Add effects to load schedule
effects_code = """  // Auto-fill rep name
  useEffect(() => {
    const fetchUser = async () => {
      if (auth.currentUser && role === 'sales_rep') {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          setRepName(userDoc.data().name);
        }
        
        // Listen to schedule
        const unsubSched = onSnapshot(doc(db, 'schedules', auth.currentUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            setRepSchedule(docSnap.data().schedule || {});
          }
        });
        
        // Listen to visits for the week
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        const day = d.getDay();
        const diff = day === 6 ? 0 : day + 1;
        d.setDate(d.getDate() - diff);
        const weekId = `week_${d.toISOString().split('T')[0]}`;
        
        const qVisits = query(collection(db, 'schedule_visits'), 
          where('repId', '==', auth.currentUser.uid),
          where('weekId', '==', weekId)
        );
        const unsubVisits = onSnapshot(qVisits, (snap) => {
          const visitedMap: Record<string, boolean> = {};
          snap.forEach(d => { visitedMap[d.data().marketId] = true; });
          setRepVisits(visitedMap);
        });
      }
    };
    fetchUser();
  }, [role]);"""

content = re.sub(r'  // Auto-fill rep name\n  useEffect\(\(\) => \{[\s\S]*?  \}, \[role\]\);', effects_code, content)

# Filter markets logic
filter_logic = """  // Filter markets for reps based on schedule
  const currentDayStr = new Date().getDay().toString();
  const WEEK_DAYS = ['6', '0', '1', '2', '3', '4'];
  const todayIndex = WEEK_DAYS.indexOf(currentDayStr);
  
  let displayMarkets = markets;
  if (role === 'sales_rep') {
    const activeDays = todayIndex === -1 ? WEEK_DAYS : WEEK_DAYS.slice(0, todayIndex + 1);
    const validMarketIds = new Set<string>();
    
    activeDays.forEach(day => {
      const dayMarkets = repSchedule[day] || [];
      dayMarkets.forEach(mId => {
        // Only include if it's today's market, OR if it's a previous day's market that hasn't been visited yet
        if (day === currentDayStr || !repVisits[mId]) {
          validMarketIds.add(mId);
        }
      });
    });
    
    displayMarkets = markets.filter(m => validMarketIds.has(m.id));
  }"""

content = content.replace("  const getPiecesByUnit = (item: Item, unit: string, qty: number) => {", filter_logic + "\n\n  const getPiecesByUnit = (item: Item, unit: string, qty: number) => {")

# Update markets.map to displayMarkets.map
content = content.replace("            <datalist id=\"markets-list\">\n              {markets.map(m => <option key={m.id} value={m.name} />)}\n            </datalist>", "            <datalist id=\"markets-list\">\n              {displayMarkets.map(m => <option key={m.id} value={m.name} />)}\n            </datalist>")

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)
