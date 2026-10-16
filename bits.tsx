// Small display pieces shared by several pages.
import { Link } from 'react-router-dom';
import { Award, Lock } from 'lucide-react';
import type { Exam, StudySession } from '../lib/types';
import type { Achievement } from '../lib/achievements';
import { useData } from '../lib/store';
import { daysBetween, fmtKey, fmtMinutes, relativeDays, timeOfDay, dayKey } from '../lib/time';
import { methodLabel } from '../lib/constants';
import type { GoalProgress } from '../lib/stats';
import { goalMessage } from '../lib/stats';
import { Dot, Progress } from './ui';

export function MiniRating({ value }: { value: number | null }) {
  if (value == null) return <span className="muted">—</span>;
  const cls = value <= 2 ? 'low' : value >= 4 ? 'high' : '';
  return (
    <span className={`mini-rating ${cls}`} title={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((n) => <i key={n} className={n <= value ? 'on' : ''} />)}
    </span>
  );
}

export function Countdown({ date, today }: { date: string; today: string }) {
  const n = daysBetween(today, date);
  const cls = n < 0 ? 'past' : n <= 14 ? 'soon' : '';
  return (
    <div className={`countdown ${cls}`}>
      <b>{n < 0 ? '✓' : n}</b><span>{n < 0 ? 'done' : n === 1 ? 'day' : 'days'}</span>
    </div>
  );
}

export function SessionRow({ s, onClick }: { s: StudySession; onClick?: () => void }) {
  const { d } = useData();
  const subj = d.subjectById.get(s.subject_id);
  const ch = s.chapter_id ? d.chapterById.get(s.chapter_id) : null;
  const k = dayKey(s.started_at, d.tz);
  return (
    <div className="list-item" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <Dot color={subj?.color ?? '#999'} />
      <div className="li-main">
        <span className="li-title">{ch?.title ?? subj?.name ?? 'Deleted subject'}</span>
        <span className="li-sub">{ch ? subj?.name : 'Whole subject'} · {methodLabel(s.method)}</span>
      </div>
      <div className="li-right">{fmtMinutes(s.duration_min)}<span className="muted">{k === d.today ? `Today ${timeOfDay(s.started_at, d.tz)}` : relativeDays(k, d.today) === 'yesterday' ? 'Yesterday' : fmtKey(k)}</span></div>
    </div>
  );
}

export function ExamRow({ e }: { e: Exam }) {
  const { d } = useData();
  const subj = e.subject_id ? d.subjectById.get(e.subject_id) : null;
  return (
    <div className="list-item">
      <Countdown date={e.exam_date} today={d.today} />
      <div className="li-main">
        <Link to="/exams" className="li-title">{e.name}</Link>
        <span className="li-sub">
          {fmtKey(e.exam_date, { weekday: true, year: true })}{e.exam_time ? ` · ${e.exam_time.slice(0, 5)}` : ''}
          {subj && <> · <Dot color={subj.color} size={7} /> {subj.name}</>}
        </span>
      </div>
      <span className={'tag ' + (e.date_checked ? 'ok' : '')} title={e.date_checked ? (e.date_source ? `Checked against: ${e.date_source}` : 'You checked this date against an official timetable') : 'Date entered by you and not yet checked'}>
        {e.date_checked ? 'Checked' : 'Unverified'}
      </span>
    </div>
  );
}

export function GoalRow({ g }: { g: GoalProgress }) {
  const done = g.current >= g.target;
  const fmt = (v: number) => (g.unit === 'min' ? fmtMinutes(v) : String(v));
  return (
    <div className={'goal' + (done ? ' done' : '')}>
      <div className="goal-top"><b>{g.label} <span className="muted" style={{ fontWeight: 500 }}>· {g.period}</span></b><span className="tabular">{fmt(g.current)} / {fmt(g.target)}</span></div>
      <Progress value={(g.current / g.target) * 100} color={done ? 'var(--success)' : 'var(--accent)'} size="sm" />
      <div className="goal-msg">{goalMessage(g)}</div>
    </div>
  );
}

export function AchievementTile({ a }: { a: Achievement }) {
  const earned = !!a.earnedOn;
  return (
    <div className={'ach' + (earned ? ' earned' : '')} title={a.rule}>
      <div className="ach-icon">{earned ? <Award size={18} /> : <Lock size={16} />}</div>
      <div className="grow">
        <div className="ach-title">{a.title}</div>
        <div className="ach-sub">{earned ? `Earned ${fmtKey(a.earnedOn!, { year: true })}` : a.id === 'subject-complete' ? `Best so far: ${a.current}% · ${a.rule}` : `${a.current} / ${a.target} · ${a.rule}`}</div>
      </div>
    </div>
  );
}
