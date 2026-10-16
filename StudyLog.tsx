import { useMemo, useState } from 'react';
import { Clock3, Pencil, Plus, Search, Trash2, Timer as TimerIcon } from 'lucide-react';
import { useData } from '../lib/store';
import { friendlyError } from '../lib/api';
import { dayKey, fmtKey, fmtMinutes, timeOfDay, addDays } from '../lib/time';
import { METHODS, methodLabel } from '../lib/constants';
import type { StudySession } from '../lib/types';
import { Card, Dot, EmptyState, useConfirm, useToast } from '../components/ui';
import { SessionForm } from '../components/SessionForm';

const PAGE = 60;

export function StudyLog() {
  const { data, d, remove } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState('');
  const [method, setMethod] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<StudySession | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.sessions.filter((s) => {
      if (subject && s.subject_id !== subject) return false;
      if (method && s.method !== method) return false;
      const k = dayKey(s.started_at, d.tz);
      if (from && k < from) return false;
      if (to && k > to) return false;
      if (needle) {
        const hay = [s.notes, d.subjectById.get(s.subject_id)?.name, s.chapter_id ? d.chapterById.get(s.chapter_id)?.title : '', methodLabel(s.method)].join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [data.sessions, q, subject, method, from, to, d]);

  const total = filtered.reduce((a, s) => a + s.duration_min, 0);
  const groups = useMemo(() => {
    const g: { key: string; items: StudySession[]; total: number }[] = [];
    for (const s of filtered.slice(0, limit)) {
      const k = dayKey(s.started_at, d.tz);
      let last = g[g.length - 1];
      if (!last || last.key !== k) { last = { key: k, items: [], total: 0 }; g.push(last); }
      last.items.push(s);
    }
    // day totals use every filtered session on that day, not just the visible page
    for (const grp of g) grp.total = filtered.filter((s) => dayKey(s.started_at, d.tz) === grp.key).reduce((a, s) => a + s.duration_min, 0);
    return g;
  }, [filtered, limit, d.tz]);

  const anyFilter = q || subject || method || from || to;
  const preset = (days: number) => { setFrom(addDays(d.today, -(days - 1))); setTo(d.today); };

  async function del(s: StudySession) {
    const subj = d.subjectById.get(s.subject_id);
    if (!await confirm({ title: 'Delete this session?', danger: true, confirmLabel: 'Delete', message: <>{fmtMinutes(s.duration_min)} of {subj?.name ?? 'study'} on {fmtKey(dayKey(s.started_at, d.tz), { weekday: true, year: true })} will be removed from all your totals and charts.</> })) return;
    try { await remove('study_sessions', s.id); toast('Session deleted.'); } catch (e) { toast(friendlyError(e), 'error'); }
  }

  return (
    <>
      <div className="page-actions">
        <div><b style={{ fontSize: 15 }}>{filtered.length} session{filtered.length === 1 ? '' : 's'}</b><span className="muted"> · {fmtMinutes(total)}{anyFilter ? ' (filtered)' : ' in total'}</span></div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={16} />Log session</button>
      </div>

      <div className="filters">
        <div className="search"><Search size={15} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes, chapters, subjects…" aria-label="Search" /></div>
        <select className="input" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Filter by subject">
          <option value="">All subjects</option>
          {data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="input" value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Filter by method">
          <option value="">All methods</option>
          {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <input className="input" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="From date" title="From" />
        <input className="input" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="To date" title="To" />
        <div className="row" style={{ gap: 4 }}>
          <button className="btn btn-sm btn-ghost" onClick={() => preset(7)}>7 days</button>
          <button className="btn btn-sm btn-ghost" onClick={() => preset(30)}>30 days</button>
          {anyFilter && <button className="btn btn-sm" onClick={() => { setQ(''); setSubject(''); setMethod(''); setFrom(''); setTo(''); }}>Clear</button>}
        </div>
      </div>

      {!data.sessions.length ? (
        <Card><EmptyState icon={<Clock3 size={22} />} title="Your study log is empty" text="Use the timer while you study, or log a session you’ve already done." action={<button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={16} />Log a session</button>} /></Card>
      ) : !filtered.length ? (
        <Card><EmptyState icon={<Search size={22} />} title="No sessions match" text="Try a different search or clear the filters." /></Card>
      ) : (
        <div className="stack">
          {groups.map((g) => (
            <Card key={g.key} title={<>{g.key === d.today ? 'Today' : fmtKey(g.key, { weekday: true, year: true })}</>} action={<span className="muted small tabular">{fmtMinutes(g.total)}</span>}>
              <div className="list">
                {g.items.map((s) => {
                  const subj = d.subjectById.get(s.subject_id);
                  const ch = s.chapter_id ? d.chapterById.get(s.chapter_id) : null;
                  return (
                    <div key={s.id} className="list-item">
                      <span className="muted small tabular nowrap" style={{ width: 42 }}>{timeOfDay(s.started_at, d.tz)}</span>
                      <Dot color={subj?.color ?? '#999'} />
                      <div className="li-main">
                        <span className="li-title">{ch?.title ?? subj?.name}</span>
                        <span className="li-sub">
                          {ch ? subj?.name : 'Whole subject'} · {methodLabel(s.method)}
                          {s.questions_attempted != null && <> · {s.questions_correct ?? '?'}/{s.questions_attempted} correct</>}
                          {s.confidence != null && <> · confidence {s.confidence}/5</>}
                          {s.source === 'timer' && <span title="Recorded with the timer"><TimerIcon size={11} style={{ verticalAlign: -1 }} /></span>}
                        </span>
                        {s.notes && <span className="li-sub" style={{ color: 'var(--text-2)', marginTop: 2 }}>{s.notes}</span>}
                      </div>
                      <div className="li-right">{fmtMinutes(s.duration_min)}</div>
                      <div className="row" style={{ gap: 0, flexWrap: 'nowrap' }}>
                        <button className="icon-btn" onClick={() => setEditing(s)} aria-label="Edit session"><Pencil size={15} /></button>
                        <button className="icon-btn danger" onClick={() => del(s)} aria-label="Delete session"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
          {filtered.length > limit && <button className="btn" style={{ alignSelf: 'center' }} onClick={() => setLimit((l) => l + PAGE)}>Show more ({filtered.length - limit} older)</button>}
        </div>
      )}

      <SessionForm open={adding} onClose={() => setAdding(false)} />
      <SessionForm open={!!editing} session={editing} onClose={() => setEditing(null)} />
    </>
  );
}
