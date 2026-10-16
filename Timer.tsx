import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Check, Info, Pause, Play, Trash2 } from 'lucide-react';
import { useData } from '../lib/store';
import { useStudyTimer } from '../lib/useTimer';
import { friendlyError } from '../lib/api';
import { METHODS, methodLabel } from '../lib/constants';
import { fmtClock, fmtMinutes } from '../lib/time';
import type { StudyMethod } from '../lib/types';
import { Card, Dot, EmptyState, Field, useConfirm, useToast } from '../components/ui';
import { SessionForm } from '../components/SessionForm';
import { SessionRow } from '../components/bits';

export function TimerPage() {
  const { data, d } = useData();
  const t = useStudyTimer();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const subjects = d.activeSubjects;

  const [subjectId, setSubjectId] = useState(params.get('subject') ?? subjects[0]?.id ?? '');
  const [chapterId, setChapterId] = useState(params.get('chapter') ?? '');
  const [method, setMethod] = useState<StudyMethod>('notes');
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => { if (!subjects.some((s) => s.id === subjectId) && subjects[0]) setSubjectId(subjects[0].id); }, [subjects, subjectId]);
  const chapters = useMemo(() => data.chapters.filter((c) => c.subject_id === subjectId), [data.chapters, subjectId]);

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (e) { toast(friendlyError(e), 'error'); }
    setBusy(false);
  };

  // keep the browser tab title showing the running time
  useEffect(() => {
    if (!t.timer) { document.title = 'Study Timer · Syllabix'; return; }
    document.title = `${t.running ? '▶' : '❚❚'} ${fmtClock(t.elapsedMs)} · Syllabix`;
  }, [t.timer, t.running, Math.floor(t.elapsedMs / 1000)]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!subjects.length) {
    return <Card><EmptyState icon={<BookOpen size={22} />} title="Add a subject first" text="The timer records study time against a subject (and optionally a chapter)." action={<Link className="btn btn-primary" to="/subjects">Go to My Subjects</Link>} /></Card>;
  }

  const timer = t.timer;
  const tSubject = timer ? d.subjectById.get(timer.subject_id) : null;
  const tChapter = timer?.chapter_id ? d.chapterById.get(timer.chapter_id) : null;
  const todayMin = d.byDay.get(d.today) ?? 0;
  const todays = data.sessions.filter((s) => s.started_at >= new Date(Date.now() - 36 * 3600000).toISOString()).slice(0, 6);

  return (
    <div className="timer-layout">
      <div className="col">
        <div className="card timer-card">
          {timer ? (
            <>
              <div className={'timer-state ' + (t.running ? 'running' : 'paused')}>{t.running ? <><span className="pulse" />Studying</> : <><Pause size={13} />Paused — paused time isn’t counted</>}</div>
              <div className="timer-face" aria-live="off">{fmtClock(t.elapsedMs)}</div>
              <div className="timer-what">
                {tSubject && <><Dot color={tSubject.color} /> <b>{tSubject.name}</b></>}
                {tChapter && <>· {tChapter.title}</>}
                <span className="tag">{methodLabel(timer.method)}</span>
              </div>
              <div className="timer-ctl">
                {t.running
                  ? <button className="btn" disabled={busy} onClick={() => run(t.pause)}><Pause size={18} />Pause</button>
                  : <button className="btn btn-primary" disabled={busy} onClick={() => run(t.resume)}><Play size={18} />Resume</button>}
                <button className="btn btn-success" disabled={busy} onClick={() => run(async () => { await t.pause(); setReviewing(true); })}><Check size={18} />Finish</button>
              </div>
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={async () => {
                if (await confirm({ title: 'Discard this session?', message: `The ${fmtClock(t.elapsedMs)} on the timer won’t be saved.`, confirmLabel: 'Discard', danger: true })) run(t.discard);
              }}><Trash2 size={14} />Discard</button>
              <p className="muted small" style={{ margin: 0, maxWidth: 380 }}>
                <Info size={13} style={{ verticalAlign: -2 }} /> You can close this tab or switch devices — the timer keeps going and is saved to your account.
              </p>
            </>
          ) : (
            <>
              <div className="timer-state">Ready</div>
              <div className="timer-face" style={{ color: 'var(--text-3)' }}>00:00</div>
              <div className="timer-setup stack">
                <Field label="Subject">
                  <select className="input" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setChapterId(''); }}>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
                <Field label="Chapter or topic" optional>
                  <select className="input" value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
                    <option value="">Whole subject / general</option>
                    {chapters.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </Field>
                <Field label="Study method">
                  <select className="input" value={method} onChange={(e) => setMethod(e.target.value as StudyMethod)}>
                    {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </Field>
              </div>
              <div className="timer-ctl">
                <button className="btn btn-primary" disabled={busy || !subjectId} onClick={() => run(() => t.start(subjectId, chapterId || null, method))}><Play size={18} />Start</button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="col">
        <Card title="Today">
          <div className="row-between"><span className="muted">Studied today</span><b className="tabular">{fmtMinutes(todayMin)}{data.profile.daily_goal_min ? <span className="muted" style={{ fontWeight: 500 }}> / {fmtMinutes(data.profile.daily_goal_min)}</span> : null}</b></div>
        </Card>
        <Card title="Recent sessions" action={<Link to="/log" className="card-link">Study log →</Link>}>
          {todays.length ? <div className="list">{todays.map((s) => <SessionRow key={s.id} s={s} />)}</div>
            : <p className="muted small" style={{ margin: 0 }}>Finished sessions appear here.</p>}
        </Card>
        <Card title="How the timer works">
          <ul className="muted small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            <li>Only running time counts. Pauses are left out.</li>
            <li>Press <b>Finish</b> to review and save. Nothing is saved until you do.</li>
            <li>Each timer session can only be saved once, even if you press Save twice or lose connection.</li>
            <li>Forgot to start it? Use <Link to="/log">Log session</Link> to add time manually.</li>
          </ul>
        </Card>
      </div>

      {timer && (
        <SessionForm open={reviewing} onClose={() => setReviewing(false)}
          timer={{ row: timer, elapsedMs: t.elapsedMs, save: t.saveSession }}
          onSaved={() => nav('/')} />
      )}
    </div>
  );
}
