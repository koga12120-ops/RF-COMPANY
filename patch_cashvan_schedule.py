import re

with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

# Add states for schedule
states = """  const [repSchedule, setRepSchedule] = useState<Record<string, string[]>>({});
  const [repVisits, setRepVisits] = useState<Record<string, boolean>>({});"""
content = content.replace("  const [loading, setLoading] = useState(true);", "  const [loading, setLoading] = useState(true);\n" + states)

# Add logic to fetch schedule inside useEffect
effect_fetch = """    if (!userName) return;
    const fetchUser = async () => {
      if (auth.currentUser) {
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
    fetchUser();"""
content = re.sub(r'if \(\!userName\) return;', effect_fetch, content)

# Calculate displayMarkets
calc = """  // Filter markets for reps based on schedule
  const currentDayStr = new Date().getDay().toString();
  const WEEK_DAYS = ['6', '0', '1', '2', '3', '4'];
  const todayIndex = WEEK_DAYS.indexOf(currentDayStr);
  
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
  
  const displayMarkets = markets.filter(m => validMarketIds.has(m.id));"""
content = content.replace("  const handleSale = async () => {", calc + "\n\n  const handleSale = async () => {")

# Replace markets with displayMarkets in select
content = content.replace("markets.map(m => (", "displayMarkets.map(m => (")

with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(content)
print("done")
