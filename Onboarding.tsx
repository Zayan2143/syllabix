import { useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Plus, Trash2 } from 'lucide-react';
import { useData } from '../lib/store';
import { api, friendlyError } from '../lib/api';
import { allTimeZones } from '../lib/time';
import { MAX_SUBJECTS, TAGLINE, WEEKDAYS } from '../lib/constants';
import { Logo } from '../components/Logo';
import { Dot, Field, useConfirm, useToast } from '../components/ui';
import { SubjectForm } from '../components/SubjectForm';

export function Onboarding() {
  const { data, updateProfile, remove } = useData();
  const p = data.profile;
  const [step, setStep] = useState(0);
  const [name, setName] = useState(p.display_name);
  const [tz, setTz] = useState(p.timezone);
  const [weekStart, setWeekStart] = useState(p.week_start);
  const [daily, setDaily] = useState<string>(p.daily_goal_min ? String(p.daily_goal_min) : '');
  const [weekly, setWeekly] = useState<string>(p.weekly_goal_min ? String(p.weekly_goal_min) : '');
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const zones = allTimeZones();

  async function save(patch: Parameters<typeof updateProfile>[0], next: number) {
    if (busy) return;
    setBusy(true);
    try { await updateProfile(patch); setStep(next); } catch (e) { toast(friendlyError(e), 'error'); }
    setBusy(false);
  }

  const steps = ['About you', 'Study goals', 'Your subjects'];

  return (
    <div className="onboard">
      <div className="onboard-top">
        <div className="auth-brand"><Logo size={32} /><span>Syllabix</span></div>
        <button className="btn btn-ghost btn-sm" onClick={() => api.auth.signOut()}>Log out</button>
      </div>
      <div className="onboard-card">
        <div className="steps">
          {steps.map((s, i) => (
            <div key={s} className={'step' + (i === step ? ' on' : i < step ? ' done' : '')}><span>{i + 1}</span>{s}</div>
          ))}
        </div>

        {step === 0 && (
          <div className="stack">
            <div>
              <h1>Welcome to Syllabix</h1>
              <p className="muted">{TAGLINE} Let’s set things up — it takes about a minute.</p>
            </div>
            <Field label="What should we call you?"><input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Your name" autoFocus /></Field>
            <div className="grid-2">
              <Field label="Timezone" hint="Used to decide which day each study session belongs to.">
                <select className="input" value={tz} onChange={(e) => setTz(e.target.value)}>
                  {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
                </select>
              </Field>
              <Field label="Week starts on" hint="For weekly totals and goals.">
                <select className="input" value={weekStart} onChange={(e) => setWeekStart(Number(e.target.value))}>
                  {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </Field>
            </div>
            <div className="row-end">
              <button className="btn btn-primary" disabled={busy} onClick={() => save({ display_name: name.trim(), timezone: tz, week_start: weekStart }, 1)}>
                Continue <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="stack">
            <div>
              <h1>Set your study goals</h1>
              <p className="muted">Optional — you can change or switch these off any time in Settings.</p>
            </div>
            <div className="grid-2">
              <Field label="Daily goal (minutes)" optional hint="e.g. 60 for one hour a day">
                <input className="input" type="number" inputMode="numeric" min={1} max={1440} value={daily} onChange={(e) => setDaily(e.target.value)} placeholder="60" />
              </Field>
              <Field label="Weekly goal (minutes)" optional hint="e.g. 420 for seven hours a week">
                <input className="input" type="number" inputMode="numeric" min={1} max={10080} value={weekly} onChange={(e) => setWeekly(e.target.value)} placeholder="420" />
              </Field>
            </div>
            <div className="row-between">
              <button className="btn btn-ghost" onClick={() => setStep(0)}><ArrowLeft size={16} />Back</button>
              <div className="row">
                <button className="btn" onClick={() => setStep(2)}>Skip</button>
                <button className="btn btn-primary" disabled={busy} onClick={() => save({
                  daily_goal_min: daily ? Math.min(1440, Math.max(1, Number(daily))) : null,
                  weekly_goal_min: weekly ? Math.min(10080, Math.max(1, Number(weekly))) : null,
                }, 2)}>Continue <ArrowRight size={16} /></button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="stack">
            <div>
              <h1>Add your subjects</h1>
              <p className="muted">Up to {MAX_SUBJECTS} subjects. You’ll add each subject’s chapters next — straight from your own syllabus.</p>
            </div>
            <div className="onboard-subjects">
              {data.subjects.map((s) => (
                <div key={s.id} className="ob-subject">
                  <Dot color={s.color} />
                  <div className="grow"><b>{s.name}</b><span className="muted"> · {s.qualification}{s.syllabus_code ? ` · ${s.syllabus_code}` : ''}</span></div>
                  <button className="icon-btn" aria-label={`Remove ${s.name}`} onClick={async () => {
                    if (await confirm({ title: `Remove ${s.name}?`, message: 'This subject has no chapters or study time yet.', confirmLabel: 'Remove', danger: true })) {
                      try { await remove('subjects', s.id); } catch (e) { toast(friendlyError(e), 'error'); }
                    }
                  }}><Trash2 size={16} /></button>
                </div>
              ))}
              {data.subjects.length < MAX_SUBJECTS ? (
                <button className="ob-add" onClick={() => setAdding(true)}><Plus size={18} />Add a subject</button>
              ) : <div className="notice">You’ve added the maximum of {MAX_SUBJECTS} subjects.</div>}
              <div className="muted small">{data.subjects.length} of {MAX_SUBJECTS} subjects</div>
            </div>
            <div className="row-between">
              <button className="btn btn-ghost" onClick={() => setStep(1)}><ArrowLeft size={16} />Back</button>
              <button className="btn btn-primary" disabled={busy} onClick={() => save({ onboarded: true }, 2)}>
                <BookOpen size={16} />{data.subjects.length ? 'Go to my dashboard' : 'Skip for now'}
              </button>
            </div>
          </div>
        )}
      </div>
      <SubjectForm open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
