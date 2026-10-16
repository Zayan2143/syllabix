import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ActiveTimer, ChapterStatus, StudyMethod, StudySession } from '../lib/types';
import { useData } from '../lib/store';
import { friendlyError } from '../lib/api';
import { CONFIDENCE_LABELS, METHODS, STATUSES } from '../lib/constants';
import { dayKey, fmtClock, timeOfDay, zonedToUtc } from '../lib/time';
import { minutesFromMs } from '../lib/stats';
import { Field, Modal, Rating, useToast } from './ui';

interface Props {
  open: boolean;
  onClose: () => void;
  /** edit an existing session */
  session?: StudySession | null;
  /** review a finished timer before saving */
  timer?: { row: ActiveTimer; elapsedMs: number; save: (s: Omit<StudySession, 'id' | 'user_id' | 'created_at'>) => Promise<StudySession> } | null;
  defaults?: { subject_id?: string; chapter_id?: string | null };
  onSaved?: (s: StudySession) => void;
}

export function SessionForm({ open, onClose, session, timer, defaults, onSaved }: Props) {
  const { data, d, insert, update } = useData();
  const toast = useToast();
  const subjects = data.subjects.filter((s) => !s.archived || s.id === session?.subject_id);

  const [subjectId, setSubjectId] = useState('');
  const [chapterId, setChapterId] = useState<string>('');
  const [date, setDate] = useState(d.today);
  const [time, setTime] = useState('16:00');
  const [minutes, setMinutes] = useState('30');
  const [method, setMethod] = useState<StudyMethod>('notes');
  const [attempted, setAttempted] = useState('');
  const [correct, setCorrect] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [newStatus, setNewStatus] = useState<ChapterStatus | ''>('');
  const [applyConfidence, setApplyConfidence] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null); setBusy(false); setNewStatus('');
    if (session) {
      setSubjectId(session.subject_id); setChapterId(session.chapter_id ?? '');
      setDate(dayKey(session.started_at, d.tz)); setTime(timeOfDay(session.started_at, d.tz));
      setMinutes(String(session.duration_min)); setMethod(session.method);
      setAttempted(session.questions_attempted?.toString() ?? ''); setCorrect(session.questions_correct?.toString() ?? '');
      setConfidence(session.confidence); setNotes(session.notes ?? ''); setApplyConfidence(false);
    } else if (timer) {
      setSubjectId(timer.row.subject_id); setChapterId(timer.row.chapter_id ?? '');
      setDate(dayKey(timer.row.started_at, d.tz)); setTime(timeOfDay(timer.row.started_at, d.tz));
      setMinutes(String(Math.max(1, minutesFromMs(timer.elapsedMs)))); setMethod(timer.row.method);
      setAttempted(''); setCorrect(''); setConfidence(null); setNotes(''); setApplyConfidence(true);
    } else {
      const sid = defaults?.subject_id ?? subjects[0]?.id ?? '';
      setSubjectId(sid); setChapterId(defaults?.chapter_id ?? '');
      setDate(d.today);
      const now = timeOfDay(new Date(Date.now() - 30 * 60000), d.tz);
      setTime(now); setMinutes('30'); setMethod('notes');
      setAttempted(''); setCorrect(''); setConfidence(null); setNotes(''); setApplyConfidence(true);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const chapters = useMemo(() => data.chapters.filter((c) => c.subject_id === subjectId), [data.chapters, subjectId]);
  const chapter = chapterId ? d.chapterById.get(chapterId) : null;
  const tooShort = !!timer && minutesFromMs(timer.elapsedMs) < 1;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const mins = Number(minutes);
    const att = attempted === '' ? null : Number(attempted);
    const cor = correct === '' ? null : Number(correct);
    if (!subjectId) return setErr('Choose a subject.');
    if (!Number.isInteger(mins) || mins < 1 || mins > 1440) return setErr('Duration must be between 1 and 1440 minutes.');
    if (att != null && (!Number.isInteger(att) || att < 0)) return setErr('Questions attempted must be a whole number.');
    if (cor != null && (!Number.isInteger(cor) || cor < 0)) return setErr('Questions correct must be a whole number.');
    if (cor != null && att == null) return setErr('Enter how many questions you attempted.');
    if (cor != null && att != null && cor > att) return setErr('Correct answers can’t be more than attempted.');
    const start = timer ? new Date(timer.row.started_at) : zonedToUtc(date, time, d.tz);
    if (!timer && start.getTime() > Date.now() + 60_000) return setErr('That start time is in the future.');

    const row = {
      subject_id: subjectId,
      chapter_id: chapterId || null,
      started_at: start.toISOString(),
      ended_at: timer ? new Date().toISOString() : new Date(start.getTime() + mins * 60000).toISOString(),
      duration_min: mins,
      method,
      questions_attempted: att,
      questions_correct: cor,
      confidence,
      notes: notes.trim() || null,
      source: (timer ? 'timer' : session?.source ?? 'manual') as 'timer' | 'manual',
    };
    setBusy(true); setErr(null);
    try {
      let saved: StudySession;
      if (session) saved = await update('study_sessions', session.id, row);
      else if (timer) saved = await timer.save(row);
      else saved = await insert('study_sessions', row);
      // optional chapter updates
      if (chapter && (newStatus || (applyConfidence && confidence != null && confidence !== chapter.confidence))) {
        const patch: { status?: ChapterStatus; confidence?: number } = {};
        if (newStatus) patch.status = newStatus;
        if (applyConfidence && confidence != null) patch.confidence = confidence;
        try { await update('chapters', chapter.id, patch); } catch (e2) { toast('Session saved, but the chapter could not be updated: ' + friendlyError(e2), 'error'); }
      }
      toast(session ? 'Session updated.' : `Saved ${mins} min of study.`);
      onSaved?.(saved);
      onClose();
    } catch (e2) { setErr(friendlyError(e2)); setBusy(false); }
  }

  const title = session ? 'Edit study session' : timer ? 'Review your session' : 'Log a study session';
  return (
    <Modal open={open} onClose={onClose} title={title} width={600} dismissable={!busy}
      footer={<>
        <button className="btn" type="button" onClick={onClose} disabled={busy}>{timer ? 'Back to timer' : 'Cancel'}</button>
        <button className="btn btn-primary" form="session-form" disabled={busy || !subjects.length}>{busy ? 'Saving…' : timer ? 'Save session' : session ? 'Save changes' : 'Save session'}</button>
      </>}>
      {!subjects.length ? <div className="notice warn"><AlertTriangle size={18} />Add a subject first, then you can log study time.</div> : (
        <form id="session-form" onSubmit={submit} className="grid-form">
          {timer && (
            <div className="span-2 notice plain">
              <div>Timed: <b className="tabular">{fmtClock(timer.elapsedMs)}</b> (paused time not included). {tooShort
                ? 'That’s under a minute — save it as 1 minute or go back and discard it.'
                : 'Adjust the minutes below if you forgot to pause.'}</div>
            </div>
          )}
          <Field label="Subject">
            <select className="input" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setChapterId(''); }} required>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}{s.archived ? ' (archived)' : ''}</option>)}
            </select>
          </Field>
          <Field label="Chapter or topic" optional>
            <select className="input" value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
              <option value="">Whole subject / general</option>
              {chapters.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </Field>
          {!timer && (
            <>
              <Field label="Date"><input className="input" type="date" value={date} max={d.today} onChange={(e) => setDate(e.target.value)} required /></Field>
              <Field label="Start time" hint={`Your timezone: ${d.tz.replace(/_/g, ' ')}`}><input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} required /></Field>
            </>
          )}
          <Field label="Duration (minutes)">
            <input className="input" type="number" inputMode="numeric" min={1} max={1440} value={minutes} onChange={(e) => setMinutes(e.target.value)} required />
          </Field>
          <Field label="Study method">
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value as StudyMethod)}>
              {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </Field>
          <Field label="Questions attempted" optional>
            <input className="input" type="number" inputMode="numeric" min={0} value={attempted} onChange={(e) => setAttempted(e.target.value)} placeholder="—" />
          </Field>
          <Field label="Questions correct" optional>
            <input className="input" type="number" inputMode="numeric" min={0} value={correct} onChange={(e) => setCorrect(e.target.value)} placeholder="—" />
          </Field>
          <div className="span-2">
            <Field label="How confident do you feel about this topic now?" optional>
              <Rating value={confidence} onChange={setConfidence} labels={CONFIDENCE_LABELS} name="Confidence" />
            </Field>
          </div>
          {chapter && (
            <div className="span-2 stack-sm" style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 10 }}>
              <b className="small">Update “{chapter.title}”</b>
              <div className="row">
                <span className="small muted">Status:</span>
                <select className="input" style={{ width: 'auto', height: 32 }} value={newStatus} onChange={(e) => setNewStatus(e.target.value as ChapterStatus | '')}>
                  <option value="">Keep as {STATUSES.find((s) => s.value === chapter.status)?.label}</option>
                  {STATUSES.filter((s) => s.value !== chapter.status).map((s) => <option key={s.value} value={s.value}>Change to {s.label}</option>)}
                </select>
              </div>
              {confidence != null && (
                <label className="check"><input type="checkbox" checked={applyConfidence} onChange={(e) => setApplyConfidence(e.target.checked)} />Set the chapter’s confidence to {confidence}/5</label>
              )}
            </div>
          )}
          <div className="span-2">
            <Field label="Notes" optional>
              <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} placeholder="What did you cover? What was tricky?" />
            </Field>
          </div>
          {err && <div className="form-error span-2">{err}</div>}
        </form>
      )}
    </Modal>
  );
}
