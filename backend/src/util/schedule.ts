// Weekly schedule in a given time zone ("Friday 23:55 in Helsinki"), independent of the server's
// own time zone (pods run in UTC).

export interface WeeklySchedule {
  weekday: number; // 0 = Sunday … 5 = Friday
  hour: number;
  minute: number;
  timeZone: string;
}

export const DEFAULT_SCHEDULE: WeeklySchedule = { weekday: 5, hour: 23, minute: 55, timeZone: 'Europe/Helsinki' };

// UPDATE_SCHEDULE="5 23:55" (weekday hh:mm, Europe/Helsinki)
export function parseSchedule(value: string | undefined): WeeklySchedule {
  const m = /^\s*([0-6])\s+(\d{1,2}):(\d{2})\s*$/.exec(value ?? '');
  if (!m) return DEFAULT_SCHEDULE;
  return { ...DEFAULT_SCHEDULE, weekday: Number(m[1]), hour: Number(m[2]), minute: Number(m[3]) };
}

// Wall-clock fields of an instant in a time zone
function wallClock(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

// Offset of the time zone from UTC at an instant, in ms
function zoneOffset(date: Date, timeZone: string): number {
  const w = wallClock(date, timeZone);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - Math.floor(date.getTime() / 1000) * 1000;
}

// The instant at which the wall clock of the time zone shows the given time
export function zonedTime(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let t = guess - zoneOffset(new Date(guess), timeZone);
  t = guess - zoneOffset(new Date(t), timeZone); // correct across a DST change
  return new Date(t);
}

// The latest scheduled moment at or before `now`
export function lastScheduledTime(now: Date, s: WeeklySchedule = DEFAULT_SCHEDULE): Date {
  const w = wallClock(now, s.timeZone);
  const weekday = new Date(Date.UTC(w.year, w.month - 1, w.day)).getUTCDay();
  const back = (weekday - s.weekday + 7) % 7;
  // calendar arithmetic on a UTC date avoids DST effects
  const day = new Date(Date.UTC(w.year, w.month - 1, w.day - back));
  let t = zonedTime(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), s.hour, s.minute, s.timeZone);
  if (t.getTime() > now.getTime()) {
    const prev = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() - 7));
    t = zonedTime(prev.getUTCFullYear(), prev.getUTCMonth() + 1, prev.getUTCDate(), s.hour, s.minute, s.timeZone);
  }
  return t;
}

export function nextScheduledTime(now: Date, s: WeeklySchedule = DEFAULT_SCHEDULE): Date {
  const last = lastScheduledTime(now, s);
  const w = wallClock(last, s.timeZone);
  const next = new Date(Date.UTC(w.year, w.month - 1, w.day + 7));
  return zonedTime(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), s.hour, s.minute, s.timeZone);
}
