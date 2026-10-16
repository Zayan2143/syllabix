import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, CheckCircle2, Clock3, Pencil, Play, Plus, Trash2, X } from 'lucide-react';
import { useData } from '../lib/store';
import { friendlyError } from '../lib/api';
import { chStats } from '../lib/stats';
import { dayKey, fmtKey, fmtMinutes, relativeDays } from '../lib/time';
import { CONFIDENCE_LABELS, DIFFICULTY_LABELS } from '../lib/constants';
import type { Subtopic } from '../lib/types';
import { Card, EmptyState, Field, Modal, Rating, StatusSelect, useConfirm, useToast } from '../components/ui';
import { SessionRow } from '../components/bits';
import { SessionForm } from '../components/SessionForm';

export function ChapterDetail() {
  const { id, chapterId } = useParams();
  const { data, d, update, remove } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const nav = useNavigate();
  const chapter = d.chapterById.get(chapterId!);
  const subject = d.subjectById.get(id!);
  const [notes, setNotes] = useState(chapter?.notes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [newSub, setNewSub] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [editSession, setEditSession] = useState<string | null>(null);
  useEffect(() => { setNotes(chapter?.notes ?? ''); }, [chapter?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const sessions = useMemo(() => data.sessions.filter((s) => s.chapter_id === chapterId), [data.sessions, chapterId]);
  const siblings = useMemo(() => data.chapters.filter((c) => c.subject_id === id).sort((a, b) => a.position - b.position), [data.chapters, id]);
  const exams = data.examTopics.filter((t) => t.chapter_id === chapterId).map((t) => ({ t, e: data.exams.find((e) => e.id === t.exam_id) })).filter((x) => x.e);
  if (!chapter || !subject || chapter.subject_id !== subject.id) return <Navigate to={subject ? `/subjects/${subject.id}` : '/subjects'} replace />;
  const st = chStats(d.chapterStats, chapter.id);
  const idx = siblings.findIndex((c) => c.id === chapter.id);

  const save = async (patch: Parameters<typeof update<'chapters'>>[2], msg?: string) => {
    try { await update('chapters', chapter.id, patch); if (msg) toast(msg); } catch (e) { toast(friendlyError(e), 'error'); }
  };
  const setSubs = (subtopics: Subtopic[]) => save({ subtopics });

  async function addSub(e: FormEvent) {
    e.preventDefault();
    const t = newSub.trim();
    if (!t) return;
    await setSubs([...chapter!.subtopics, { id: crypto.randomUUID(), title: t.slice(0, 200), done: false }]);
    setNewSub('');
  }

  async function move(dir: -1 | 1) {
    const other = siblings[idx + dir];
    if (!other) return;
    try {
      await Promise.all([update('chapters', chapter!.id, { position: idx + dir }), update('chapters', other.id, { position: idx })]);
    } catch (e) { toast(friendlyError(e), 'error'); }
  }

  const notesDirty = (notes || '') !== (chapter.notes || '');
  const accuracy = st.attempted ? Math.round((st.correct / st.attempted) * 100) : null;
  const editing = editSession ? data.sessions.find((s) => s.id === editSession) ?? null : null;

  return (
    <>
      <div className="chapter-head">
        <div className="grow">
          <div className="crumbs"><Link to="/subjects">My Subjects</Link>/<Link to={`/subjects/${subject.id}`}>{subject.name}</Link>/<span>Chapter {idx + 1}</span></div>
          <div className="row" style={{ gap: 10 }}>
            <h2 className="h-title">{chapter.title}</h2>
            <button className="icon-btn" onClick={() => setEditOpen(true)} aria-label="Rename chapter"><Pencil size={15} /></button>
          </div>
          {chapter.description && <p className="muted" style={{ margin: '4px 0 0' }}>{chapter.description}</p>}
          {chapter.status === 'mastered' && chapter.mastered_at && (
            <div className="tag ok" style={{ marginTop: 8 }}><CheckCircle2 size={12} />Mastered on {fmtKey(dayKey(chapter.mastered_at, d.tz), { year: true })}</div>
          )}
        </div>
        <div className="row">
          <StatusSelect value={chapter.status} onChange={(status) => save({ status }, status === 'mastered' ? 'Marked as mastered.' : undefined)} />
          <button className="btn btn-sm" onClick={() => setLogOpen(true)}><Plus size={14} />Log session</button>
          <button className="btn btn-sm btn-primary" onClick={() => nav(`/timer?subject=${subject.id}&chapter=${chapter.id}`)}><Play size={14} />Study this</button>
        </div>
      </div>

      <div className="dash-grid">
        <div className="col">
          <Card title="Subtopics & learning objectives" action={chapter.subtopics.length ? <span className="muted small">{chapter.subtopics.filter((x) => x.done).length}/{chapter.subtopics.length} done</span> : undefined}>
            {chapter.subtopics.length === 0 && <p className="muted small" style={{ margin: '0 0 10px' }}>Break this chapter into the points listed in your syllabus and tick them off as you go.</p>}
            <div>
              {chapter.subtopics.map((s, i) => (
                <div key={s.id} className={'subtopic' + (s.done ? ' done' : '')}>
                  <input type="checkbox" checked={s.done} onChange={() => setSubs(chapter.subtopics.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} aria-label={`Mark ${s.title} done`} style={{ accentColor: 'var(--success)', width: 16, height: 16 }} />
                  <span className="grow">{s.title}</span>
                  <button className="icon-btn danger" onClick={() => setSubs(chapter.subtopics.filter((x) => x.id !== s.id))} aria-label="Remove subtopic"><X size={14} /></button>
                </div>
              ))}
            </div>
            <form className="row" style={{ marginTop: 10, flexWrap: 'nowrap' }} onSubmit={addSub}>
              <input className="input" value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="Add a subtopic…" maxLength={200} />
              <button className="btn" disabled={!newSub.trim()}><Plus size={15} />Add</button>
            </form>
          </Card>

          <Card title="My notes" action={notesDirty ? <span className="tag warn">Unsaved</span> : undefined}>
            <textarea className="input" style={{ minHeight: 140 }} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={10000} placeholder="Key formulas, definitions, mistakes to avoid…" />
            <div className="row-end" style={{ marginTop: 10 }}>
              {notesDirty && <button className="btn btn-sm btn-ghost" onClick={() => setNotes(chapter.notes ?? '')}>Discard</button>}
              <button className="btn btn-sm btn-primary" disabled={!notesDirty || savingNotes} onClick={async () => { setSavingNotes(true); await save({ notes: notes.trim() || null }, 'Notes saved.'); setSavingNotes(false); }}>{savingNotes ? 'Saving…' : 'Save notes'}</button>
            </div>
          </Card>

          <Card title={`Study sessions (${sessions.length})`}>
            {sessions.length ? <div className="list">{sessions.map((s) => <SessionRow key={s.id} s={s} onClick={() => setEditSession(s.id)} />)}</div>
              : <EmptyState icon={<Clock3 size={20} />} title="Not studied yet" text="Sessions you log for this chapter will appear here." />}
          </Card>
        </div>

        <div className="col">
          <Card title="Self-assessment">
            <div className="stack">
              <Field label="Confidence" hint="How well could you answer an exam question on this today?">
                <Rating value={chapter.confidence} onChange={(v) => save({ confidence: v })} labels={CONFIDENCE_LABELS} name="Confidence" />
              </Field>
              <Field label="Difficulty" hint="How hard is this chapter for you?">
                <Rating value={chapter.difficulty} onChange={(v) => save({ difficulty: v })} labels={DIFFICULTY_LABELS} name="Difficulty" />
              </Field>
            </div>
          </Card>

          <Card title="Progress">
            <dl className="kv">
              <dt>Total study time</dt><dd>{fmtMinutes(st.minutes)}</dd>
              <dt>Sessions</dt><dd>{st.sessions}</dd>
              <dt>Last studied</dt><dd>{st.lastStudied ? relativeDays(dayKey(st.lastStudied, d.tz), d.today) : 'Never'}</dd>
              <dt>Practice questions</dt><dd>{st.attempted ? `${st.correct} / ${st.attempted}` : '—'}</dd>
              <dt>Accuracy</dt><dd>{accuracy != null ? `${accuracy}%` : '—'}</dd>
            </dl>
            <p className="muted small" style={{ margin: '12px 0 0' }}>Time spent shows effort, not understanding — use your confidence rating and practice accuracy to judge how ready you are.</p>
          </Card>

          {exams.length > 0 && (
            <Card title="On your revision list for">
              <div className="list">{exams.map(({ t, e }) => (
                <div key={t.id} className="list-item"><div className="li-main"><Link to="/exams" className="li-title">{e!.name}</Link><span className="li-sub">{fmtKey(e!.exam_date, { year: true })}{t.deadline ? ` · revise by ${fmtKey(t.deadline)}` : ''}</span></div>{t.done ? <span className="tag ok">Revised</span> : <span className="tag">To revise</span>}</div>
              ))}</div>
            </Card>
          )}

          <Card title="Chapter options">
            <div className="stack-sm">
              <div className="row">
                <button className="btn btn-sm" disabled={idx <= 0} onClick={() => move(-1)}><ArrowUp size={14} />Move up</button>
                <button className="btn btn-sm" disabled={idx >= siblings.length - 1} onClick={() => move(1)}><ArrowDown size={14} />Move down</button>
              </div>
              <button className="btn btn-sm" style={{ color: 'var(--danger-text)', alignSelf: 'flex-start' }} onClick={async () => {
                if (!await confirm({ title: `Delete “${chapter.title}”?`, danger: true, confirmLabel: 'Delete chapter', message: st.sessions ? <>Notes, subtopics and ratings are deleted. Its {st.sessions} study session{st.sessions === 1 ? '' : 's'} stay in your log under “{subject.name}”.</> : 'Notes, subtopics and ratings will be deleted.' })) return;
                try { await remove('chapters', chapter.id); toast('Chapter deleted.'); nav(`/subjects/${subject.id}`); } catch (e) { toast(friendlyError(e), 'error'); }
              }}><Trash2 size={14} />Delete chapter</button>
            </div>
          </Card>
        </div>
      </div>

      <EditChapter open={editOpen} onClose={() => setEditOpen(false)} title={chapter.title} description={chapter.description ?? ''}
        onSave={(title, description) => save({ title, description: description || null }, 'Chapter updated.')} />
      <SessionForm open={logOpen} onClose={() => setLogOpen(false)} defaults={{ subject_id: subject.id, chapter_id: chapter.id }} />
      <SessionForm open={!!editing} session={editing} onClose={() => setEditSession(null)} />
    </>
  );
}

function EditChapter({ open, onClose, title, description, onSave }: { open: boolean; onClose: () => void; title: string; description: string; onSave: (t: string, d: string) => Promise<void> }) {
  const [t, setT] = useState(title);
  const [desc, setDesc] = useState(description);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setT(title); setDesc(description); } }, [open, title, description]);
  return (
    <Modal open={open} onClose={onClose} title="Edit chapter" footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" disabled={!t.trim() || busy} onClick={async () => { setBusy(true); await onSave(t.trim(), desc.trim()); setBusy(false); onClose(); }}>Save</button>
    </>}>
      <div className="stack">
        <Field label="Chapter title"><input className="input" value={t} onChange={(e) => setT(e.target.value)} maxLength={160} /></Field>
        <Field label="Description" optional><textarea className="input" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={2000} /></Field>
      </div>
    </Modal>
  );
}
