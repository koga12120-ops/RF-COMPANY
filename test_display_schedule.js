const schedule = {
  '6': ['m1', 'm2', 'm3'], // Saturday
  '0': ['m4'], // Sunday
  '1': ['m5', 'm6'], // Monday (let's say today is 1)
};
const visits = { 'm1': true, 'm4': true };
const WEEK_DAYS = ['6', '0', '1', '2', '3', '4'];
const currentDayStr = '1';

const displaySchedule = {};
WEEK_DAYS.forEach(d => displaySchedule[d] = []);

const todayIndex = WEEK_DAYS.indexOf(currentDayStr);
const isFuture = (day) => WEEK_DAYS.indexOf(day) > todayIndex;
const isPast = (day) => WEEK_DAYS.indexOf(day) < todayIndex;

WEEK_DAYS.forEach(day => {
  const originalMarkets = schedule[day] || [];
  originalMarkets.forEach(mId => {
    if (isPast(day) && !visits[mId]) {
      // move to today
      displaySchedule[currentDayStr].push(mId);
    } else {
      displaySchedule[day].push(mId);
    }
  });
});

console.log(displaySchedule);
