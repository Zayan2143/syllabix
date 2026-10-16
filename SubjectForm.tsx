import { useEffect, useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import type { Subject } from '../lib/types';
import { EXAM_BOARDS, EXAM_SESSIONS, MAX_SUBJECTS, QUALIFICATIONS, SUBJECT_COLORS } from '../lib/constants';
import { friendlyError } from '../lib/api';
import { useData } from '../lib/store';
import { Field, Modal, useToast } from './ui';

type Draft = Pick<Subject, 'name' | 'short_code' | 'exam_board' | 'qualification' | 'syllabus_code' | 'exam_session' | 'exam_year' | 'exam_date' | 'color' | 'weekly_target_min'>;

const blank = (color: string): Draft => ({
  name: '', short_code: null, exam_board: 'Cambridge International', qualification: 'IGCSE', syllabus_code: null,
  exam_session: 'May/June', exam_year: new Date().getFullYear() + 1, exam_date: null, color, weekly_target_min: null,
});

export function SubjectForm({ open, onClose, subject, onSaved }: { open: boolean; onClose: () => void; subject?: Subject | null; onSaved?: (s: Subject) => void }) {
  const { data, insert, update } = useData();
  const toast = useToast();
  const nextColor = SUBJECT_COLORS.find((c) => !data.subjects.some((s) => s.color === c)) ?? SUBJECT_COLORS[data.subjects.length % SUBJECT_COLORS.length];
  const [f, setF] = useState<Draft>(blank(nextColor));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setF(subject ? {
      name: subject.name, short_code: subject.short_code, exam_board: subject.exam_board, qualification: subject.qualification,
      syllabus_code: subject.syllabus_code, exam_session: subject.exam_session, exam_year: subject.exam_year, exam_date: subject.exam_date,
      color: subject.color, weekly_target_min: subject.weekly_target_min,
    } : blank(nextColor));
  }, [open, subject]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setF((x) => ({ ...x, [k]: v }));
  const atLimit = !subject && data.subjects.length >= MAX_SUBJECTS;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const name = f.name.trim();
    if (!name) return setErr('Please enter a subject name.');
    if (f.exam_year != null && (f.exam_year < 2000 || f.exam_year > 2100)) return setErr('Exam year looks wrong.');
    setBusy(true); setErr(null);
    const row = {
      ...f, name,
      short_code: f.short_code?.trim() || null,
      syllabus_code: f.syllabus_code?.trim() || null,
      exam_date: f.exam_date || null,
    };
    try {
      const saved = subject
        ? await update('subjects', subject.id, row)
        : await insert('subjects', { ...row, position: Math.max(-1, ...data.subjects.map((s) => s.position)) + 1 });
      toast(subject ? 'Subject updated.' : `${name} added.`);
      onSaved?.(saved);
      onClose();
    } catch (e2) { setErr(friendlyError(e2)); }
    setBusy(false);
  }

  return (
    <Modal open={open} onClose={onClose} title={subject ? 'Edit subject' : 'Add a subject'} width={560}
      footer={<>
        <button className="btn" type="button" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" form="subject-form" disabled={busy || atLimit}>{busy ? 'Saving…' : subject ? 'Save changes' : 'Add subject'}</button>
      </>}>
      {atLimit ? (
        <div className="notice warn">You already have {MAX_SUBJECTS} subjects. Delete one in My Subjects to free a slot.</div>
      ) : (
        <form id="subject-form" onSubmit={submit} className="grid-form">
          <div className="span-2"><Field label="Subject name"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Physics" maxLength={80} required autoFocus /></Field></div>
          <Field label="Short code" optional hint="Shown on small screens, e.g. PHY"><input className="input" value={f.short_code ?? ''} onChange={(e) => set('short_code', e.target.value)} maxLength={12} /></Field>
          <Field label="Syllabus code" optional hint="From your syllabus document, e.g. 0625"><input className="input" value={f.syllabus_code ?? ''} onChange={(e) => set('syllabus_code', e.target.value)} maxLength={20} /></Field>
          <Field label="Qualification">
            <select className="input" value={f.qualification} onChange={(e) => set('qualification', e.target.value)}>
              {QUALIFICATIONS.map((q) => <option key={q}>{q}</option>)}
            </select>
          </Field>
          <Field label="Exam board">
            <select className="input" value={f.exam_board} onChange={(e) => set('exam_board', e.target.value)}>
              {EXAM_BOARDS.map((q) => <option key={q}>{q}</option>)}
            </select>
          </Field>
          <Field label="Exam session" optional>
            <select className="input" value={f.exam_session ?? ''} onChange={(e) => set('exam_session', e.target.value || null)}>
              <option value="">Not set</option>
              {EXAM_SESSIONS.map((q) => <option key={q}>{q}</option>)}
            </select>
          </Field>
          <Field label="Exam year" optional>
            <input className="input" type="number" inputMode="numeric" value={f.exam_year ?? ''} onChange={(e) => set('exam_year', e.target.value ? Number(e.target.value) : null)} min={2000} max={2100} />
          </Field>
          <Field label="First exam date" optional hint="Entered by you — check your official timetable.">
            <input className="input" type="date" value={f.exam_date ?? ''} onChange={(e) => set('exam_date', e.target.value || null)} />
          </Field>
          <Field label="Weekly study target" optional hint="Minutes per week for this subject">
            <input className="input" type="number" inputMode="numeric" min={1} max={10080} value={f.weekly_target_min ?? ''} onChange={(e) => set('weekly_target_min', e.target.value ? Math.max(1, Number(e.target.value)) : null)} placeholder="e.g. 180" />
          </Field>
          <div className="span-2">
            <span className="field-label">Colour</span>
            <div className="swatches">
              {SUBJECT_COLORS.map((c) => (
                <button type="button" key={c} className={'swatch' + (f.color === c ? ' on' : '')} style={{ background: c }} onClick={() => set('color', c)} aria-label={`Colour ${c}`}>
                  {f.color === c && <Check size={14} color="#fff" />}
                </button>
              ))}
            </div>
          </div>
          {err && <div className="form-error span-2">{err}</div>}
        </form>
      )}
    </Modal>
  );
}
