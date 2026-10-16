import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Download, LogOut, Monitor, Moon, Sun, Smartphone } from 'lucide-react';
import { useAuth, useData } from '../lib/store';
import { api, friendlyError } from '../lib/api';
import { allTimeZones, fmtLongToday } from '../lib/time';
import { WEEKDAYS } from '../lib/constants';
import type { Profile, ThemePref } from '../lib/types';
import { Card, Field, useConfirm, useToast } from '../components/ui';

function Section({ id, title, children, className }: { id: string; title: string; children: ReactNode; className?: string }) {
  return <section id={id} className="settings-section"><Card title={title} className={className}>{children}</Card></section>;
}

const numOrNull = (v: string, max: number) => (v.trim() === '' ? null : Math.min(max, Math.max(1, Math.round(Number(v)))));

export function SettingsPage() {
  const { data, updateProfile } = useData();
  const { user } = useAuth();
  const p = data.profile;
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => { if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView(); }, []);

  async function save(patch: Partial<Profile>, msg = 'Saved.') {
    try { await updateProfile(patch); toast(msg); return true; } catch (e) { toast(friendlyError(e), 'error'); return false; }
  }

  // ---------- profile
  const [name, setName] = useState(p.display_name);
  const [tz, setTz] = useState(p.timezone);
  const [ws, setWs] = useState(p.week_start);
  // ---------- goals
  const [daily, setDaily] = useState(p.daily_goal_min?.toString() ?? '');
  const [weekly, setWeekly] = useState(p.weekly_goal_min?.toString() ?? '');
  const [chap, setChap] = useState(p.weekly_chapters_goal?.toString() ?? '');
  const [streakMin, setStreakMin] = useState(String(p.streak_min_minutes));
  // ---------- revision
  const [lowConf, setLowConf] = useState(p.rev_low_confidence);
  const [stale, setStale] = useState(String(p.rev_stale_days));
  const [flagDiff, setFlagDiff] = useState(p.rev_flag_difficult);
  const [flagPrac, setFlagPrac] = useState(p.rev_flag_no_practice);
  // ---------- password
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  const isGoogle = user?.provider === 'google';
  const zones = allTimeZones();

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return toast('Password must be at least 8 characters.', 'error');
    if (pw !== pw2) return toast('The two passwords don’t match.', 'error');
    setPwBusy(true);
    try { await api.auth.updatePassword(pw); setPw(''); setPw2(''); toast('Password changed.'); } catch (e2) { toast(friendlyError(e2), 'error'); }
    setPwBusy(false);
  }

  function exportData() {
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), ...data }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `syllabix-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function deleteAccount() {
    const ok = await confirm({
      title: 'Delete your account?', danger: true, confirmLabel: 'Delete my account forever', requireText: 'DELETE',
      message: <>This permanently deletes your login and <b>everything</b> stored in Syllabix:
        <ul><li>{data.subjects.length} subjects and {data.chapters.length} chapters (with notes and ratings)</li><li>{data.sessions.length} study sessions</li><li>{data.exams.length} exams and their revision lists</li><li>Your goals and settings</li></ul>
        <p style={{ marginBottom: 0 }}>This can’t be undone. You may want to download a copy of your data first.</p></>,
    });
    if (!ok) return;
    try { await api.deleteAccount(); } catch (e) { toast(friendlyError(e), 'error'); }
  }

  return (
    <div className="settings-grid">
      <nav className="settings-nav">
        {[['profile', 'Profile'], ['appearance', 'Appearance'], ['goals', 'Study goals'], ['revision', 'Revision rules'], ['account', 'Account & security'], ['app', 'Install the app'], ['data', 'Your data']].map(([id, label]) => (
          <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); history.replaceState(null, '', `#${id}`); }}>{label}</a>
        ))}
      </nav>

      <div className="stack">
        <Section id="profile" title="Profile">
          <form className="stack" onSubmit={(e) => { e.preventDefault(); save({ display_name: name.trim(), timezone: tz, week_start: ws }, 'Profile saved.'); }}>
            <div className="grid-2">
              <Field label="Display name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Field>
              <Field label="Email"><input className="input" value={user?.email ?? ''} disabled /></Field>
              <Field label="Timezone" hint={`Today there: ${fmtLongToday(tz)}. Decides which day each session counts towards.`}>
                <select className="input" value={tz} onChange={(e) => setTz(e.target.value)}>
                  {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
                </select>
              </Field>
              <Field label="Week starts on" hint="Used for weekly totals and goals.">
                <select className="input" value={ws} onChange={(e) => setWs(Number(e.target.value))}>
                  {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </Field>
            </div>
            <div className="row-end"><button className="btn btn-primary">Save profile</button></div>
          </form>
        </Section>

        <Section id="appearance" title="Appearance">
          <div className="row">
            {([['system', 'Match device', Monitor], ['light', 'Light', Sun], ['dark', 'Dark', Moon]] as [ThemePref, string, typeof Sun][]).map(([v, label, Icon]) => (
              <button key={v} className={'btn' + (p.theme === v ? ' btn-primary' : '')} onClick={() => save({ theme: v }, 'Theme updated.')}><Icon size={16} />{label}</button>
            ))}
          </div>
        </Section>

        <Section id="goals" title="Study goals">
          <form className="stack" onSubmit={(e) => {
            e.preventDefault();
            save({ daily_goal_min: numOrNull(daily, 1440), weekly_goal_min: numOrNull(weekly, 10080), weekly_chapters_goal: numOrNull(chap, 100), streak_min_minutes: numOrNull(streakMin, 600) ?? 15 }, 'Goals saved.');
          }}>
            <p className="muted small" style={{ margin: 0 }}>Leave a box empty to switch that goal off. Per-subject weekly targets are set when you edit a subject.</p>
            <div className="grid-3">
              <Field label="Daily study (minutes)"><input className="input" type="number" inputMode="numeric" min={1} max={1440} value={daily} onChange={(e) => setDaily(e.target.value)} placeholder="Off" /></Field>
              <Field label="Weekly study (minutes)"><input className="input" type="number" inputMode="numeric" min={1} max={10080} value={weekly} onChange={(e) => setWeekly(e.target.value)} placeholder="Off" /></Field>
              <Field label="Chapters mastered per week"><input className="input" type="number" inputMode="numeric" min={1} max={100} value={chap} onChange={(e) => setChap(e.target.value)} placeholder="Off" /></Field>
            </div>
            <Field label="Streak rule: minimum minutes for a day to count" hint="Missing a day just resets the counter — no penalties.">
              <input className="input" style={{ maxWidth: 200 }} type="number" inputMode="numeric" min={1} max={600} value={streakMin} onChange={(e) => setStreakMin(e.target.value)} />
            </Field>
            <div className="row-end"><button className="btn btn-primary">Save goals</button></div>
          </form>
        </Section>

        <Section id="revision" title="Revision rules">
          <form className="stack" onSubmit={(e) => {
            e.preventDefault();
            const days = stale.trim() === '' ? 0 : Math.min(365, Math.max(0, Math.round(Number(stale))));
            save({ rev_low_confidence: lowConf, rev_stale_days: days, rev_flag_difficult: flagDiff, rev_flag_no_practice: flagPrac }, 'Revision rules saved.');
          }}>
            <p className="muted small" style={{ margin: 0 }}>Chapters marked “Needs Revision” always appear. Choose what else the Revision Centre should flag:</p>
            <div className="grid-2">
              <Field label="Low confidence: flag when confidence is at or below">
                <select className="input" value={lowConf} onChange={(e) => setLowConf(Number(e.target.value))}>
                  <option value={0}>Off</option>{[1, 2, 3].map((n) => <option key={n} value={n}>{n} out of 5</option>)}
                </select>
              </Field>
              <Field label="Not studied recently: flag after this many days" hint="Applies to chapters you’ve started. 0 = off.">
                <input className="input" type="number" inputMode="numeric" min={0} max={365} value={stale} onChange={(e) => setStale(e.target.value)} />
              </Field>
            </div>
            <label className="check"><input type="checkbox" checked={flagDiff} onChange={(e) => setFlagDiff(e.target.checked)} />Flag chapters I’ve rated difficult (4/5 or higher)</label>
            <label className="check"><input type="checkbox" checked={flagPrac} onChange={(e) => setFlagPrac(e.target.checked)} />Flag chapters I’m learning or have learned but haven’t logged any practice questions for</label>
            <div className="row-end"><button className="btn btn-primary">Save rules</button></div>
          </form>
        </Section>

        <Section id="account" title="Account & security">
          <div className="stack">
            {isGoogle ? (
              <p className="muted small" style={{ margin: 0 }}>You sign in with Google, so your password is managed by your Google account.</p>
            ) : (
              <form className="stack" onSubmit={changePassword}>
                <div className="grid-2">
                  <Field label="New password" hint="At least 8 characters."><input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" minLength={8} /></Field>
                  <Field label="Confirm new password"><input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></Field>
                </div>
                <div className="row-end"><button className="btn" disabled={!pw || pwBusy}>{pwBusy ? 'Saving…' : 'Change password'}</button></div>
              </form>
            )}
            <div className="row-between" style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div><b>Log out</b><div className="muted small">Your data stays saved. Log in again on any device.</div></div>
              <button className="btn" onClick={() => api.auth.signOut()}><LogOut size={16} />Log out</button>
            </div>
            <p className="muted small" style={{ margin: 0 }}>Forgot your password? Log out and use “Forgot password?” on the login page to get a reset email.</p>
          </div>
        </Section>

        <Section id="app" title="Install the app">
          <div className="stack-sm small">
            <p style={{ margin: 0 }}>Syllabix works in any browser. You can also add it to your home screen so it opens like an app:</p>
            <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}><Monitor size={16} style={{ marginTop: 2 }} /><div><b>Chrome on a computer:</b> click the install icon at the right end of the address bar (or ⋮ menu → <i>Cast, save and share</i> → <i>Install page as app</i>).</div></div>
            <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}><Smartphone size={16} style={{ marginTop: 2 }} /><div><b>Android (Chrome):</b> ⋮ menu → <i>Add to home screen</i> → <i>Install</i>. <b>iPhone (Safari):</b> Share → <i>Add to Home Screen</i>.</div></div>
            <p className="muted" style={{ margin: 0 }}>To bookmark it instead, press Ctrl+D (Windows) or ⌘+D (Mac).</p>
          </div>
        </Section>

        <Section id="data" title="Your data" className="danger-zone">
          <div className="stack">
            <div className="row-between">
              <div><b>Download your data</b><div className="muted small">All your subjects, chapters, sessions and exams as a JSON file.</div></div>
              <button className="btn" onClick={exportData}><Download size={16} />Download</button>
            </div>
            <div className="row-between" style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div><b style={{ color: 'var(--danger-text)' }}>Delete account</b><div className="muted small">Permanently deletes your login and all study data.</div></div>
              <button className="btn btn-danger" onClick={deleteAccount}>Delete account</button>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
