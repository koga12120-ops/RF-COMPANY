import re

# Update OrdersView.tsx
with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

new_useEffect_orders = """  useEffect(() => {
    let unsubSched = () => {};
    let unsubVisits = () => {};

    const fetchUser = async () => {
      if (auth.currentUser && role === 'sales_rep') {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          setRepName(userDoc.data().name);
        }
        
        // Listen to schedule
        unsubSched = onSnapshot(doc(db, 'schedules', auth.currentUser.uid), (docSnap) => {
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
        unsubVisits = onSnapshot(qVisits, (snap) => {
          const visitedMap: Record<string, boolean> = {};
          snap.forEach(d => { visitedMap[d.data().marketId] = true; });
          setRepVisits(visitedMap);
        });
      }
    };
    fetchUser();
"""

content = re.sub(r"  useEffect\(\(\) => \{\n    const fetchUser = async \(\) => \{.*?\n    fetchUser\(\);\n", new_useEffect_orders, content, flags=re.DOTALL)

cleanup_orders = """    return () => {
      unsubOrders();
      unsubItems();
      unsubMarkets();
      unsubReps();
      if (unsubSched) unsubSched();
      if (unsubVisits) unsubVisits();
    };"""

content = re.sub(r"    return \(\) => \{\n      unsubOrders\(\);\n      unsubItems\(\);\n      unsubMarkets\(\);\n      unsubReps\(\);\n    \};", cleanup_orders, content)

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)

# Update CashvanSalesView.tsx
with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

new_useEffect_cashvan = """  useEffect(() => {
    if (!userName) return;
    
    let unsubSched = () => {};
    let unsubVisits = () => {};

    const fetchUser = async () => {
      if (auth.currentUser) {
        // Listen to schedule
        unsubSched = onSnapshot(doc(db, 'schedules', auth.currentUser.uid), (docSnap) => {
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
        unsubVisits = onSnapshot(qVisits, (snap) => {
          const visitedMap: Record<string, boolean> = {};
          snap.forEach(d => { visitedMap[d.data().marketId] = true; });
          setRepVisits(visitedMap);
        });
      }
    };
    fetchUser();
"""

content = re.sub(r"  useEffect\(\(\) => \{\n        if \(\!userName\) return;\n    const fetchUser = async \(\) => \{.*?\n    fetchUser\(\);\n", new_useEffect_cashvan, content, flags=re.DOTALL)

cleanup_cashvan = """    return () => {
      unsubInv();
      unsubMarkets();
      unsubSales();
      if (unsubSched) unsubSched();
      if (unsubVisits) unsubVisits();
    };"""

content = re.sub(r"    return \(\) => \{\n      unsubInv\(\);\n      unsubMarkets\(\);\n      unsubSales\(\);\n    \};", cleanup_cashvan, content)

with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(content)

print("done")
