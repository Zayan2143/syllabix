import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Api } from './api';
import type { ActiveTimer, AllData, AuthUser, Profile, StudySession, TableName } from './types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const toUser = (u: User | null | undefined): AuthUser | null =>
  u ? { id: u.id, email: u.email ?? null, provider: (u.app_metadata?.provider as string) ?? null } : null;

function must<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}

const PAGE = 1000;
async function fetchAll<T>(sb: SupabaseClient, table: string, order: string, ascending = true): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const r = await sb.from(table).select('*').order(order, { ascending }).order('id').range(from, from + PAGE - 1);
    const rows = must(r) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

export function createSupabaseApi(): Api {
  const configured = Boolean(url && key);
  const sb = createClient(url || 'https://not-configured.supabase.co', key || 'not-configured', {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  const uid = async () => {
    const { data } = await sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new Error('JWT expired');
    return id;
  };
  const origin = () => window.location.origin;

  return {
    configured,
    auth: {
      async getUser() {
        const { data } = await sb.auth.getSession();
        return toUser(data.session?.user);
      },
      onChange(cb) {
        const { data } = sb.auth.onAuthStateChange((event, session) => cb(event, toUser(session?.user)));
        return () => data.subscription.unsubscribe();
      },
      async signUp(email, password, displayName, timezone) {
        const r = await sb.auth.signUp({
          email, password,
          options: { emailRedirectTo: origin() + '/', data: { display_name: displayName, timezone } },
        });
        if (r.error) throw r.error;
        // Supabase returns a user with no identities when the email is already registered
        if (r.data.user && r.data.user.identities && r.data.user.identities.length === 0) {
          throw new Error('User already registered');
        }
        return { needsConfirm: !r.data.session };
      },
      async signIn(email, password) {
        const r = await sb.auth.signInWithPassword({ email, password });
        if (r.error) throw r.error;
      },
      async signInWithGoogle() {
        const r = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: origin() + '/' } });
        if (r.error) throw r.error;
      },
      async signOut() { await sb.auth.signOut(); },
      async sendReset(email) {
        const r = await sb.auth.resetPasswordForEmail(email, { redirectTo: origin() + '/reset-password' });
        if (r.error) throw r.error;
      },
      async updatePassword(password) {
        const r = await sb.auth.updateUser({ password });
        if (r.error) throw r.error;
      },
      async resendConfirmation(email) {
        const r = await sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: origin() + '/' } });
        if (r.error) throw r.error;
      },
    },

    async loadAll(): Promise<AllData> {
      const id = await uid();
      const [profileR, subjects, chapters, sessions, timerR, exams, examTopics] = await Promise.all([
        sb.from('profiles').select('*').eq('id', id).maybeSingle(),
        fetchAll<AllData['subjects'][number]>(sb, 'subjects', 'position'),
        fetchAll<AllData['chapters'][number]>(sb, 'chapters', 'position'),
        fetchAll<StudySession>(sb, 'study_sessions', 'started_at', false),
        sb.from('active_timers').select('*').maybeSingle(),
        fetchAll<AllData['exams'][number]>(sb, 'exams', 'exam_date'),
        fetchAll<AllData['examTopics'][number]>(sb, 'exam_topics', 'created_at'),
      ]);
      const profile = must(profileR) as Profile | null;
      if (!profile) throw new Error('Your profile could not be found. Please log out and back in.');
      return { profile, subjects, chapters, sessions, timer: must(timerR) as ActiveTimer | null, exams, examTopics };
    },

    async updateProfile(patch) {
      const id = await uid();
      const { id: _ignore, ...rest } = patch as Profile;
      void _ignore;
      return must(await sb.from('profiles').update(rest).eq('id', id).select().single()) as Profile;
    },
    async insert(table, row) {
      return must(await sb.from(table).insert(row as never).select().single()) as never;
    },
    async update(table, id, patch) {
      const { id: _i, user_id: _u, ...rest } = patch as Record<string, unknown>;
      void _i; void _u;
      return must(await sb.from(table).update(rest as never).eq('id', id).select().single()) as never;
    },
    async remove(table: TableName, id: string) {
      const r = await sb.from(table).delete().eq('id', id);
      if (r.error) throw r.error;
    },
    async getTimer() {
      return must(await sb.from('active_timers').select('*').maybeSingle()) as ActiveTimer | null;
    },
    async saveTimer(row) {
      const id = await uid();
      return must(await sb.from('active_timers').upsert({ ...row, user_id: id } as never).select().single()) as ActiveTimer;
    },
    async clearTimer() {
      const id = await uid();
      const r = await sb.from('active_timers').delete().eq('user_id', id);
      if (r.error) throw r.error;
    },
    async saveTimerSession(session) {
      // ignoreDuplicates: a retry after a dropped connection can't double-count the time
      const ins = await sb.from('study_sessions').upsert(session as never, { onConflict: 'id', ignoreDuplicates: true });
      if (ins.error) throw ins.error;
      const saved = must(await sb.from('study_sessions').select('*').eq('id', session.id).single()) as StudySession;
      const id = await uid();
      await sb.from('active_timers').delete().eq('user_id', id);
      return saved;
    },
    async deleteAccount() {
      const r = await sb.rpc('delete_my_account');
      if (r.error) throw r.error;
      await sb.auth.signOut();
    },
  };
}
