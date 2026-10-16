import { describe, expect, it } from 'vitest';
import { addDays, dayKey, daysBetween, monthKey, weekStartKey, zonedToUtc, timeOfDay, fmtClock } from './time';
import { lastNDays, lastNMonths, lastNWeeks, masteredByMonth, minutesByDay, minutesFromMs, streaks, subjectStatsMap, timerElapsedMs, goalProgress } from './stats';
import { revisionItems } from './revision';
import { achievements } from './achievements';
import type { AllData, Chapter, Profile, StudySession, Subject } from './types';

const profile: Profile = {
  id: 'u', display_name: 'Shoaib', timezone: 'Asia/Riyadh', week_start: 0, theme: 'system', onboarded: true,
  daily_goal_min: 60, weekly_goal_min: 300, weekly_chapters_goal: 2, streak_min_minutes: 15,
  rev_low_confidence: 2, rev_stale_days: 14, rev_flag_difficult: false, rev_flag_no_practice: false, created_at: '2026-01-01T00:00:00Z',
};
const subj = (id: string, extra: Partial<Subject> = {}): Subject => ({
  id, user_id: 'u', name: id, short_code: null, exam_board: 'Cambridge International', qualification: 'IGCSE', syllabus_code: null,
  exam_session: null, exam_year: null, exam_date: null, color: '#2563EB', weekly_target_min: null, archived: false, position: 0, created_at: '', ...extra,
});
const chap = (id: string, subject_id: string, extra: Partial<Chapter> = {}): Chapter => ({
  id, user_id: 'u', subject_id, title: id, description: null, position: 0, subtopics: [], status: 'not_started', difficulty: null,
  confidence: null, notes: null, mastered_at: null, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z', ...extra,
});
const sess = (id: string, started_at: string, duration_min: number, extra: Partial<StudySession> = {}): StudySession => ({
  id, user_id: 'u', subject_id: 'phy', chapter_id: null, started_at, ended_at: null, duration_min, method: 'notes',
  questions_attempted: null, questions_correct: null, confidence: null, notes: null, source: 'manual', created_at: '', ...extra,
});

describe('timer', () => {
  it('excludes paused time', () => {
    // studied 10 min, paused (accumulated), then running again for 5 min
    const t0 = Date.parse('2026-10-16T10:00:00Z');
    const t = { accumulated_ms: 10 * 60000, running_since: new Date(t0).toISOString() };
    expect(timerElapsedMs(t, t0 + 5 * 60000)).toBe(15 * 60000);
    // paused: time keeps passing but elapsed doesn't change
    expect(timerElapsedMs({ accumulated_ms: 15 * 60000, running_since: null }, t0 + 99 * 60000)).toBe(15 * 60000);
  });
  it('rounds to minutes', () => {
    expect(minutesFromMs(29_000)).toBe(0);
    expect(minutesFromMs(90_000)).toBe(2);
    expect(minutesFromMs(25 * 60000 + 10_000)).toBe(25);
    expect(fmtClock(3_725_000)).toBe('1:02:05');
  });
});

describe('timezone handling', () => {
  it('assigns a session to the student’s local day', () => {
    // 22:30 UTC on 15 Oct is 01:30 on 16 Oct in Riyadh (UTC+3)
    expect(dayKey('2026-10-15T22:30:00Z', 'Asia/Riyadh')).toBe('2026-10-16');
    expect(dayKey('2026-10-15T22:30:00Z', 'Europe/London')).toBe('2026-10-15');
    expect(dayKey('2026-10-15T22:30:00Z', 'Asia/Karachi')).toBe('2026-10-16');
  });
  it('converts local wall time to UTC, including across DST', () => {
    expect(zonedToUtc('2026-10-16', '09:15', 'Asia/Riyadh').toISOString()).toBe('2026-10-16T06:15:00.000Z');
    expect(zonedToUtc('2026-07-01', '09:00', 'Europe/London').toISOString()).toBe('2026-07-01T08:00:00.000Z');
    expect(zonedToUtc('2026-12-01', '09:00', 'Europe/London').toISOString()).toBe('2026-12-01T09:00:00.000Z');
    expect(timeOfDay('2026-10-16T06:15:00Z', 'Asia/Riyadh')).toBe('09:15');
  });
  it('does date arithmetic on calendar days', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(daysBetween('2026-10-16', '2027-05-10')).toBe(206);
    expect(monthKey('2026-10-16')).toBe('2026-10');
  });
  it('starts weeks on the chosen day', () => {
    // 16 Oct 2026 is a Friday
    expect(weekStartKey('2026-10-16', 0)).toBe('2026-10-11'); // Sunday
    expect(weekStartKey('2026-10-16', 1)).toBe('2026-10-12'); // Monday
    expect(weekStartKey('2026-10-11', 0)).toBe('2026-10-11');
    expect(weekStartKey('2026-10-16', 6)).toBe('2026-10-10'); // Saturday
  });
});

describe('statistics', () => {
  const sessions = [
    sess('a', '2026-10-15T22:30:00Z', 30), // 16 Oct Riyadh
    sess('b', '2026-10-16T08:00:00Z', 45), // 16 Oct
    sess('c', '2026-10-14T10:00:00Z', 20), // 14 Oct
    sess('d', '2026-09-20T10:00:00Z', 60), // Sept
  ];
  const byDay = minutesByDay(sessions, 'Asia/Riyadh');
  it('totals per day, once each', () => {
    expect(byDay.get('2026-10-16')).toBe(75);
    expect(byDay.get('2026-10-15')).toBeUndefined();
    const total = [...byDay.values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(155);
  });
  it('last 7 days / 8 weeks / 12 months add up', () => {
    const d7 = lastNDays(byDay, '2026-10-16', 7);
    expect(d7).toHaveLength(7);
    expect(d7.at(-1)).toEqual({ key: '2026-10-16', minutes: 75 });
    expect(d7.reduce((a, b) => a + b.minutes, 0)).toBe(95);
    const w8 = lastNWeeks(byDay, '2026-10-16', 0, 8);
    expect(w8.at(-1)).toEqual({ key: '2026-10-11', minutes: 95 });
    expect(w8.reduce((a, b) => a + b.minutes, 0)).toBe(155);
    const m12 = lastNMonths(byDay, '2026-10-16', 12);
    expect(m12.at(-1)).toEqual({ key: '2026-10', minutes: 95 });
    expect(m12.at(-2)).toEqual({ key: '2026-09', minutes: 60 });
  });
  it('editing or deleting a session changes the totals', () => {
    const edited = sessions.map((s) => (s.id === 'b' ? { ...s, duration_min: 15 } : s)).filter((s) => s.id !== 'a');
    expect(minutesByDay(edited, 'Asia/Riyadh').get('2026-10-16')).toBe(15);
  });
  it('streaks: today never breaks a streak; short days do not count', () => {
    const m = new Map([['2026-10-13', 20], ['2026-10-14', 30], ['2026-10-15', 15], ['2026-10-10', 5]]);
    expect(streaks(m, '2026-10-16', 15)).toMatchObject({ current: 3, longest: 3, todayDone: false });
    m.set('2026-10-16', 40);
    expect(streaks(m, '2026-10-16', 15)).toMatchObject({ current: 4, todayDone: true });
    expect(streaks(m, '2026-10-18', 15).current).toBe(0);
  });
  it('subject progress counts only Mastered as complete', () => {
    const chs = [chap('1', 'phy', { status: 'mastered' }), chap('2', 'phy', { status: 'practising' }), chap('3', 'phy'), chap('4', 'phy', { status: 'learning' })];
    const st = subjectStatsMap([subj('phy')], chs, sessions).get('phy')!;
    expect(st).toMatchObject({ total: 4, mastered: 1, pct: 25, started: 3, minutes: 155 });
  });
  it('mastered over time is cumulative', () => {
    const chs = [chap('1', 'phy', { status: 'mastered', mastered_at: '2026-08-02T10:00:00Z' }), chap('2', 'phy', { status: 'mastered', mastered_at: '2026-10-02T10:00:00Z' })];
    const m = masteredByMonth(chs, 'Asia/Riyadh', '2026-10-16', 3);
    expect(m.map((x) => x.minutes)).toEqual([1, 1, 2]);
  });
  it('goal progress uses the timezone and week start', () => {
    const d: AllData = { profile, subjects: [subj('phy', { weekly_target_min: 120 })], chapters: [], sessions, timer: null, exams: [], examTopics: [] };
    const g = goalProgress(d, 'Asia/Riyadh', '2026-10-16');
    expect(g.find((x) => x.id === 'daily')!.current).toBe(75);
    expect(g.find((x) => x.id === 'weekly')!.current).toBe(95);
    expect(g.find((x) => x.id === 'subj-phy')!.current).toBe(95);
  });
});

describe('revision centre', () => {
  const subjects = [subj('phy'), subj('old', { archived: true })];
  const chapters = [
    chap('nr', 'phy', { status: 'needs_revision' }),
    chap('lc', 'phy', { status: 'practising', confidence: 2 }),
    chap('ok', 'phy', { status: 'practising', confidence: 4 }),
    chap('stale', 'phy', { status: 'mastered', confidence: 5 }),
    chap('new', 'phy'),
    chap('arch', 'old', { status: 'needs_revision' }),
  ];
  const sessions = [
    sess('1', '2026-10-15T10:00:00Z', 30, { chapter_id: 'ok' }),
    sess('2', '2026-09-20T10:00:00Z', 30, { chapter_id: 'stale' }),
    sess('3', '2026-10-15T10:00:00Z', 30, { chapter_id: 'lc' }),
  ];
  const stats = new Map<string, import('./stats').ChapterStats>();
  for (const s of sessions) stats.set(s.chapter_id!, { minutes: 30, sessions: 1, lastStudied: s.started_at, attempted: 0, correct: 0 });

  it('flags exactly the chapters the rule describes', () => {
    const items = revisionItems(chapters, subjects, stats, profile, 'Asia/Riyadh', '2026-10-16');
    const ids = items.map((i) => i.chapter.id).sort();
    expect(ids).toEqual(['lc', 'nr', 'stale']);
    expect(items.find((i) => i.chapter.id === 'stale')!.daysSince).toBe(26);
  });
  it('respects adjustable thresholds', () => {
    const items = revisionItems(chapters, subjects, stats, { ...profile, rev_low_confidence: 0, rev_stale_days: 30 }, 'Asia/Riyadh', '2026-10-16');
    expect(items.map((i) => i.chapter.id)).toEqual(['nr']);
  });
});

describe('achievements', () => {
  it('are earned only from real data', () => {
    const empty: AllData = { profile, subjects: [], chapters: [], sessions: [], timer: null, exams: [], examTopics: [] };
    expect(achievements(empty, 'Asia/Riyadh', 15).every((a) => a.earnedOn === null)).toBe(true);
    const d = { ...empty, sessions: [sess('a', '2026-10-15T10:00:00Z', 70)] };
    const a = achievements(d, 'Asia/Riyadh', 15);
    expect(a.find((x) => x.id === 'first-session')!.earnedOn).toBe('2026-10-15');
    expect(a.find((x) => x.id === 'hours-1')!.earnedOn).toBe('2026-10-15');
    expect(a.find((x) => x.id === 'hours-10')!.earnedOn).toBeNull();
  });
});
