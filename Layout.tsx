import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, Clock3, BarChart3, RotateCcw, CalendarDays, Settings, Play, Pause, LogOut,
  MoreHorizontal, Timer as TimerIcon, ChevronDown, X,
} from 'lucide-react';
import { useAuth, useData } from '../lib/store';
import { useStudyTimer } from '../lib/useTimer';
import { api } from '../lib/api';
import { fmtClock, fmtLongToday } from '../lib/time';
import { Logo } from './Logo';

export const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/subjects', label: 'My Subjects', icon: BookOpen },
  { to: '/log', label: 'Study Log', icon: Clock3 },
  { to: '/stats', label: 'Statistics', icon: BarChart3 },
  { to: '/revision', label: 'Revision Centre', icon: RotateCcw },
  { to: '/exams', label: 'Exam Planner', icon: CalendarDays },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function titleFor(path: string): string {
  if (path.startsWith('/subjects/') && path.includes('/chapters/')) return 'Chapter';
  if (path.startsWith('/subjects/')) return 'Subject';
  if (path.startsWith('/timer')) return 'Study Timer';
  return NAV.find((n) => (n.end ? path === n.to : path.startsWith(n.to)))?.label ?? 'Syllabix';
}

export function Layout() {
  const { data, d } = useData();
  const loc = useLocation();
  const title = titleFor(loc.pathname);
  const [more, setMore] = useState(false);
  useEffect(() => { document.title = `${title} · Syllabix`; setMore(false); window.scrollTo(0, 0); }, [title, loc.pathname]);

  return (
    <div className="app">
      <aside className="sidebar">
        <Link to="/" className="brand"><Logo size={30} /><span>Syllabix</span></Link>
        <TimerButton />
        <nav className="side-nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => 'side-link' + (isActive ? ' active' : '')}>
              <n.icon size={18} /><span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div className="side-tag">Your syllabus.<br />Your progress.<br />Your results.</div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <Link to="/" className="brand brand-mobile"><Logo size={26} /></Link>
            <div>
              <h1 className="page-title">{title}</h1>
              <div className="page-date">{fmtLongToday(d.tz)}</div>
            </div>
          </div>
          <div className="topbar-right">
            <TimerPill />
            <ProfileMenu name={data.profile.display_name} />
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Main">
        {[NAV[0], NAV[1]].map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => 'bn-link' + (isActive ? ' active' : '')}>
            <n.icon size={20} /><span>{n.to === '/' ? 'Home' : 'Subjects'}</span>
          </NavLink>
        ))}
        <NavLink to="/timer" className={({ isActive }) => 'bn-link bn-timer' + (isActive ? ' active' : '')}>
          <span className="bn-timer-btn"><TimerIcon size={22} /></span><span>Study</span>
        </NavLink>
        <NavLink to="/log" className={({ isActive }) => 'bn-link' + (isActive ? ' active' : '')}><Clock3 size={20} /><span>Log</span></NavLink>
        <button className={'bn-link' + (more ? ' active' : '')} onClick={() => setMore(true)}><MoreHorizontal size={20} /><span>More</span></button>
      </nav>

      {more && (
        <div className="sheet-backdrop" onClick={() => setMore(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head"><b>More</b><button className="icon-btn" onClick={() => setMore(false)} aria-label="Close"><X size={18} /></button></div>
            {NAV.slice(3).map((n) => (
              <NavLink key={n.to} to={n.to} className="sheet-link"><n.icon size={19} />{n.label}</NavLink>
            ))}
            <button className="sheet-link" onClick={() => api.auth.signOut()}><LogOut size={19} />Log out</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TimerButton() {
  const { timer, running, elapsedMs } = useStudyTimer();
  const nav = useNavigate();
  return (
    <button className={'btn btn-primary side-cta' + (timer ? ' active-timer' : '')} onClick={() => nav('/timer')}>
      {timer ? (running ? <><span className="pulse" />{fmtClock(elapsedMs)} · studying</> : <><Pause size={16} />{fmtClock(elapsedMs)} · paused</>)
        : <><Play size={16} />Start studying</>}
    </button>
  );
}

function TimerPill() {
  const { timer, running, elapsedMs } = useStudyTimer();
  const { d } = useData();
  const loc = useLocation();
  if (!timer || loc.pathname === '/timer') return null;
  const s = d.subjectById.get(timer.subject_id);
  return (
    <Link to="/timer" className={'timer-pill' + (running ? ' running' : '')} title="Open study timer">
      {running ? <span className="pulse" /> : <Pause size={13} />}
      <span className="tp-time">{fmtClock(elapsedMs)}</span>
      {s && <span className="tp-subj">{s.short_code || s.name}</span>}
    </Link>
  );
}

function ProfileMenu({ name }: { name: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const display = name || user?.email?.split('@')[0] || 'Student';
  return (
    <div className="profile" ref={ref}>
      <button className="profile-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        <Avatar name={display} />
        <span className="profile-name">{display}</span>
        <ChevronDown size={15} className="profile-chev" />
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head"><b>{display}</b><span>{user?.email}</span></div>
          <Link to="/settings" className="menu-item" role="menuitem" onClick={() => setOpen(false)}><Settings size={16} />Settings</Link>
          <button className="menu-item" role="menuitem" onClick={() => api.auth.signOut()}><LogOut size={16} />Log out</button>
        </div>
      )}
    </div>
  );
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'S';
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }}>{initials}</span>;
}

export function PageActions({ children }: { children: ReactNode }) {
  return <div className="page-actions">{children}</div>;
}
