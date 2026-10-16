import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { AuthProvider, DataProvider, useAuth, useData } from './lib/store';
import { api } from './lib/api';
import { ConfirmProvider, Spinner, ToastProvider } from './components/ui';
import { Layout } from './components/Layout';
import { Logo } from './components/Logo';
import { LoginPage, SignupPage, ForgotPage, ResetPasswordPage } from './pages/Auth';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';

const Subjects = lazy(() => import('./pages/Subjects').then((m) => ({ default: m.Subjects })));
const SubjectDetail = lazy(() => import('./pages/SubjectDetail').then((m) => ({ default: m.SubjectDetail })));
const ChapterDetail = lazy(() => import('./pages/ChapterDetail').then((m) => ({ default: m.ChapterDetail })));
const TimerPage = lazy(() => import('./pages/Timer').then((m) => ({ default: m.TimerPage })));
const StudyLog = lazy(() => import('./pages/StudyLog').then((m) => ({ default: m.StudyLog })));
const Statistics = lazy(() => import('./pages/Statistics').then((m) => ({ default: m.Statistics })));
const Revision = lazy(() => import('./pages/Revision').then((m) => ({ default: m.Revision })));
const Exams = lazy(() => import('./pages/Exams').then((m) => ({ default: m.Exams })));
const SettingsPage = lazy(() => import('./pages/Settings').then((m) => ({ default: m.SettingsPage })));

function useThemeSync() {
  useEffect(() => {
    const apply = () => {
      let t = 'system';
      try { t = localStorage.getItem('syllabix-theme') || 'system'; } catch { /* ignore */ }
      const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    window.addEventListener('syllabix-theme', apply);
    return () => { mq.removeEventListener('change', apply); window.removeEventListener('syllabix-theme', apply); };
  }, []);
}

export default function App() {
  useThemeSync();
  if (!api.configured) return <SetupNeeded />;
  return (
    <BrowserRouter>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
              <Route path="/signup" element={<PublicOnly><SignupPage /></PublicOnly>} />
              <Route path="/forgot" element={<PublicOnly><ForgotPage /></PublicOnly>} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/*" element={<Private />} />
            </Routes>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="fullscreen"><Logo size={44} />{children}</div>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, ready, recovery } = useAuth();
  if (!ready) return <FullScreen><Spinner /></FullScreen>;
  if (recovery) return <Navigate to="/reset-password" replace />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function Private() {
  const { user, ready, recovery } = useAuth();
  const loc = useLocation();
  if (!ready) return <FullScreen><Spinner label="Loading Syllabix…" /></FullScreen>;
  if (recovery) return <Navigate to="/reset-password" replace />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return (
    <DataProvider key={user.id} fallback={({ error, retry }) => (
      <FullScreen>
        {error ? (
          <div className="load-error">
            <AlertTriangle size={20} /><p>{error}</p>
            <div className="row"><button className="btn btn-primary" onClick={retry}>Try again</button><button className="btn" onClick={() => api.auth.signOut()}>Log out</button></div>
          </div>
        ) : <Spinner label="Loading your syllabus…" />}
      </FullScreen>
    )}>
      <Gate />
    </DataProvider>
  );
}

function Gate() {
  const { data } = useData();
  if (!data.profile.onboarded) return <Onboarding />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="subjects" element={<Lazy><Subjects /></Lazy>} />
        <Route path="subjects/:id" element={<Lazy><SubjectDetail /></Lazy>} />
        <Route path="subjects/:id/chapters/:chapterId" element={<Lazy><ChapterDetail /></Lazy>} />
        <Route path="timer" element={<Lazy><TimerPage /></Lazy>} />
        <Route path="log" element={<Lazy><StudyLog /></Lazy>} />
        <Route path="stats" element={<Lazy><Statistics /></Lazy>} />
        <Route path="revision" element={<Lazy><Revision /></Lazy>} />
        <Route path="exams" element={<Lazy><Exams /></Lazy>} />
        <Route path="settings" element={<Lazy><SettingsPage /></Lazy>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="page-loading"><Spinner /></div>}>{children}</Suspense>;
}

function SetupNeeded() {
  return (
    <FullScreen>
      <div className="load-error" style={{ maxWidth: 460, textAlign: 'left' }}>
        <h2 style={{ margin: '4px 0 8px' }}>Syllabix isn’t connected to its database yet</h2>
        <p>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> as environment variables
          (in Vercel: Project → Settings → Environment Variables), then redeploy. See the README for the full steps.</p>
      </div>
    </FullScreen>
  );
}
