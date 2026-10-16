import type { AllData } from './types';
import { dayKey, daysBetween } from './time';

export interface Achievement {
  id: string;
  title: string;
  rule: string;
  earnedOn: string | null; // day key when earned
  current: number;
  target: number;
}

/** Every badge is computed from saved data only, so editing or deleting sessions updates them. */
export function achievements(d: AllData, tz: string, streakMin: number): Achievement[] {
  const sessions = [...d.sessions].sort((a, b) => a.started_at.localeCompare(b.started_at));
  const out: Achievement[] = [];

  out.push({
    id: 'first-session', title: 'First step', rule: 'Log your first study session.',
    earnedOn: sessions[0] ? dayKey(sessions[0].started_at, tz) : null, current: Math.min(sessions.length, 1), target: 1,
  });

  const totalMin = sessions.reduce((a, s) => a + s.duration_min, 0);
  for (const h of [1, 10, 50, 100]) {
    let run = 0, when: string | null = null;
    for (const s of sessions) { run += s.duration_min; if (run >= h * 60) { when = dayKey(s.started_at, tz); break; } }
    out.push({ id: `hours-${h}`, title: `${h} hour${h > 1 ? 's' : ''} logged`, rule: `Log ${h} hour${h > 1 ? 's' : ''} of study in total.`,
      earnedOn: when, current: Math.min(Math.floor(totalMin / 60), h), target: h });
  }

  const mastered = d.chapters.filter((c) => c.status === 'mastered' && c.mastered_at)
    .map((c) => c.mastered_at!).sort();
  out.push({ id: 'first-mastered', title: 'First chapter mastered', rule: 'Mark a chapter as Mastered.',
    earnedOn: mastered[0] ? dayKey(mastered[0], tz) : null, current: Math.min(mastered.length, 1), target: 1 });
  out.push({ id: 'mastered-10', title: 'Ten chapters mastered', rule: 'Have 10 chapters marked Mastered.',
    earnedOn: mastered[9] ? dayKey(mastered[9], tz) : null, current: Math.min(mastered.length, 10), target: 10 });

  // 7-day streak (same rule as the streak counter)
  const byDay = new Map<string, number>();
  for (const s of sessions) { const k = dayKey(s.started_at, tz); byDay.set(k, (byDay.get(k) ?? 0) + s.duration_min); }
  const okDays = [...byDay.entries()].filter(([, m]) => m >= streakMin).map(([k]) => k).sort();
  let run = 0, best = 0, streakWhen: string | null = null, prev: string | null = null;
  for (const k of okDays) {
    run = prev && daysBetween(prev, k) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    if (run >= 7 && !streakWhen) streakWhen = k;
    prev = k;
  }
  out.push({ id: 'streak-7', title: 'One-week streak', rule: `Study at least ${streakMin} min a day for 7 days in a row.`,
    earnedOn: streakWhen, current: Math.min(best, 7), target: 7 });

  // a subject (3+ chapters) fully mastered
  let subjWhen: string | null = null, bestPct = 0;
  for (const s of d.subjects) {
    const chs = d.chapters.filter((c) => c.subject_id === s.id);
    if (chs.length < 3) continue;
    const m = chs.filter((c) => c.status === 'mastered');
    bestPct = Math.max(bestPct, Math.round((m.length / chs.length) * 100));
    if (m.length === chs.length) {
      const k = dayKey(m.map((c) => c.mastered_at ?? c.updated_at).sort().at(-1)!, tz);
      if (!subjWhen || k < subjWhen) subjWhen = k;
    }
  }
  out.push({ id: 'subject-complete', title: 'Syllabus complete', rule: 'Master every chapter of a subject (at least 3 chapters).',
    earnedOn: subjWhen, current: bestPct, target: 100 });

  let q = 0, qWhen: string | null = null;
  for (const s of sessions) { q += s.questions_attempted ?? 0; if (q >= 100 && !qWhen) qWhen = dayKey(s.started_at, tz); }
  out.push({ id: 'questions-100', title: '100 practice questions', rule: 'Log 100 practice questions attempted.',
    earnedOn: qWhen, current: Math.min(q, 100), target: 100 });

  return out;
}
