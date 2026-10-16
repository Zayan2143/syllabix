// Timezone-aware date helpers.
// All "day keys" are 'YYYY-MM-DD' strings in the student's chosen timezone.
// Date arithmetic on day keys is done in UTC so DST never shifts a day.

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string) {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
    dtfCache.set(tz, f);
  }
  return f;
}

export function isValidTimeZone(tz: string): boolean {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; }
}

export function safeTz(tz: string | null | undefined): string {
  return tz && isValidTimeZone(tz) ? tz : 'UTC';
}

function zonedParts(d: Date, tz: string) {
  const out: Record<string, number> = {};
  for (const p of partsFormatter(safeTz(tz)).formatToParts(d)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** The calendar day (in tz) that an instant falls on. */
export function dayKey(input: Date | string | number, tz: string): string {
  const p = zonedParts(new Date(input), tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function todayKey(tz: string): string { return dayKey(new Date(), tz); }

function keyToUtc(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function utcToKey(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(key: string, n: number): string {
  const d = keyToUtc(key); d.setUTCDate(d.getUTCDate() + n); return utcToKey(d);
}
export function addMonths(monthKeyStr: string, n: number): string {
  const [y, m] = monthKeyStr.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}
/** 0 = Sunday … 6 = Saturday */
export function weekday(key: string): number { return keyToUtc(key).getUTCDay(); }
/** Whole days from a to b (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((keyToUtc(b).getTime() - keyToUtc(a).getTime()) / 86400000);
}
export function weekStartKey(key: string, weekStart: number): string {
  const diff = (weekday(key) - weekStart + 7) % 7;
  return addDays(key, -diff);
}
export function monthKey(key: string): string { return key.slice(0, 7); }

/** Offset of tz from UTC at a given instant, in ms. */
export function tzOffsetMs(at: Date, tz: string): number {
  const p = zonedParts(at, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Convert a wall-clock date + time in tz to a real instant. */
export function zonedToUtc(key: string, hhmm: string, tz: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let t = guess - tzOffsetMs(new Date(guess), tz);
  // second pass handles DST transitions
  t = guess - tzOffsetMs(new Date(t), tz);
  return new Date(t);
}

/** 'HH:MM' wall-clock time of an instant in tz */
export function timeOfDay(input: Date | string, tz: string): string {
  const p = zonedParts(new Date(input), tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function fmtKey(key: string, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const [y, m, d] = key.split('-').map(Number);
  let s = `${d} ${MONTHS[m - 1]}`;
  if (opts.year) s += ` ${y}`;
  if (opts.weekday) s = `${DAYS[weekday(key)]}, ${s}`;
  return s;
}
export function fmtMonthKey(mk: string, withYear = false): string {
  const [y, m] = mk.split('-').map(Number);
  return withYear ? `${MONTHS[m - 1]} ${y}` : MONTHS[m - 1];
}
export function shortWeekday(key: string): string { return DAYS[weekday(key)]; }

export function fmtLongToday(tz: string): string {
  const key = todayKey(tz);
  const [y, m, d] = key.split('-').map(Number);
  const long = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekday(key)];
  return `${long}, ${d} ${MONTHS[m - 1]} ${y}`;
}

export function fmtMinutes(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}
export function fmtHours(min: number): string {
  const h = min / 60;
  return h >= 10 ? `${Math.round(h)}h` : `${Math.round(h * 10) / 10}h`;
}
export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function relativeDays(fromKey: string, toKey: string): string {
  const n = daysBetween(fromKey, toKey);
  if (n === 0) return 'today';
  if (n === 1) return 'yesterday';
  if (n === -1) return 'tomorrow';
  if (n > 0) return `${n} days ago`;
  return `in ${-n} days`;
}

export function browserTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

export function allTimeZones(): string[] {
  try {
    const list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone');
    if (list && list.length) return list.includes('UTC') ? list : ['UTC', ...list];
  } catch { /* older browsers */ }
  return ['UTC', 'Asia/Riyadh', 'Asia/Karachi', 'Asia/Dubai', 'Asia/Kolkata', 'Europe/London', 'America/New_York'];
}
