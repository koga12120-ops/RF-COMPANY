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
  
# Since string replacement fails on whitespaces, let's use regex
content = re.sub(r'const activeDays = todayIndex === -1.*?(?=return \()', r'''
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
  });

  ''', content, flags=re.DOTALL)

content = content.replace('const dayMarkets = schedule[day] || [];\n            const isToday = day === currentDayStr;', 'const dayMarkets = displaySchedule[day] || [];\n            const isToday = day === currentDayStr;')

with open('src/components/views/RepScheduleView.tsx', 'w') as f:
    f.write(content)
print("done")
