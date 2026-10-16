import type { Chapter, Profile, Subject } from './types';
import type { ChapterStats } from './stats';
import { chStats } from './stats';
import { dayKey, daysBetween } from './time';

export type RevisionReason = 'needs_revision' | 'low_confidence' | 'stale' | 'difficult' | 'no_practice';

export const REASON_LABEL: Record<RevisionReason, string> = {
  needs_revision: 'Marked Needs Revision',
  low_confidence: 'Low confidence',
  stale: 'Not studied recently',
  difficult: 'Rated difficult',
  no_practice: 'No practice logged',
};

export interface RevisionItem {
  chapter: Chapter;
  subject: Subject;
  reasons: RevisionReason[];
  daysSince: number | null; // days since last logged study session
  score: number;
}

/**
 * The revision rule, in plain words (shown to students):
 *  - always: chapters marked "Needs Revision"
 *  - confidence at or below the threshold (default 2/5)
 *  - started chapters not studied for N days (default 14)
 *  - optional: difficulty 4/5 or higher
 *  - optional: status Learning or beyond, but no practice questions logged
 */
export function revisionItems(
  chapters: Chapter[], subjects: Subject[], stats: Map<string, ChapterStats>, p: Profile, tz: string, today: string,
): RevisionItem[] {
  const subj = new Map(subjects.filter((s) => !s.archived).map((s) => [s.id, s]));
  const out: RevisionItem[] = [];
  for (const c of chapters) {
    const s = subj.get(c.subject_id);
    if (!s) continue;
    const st = chStats(stats, c.id);
    const reasons: RevisionReason[] = [];
    const daysSince = st.lastStudied ? daysBetween(dayKey(st.lastStudied, tz), today) : null;

    if (c.status === 'needs_revision') reasons.push('needs_revision');
    if (p.rev_low_confidence > 0 && c.confidence != null && c.confidence <= p.rev_low_confidence) reasons.push('low_confidence');
    if (p.rev_stale_days > 0 && c.status !== 'not_started') {
      if (daysSince != null ? daysSince >= p.rev_stale_days
        : daysBetween(dayKey(c.updated_at, tz), today) >= p.rev_stale_days) reasons.push('stale');
    }
    if (p.rev_flag_difficult && c.difficulty != null && c.difficulty >= 4) reasons.push('difficult');
    if (p.rev_flag_no_practice && ['learning', 'practising', 'mastered'].includes(c.status) && st.attempted === 0) reasons.push('no_practice');

    if (!reasons.length) continue;
    const score =
      (reasons.includes('needs_revision') ? 40 : 0) +
      (reasons.includes('low_confidence') ? 30 - (c.confidence ?? 3) * 5 : 0) +
      (reasons.includes('stale') ? 10 + Math.min(daysSince ?? 30, 60) / 3 : 0) +
      (reasons.includes('difficult') ? 8 : 0) +
      (reasons.includes('no_practice') ? 6 : 0);
    out.push({ chapter: c, subject: s, reasons, daysSince, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

export function ruleSummary(p: Profile): string[] {
  const r = ['Chapters you have marked “Needs Revision”'];
  if (p.rev_low_confidence > 0) r.push(`Confidence ${p.rev_low_confidence}/5 or lower`);
  if (p.rev_stale_days > 0) r.push(`Started chapters not studied for ${p.rev_stale_days}+ days`);
  if (p.rev_flag_difficult) r.push('Difficulty rated 4/5 or higher');
  if (p.rev_flag_no_practice) r.push('Learning or beyond, but no practice questions logged');
  return r;
}
