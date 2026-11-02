/**
 * Schedule Rotation Utility for Alternating 2-Week Rep & Cashvan Schedules
 * خشتەی خولانەوەی دوو هەفتەیی (خشتەی یەکەم و خشتەی دووەم) بۆ مەندووب و کاشڤان
 *
 * Each business week runs Saturday to Thursday.
 * Week A (خشتەی یەکەم) runs for 1 week (e.g. 1st to 6th of the month)
 * Week B (خشتەی دووەم) automatically takes over for the next week (e.g. 8th to 13th)
 * Then automatically flips back to Week A, and so on.
 */

// Epoch reference Saturday: 2024-01-06 00:00:00 UTC
const EPOCH_SATURDAY_MS = new Date('2024-01-06T00:00:00.000Z').getTime();
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Returns the Saturday 00:00:00 of the week for any given date
 */
export function getSaturdayStartDate(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 is Sunday, 6 is Saturday
  const diffToSaturday = day === 6 ? 0 : day + 1;
  d.setDate(d.getDate() - diffToSaturday);
  return d;
}

/**
 * Returns the Thursday 23:59:59 (end of 6-day working week)
 */
export function getThursdayEndDate(date: Date = new Date()): Date {
  const sat = getSaturdayStartDate(date);
  const thu = new Date(sat);
  thu.setDate(sat.getDate() + 5);
  thu.setHours(23, 59, 59, 999);
  return thu;
}

/**
 * Returns the next Saturday 00:00:00
 */
export function getNextSaturdayStartDate(date: Date = new Date()): Date {
  const sat = getSaturdayStartDate(date);
  const nextSat = new Date(sat);
  nextSat.setDate(sat.getDate() + 7);
  return nextSat;
}

/**
 * Returns the weekId (e.g. week_2026-11-07)
 */
export function getWeekId(date: Date = new Date()): string {
  const sat = getSaturdayStartDate(date);
  const y = sat.getFullYear();
  const m = String(sat.getMonth() + 1).padStart(2, '0');
  const d = String(sat.getDate()).padStart(2, '0');
  return `week_${y}-${m}-${d}`;
}

export interface ScheduleRotationConfig {
  activeScheduleOverride?: 'auto' | '1' | '2';
  startingSchedule?: '1' | '2'; // Flip parity if desired
  rotationAnchorDate?: string; // Optional custom anchor
}

/**
 * Automatically computes whether the given date is in '1' (خشتەی یەکەم) or '2' (خشتەی دووەم)
 */
export function getCalculatedWeekSchedule(config?: ScheduleRotationConfig, date: Date = new Date()): '1' | '2' {
  if (config?.activeScheduleOverride === '1') return '1';
  if (config?.activeScheduleOverride === '2') return '2';

  const sat = getSaturdayStartDate(date);
  let anchorMs = EPOCH_SATURDAY_MS;
  if (config?.rotationAnchorDate) {
    const customAnchor = new Date(config.rotationAnchorDate);
    if (!isNaN(customAnchor.getTime())) {
      anchorMs = getSaturdayStartDate(customAnchor).getTime();
    }
  }

  const diffMs = sat.getTime() - anchorMs;
  const weekIndex = Math.floor(diffMs / ONE_WEEK_MS);
  const isEvenWeek = Math.abs(weekIndex) % 2 === 0;

  let baseType: '1' | '2' = isEvenWeek ? '1' : '2';

  if (config?.startingSchedule === '2') {
    baseType = baseType === '1' ? '2' : '1';
  }

  return baseType;
}

/**
 * Comprehensive details about the current week and next week for display
 */
export function getWeekScheduleInfo(config?: ScheduleRotationConfig, date: Date = new Date()) {
  const currentSchedule = getCalculatedWeekSchedule(config, date);
  const nextDate = getNextSaturdayStartDate(date);
  const nextSchedule = getCalculatedWeekSchedule(config, nextDate);

  const sat = getSaturdayStartDate(date);
  const thu = getThursdayEndDate(date);
  const nextSat = getNextSaturdayStartDate(date);
  const nextThu = getThursdayEndDate(nextDate);

  const formatShort = (d: Date) => `${d.getDate()}ی ${d.getMonth() + 1}`;
  const formatFull = (satD: Date, thuD: Date) => 
    `شەممە ${satD.getDate()}/${satD.getMonth() + 1} تا پێنجشەممە ${thuD.getDate()}/${thuD.getMonth() + 1}`;

  const isAuto = !config?.activeScheduleOverride || config?.activeScheduleOverride === 'auto';

  return {
    currentSchedule,
    nextSchedule,
    currentScheduleLabel: currentSchedule === '1' ? 'خشتەی یەکەم' : 'خشتەی دووەم',
    nextScheduleLabel: nextSchedule === '1' ? 'خشتەی یەکەم' : 'خشتەی دووەم',
    currentWeekRangeShort: `${formatShort(sat)} تا ${formatShort(thu)}`,
    currentWeekRangeFull: formatFull(sat, thu),
    nextWeekRangeShort: `${formatShort(nextSat)} تا ${formatShort(nextThu)}`,
    nextWeekRangeFull: formatFull(nextSat, nextThu),
    isAuto,
    satDate: sat,
    thuDate: thu
  };
}

/**
 * Default empty schedule structure
 */
export function createEmptySchedule(): Record<string, string[]> {
  return {
    '6': [], // شەممە
    '0': [], // یەکشەممە
    '1': [], // دووشەممە
    '2': [], // سێشەممە
    '3': [], // چوارشەممە
    '4': []  // پێنجشەممە
  };
}
