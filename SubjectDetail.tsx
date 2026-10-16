import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, BookOpen, CheckCircle2, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { useData } from '../lib/store';
import { friendlyError } from '../lib/api';
import { chStats } from '../lib/stats';
import { dayKey, fmtKey, fmtMinutes, relativeDays } from '../lib/time';
import { STATUSES } from '../lib/constants';
import type { Chapter, ChapterStatus } from '../lib/types';
import { Card, EmptyState, Ring, Segmented, StatusSelect, useConfirm, useToast } from '../components/ui';
import { MiniRating } from '../components/bits';
import { SubjectForm } from '../components/SubjectForm';
import { SessionForm } from '../components/SessionForm';
import { useSubjectActions } from '../components/subjectActions';

type Filter = 'all' | 'todo' | ChapterStatus;

export function SubjectDetail() {
  const { id } = useParams();
  const { data, d, insert, update, remove } = useData();
  const subject = d.subjectById.get(id!);
  const [editing, setEditing] = useState(false);
  const [logging, setLogging] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [title, setTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [moving, setMoving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const confirm = useConfirm();
  const nav = useNavigate();
  const { toggleArchive, deleteSubject } = useSubjectActions();

  const chapters = useMemo(() => data.chapters.filter((c) => c.subject_id === id).sort((a, b) => a.position - b.position), [data.chapters, id]);
  if (!subject) return <Navigate to="/subjects" replace />;
  const st = d.subjectStats.get(subject.id)!;
  const shown = chapters.filter((c) => filter === 'all' || (filter === 'todo' ? c.status !== 'mastered' : c.status === filter));

  async function addChapter(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || adding) return;
    setAdding(true);
    try {
      await insert('chapters', { subject_id: subject!.id, title: t, position: Math.max(-1, ...chapters.map((c) => c.position)) + 1 });
      setTitle('');
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch (e2) { toast(friendlyError(e2), 'error'); }
    setAdding(false);
  }

  async function move(c: Chapter, dir: -1 | 1) {
    const i = chapters.findIndex((x) => x.id === c.id);
    const other = chapters[i + dir];
    if (!other || moving) return;
    setMoving(true);
    try {
      // normalise positions so a swap is always clean
      const a = i, b = i + dir;
      await Promise.all([update('chapters', c.id, { position: b }), update('chapters', other.id, { position: a })]);
      const stray = chapters.filter((x, k) => x.position !== k && x.id !== c.id && x.id !== other.id);
      await Promise.all(stray.map((x) => update('chapters', x.id, { position: chapters.indexOf(x) })));
    } catch (e) { toast(friendlyError(e), 'error'); }
    setMoving(false);
  }

  async function setStatus(c: Chapter, status: ChapterStatus) {
    try { await update('chapters', c.id, { status }); if (status === 'mastered') toast(`“${c.title}” marked as mastered.`); }
    catch (e) { toast(friendlyError(e), 'error'); }
  }

  async function del(c: Chapter) {
    const s = chStats(d.chapterStats, c.id);
    if (!await confirm({
      title: `Delete “${c.title}”?`, danger: true, confirmLabel: 'Delete chapter',
      message: s.sessions ? <>Its notes, subtopics and ratings are deleted. Its <b>{s.sessions}</b> study session{s.sessions === 1 ? '' : 's'} ({fmtMinutes(s.minutes)}) stay in your log under “{subject!.name}”.</> : 'Its notes, subtopics and ratings will be deleted.',
    })) return;
    try { await remove('chapters', c.id); toast('Chapter deleted.'); } catch (e) { toast(friendlyError(e), 'error'); }
  }

  return (
    <>
      <div className="crumbs"><Link to="/subjects">My Subjects</Link>/<span>{subject.name}</span></div>
      <div className="card subject-hero" style={{ marginBottom: 14, borderTop: `4px solid ${subject.color}` }}>
        <Ring value={st.pct} size={74} stroke={8} color={subject.color}><span>{st.total ? `${st.pct}%` : '—'}</span></Ring>
        <div className="grow">
          <h2>{subject.name}{subject.archived && <span className="tag">Archived</span>}</h2>
          <div className="hero-meta">
            <span className="tag">{subject.exam_board}</span>
            <span className="tag">{subject.qualification}</span>
            {subject.syllabus_code && <span className="tag">Syllabus {subject.syllabus_code}</span>}
            {(subject.exam_session || subject.exam_year) && <span className="tag">{[subject.exam_session, subject.exam_year].filter(Boolean).join(' ')}</span>}
            {subject.exam_date && <span className="tag info" title="Entered by you">First exam {fmtKey(subject.exam_date, { year: true })}</span>}
          </div>
        </div>
        <div className="hero-stats">
          <div className="hero-stat"><b>{st.mastered}/{st.total}</b><span>Mastered</span></div>
          <div className="hero-stat"><b>{fmtMinutes(st.minutes)}</b><span>Studied</span></div>
          <div className="hero-stat"><b>{st.avgConfidence != null ? st.avgConfidence.toFixed(1) : '—'}</b><span>Avg confidence</span></div>
          <div className="hero-stat"><b>{st.avgDifficulty != null ? st.avgDifficulty.toFixed(1) : '—'}</b><span>Avg difficulty</span></div>
        </div>
      </div>

      <div className="page-actions">
        <Segmented<Filter> value={filter} onChange={setFilter} options={[
          { value: 'all', label: `All (${chapters.length})` },
          { value: 'todo', label: `To do (${chapters.length - st.mastered})` },
          { value: 'needs_revision', label: `Revise (${st.needsRevision})` },
          { value: 'mastered', label: `Mastered (${st.mastered})` },
        ]} />
        <div className="row">
          <button className="btn btn-sm" onClick={() => setEditing(true)}><Pencil size={14} />Edit</button>
          <button className="btn btn-sm" onClick={() => toggleArchive(subject)}>{subject.archived ? <><ArchiveRestore size={14} />Restore</> : <><Archive size={14} />Archive</>}</button>
          <button className="btn btn-sm" onClick={() => deleteSubject(subject, '/subjects')}><Trash2 size={14} />Delete</button>
          <button className="btn btn-sm" onClick={() => setLogging(true)}><Plus size={14} />Log session</button>
          <button className="btn btn-sm btn-primary" onClick={() => nav(`/timer?subject=${subject.id}`)}><Play size={14} />Study</button>
        </div>
      </div>

      <Card pad={false}>
        {chapters.length === 0 ? (
          <EmptyState icon={<BookOpen size={22} />} title="Add this subject’s chapters"
            text="Type each chapter or topic from your syllabus below and press Enter. Syllabix doesn’t pre-fill syllabus content, so your list always matches the syllabus you’re actually following." />
        ) : shown.length === 0 ? (
          <EmptyState icon={<CheckCircle2 size={22} />} title="Nothing here" text="No chapters match this filter." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="hide-mobile">#</th><th>Chapter</th><th>Status</th>
                  <th className="hide-mobile">Confidence</th><th className="hide-mobile">Difficulty</th>
                  <th className="num">Time</th><th className="hide-mobile">Last studied</th><th className="hide-mobile num">Practice</th>
                  <th className="hide-mobile" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => {
                  const s = chStats(d.chapterStats, c.id);
                  const idx = chapters.indexOf(c);
                  const subDone = c.subtopics.filter((x) => x.done).length;
                  return (
                    <tr key={c.id} className={c.status === 'mastered' ? 'is-mastered' : undefined}>
                      <td className="ch-num hide-mobile">{idx + 1}</td>
                      <td style={{ minWidth: 160 }}>
                        <Link to={`/subjects/${subject.id}/chapters/${c.id}`} className="ch-title">{c.status === 'mastered' && <CheckCircle2 size={14} style={{ verticalAlign: -2, marginRight: 4 }} />}{c.title}</Link>
                        {c.subtopics.length > 0 && <div className="ch-sub">{subDone}/{c.subtopics.length} subtopics done</div>}
                      </td>
                      <td><StatusSelect value={c.status} onChange={(v) => setStatus(c, v)} /></td>
                      <td className="hide-mobile"><MiniRating value={c.confidence} /></td>
                      <td className="hide-mobile"><MiniRating value={c.difficulty} /></td>
                      <td className="num">{s.minutes ? fmtMinutes(s.minutes) : <span className="muted">—</span>}</td>
                      <td className="hide-mobile nowrap">{s.lastStudied ? relativeDays(dayKey(s.lastStudied, d.tz), d.today) : <span className="muted">Never</span>}</td>
                      <td className="hide-mobile num">{s.attempted ? `${s.correct}/${s.attempted}` : <span className="muted">—</span>}</td>
                      <td className="hide-mobile nowrap" style={{ textAlign: 'right' }}>
                        {filter === 'all' && (
                          <span className="reorder">
                            <button className="icon-btn" disabled={idx === 0 || moving} onClick={() => move(c, -1)} aria-label="Move up"><ArrowUp size={13} /></button>
                            <button className="icon-btn" disabled={idx === chapters.length - 1 || moving} onClick={() => move(c, 1)} aria-label="Move down"><ArrowDown size={13} /></button>
                          </span>
                        )}
                        <button className="icon-btn danger" onClick={() => del(c)} aria-label={`Delete ${c.title}`}><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <form className="quick-add" onSubmit={addChapter}>
          <input ref={inputRef} className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Add chapter ${chapters.length + 1} — e.g. “${['Motion, forces and energy', 'Algebra and graphs', 'Stoichiometry'][chapters.length % 3]}”`} maxLength={160} />
          <button className="btn btn-primary" disabled={!title.trim() || adding}><Plus size={16} />Add</button>
        </form>
      </Card>
      <p className="muted small" style={{ marginTop: 10 }}>
        Completion counts chapters marked <b>Mastered</b> only. Statuses: {STATUSES.map((s) => s.label).join(' → ')}. Open a chapter to add subtopics, notes and ratings.
      </p>

      <SubjectForm open={editing} subject={subject} onClose={() => setEditing(false)} />
      <SessionForm open={logging} onClose={() => setLogging(false)} defaults={{ subject_id: subject.id }} />
    </>
  );
}
