// DEMO-ONLY backend used by `npm run demo` for local testing and screenshots.
// It keeps data in this browser only. Production builds never include it.
import type { Api } from './api';
import type { ActiveTimer, AllData, Chapter, Profile, StudySession, Subject, TableName, TableRows } from './types';

const KEY = 'syllabix-demo-db';
const USER = { id: 'demo-user', email: 'student@example.com', provider: 'email' };

interface DB { signedIn: boolean; profile: Profile; rows: { [K in TableName]: TableRows[K][] }; timer: ActiveTimer | null }

const uuid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

function freshProfile(): Profile {
  return {
    id: USER.id, display_name: '', timezone: 'Asia/Riyadh', week_start: 0, theme: 'system', onboarded: false,
    daily_goal_min: null, weekly_goal_min: null, weekly_chapters_goal: null, streak_min_minutes: 15,
    rev_low_confidence: 2, rev_stale_days: 14, rev_flag_difficult: false, rev_flag_no_practice: false, created_at: nowIso(),
  };
}
const empty = (): DB => ({ signedIn: false, profile: freshProfile(), rows: { subjects: [], chapters: [], study_sessions: [], exams: [], exam_topics: [] }, timer: null });

function load(): DB {
  try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch { /* ignore */ }
  return empty();
}
let db = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* ignore */ } };
const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 120));
const listeners = new Set<(e: string, u: typeof USER | null) => void>();

function defaults(table: TableName, row: Record<string, unknown>): Record<string, unknown> {
  const base = { id: uuid(), user_id: USER.id, created_at: nowIso(), updated_at: nowIso() };
  switch (table) {
    case 'subjects': return { ...base, short_code: null, exam_board: 'Cambridge International', qualification: 'IGCSE', syllabus_code: null, exam_session: null, exam_year: null, exam_date: null, color: '#2563EB', weekly_target_min: null, archived: false, position: 0, ...row };
    case 'chapters': return { ...base, description: null, position: 0, subtopics: [], status: 'not_started', difficulty: null, confidence: null, notes: null, mastered_at: null, ...row };
    case 'study_sessions': return { ...base, chapter_id: null, ended_at: null, method: 'notes', questions_attempted: null, questions_correct: null, confidence: null, notes: null, source: 'manual', ...row };
    case 'exams': return { ...base, subject_id: null, paper: null, exam_board: null, exam_time: null, notes: null, date_checked: false, date_source: null, ...row };
    case 'exam_topics': return { ...base, done: false, deadline: null, ...row };
  }
}

function mastered(prev: Chapter | null, next: Chapter) {
  if (next.status === 'mastered') { if (!prev || prev.status !== 'mastered') next.mastered_at = nowIso(); }
  else next.mastered_at = null;
}

function cascadeDelete(table: TableName, id: string) {
  const r = db.rows;
  if (table === 'subjects') {
    const chs = r.chapters.filter((c) => c.subject_id === id).map((c) => c.id);
    r.chapters = r.chapters.filter((c) => c.subject_id !== id);
    r.study_sessions = r.study_sessions.filter((s) => s.subject_id !== id);
    r.exam_topics = r.exam_topics.filter((t) => !chs.includes(t.chapter_id));
    r.exams = r.exams.map((e) => (e.subject_id === id ? { ...e, subject_id: null } : e));
    if (db.timer?.subject_id === id) db.timer = null;
  }
  if (table === 'chapters') {
    r.study_sessions = r.study_sessions.map((s) => (s.chapter_id === id ? { ...s, chapter_id: null } : s));
    r.exam_topics = r.exam_topics.filter((t) => t.chapter_id !== id);
  }
  if (table === 'exams') r.exam_topics = r.exam_topics.filter((t) => t.exam_id !== id);
}

export function createMockApi(): Api {
  if (new URLSearchParams(location.search).has('seed')) { db = seed(); save(); }
  if (new URLSearchParams(location.search).has('fresh')) { db = { ...empty(), signedIn: true }; save(); }
  return {
    configured: true,
    auth: {
      async getUser() { return db.signedIn ? USER : null; },
      onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
      async signUp(_e, _p, name, tz) { db = { ...empty(), signedIn: true }; db.profile.display_name = name; db.profile.timezone = tz; save(); listeners.forEach((l) => l('SIGNED_IN', USER)); return { needsConfirm: false }; },
      async signIn() { db.signedIn = true; save(); listeners.forEach((l) => l('SIGNED_IN', USER)); },
      async signInWithGoogle() { db.signedIn = true; save(); listeners.forEach((l) => l('SIGNED_IN', USER)); },
      async signOut() { db.signedIn = false; save(); listeners.forEach((l) => l('SIGNED_OUT', null)); },
      async sendReset() { await delay(0); },
      async updatePassword() { await delay(0); },
      async resendConfirmation() { await delay(0); },
    },
    async loadAll(): Promise<AllData> {
      const r = db.rows;
      return delay({
        profile: db.profile,
        subjects: [...r.subjects].sort((a, b) => a.position - b.position),
        chapters: [...r.chapters].sort((a, b) => a.position - b.position),
        sessions: [...r.study_sessions].sort((a, b) => b.started_at.localeCompare(a.started_at)),
        timer: db.timer, exams: r.exams, examTopics: r.exam_topics,
      });
    },
    async updateProfile(patch) { db.profile = { ...db.profile, ...patch }; save(); return delay(db.profile); },
    async insert(table, row) {
      if (table === 'subjects' && db.rows.subjects.length >= 6) throw new Error('SUBJECT_LIMIT');
      const full = defaults(table, row as Record<string, unknown>) as never;
      if (table === 'chapters') mastered(null, full);
      (db.rows[table] as unknown[]).push(full); save();
      return delay(full);
    },
    async update(table, id, patch) {
      const list = db.rows[table] as unknown as Record<string, unknown>[];
      const i = list.findIndex((x) => x.id === id);
      if (i < 0) throw new Error('Not found');
      const next = { ...list[i], ...patch, updated_at: nowIso() };
      if (table === 'chapters' && 'status' in patch) mastered(list[i] as unknown as Chapter, next as unknown as Chapter);
      list[i] = next; save();
      return delay(next as never);
    },
    async remove(table, id) {
      (db.rows as Record<string, { id: string }[]>)[table] = (db.rows as Record<string, { id: string }[]>)[table].filter((x) => x.id !== id);
      cascadeDelete(table, id); save(); await delay(0);
    },
    async getTimer() { return delay(db.timer); },
    async saveTimer(row) {
      db.timer = { user_id: USER.id, method: 'notes', chapter_id: null, started_at: nowIso(), accumulated_ms: 0, running_since: null, session_id: uuid(), ...(db.timer ?? {}), ...row } as ActiveTimer;
      save(); return delay(db.timer);
    },
    async clearTimer() { db.timer = null; save(); },
    async saveTimerSession(s) {
      let row = db.rows.study_sessions.find((x) => x.id === s.id);
      if (!row) { row = defaults('study_sessions', s) as unknown as StudySession; db.rows.study_sessions.push(row); }
      db.timer = null; save(); return delay(row);
    },
    async deleteAccount() { db = empty(); save(); listeners.forEach((l) => l('SIGNED_OUT', null)); },
  };
}

// ------------------------------------------------------------------ demo data
function seed(): DB {
  const d = empty();
  d.signedIn = true;
  Object.assign(d.profile, { display_name: 'Shoaib', onboarded: true, daily_goal_min: 90, weekly_goal_min: 600, weekly_chapters_goal: 2 });
  const day = 86400000;
  const subjects: [string, string, string, string, string[]][] = [
    ['Physics', '0625', '#2563EB', 'PHY', ['General physics: measurement', 'Motion, forces and energy', 'Thermal physics', 'Waves', 'Electricity and magnetism', 'Nuclear physics', 'Space physics']],
    ['Mathematics', '0580', '#16A34A', 'MTH', ['Number', 'Algebra and graphs', 'Coordinate geometry', 'Geometry', 'Mensuration', 'Trigonometry', 'Vectors and transformations', 'Probability', 'Statistics']],
    ['Chemistry', '0620', '#7C3AED', 'CHM', ['States of matter', 'Atoms, elements and compounds', 'Stoichiometry', 'Electrochemistry', 'Chemical energetics', 'Acids, bases and salts', 'Organic chemistry']],
    ['Computer Science', '0478', '#0891B2', 'CS', ['Data representation', 'Data transmission', 'Hardware', 'Software', 'Algorithm design', 'Programming', 'Databases', 'Boolean logic']],
    ['English Language', '0500', '#DB2777', 'ENG', ['Reading comprehension', 'Summary writing', 'Directed writing', 'Descriptive writing', 'Narrative writing']],
  ];
  const statuses: Chapter['status'][] = ['mastered', 'mastered', 'practising', 'needs_revision', 'learning', 'practising', 'not_started', 'not_started', 'not_started'];
  let rnd = 7;
  const rand = () => { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280; };
  subjects.forEach(([name, code, color, short, chs], si) => {
    const s = defaults('subjects', { name, syllabus_code: code, color, short_code: short, position: si, exam_session: 'May/June', exam_year: 2027, weekly_target_min: si === 0 ? 180 : null }) as unknown as Subject;
    d.rows.subjects.push(s);
    chs.forEach((title, ci) => {
      const status = statuses[(ci + si) % statuses.length];
      const c = defaults('chapters', {
        subject_id: s.id, title, position: ci, status,
        confidence: status === 'not_started' ? null : status === 'mastered' ? 5 : status === 'needs_revision' ? 2 : 3,
        difficulty: status === 'not_started' ? null : 2 + ((ci + si) % 3),
        mastered_at: status === 'mastered' ? new Date(Date.now() - (5 + ci * 9 + si * 4) * day).toISOString() : null,
        updated_at: new Date(Date.now() - 20 * day).toISOString(),
        subtopics: ci === 1 && si === 0 ? [{ id: uuid(), title: 'Speed, velocity and acceleration', done: true }, { id: uuid(), title: 'Mass and weight', done: true }, { id: uuid(), title: 'Momentum', done: false }] : [],
        notes: ci === 1 && si === 0 ? 'Remember: momentum is conserved in all collisions; kinetic energy only in elastic ones.' : null,
      }) as unknown as Chapter;
      d.rows.chapters.push(c);
    });
  });
  const methods: StudySession['method'][] = ['notes', 'past_papers', 'practice_questions', 'textbook', 'flashcards', 'video_lesson'];
  for (let back = 70; back >= 0; back--) {
    if (rand() < 0.28 && back > 2) continue;
    const n = 1 + Math.floor(rand() * 2.4);
    for (let k = 0; k < n; k++) {
      const subj = d.rows.subjects[Math.floor(rand() * 4)];
      const chs = d.rows.chapters.filter((c) => c.subject_id === subj.id && c.status !== 'not_started' && c.title !== 'Waves');
      const ch = chs[Math.floor(rand() * chs.length)];
      const start = new Date(Date.now() - back * day);
      start.setUTCHours(13 + k * 2, Math.floor(rand() * 50), 0, 0);
      if (start.getTime() > Date.now()) start.setTime(Date.now() - 3 * 3600000);
      const dur = 20 + Math.floor(rand() * 70);
      const m = methods[Math.floor(rand() * methods.length)];
      const att = m === 'past_papers' || m === 'practice_questions' ? 8 + Math.floor(rand() * 20) : null;
      d.rows.study_sessions.push(defaults('study_sessions', {
        subject_id: subj.id, chapter_id: ch?.id ?? null, started_at: start.toISOString(), ended_at: new Date(start.getTime() + dur * 60000).toISOString(),
        duration_min: dur, method: m, questions_attempted: att, questions_correct: att ? Math.floor(att * (0.55 + rand() * 0.4)) : null,
        confidence: 2 + Math.floor(rand() * 4), source: rand() > 0.3 ? 'timer' : 'manual',
      }) as unknown as StudySession);
    }
  }
  const phy = d.rows.subjects[0];
  const today = new Date();
  const iso = (n: number) => new Date(today.getTime() + n * day).toISOString().slice(0, 10);
  const e1 = defaults('exams', { name: 'Physics Paper 4 (Theory)', subject_id: phy.id, paper: 'Paper 42', exam_board: 'Cambridge International', exam_date: iso(24), exam_time: '09:00', notes: 'Mock exam at school' }) as unknown as TableRows['exams'];
  const e2 = defaults('exams', { name: 'Maths Paper 2', subject_id: d.rows.subjects[1].id, paper: 'Paper 22', exam_board: 'Cambridge International', exam_date: iso(41) }) as unknown as TableRows['exams'];
  d.rows.exams.push(e1, e2);
  d.rows.chapters.filter((c) => c.subject_id === phy.id).slice(1, 5).forEach((c, i) => {
    d.rows.exam_topics.push(defaults('exam_topics', { exam_id: e1.id, chapter_id: c.id, done: i === 0, deadline: iso(10 + i * 3) }) as unknown as TableRows['exam_topics']);
  });
  return d;
}
