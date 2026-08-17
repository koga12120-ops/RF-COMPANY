import re

with open('src/components/views/RepScheduleView.tsx', 'r') as f:
    content = f.read()

find_str = """  const todayIndex = WEEK_DAYS.indexOf(currentDayStr);

  const activeDays = todayIndex === -1 ? WEEK_DAYS : WEEK_DAYS.slice(0, todayIndex + 1);

  const pendingMarkets: { marketId: string, assignedDay: string }[] = [];
  activeDays.forEach(day => {
    const dayMarkets = schedule[day] || [];
    dayMarkets.forEach(mId => {
      if (!visits[mId]) {
        pendingMarkets.push({ marketId: mId, assignedDay: day });
      }
    });
  });"""

replace_str = """  const todayIndex = WEEK_DAYS.indexOf(currentDayStr);

  const displaySchedule: Record<string, string[]> = {};
  WEEK_DAYS.forEach(d => displaySchedule[d] = []);

  WEEK_DAYS.forEach(day => {
    const originalMarkets = schedule[day] || [];
    originalMarkets.forEach(mId => {
      const isPast = WEEK_DAYS.indexOf(day) < todayIndex;
      if (isPast && !visits[mId]) {
        if (todayIndex !== -1) {
          displaySchedule[currentDayStr].push(mId);
        } else {
          displaySchedule[day].push(mId);
        }
      } else {
        displaySchedule[day].push(mId);
      }
    });
  });"""

if find_str in content:
    content = content.replace(find_str, replace_str)
    
    find_str2 = """          {WEEK_DAYS.map(day => {
            const dayMarkets = schedule[day] || [];
            const isToday = day === currentDayStr;"""
            
    replace_str2 = """          {WEEK_DAYS.map(day => {
            const dayMarkets = displaySchedule[day] || [];
            const isToday = day === currentDayStr;"""
            
    if find_str2 in content:
        content = content.replace(find_str2, replace_str2)
        with open('src/components/views/RepScheduleView.tsx', 'w') as f:
            f.write(content)
        print("Patched RepScheduleView.tsx successfully.")
    else:
        print("Could not find the second target string.")
else:
    print("Could not find the first target string in RepScheduleView.tsx.")
