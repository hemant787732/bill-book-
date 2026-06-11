// @ts-nocheck
// Thin wrapper around Supabase Auth. When Supabase is not configured the app
// runs without a login gate (local-only mode), so every helper degrades safely.
import { supabase } from './supabase';

export type AuthSession = { user: { id: string; email: string } } | null;

export function isAuthEnabled(): boolean {
  return !!supabase;
}

export async function getCurrentSession(): Promise<AuthSession> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

export function getSessionEmail(session: AuthSession): string {
  return session?.user?.email ?? '';
}

function syncRealtimeAuth(session: AuthSession) {
  const token = session?.access_token;
  if (supabase && token) {
    try {
      supabase.realtime.setAuth(token);
    } catch {
      // realtime not started yet; it will pick up the session on connect
    }
  }
}

export async function signInWithEmail(email: string, password: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase not configured.' };
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) return { error: error.message };
  syncRealtimeAuth(data.session);
  return { error: null };
}

export async function signUpWithEmail(email: string, password: string): Promise<{ error: string | null; needsConfirm: boolean }> {
  if (!supabase) return { error: 'Supabase not configured.', needsConfirm: false };
  const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password });
  if (error) return { error: error.message, needsConfirm: false };
  syncRealtimeAuth(data.session);
  // If email confirmation is enabled there is no session until the user confirms.
  return { error: null, needsConfirm: !data.session };
}

// Email OTP: first-time login works without a password. shouldCreateUser lets a
// new email register on first OTP.
export async function sendEmailOtp(email: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase not configured.' };
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  });
  return { error: error?.message ?? null };
}

export async function verifyEmailOtp(email: string, token: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase not configured.' };
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: 'email',
  });
  if (error) return { error: error.message };
  syncRealtimeAuth(data.session);
  return { error: null };
}

// Change password for the currently signed-in user (Settings → change password).
export async function changePassword(newPassword: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase not configured.' };
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error: error?.message ?? null };
}

// Forgot password: emails a reset/OTP to the address.
export async function sendPasswordReset(email: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase not configured.' };
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
  return { error: error?.message ?? null };
}

export async function signOutUser(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

// Calls back with the session whenever auth state changes; returns an
// unsubscribe function.
export function subscribeAuth(callback: (session: AuthSession) => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    syncRealtimeAuth(session ?? null);
    callback(session ?? null);
  });
  return () => data.subscription.unsubscribe();
}
