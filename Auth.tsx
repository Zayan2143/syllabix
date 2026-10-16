import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, Mail } from 'lucide-react';
import { api, friendlyError } from '../lib/api';
import { useAuth } from '../lib/store';
import { browserTimeZone } from '../lib/time';
import { DEFAULT_TIMEZONE, TAGLINE } from '../lib/constants';
import { Logo } from '../components/Logo';
import { Field, useToast } from '../components/ui';

function AuthShell({ title, sub, children, foot }: { title: string; sub?: string; children: ReactNode; foot?: ReactNode }) {
  return (
    <div className="auth">
      <div className="auth-side">
        <div className="auth-brand"><Logo size={40} /><span>Syllabix</span></div>
        <div className="auth-pitch">
          <h2>{TAGLINE}</h2>
          <p>A study tracker built for Cambridge IGCSE and O-Level students.</p>
          <ul>
            <li><CheckCircle2 size={18} />Enter your syllabus chapter by chapter</li>
            <li><CheckCircle2 size={18} />Time every study session — pauses never count</li>
            <li><CheckCircle2 size={18} />See exactly which topics need revision</li>
            <li><CheckCircle2 size={18} />Count down to every exam paper</li>
          </ul>
        </div>
        <div className="auth-foot">Free for students · Your data stays private to your account</div>
      </div>
      <div className="auth-main">
        <div className="auth-card">
          <div className="auth-mobile-brand"><Logo size={36} /><span>Syllabix</span></div>
          <h1>{title}</h1>
          {sub && <p className="auth-sub">{sub}</p>}
          {children}
        </div>
        {foot && <div className="auth-below">{foot}</div>}
      </div>
    </div>
  );
}

function PasswordInput({ value, onChange, autoComplete, id }: { value: string; onChange: (v: string) => void; autoComplete: string; id?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-wrap">
      <input id={id} className="input" type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required minLength={8} />
      <button type="button" className="input-icon" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

function GoogleButton() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <button type="button" className="btn btn-google" disabled={busy} onClick={async () => {
        setBusy(true); setErr(null);
        try { await api.auth.signInWithGoogle(); } catch (e) { setErr(friendlyError(e)); setBusy(false); }
      }}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
        Continue with Google
      </button>
      {err && <div className="form-error">{err}</div>}
    </>
  );
}

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const toast = useToast();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr(null); setUnconfirmed(false);
    try { await api.auth.signIn(email.trim(), password); }
    catch (e2) {
      const m = friendlyError(e2);
      setErr(m); setUnconfirmed(/confirm your email/.test(m));
      setBusy(false);
    }
  }
  return (
    <AuthShell title="Welcome back" sub="Log in to continue studying." foot={<>New to Syllabix? <Link to="/signup">Create a free account</Link></>}>
      <GoogleButton />
      <div className="or"><span>or</span></div>
      <form onSubmit={submit} className="stack">
        <Field label="Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></Field>
        <Field label={<span className="label-row">Password<Link to="/forgot" className="small">Forgot password?</Link></span>}>
          <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
        </Field>
        {err && <div className="form-error">{err}{unconfirmed && <> <button type="button" className="link-btn" onClick={async () => {
          try { await api.auth.resendConfirmation(email.trim()); toast('Confirmation email sent again.'); } catch (e3) { toast(friendlyError(e3), 'error'); }
        }}>Resend link</button></>}</div>}
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
    </AuthShell>
  );
}

export function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const toast = useToast();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (password.length < 8) { setErr('Password must be at least 8 characters.'); return; }
    setBusy(true); setErr(null);
    try {
      // New accounts start in Asia/Riyadh time (changeable in Settings)
      const tz = DEFAULT_TIMEZONE || browserTimeZone();
      const r = await api.auth.signUp(email.trim(), password, name.trim(), tz);
      if (r.needsConfirm) setSent(true);
    } catch (e2) { setErr(friendlyError(e2)); }
    setBusy(false);
  }

  if (sent) return (
    <AuthShell title="Check your email" foot={<Link to="/login">Back to log in</Link>}>
      <div className="notice"><Mail size={20} /><div>We sent a confirmation link to <b>{email}</b>. Open it to activate your account, then log in. It can take a minute — check spam too.</div></div>
      <button className="btn" onClick={async () => {
        try { await api.auth.resendConfirmation(email.trim()); toast('Sent again.'); } catch (e2) { toast(friendlyError(e2), 'error'); }
      }}>Resend email</button>
    </AuthShell>
  );

  return (
    <AuthShell title="Create your account" sub="Free, private, and takes less than a minute." foot={<>Already have an account? <Link to="/login">Log in</Link></>}>
      <GoogleButton />
      <div className="or"><span>or</span></div>
      <form onSubmit={submit} className="stack">
        <Field label="Your name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={60} /></Field>
        <Field label="Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></Field>
        <Field label="Password" hint="At least 8 characters.">
          <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
        </Field>
        {err && <div className="form-error">{err}</div>}
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
    </AuthShell>
  );
}

export function ForgotPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr(null);
    try { await api.auth.sendReset(email.trim()); setSent(true); } catch (e2) { setErr(friendlyError(e2)); }
    setBusy(false);
  }
  return (
    <AuthShell title="Reset your password" sub={sent ? undefined : 'Enter your email and we’ll send you a reset link.'} foot={<Link to="/login">Back to log in</Link>}>
      {sent ? (
        <div className="notice"><Mail size={20} /><div>If an account exists for <b>{email}</b>, a reset link is on its way. Open it on this device to choose a new password.</div></div>
      ) : (
        <form onSubmit={submit} className="stack">
          <Field label="Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></Field>
          {err && <div className="form-error">{err}</div>}
          <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const { user, ready, clearRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();
  const toast = useToast();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (password.length < 8) return setErr('Password must be at least 8 characters.');
    if (password !== confirm) return setErr('The two passwords don’t match.');
    setBusy(true); setErr(null);
    try { await api.auth.updatePassword(password); clearRecovery(); toast('Password updated.'); nav('/', { replace: true }); }
    catch (e2) { setErr(friendlyError(e2)); setBusy(false); }
  }

  if (ready && !user) return (
    <AuthShell title="Link expired" sub="This reset link is invalid or has expired." foot={<Link to="/login">Back to log in</Link>}>
      <Link to="/forgot" className="btn btn-primary btn-lg">Send a new link</Link>
    </AuthShell>
  );
  return (
    <AuthShell title="Choose a new password">
      <form onSubmit={submit} className="stack">
        <Field label="New password" hint="At least 8 characters."><PasswordInput value={password} onChange={setPassword} autoComplete="new-password" /></Field>
        <Field label="Confirm new password"><PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" /></Field>
        {err && <div className="form-error">{err}</div>}
        <button className="btn btn-primary btn-lg" disabled={busy || !ready}>{busy ? 'Saving…' : 'Save password'}</button>
      </form>
    </AuthShell>
  );
}
