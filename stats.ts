import type { ActiveTimer, AllData, Chapter, Profile, StudySession, Subject } from './types';
import { addDays, addMonths, daysBetween, dayKey, monthKey, weekStartKey } from './time';

// ---------------------------------------------------------------- timer
/** Elapsed study time, excluding every paused interval. */
export function timerElapsedMs(t: Pick<ActiveTimer, 'accumulated_ms' | 'running_since'>, now = Date.now()): number {
  const running = t.running_since ? Math.max(0, now - new Date(t.running_since).getTime()) : 0;
  return Number(t.accumulated_ms) + running;
}
/** Minutes to record for an elapsed time (rounded to nearest minute; 0 if under 30 seconds). */
export function minutesFromMs(ms: number): number { return Math.round(ms / 60000); }

// ---------------------------------------------------------------- per chapter / subject
export interface ChapterStats { minutes: number; sessions: number; lastStudied: string | null; attempted: number; correct: number }
export interface SubjectStats {
  total: number; mastered: number; pct: number; minutes: number; sessions: number;
  started: number; needsRevision: number;
  avgConfidence: number | null; avgDifficulty: number | null;
  lastStudied: string | null;
}

const emptyCh = (): ChapterStats => ({ minutes: 0, sessions: 0, lastStudied: null, attempted: 0, correct: 0 });

export function chapterStatsMap(sessions: StudySession[]): Map<string, ChapterStats> {
  const m = new Map<string, ChapterStats>();
  for (const s of sessions) {
    if (!s.chapter_id) continue;
    const c = m.get(s.chapter_id) ?? emptyCh();
    c.minutes += s.duration_min; c.sessions += 1;
    c.attempted += s.questions_attempted ?? 0; c.correct += s.questions_correct ?? 0;
    if (!c.lastStudied || s.started_at > c.lastStudied) c.lastStudied = s.started_at;
    m.set(s.chapter_id, c);
  }
  return m;
}
export const chStats = (m: Map<string, ChapterStats>, id: string) => m.get(id) ?? emptyCh();

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function subjectStatsMap(subjects: Subject[], chapters: Chapter[], sessions: StudySession[]): Map<string, SubjectStats> {
  const m = new Map<string, SubjectStats>();
  for (const s of subjects) {
    const chs = chapters.filter((c) => c.subject_id === s.id);
    const ss = sessions.filter((x) => x.subject_id === s.id);
    const mastered = chs.filter((c) => c.status === 'mastered').length;
    const conf = chs.map((c) => c.confidence).filter((x): x is number => x != null);
    const diff = chs.map((c) => c.difficulty).filter((x): x is number => x != null);
    let last: string | null = null;
    for (const x of ss) if (!last || x.started_at > last) last = x.started_at;
    m.set(s.id, {
      total: chs.length,
      mastered,
      pct: chs.length ? Math.round((mastered / chs.length) * 100) : 0,
      minutes: ss.reduce((a, x) => a + x.duration_min, 0),
      sessions: ss.length,
      started: chs.filter((c) => c.status !== 'not_started').length,
      needsRevision: chs.filter((c) => c.status === 'needs_revision').length,
      // averages only shown once at least 2 chapters are rated
      avgConfidence: conf.length >= 2 ? avg(conf) : null,
      avgDifficulty: diff.length >= 2 ? avg(diff) : null,
      lastStudied: last,
    });
  }
  return m;
}

// ---------------------------------------------------------------- time series
/** Each session counts once, on the day (in the student's timezone) it started. */
export function minutesByDay(sessions: StudySession[], tz: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of sessions) {
    const k = dayKey(s.started_at, tz);
    m.set(k, (m.get(k) ?? 0) + s.duration_min);
  }
  return m;
}

export interface Bucket { key: string; minutes: number }

export function lastNDays(byDay: Map<string, number>, today: string, n: number): Bucket[] {
  const out: Bucket[] = [];
  for (let i = n - 1; i >= 0; i--) { const k = addDays(today, -i); out.push({ key: k, minutes: byDay.get(k) ?? 0 }); }
  return out;
}
export function lastNWeeks(byDay: Map<string, number>, today: string, weekStart: number, n: number): Bucket[] {
  const thisWeek = weekStartKey(today, weekStart);
  const out: Bucket[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i);
    let sum = 0;
    for (let d = 0; d < 7; d++) sum += byDay.get(addDays(start, d)) ?? 0;
    out.push({ key: start, minutes: sum });
  }
  return out;
}
export function lastNMonths(byDay: Map<string, number>, today: string, n: number): Bucket[] {
  const sums = new Map<string, number>();
  for (const [k, v] of byDay) sums.set(monthKey(k), (sums.get(monthKey(k)) ?? 0) + v);
  const cur = monthKey(today);
  const out: Bucket[] = [];
  for (let i = n - 1; i >= 0; i--) { const mk = addMonths(cur, -i); out.push({ key: mk, minutes: sums.get(mk) ?? 0 }); }
  return out;
}

export function minutesInRange(byDay: Map<string, number>, startKey: string, endKeyInclusive: string): number {
  let sum = 0;
  for (const [k, v] of byDay) if (k >= startKey && k <= endKeyInclusive) sum += v;
  return sum;
}

// ---------------------------------------------------------------- streaks
/**
 * A day counts towards a streak when at least `minMinutes` were logged that day.
 * Today never breaks a streak — it only adds to it once you reach the minimum.
 */
export function streaks(byDay: Map<string, number>, today: string, minMinutes: number) {
  const ok = (k: string) => (byDay.get(k) ?? 0) >= minMinutes;
  let current = 0;
  let k = ok(today) ? today : addDays(today, -1);
  while (ok(k)) { current++; k = addDays(k, -1); }

  const days = [...byDay.keys()].filter(ok).sort();
  let longest = 0, run = 0, prev: string | null = null, longestEnd: string | null = null;
  for (const d of days) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    if (run > longest) { longest = run; longestEnd = d; }
    prev = d;
  }
  return { current, longest, todayDone: ok(today), longestEnd };
}

// ---------------------------------------------------------------- mastery over time
export function masteredBetween(chapters: Chapter[], tz: string, startKey: string, endKey: string): number {
  return chapters.filter((c) => c.status === 'mastered' && c.mastered_at)
    .filter((c) => { const k = dayKey(c.mastered_at!, tz); return k >= startKey && k <= endKey; }).length;
}

export function masteredByMonth(chapters: Chapter[], tz: string, today: string, n: number): Bucket[] {
  const cur = monthKey(today);
  const firstMonth = addMonths(cur, -(n - 1));
  const counts = new Map<string, number>();
  let before = 0;
  for (const c of chapters) {
    if (c.status !== 'mastered' || !c.mastered_at) continue;
    const mk = monthKey(dayKey(c.mastered_at, tz));
    if (mk < firstMonth) before++; else counts.set(mk, (counts.get(mk) ?? 0) + 1);
  }
  const out: Bucket[] = [];
  let running = before;
  for (let i = n - 1; i >= 0; i--) {
    const mk = addMonths(cur, -i);
    running += counts.get(mk) ?? 0;
    out.push({ key: mk, minutes: running }); // cumulative count of currently-mastered chapters
  }
  return out;
}

// ---------------------------------------------------------------- goals
export interface GoalProgress { id: string; label: string; current: number; target: number; unit: 'min' | 'chapters'; period: string }

export function goalProgress(d: AllData, tz: string, today: string): GoalProgress[] {
  const p = d.profile;
  const byDay = minutesByDay(d.sessions, tz);
  const ws = weekStartKey(today, p.week_start);
  const we = addDays(ws, 6);
  const out: GoalProgress[] = [];
  if (p.daily_goal_min) out.push({ id: 'daily', label: 'Daily study time', current: byDay.get(today) ?? 0, target: p.daily_goal_min, unit: 'min', period: 'Today' });
  if (p.weekly_goal_min) out.push({ id: 'weekly', label: 'Weekly study time', current: minutesInRange(byDay, ws, we), target: p.weekly_goal_min, unit: 'min', period: 'This week' });
  if (p.weekly_chapters_goal) out.push({ id: 'chapters', label: 'Chapters mastered', current: masteredBetween(d.chapters, tz, ws, we), target: p.weekly_chapters_goal, unit: 'chapters', period: 'This week' });
  for (const s of d.subjects) {
    if (s.archived || !s.weekly_target_min) continue;
    const mins = d.sessions.filter((x) => x.subject_id === s.id && (() => { const k = dayKey(x.started_at, tz); return k >= ws && k <= we; })())
      .reduce((a, x) => a + x.duration_min, 0);
    out.push({ id: 'subj-' + s.id, label: s.name, current: mins, target: s.weekly_target_min, unit: 'min', period: 'This week' });
  }
  return out;
}

export function goalMessage(g: GoalProgress, isPeriodOver = false): string {
  if (g.current >= g.target) return 'Target reached — nice work.';
  if (isPeriodOver) return 'Not reached this time. A new period is a fresh start.';
  if (g.current === 0) return 'Not started yet.';
  const left = g.target - g.current;
  return g.unit === 'min' ? `${left} min to go.` : `${left} to go.`;
}

export function profileTz(p: Profile): string { return p.timezone || 'UTC'; }
