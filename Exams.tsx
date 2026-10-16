import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CheckCircle2, ChevronDown, ChevronUp, Pencil, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { useData } from '../lib/store';
import { friendlyError } from '../lib/api';
import { daysBetween, fmtKey } from '../lib/time';
import { EXAM_BOARDS } from '../lib/constants';
import type { Exam } from '../lib/types';
import { Card, Dot, EmptyState, Field, Modal, Progress, StatusBadge, useConfirm, useToast } from '../components/ui';
import { Countdown } from '../components/bits';

export function Exams() {
  const { data, d } = useData();
  const [editing, setEditing] = useState<Exam | null>(null);
  const [adding, setAdding] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const sorted = [...data.exams].sort((a, b) => a.exam_date.localeCompare(b.exam_date) || (a.exam_time ?? '').localeCompare(b.exam_time ?? ''));
  const upcoming = sorted.filter((e) => e.exam_date >= d.today);
  const past = sorted.filter((e) => e.exam_date < d.today).reverse();
  const next = upcoming[0];

  return (
    <>
      <div className="page-actions">
        <div>{next ? <><b style={{ fontSize: 15 }}>Next exam in {daysBetween(d.today, next.exam_date) === 0 ? 'today' : `${daysBetween(d.today, next.exam_date)} days`}</b><span className="muted"> · {next.name}</span></> : <b style={{ fontSize: 15 }}>{upcoming.length} upcoming exams</b>}</div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={16} />Add exam</button>
      </div>

      <div className="notice plain" style={{ marginBottom: 16 }}>
        <ShieldCheck size={18} />
        <div className="small">Syllabix never fills in exam dates for you. Every date here is <b>entered by you</b>. Once you’ve checked one against your official timetable (from your school or exam board), tick “I’ve checked this date” so it shows as <span className="tag ok">Checked</span>.</div>
      </div>

      {!data.exams.length ? (
        <Card><EmptyState icon={<CalendarDays size={22} />} title="No exams yet" text="Add each paper you’re sitting — with its date, the topics to revise, and optional revision deadlines." action={<button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={16} />Add your first exam</button>} /></Card>
      ) : (
        <div className="stack">
          {upcoming.map((e) => <ExamCard key={e.id} exam={e} onEdit={() => setEditing(e)} />)}
          {!upcoming.length && <Card><EmptyState icon={<CheckCircle2 size={22} />} title="No upcoming exams" text="All your exams are in the past." /></Card>}
          {past.length > 0 && (
            <>
              <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setShowPast((s) => !s)}>{showPast ? <ChevronUp size={16} /> : <ChevronDown size={16} />}Past exams ({past.length})</button>
              {showPast && past.map((e) => <ExamCard key={e.id} exam={e} onEdit={() => setEditing(e)} />)}
            </>
          )}
        </div>
      )}

      <ExamForm open={adding} onClose={() => setAdding(false)} />
      <ExamForm open={!!editing} exam={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function ExamCard({ exam, onEdit }: { exam: Exam; onEdit: () => void }) {
  const { data, d, insert, update, remove } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [picking, setPicking] = useState(false);
  const subj = exam.subject_id ? d.subjectById.get(exam.subject_id) : null;
  const topics = data.examTopics.filter((t) => t.exam_id === exam.id)
    .map((t) => ({ t, c: d.chapterById.get(t.chapter_id) }))
    .filter((x) => x.c)
    .sort((a, b) => (a.t.deadline ?? '9999').localeCompare(b.t.deadline ?? '9999') || a.c!.position - b.c!.position);
  const done = topics.filter((x) => x.t.done).length;
  const linked = new Set(topics.map((x) => x.t.chapter_id));
  const candidates = data.chapters.filter((c) => !linked.has(c.id) && (!exam.subject_id || c.subject_id === exam.subject_id));
  const days = daysBetween(d.today, exam.exam_date);

  const act = async (fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { toast(friendlyError(e), 'error'); } };

  return (
    <div className="card exam-card" style={subj ? { borderLeft: `4px solid ${subj.color}` } : undefined}>
      <div className="exam-top">
        <Countdown date={exam.exam_date} today={d.today} />
        <div className="grow">
          <div className="row" style={{ gap: 8 }}>
            <b style={{ fontSize: 15.5 }}>{exam.name}</b>
            {exam.date_checked
              ? <span className="tag ok" title={exam.date_source ? `Checked against: ${exam.date_source}` : undefined}><ShieldCheck size={12} />Checked by you{exam.date_source ? ` · ${exam.date_source.length > 40 ? exam.date_source.slice(0, 40) + '…' : exam.date_source}` : ''}</span>
              : <span className="tag">Date entered by you · unverified</span>}
          </div>
          <div className="li-sub" style={{ marginTop: 3 }}>
            {fmtKey(exam.exam_date, { weekday: true, year: true })}{exam.exam_time ? ` at ${exam.exam_time.slice(0, 5)}` : ''}
            {exam.paper && <> · {exam.paper}</>}
            {exam.exam_board && <> · {exam.exam_board}</>}
            {subj && <> · <Dot color={subj.color} size={7} /> {subj.name}</>}
            {days >= 0 && <> · {days === 0 ? <b>today</b> : days === 1 ? <b>tomorrow</b> : `${days} days to go`}</>}
          </div>
          {exam.notes && <div className="small" style={{ marginTop: 6, color: 'var(--text-2)' }}>{exam.notes}</div>}
        </div>
        <div className="row" style={{ gap: 0, flexWrap: 'nowrap' }}>
          <button className="icon-btn" onClick={onEdit} aria-label="Edit exam"><Pencil size={15} /></button>
          <button className="icon-btn danger" aria-label="Delete exam" onClick={async () => {
            if (await confirm({ title: `Delete “${exam.name}”?`, danger: true, confirmLabel: 'Delete exam', message: 'Its revision checklist is deleted too. Your chapters and study sessions are not affected.' })) act(() => remove('exams', exam.id));
          }}><Trash2 size={15} /></button>
        </div>
      </div>

      <div>
        <div className="row-between" style={{ marginBottom: 8 }}>
          <span className="field-label">Revision topics {topics.length > 0 && <span className="muted">· {done}/{topics.length} revised</span>}</span>
          <button className="btn btn-sm" onClick={() => setPicking(true)} disabled={!candidates.length} title={!candidates.length ? 'No more chapters to add' : undefined}><Plus size={14} />Add topics</button>
        </div>
        {topics.length > 0 && <Progress value={(done / topics.length) * 100} size="sm" />}
        <div className="exam-topics" style={{ marginTop: 6 }}>
          {topics.map(({ t, c }) => {
            const late = t.deadline && !t.done && t.deadline < d.today;
            return (
              <div key={t.id} className={'exam-topic' + (t.done ? ' done' : '')}>
                <input type="checkbox" checked={t.done} onChange={() => act(() => update('exam_topics', t.id, { done: !t.done }))} style={{ accentColor: 'var(--success)', width: 16, height: 16 }} aria-label={`Mark ${c!.title} revised`} />
                <div className="grow">
                  <Link to={`/subjects/${c!.subject_id}/chapters/${c!.id}`} className="et-title" style={{ color: 'var(--text)', fontWeight: 550 }}>{c!.title}</Link>
                  {!exam.subject_id && <span className="muted small"> · {d.subjectById.get(c!.subject_id)?.name}</span>}
                </div>
                <span className="hide-mobile"><StatusBadge status={c!.status} /></span>
                <input type="date" className="input" style={{ width: 'auto', height: 30, fontSize: 12.5, borderColor: late ? 'var(--danger)' : undefined }} value={t.deadline ?? ''} max={exam.exam_date}
                  onChange={(e) => act(() => update('exam_topics', t.id, { deadline: e.target.value || null }))} aria-label="Revise by" title={late ? 'Deadline passed' : 'Revise by (optional)'} />
                <button className="icon-btn danger" onClick={() => act(() => remove('exam_topics', t.id))} aria-label="Remove topic"><X size={14} /></button>
              </div>
            );
          })}
          {!topics.length && <p className="muted small" style={{ margin: '2px 0 0' }}>Link the chapters this paper covers, then tick them off as you revise. Add a “revise by” date to any topic to plan your countdown.</p>}
        </div>
      </div>

      <TopicPicker open={picking} onClose={() => setPicking(false)} candidates={candidates} onAdd={async (ids) => {
        for (const id of ids) await insert('exam_topics', { exam_id: exam.id, chapter_id: id });
        toast(`${ids.length} topic${ids.length === 1 ? '' : 's'} added.`);
      }} />
    </div>
  );
}

function TopicPicker({ open, onClose, candidates, onAdd }: { open: boolean; onClose: () => void; candidates: { id: string; title: string; subject_id: string }[]; onAdd: (ids: string[]) => Promise<void> }) {
  const { d } = useData();
  const toast = useToast();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setSel(new Set()); }, [open]);
  const groups = useMemo(() => {
    const m = new Map<string, typeof candidates>();
    for (const c of candidates) m.set(c.subject_id, [...(m.get(c.subject_id) ?? []), c]);
    return [...m.entries()];
  }, [candidates]);
  return (
    <Modal open={open} onClose={onClose} title="Add revision topics" footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" disabled={!sel.size || busy} onClick={async () => {
        setBusy(true);
        try { await onAdd([...sel]); onClose(); } catch (e) { toast(friendlyError(e), 'error'); }
        setBusy(false);
      }}>Add {sel.size || ''} topic{sel.size === 1 ? '' : 's'}</button>
    </>}>
      {!candidates.length ? <p className="muted">No chapters available. Add chapters to this subject first.</p> : (
        <div className="stack-sm" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
          {groups.map(([sid, cs]) => (
            <div key={sid} className="stack-sm">
              <div className="row-between"><b className="small">{d.subjectById.get(sid)?.name}</b>
                <button className="link-btn small" onClick={() => setSel((s) => { const n = new Set(s); const all = cs.every((c) => n.has(c.id)); cs.forEach((c) => (all ? n.delete(c.id) : n.add(c.id))); return n; })}>Select all</button>
              </div>
              {cs.map((c) => (
                <label key={c.id} className="check"><input type="checkbox" checked={sel.has(c.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })} />{c.title}</label>
              ))}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function ExamForm({ open, onClose, exam }: { open: boolean; onClose: () => void; exam?: Exam | null }) {
  const { data, d, insert, update } = useData();
  const toast = useToast();
  const [f, setF] = useState({ name: '', subject_id: '', paper: '', exam_board: 'Cambridge International', exam_date: '', exam_time: '', notes: '', date_checked: false, date_source: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setErr(null); setBusy(false);
    setF(exam ? {
      name: exam.name, subject_id: exam.subject_id ?? '', paper: exam.paper ?? '', exam_board: exam.exam_board ?? '', exam_date: exam.exam_date,
      exam_time: exam.exam_time?.slice(0, 5) ?? '', notes: exam.notes ?? '', date_checked: exam.date_checked, date_source: exam.date_source ?? '',
    } : { name: '', subject_id: d.activeSubjects[0]?.id ?? '', paper: '', exam_board: d.activeSubjects[0]?.exam_board ?? 'Cambridge International', exam_date: '', exam_time: '', notes: '', date_checked: false, date_source: '' });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!f.name.trim()) return setErr('Give the exam a name, e.g. “Physics Paper 4”.');
    if (!f.exam_date) return setErr('Enter the exam date.');
    setBusy(true); setErr(null);
    const row = {
      name: f.name.trim(), subject_id: f.subject_id || null, paper: f.paper.trim() || null, exam_board: f.exam_board.trim() || null,
      exam_date: f.exam_date, exam_time: f.exam_time || null, notes: f.notes.trim() || null,
      date_checked: f.date_checked, date_source: f.date_checked ? f.date_source.trim() || null : null,
    };
    try {
      if (exam) await update('exams', exam.id, row); else await insert('exams', row);
      toast(exam ? 'Exam updated.' : 'Exam added.');
      onClose();
    } catch (e2) { setErr(friendlyError(e2)); setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={exam ? 'Edit exam' : 'Add an exam'} width={560} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" form="exam-form" disabled={busy}>{busy ? 'Saving…' : exam ? 'Save changes' : 'Add exam'}</button>
    </>}>
      <form id="exam-form" onSubmit={submit} className="grid-form">
        <div className="span-2"><Field label="Exam name"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Physics Paper 4 (Theory)" maxLength={120} /></Field></div>
        <Field label="Subject" optional>
          <select className="input" value={f.subject_id} onChange={(e) => set('subject_id', e.target.value)}>
            <option value="">Not linked</option>
            {data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Paper name or number" optional><input className="input" value={f.paper} onChange={(e) => set('paper', e.target.value)} placeholder="e.g. Paper 42" maxLength={60} /></Field>
        <Field label="Exam board" optional>
          <input className="input" list="boards" value={f.exam_board} onChange={(e) => set('exam_board', e.target.value)} maxLength={60} />
          <datalist id="boards">{EXAM_BOARDS.map((b) => <option key={b} value={b} />)}</datalist>
        </Field>
        <div className="grid-2" style={{ gap: 10 }}>
          <Field label="Date"><input className="input" type="date" value={f.exam_date} onChange={(e) => set('exam_date', e.target.value)} required /></Field>
          <Field label="Time" optional><input className="input" type="time" value={f.exam_time} onChange={(e) => set('exam_time', e.target.value)} /></Field>
        </div>
        <div className="span-2 stack-sm" style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 10 }}>
          <label className="check"><input type="checkbox" checked={f.date_checked} onChange={(e) => set('date_checked', e.target.checked)} /><span><b>I’ve checked this date against my official timetable</b><br /><span className="muted small">Leave unticked if it’s a guess or not yet confirmed.</span></span></label>
          {f.date_checked && <input className="input" value={f.date_source} onChange={(e) => set('date_source', e.target.value)} placeholder="Where you checked it (e.g. school exams office timetable)" maxLength={300} />}
        </div>
        <div className="span-2"><Field label="Notes" optional><textarea className="input" value={f.notes} onChange={(e) => set('notes', e.target.value)} maxLength={5000} placeholder="Room, equipment, what to bring…" /></Field></div>
        {err && <div className="form-error span-2">{err}</div>}
      </form>
    </Modal>
  );
}
