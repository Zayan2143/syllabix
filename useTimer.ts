import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { useData } from './store';
import type { ActiveTimer, StudyMethod, StudySession } from './types';
import { timerElapsedMs } from './stats';

/** Live study timer backed by the database, so it survives refreshes and works across devices. */
export function useStudyTimer() {
  const { data, setTimer, addSession } = useData();
  const timer = data.timer;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!timer?.running_since) return;
    setNow(Date.now());
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [timer?.running_since]);

  const elapsedMs = timer ? timerElapsedMs(timer, now) : 0;
  const running = !!timer?.running_since;

  const write = useCallback(async (patch: Partial<ActiveTimer>) => {
    const current = data.timer;
    // always send the whole row so the upsert is complete
    const row = { ...(current ?? {}), ...patch } as ActiveTimer;
    const saved = await api.saveTimer(row);
    setTimer(saved);
    return saved;
  }, [data.timer, setTimer]);

  const start = useCallback(async (subject_id: string, chapter_id: string | null, method: StudyMethod) => {
    const t = new Date().toISOString();
    return write({ subject_id, chapter_id, method, started_at: t, accumulated_ms: 0, running_since: t, session_id: crypto.randomUUID() });
  }, [write]);

  const pause = useCallback(async () => {
    if (!data.timer?.running_since) return data.timer;
    return write({ accumulated_ms: Math.round(timerElapsedMs(data.timer)), running_since: null });
  }, [data.timer, write]);

  const resume = useCallback(async () => {
    if (!data.timer || data.timer.running_since) return data.timer;
    return write({ running_since: new Date().toISOString() });
  }, [data.timer, write]);

  const discard = useCallback(async () => { await api.clearTimer(); setTimer(null); }, [setTimer]);

  const saveSession = useCallback(async (s: Omit<StudySession, 'id' | 'user_id' | 'created_at'>) => {
    if (!data.timer) throw new Error('No active session');
    const saved = await api.saveTimerSession({ ...s, id: data.timer.session_id });
    addSession(saved);
    return saved;
  }, [data.timer, addSession]);

  return { timer, elapsedMs, running, start, pause, resume, discard, saveSession, retarget: write };
}
