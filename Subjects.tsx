import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, ArchiveRestore, BookOpen, Info, Pencil, Plus, Trash2 } from 'lucide-react';
import { useData } from '../lib/store';
import { MAX_SUBJECTS } from '../lib/constants';
import { fmtMinutes } from '../lib/time';
import type { Subject } from '../lib/types';
import { Card, EmptyState, Progress } from '../components/ui';
import { SubjectForm } from '../components/SubjectForm';
import { useSubjectActions } from '../components/subjectActions';
import { MiniRating } from '../components/bits';

export function Subjects() {
  const { data, d } = useData();
  const [editing, setEditing] = useState<Subject | null>(null);
  const [adding, setAdding] = useState(false);
  const { toggleArchive, deleteSubject } = useSubjectActions();
  const count = data.subjects.length;
  const full = count >= MAX_SUBJECTS;
  const active = data.subjects.filter((s) => !s.archived);
  const archived = data.subjects.filter((s) => s.archived);

  const card = (s: Subject) => {
    const st = d.subjectStats.get(s.id)!;
    return (
      <div key={s.id} className="card subject-card" style={{ ['--subject' as string]: s.color, opacity: s.archived ? 0.75 : 1 }}>
        <div className="sc-head">
          <Link to={`/subjects/${s.id}`} className="grow" style={{ color: 'inherit', textDecoration: 'none' }}>
            <div className="sc-name">{s.name}{s.short_code && <span className="muted" style={{ fontWeight: 500 }}> · {s.short_code}</span>}</div>
            <div className="sc-meta">{s.exam_board} · {s.qualification}{s.syllabus_code ? ` · ${s.syllabus_code}` : ''}</div>
            {(s.exam_session || s.exam_year) && <div className="sc-meta">Exams: {[s.exam_session, s.exam_year].filter(Boolean).join(' ')}</div>}
          </Link>
          <div className="row" style={{ gap: 0 }}>
            <button className="icon-btn" title="Edit" aria-label={`Edit ${s.name}`} onClick={() => setEditing(s)}><Pencil size={15} /></button>
            <button className="icon-btn" title={s.archived ? 'Restore' : 'Archive'} aria-label={s.archived ? 'Restore' : 'Archive'} onClick={() => toggleArchive(s)}>{s.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}</button>
            <button className="icon-btn danger" title="Delete" aria-label={`Delete ${s.name}`} onClick={() => deleteSubject(s)}><Trash2 size={15} /></button>
          </div>
        </div>
        <div>
          <div className="sc-nums" style={{ marginBottom: 6 }}><span><b>{st.pct}%</b> complete</span><span><b>{st.mastered}</b> of {st.total} chapters mastered</span></div>
          <Progress value={st.pct} color={s.color} />
        </div>
        <div className="sc-nums">
          <span>Studied <b>{fmtMinutes(st.minutes)}</b></span>
          <span className="row" style={{ gap: 6 }}>Confidence <MiniRating value={st.avgConfidence != null ? Math.round(st.avgConfidence) : null} /></span>
        </div>
        <div className="sc-foot">
          {s.archived && <span className="tag">Archived</span>}
          {st.needsRevision > 0 && <span className="tag warn">{st.needsRevision} need revision</span>}
          {st.avgDifficulty != null && <span className="tag">Avg difficulty {st.avgDifficulty.toFixed(1)}/5</span>}
          <Link to={`/subjects/${s.id}`} className="tag info" style={{ marginLeft: 'auto' }}>Open chapters →</Link>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="page-actions">
        <div className="row">
          <b style={{ fontSize: 15 }}>{count} of {MAX_SUBJECTS} subjects</b>
          <div style={{ width: 120 }}><Progress value={(count / MAX_SUBJECTS) * 100} size="sm" color={full ? 'var(--warn)' : 'var(--accent)'} /></div>
        </div>
        <button className="btn btn-primary" disabled={full} onClick={() => setAdding(true)} title={full ? 'You have reached the 6-subject limit' : undefined}><Plus size={16} />Add subject</button>
      </div>

      {full && (
        <div className="notice warn" style={{ marginBottom: 16 }}>
          <Info size={18} />
          <div>You’ve reached the limit of {MAX_SUBJECTS} subjects. To swap one, <b>delete</b> it with the bin icon, then add the new subject. Archived subjects still count — archiving hides a subject but keeps its history.</div>
        </div>
      )}

      {!count ? (
        <Card><EmptyState icon={<BookOpen size={22} />} title="No subjects yet" text={`Add up to ${MAX_SUBJECTS} subjects you’re taking this exam season.`} action={<button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={16} />Add your first subject</button>} /></Card>
      ) : (
        <>
          <div className="subject-cards">
            {active.map(card)}
            {!full && <button className="add-card" onClick={() => setAdding(true)}><Plus size={20} />Add subject<span className="muted small" style={{ fontWeight: 500 }}>{MAX_SUBJECTS - count} slot{MAX_SUBJECTS - count === 1 ? '' : 's'} left</span></button>}
          </div>
          {archived.length > 0 && (
            <>
              <div className="section-title">Archived</div>
              <div className="subject-cards">{archived.map(card)}</div>
            </>
          )}
        </>
      )}

      <SubjectForm open={adding} onClose={() => setAdding(false)} />
      <SubjectForm open={!!editing} subject={editing} onClose={() => setEditing(null)} />
    </>
  );
}
