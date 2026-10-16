import type { ActiveTimer, AllData, AuthUser, Profile, StudySession, TableName, TableRows } from './types';
import { createBackend } from './backend';

export type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'PASSWORD_RECOVERY' | 'USER_UPDATED' | 'TOKEN_REFRESHED' | 'INITIAL_SESSION' | string;

export interface Api {
  configured: boolean;
  auth: {
    getUser(): Promise<AuthUser | null>;
    onChange(cb: (event: AuthEvent, user: AuthUser | null) => void): () => void;
    signUp(email: string, password: string, displayName: string, timezone: string): Promise<{ needsConfirm: boolean }>;
    signIn(email: string, password: string): Promise<void>;
    signInWithGoogle(): Promise<void>;
    signOut(): Promise<void>;
    sendReset(email: string): Promise<void>;
    updatePassword(password: string): Promise<void>;
    resendConfirmation(email: string): Promise<void>;
  };
  loadAll(): Promise<AllData>;
  updateProfile(patch: Partial<Profile>): Promise<Profile>;
  insert<T extends TableName>(table: T, row: Partial<TableRows[T]>): Promise<TableRows[T]>;
  update<T extends TableName>(table: T, id: string, patch: Partial<TableRows[T]>): Promise<TableRows[T]>;
  remove(table: TableName, id: string): Promise<void>;
  getTimer(): Promise<ActiveTimer | null>;
  saveTimer(row: Partial<ActiveTimer>): Promise<ActiveTimer>;
  clearTimer(): Promise<void>;
  /** Saves a timer session under the timer's fixed id (never twice), then clears the timer. */
  saveTimerSession(session: Partial<StudySession> & { id: string }): Promise<StudySession>;
  deleteAccount(): Promise<void>;
}

// Real Supabase backend in production. `npm run demo` swaps in a local demo backend at build time.
export const api: Api = createBackend();

export function friendlyError(e: unknown): string {
  const raw = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e ?? '');
  const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: unknown }).code) : '';
  if (raw.includes('SUBJECT_LIMIT')) return 'You already have 6 subjects. Delete one to add another.';
  if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(raw)) return "Can't reach Syllabix right now. Check your internet connection and try again.";
  if (/Invalid login credentials/i.test(raw)) return 'Email or password is incorrect.';
  if (/Email not confirmed/i.test(raw)) return 'Please confirm your email first — check your inbox for the link.';
  if (/User already registered/i.test(raw)) return 'An account with this email already exists. Try logging in.';
  if (/Password should be at least/i.test(raw)) return 'Password must be at least 8 characters.';
  if (/rate limit|too many requests|over_email_send_rate_limit/i.test(raw)) return 'Too many attempts. Please wait a few minutes and try again.';
  if (/provider is not enabled|Unsupported provider/i.test(raw)) return 'Google sign-in isn’t switched on yet for this site. Use email and password for now.';
  if (/JWT expired|invalid JWT|refresh token/i.test(raw)) return 'Your session expired. Please log in again.';
  if (code === '23505' || /duplicate key/i.test(raw)) return 'That has already been saved.';
  if (code === '23514' || /violates check constraint/i.test(raw)) return 'Some values are out of range. Please check the form.';
  if (code === '42501' || /row-level security/i.test(raw)) return "You don't have permission to do that.";
  return raw || 'Something went wrong. Please try again.';
}
