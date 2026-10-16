import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, friendlyError } from './api';
import type { ActiveTimer, AllData, AuthUser, Chapter, Exam, ExamTopic, Profile, StudySession, Subject, TableName, TableRows } from './types';
import { chapterStatsMap, minutesByDay, subjectStatsMap, type ChapterStats, type SubjectStats } from './stats';
import { safeTz, todayKey } from './time';

// ================================================================ Auth
interface AuthState { user: AuthUser | null; ready: boolean; recovery: boolean; clearRecovery: () => void }
const AuthCtx = createContext<AuthState>({ user: null, ready: false, recovery: false, clearRecovery: () => {} });
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(() => /type=recovery/.test(window.location.hash));
  useEffect(() => {
    let alive = true;
    api.auth.getUser().then((u) => { if (alive) { setUser(u); setReady(true); } }).catch(() => alive && setReady(true));
    const off = api.auth.onChange((event, u) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setUser((prev) => (prev?.id === u?.id ? prev : u));
      setReady(true);
    });
    return () => { alive = false; off(); };
  }, []);
  const clearRecovery = useCallback(() => setRecovery(false), []);
  return <AuthCtx.Provider value={{ user, ready, recovery, clearRecovery }}>{children}</AuthCtx.Provider>;
}

// ================================================================ Data
const KEY: Record<TableName, 'subjects' | 'chapters' | 'sessions' | 'exams' | 'examTopics'> = {
  subjects: 'subjects', chapters: 'chapters', study_sessions: 'sessions', exams: 'exams', exam_topics: 'examTopics',
};

export interface Derived {
  tz: string;
  today: string;
  chapterStats: Map<string, ChapterStats>;
  subjectStats: Map<string, SubjectStats>;
  byDay: Map<string, number>;
  subjectById: Map<string, Subject>;
  chapterById: Map<string, Chapter>;
  activeSubjects: Subject[];
}

interface DataCtxValue {
  data: AllData;
  d: Derived;
  reload: () => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<Profile>;
  insert: <T extends TableName>(t: T, row: Partial<TableRows[T]>) => Promise<TableRows[T]>;
  update: <T extends TableName>(t: T, id: string, patch: Partial<TableRows[T]>) => Promise<TableRows[T]>;
  remove: (t: TableName, id: string) => Promise<void>;
  setTimer: (t: ActiveTimer | null) => void;
  addSession: (s: StudySession) => void;
}
const DataCtx = createContext<DataCtxValue | null>(null);
export function useData() {
  const v = useContext(DataCtx);
  if (!v) throw new Error('useData outside DataProvider');
  return v;
}

export function DataProvider({ children, fallback }: { children: ReactNode; fallback: (state: { error: string | null; retry: () => void }) => ReactNode }) {
  const [data, setData] = useState<AllData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const lastLoad = useRef(0);

  const reload = useCallback(async () => {
    try {
      const all = await api.loadAll();
      lastLoad.current = Date.now();
      setData(all); setError(null);
    } catch (e) { setError(friendlyError(e)); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Refresh when returning to the tab (picks up changes made on another device)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoad.current > 60_000) reload();
      if (document.visibilityState === 'visible') setTick((t) => t + 1); // re-evaluate "today"
    };
    document.addEventListener('visibilitychange', onVis);
    const iv = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => { document.removeEventListener('visibilitychange', onVis); clearInterval(iv); };
  }, [reload]);

  // Keep the local theme cache in step with the saved preference
  useEffect(() => {
    if (!data) return;
    try { localStorage.setItem('syllabix-theme', data.profile.theme); } catch { /* ignore */ }
    window.dispatchEvent(new Event('syllabix-theme'));
  }, [data?.profile.theme]); // eslint-disable-line react-hooks/exhaustive-deps

  const d = useMemo<Derived | null>(() => {
    if (!data) return null;
    const tz = safeTz(data.profile.timezone);
    return {
      tz,
      today: todayKey(tz),
      chapterStats: chapterStatsMap(data.sessions),
      subjectStats: subjectStatsMap(data.subjects, data.chapters, data.sessions),
      byDay: minutesByDay(data.sessions, tz),
      subjectById: new Map(data.subjects.map((s) => [s.id, s])),
      chapterById: new Map(data.chapters.map((c) => [c.id, c])),
      activeSubjects: data.subjects.filter((s) => !s.archived),
    };
  }, [data, tick]);

  const value = useMemo<DataCtxValue | null>(() => {
    if (!data || !d) return null;
    return {
      data, d, reload,
      async updateProfile(patch) {
        const p = await api.updateProfile(patch);
        setData((x) => (x ? { ...x, profile: p } : x));
        return p;
      },
      async insert(t, row) {
        const r = await api.insert(t, row);
        setData((x) => {
          if (!x) return x;
          const list = [...(x[KEY[t]] as unknown[]), r];
          if (t === 'study_sessions') (list as StudySession[]).sort((a, b) => b.started_at.localeCompare(a.started_at));
          return { ...x, [KEY[t]]: list };
        });
        return r;
      },
      async update(t, id, patch) {
        const r = await api.update(t, id, patch);
        setData((x) => {
          if (!x) return x;
          const list = (x[KEY[t]] as { id: string }[]).map((o) => (o.id === id ? r : o));
          if (t === 'study_sessions') (list as StudySession[]).sort((a, b) => b.started_at.localeCompare(a.started_at));
          if (t === 'chapters' || t === 'subjects') (list as (Chapter | Subject)[]).sort((a, b) => a.position - b.position);
          return { ...x, [KEY[t]]: list };
        });
        return r;
      },
      async remove(t, id) {
        await api.remove(t, id);
        // deleting can cascade (e.g. a subject's chapters/sessions), so re-read everything
        if (t === 'subjects' || t === 'chapters' || t === 'exams') await reload();
        else setData((x) => (x ? { ...x, [KEY[t]]: (x[KEY[t]] as { id: string }[]).filter((o) => o.id !== id) } : x));
      },
      setTimer(timer) { setData((x) => (x ? { ...x, timer } : x)); },
      addSession(s) {
        setData((x) => {
          if (!x) return x;
          if (x.sessions.some((o) => o.id === s.id)) return { ...x, timer: null };
          return { ...x, timer: null, sessions: [s, ...x.sessions].sort((a, b) => b.started_at.localeCompare(a.started_at)) };
        });
      },
    };
  }, [data, d, reload]);

  if (!value) return <>{fallback({ error, retry: reload })}</>;
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}

export type { Exam, ExamTopic };
