import type { Session, User } from '@supabase/supabase-js';
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { deleteAccountOnServer, leaveHubOnServer, type AccountActionResult } from '@/lib/account';
import { clearAll as clearLocalReminders } from '@/lib/notifications';
import { registerForPush, unregisterForPush } from '@/lib/push';
import { supabase } from '@/lib/supabase';

/**
 * `restoring` is the state that matters. A cold start always begins here while
 * the persisted session is read off disk — routing on `signed-out` before that
 * finishes bounces a returning user through onboarding for a frame.
 */
export type AuthStatus = 'restoring' | 'signed-out' | 'signed-in';

/** Which onboarding step a signed-in user still owes us. */
export type PairingStatus = 'unknown' | 'unpaired' | 'paired';

export type AuthResult =
  | { ok: true; needsEmailConfirmation?: boolean }
  | { ok: false; message: string; field?: 'email' | 'password' };

type AuthApi = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  pairing: PairingStatus;
  coupleId: string | null;
  signUp: (input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  /**
   * Permanently deletes the account and its data, then clears this device.
   * Resolves `{ ok: false }` without signing out if the server refused, so the
   * person can try again from where they were.
   */
  deleteAccount: () => Promise<AccountActionResult>;
  /**
   * Ends the hub for both people. On success pairing becomes `unpaired` and the
   * gate moves this device to the pairing flow; the partner's app follows via
   * realtime, push, or its next foreground.
   */
  unpair: () => Promise<AccountActionResult>;
  /** Re-reads pairing state and returns it. Call after create-hub or join-partner succeeds. */
  refreshPairing: () => Promise<PairingStatus>;
};

const AuthContext = createContext<AuthApi | null>(null);

/**
 * Supabase error messages are written for developers.
 *
 * "Invalid login credentials" is accurate and unhelpful; worse, it is
 * deliberately vague about *which* half was wrong, because saying so would let
 * an attacker enumerate registered addresses. We keep that property and just
 * say it in a human register.
 */
function toAuthResult(message: string): AuthResult {
  const lower = message.toLowerCase();

  if (lower.includes('invalid login credentials')) {
    return { ok: false, message: 'That email and password don’t match.' };
  }
  if (lower.includes('already registered') || lower.includes('already been registered')) {
    return {
      ok: false,
      field: 'email',
      message: 'There’s already an account with this email. Try logging in.',
    };
  }
  if (lower.includes('email not confirmed')) {
    return { ok: false, message: 'Confirm your email first — check your inbox for the link.' };
  }
  if (lower.includes('password')) {
    return { ok: false, field: 'password', message };
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return { ok: false, message: 'Too many attempts. Give it a minute and try again.' };
  }
  // Anything unmapped is shown as-is rather than replaced with a generic
  // apology: a message we did not anticipate is more useful than "went wrong".
  return { ok: false, message };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [session, setSession] = useState<Session | null>(null);
  const [pairing, setPairing] = useState<PairingStatus>('unknown');
  const [coupleId, setCoupleId] = useState<string | null>(null);

  /**
   * Read straight from `couple_members` rather than calling
   * `current_couple_id()`. RLS already scopes the table to the caller's own
   * rows, so the plain select returns exactly the same answer without spending
   * an RPC grant on it.
   */
  const loadPairing = useCallback(async (activeSession: Session | null): Promise<PairingStatus> => {
    if (!activeSession) {
      setPairing('unknown');
      setCoupleId(null);
      return 'unknown';
    }

    const { data: myMember, error: myError } = await supabase
      .from('couple_members')
      .select('couple_id')
      .is('left_at', null)
      .limit(1)
      .maybeSingle();

    if (myError) {
      // Leave it `unknown` — the routing gate treats that as "don't move",
      // which is the right response to a network blip. Forcing 'unpaired' here
      // would drop a paired couple back into the pairing flow.
      setPairing('unknown');
      return 'unknown';
    }

    if (!myMember?.couple_id) {
      setCoupleId(null);
      setPairing('unpaired');
      return 'unpaired';
    }

    setCoupleId(myMember.couple_id);

    // A user is only 'paired' if another active member exists in the same couple.
    const { data: partnerMember, error: partnerError } = await supabase
      .from('couple_members')
      .select('user_id')
      .eq('couple_id', myMember.couple_id)
      .neq('user_id', activeSession.user.id)
      .is('left_at', null)
      .limit(1)
      .maybeSingle();

    if (partnerError) {
      setPairing('unknown');
      return 'unknown';
    }

    const next: PairingStatus = partnerMember ? 'paired' : 'unpaired';
    setPairing(next);
    return next;
  }, []);

  useEffect(() => {
    let active = true;

    /**
     * `getSession()` reads the persisted session; `onAuthStateChange` covers
     * everything after — sign-in, sign-out, and the silent token refreshes that
     * would otherwise leave this provider holding a stale JWT.
     */
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadPairing(data.session);
      if (!active) return;
      setStatus(data.session ? 'signed-in' : 'signed-out');
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setStatus(nextSession ? 'signed-in' : 'signed-out');
      void loadPairing(nextSession);

      /*
       * Register this device for push whenever a session appears.
       *
       * Here rather than on a screen, because the token has to be stored for a
       * user who never opens Settings — and a notification you only receive
       * after visiting the notification screen is not much of a notification.
       *
       * Fire-and-forget on purpose: `registerForPush` swallows its own failures
       * and returns null when push is unavailable (Expo Go, a simulator, a
       * declined prompt). None of those should hold up a sign-in, and none of
       * them are worth telling the user about.
       *
       * `onAuthStateChange` also fires on silent token refreshes, so this runs
       * more than once per session. That is fine and is why the write is an
       * upsert keyed on the token: the repeat case changes nothing but
       * `updated_at`.
       */
      if (nextSession?.user) void registerForPush(nextSession.user.id);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadPairing]);

  const signUp = useCallback(
    async ({
      email,
      password,
      firstName,
      lastName,
    }: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    }): Promise<AuthResult> => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          /**
           * Lands in `auth.users.raw_user_meta_data`, which is where the
           * `handle_new_user` trigger reads it. Sending it here rather than
           * writing `profiles` from the client means the name is set in the
           * same transaction as the account — there is no window where a
           * profile exists with the fallback email-prefix name.
           */
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
          },
        },
      });

      if (error) return toAuthResult(error.message);

      /**
       * Confirmation is off in this project, so a session comes back and the
       * flag is false. It stays here as the signal for the other case: with
       * confirmation on, sign-up succeeds and returns no session, and treating
       * that as signed-in strands the user on a screen that cannot load.
       */
      return { ok: true, needsEmailConfirmation: data.session === null };
    },
    []
  );

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return error ? toAuthResult(error.message) : { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    /*
     * Drop the push token *before* the session goes.
     *
     * The delete is an authenticated write, so it has to happen while there is
     * still a session to authorise it — and it has to happen at all, or the next
     * notification for the account that just left is delivered to a phone now
     * being used by someone else. Awaited rather than fired off, because
     * `signOut()` immediately after would race it.
     */
    await unregisterForPush();

    await supabase.auth.signOut();
    setPairing('unknown');
    setCoupleId(null);
  }, []);

  const deleteAccount = useCallback(async (): Promise<AccountActionResult> => {
    const result = await deleteAccountOnServer();
    if (!result.ok) return result;

    /*
     * The server has already removed the push token rows with the account, so
     * there is nothing to unregister — and no session left that could. What is
     * left is on this device: reminders scheduled for events that no longer
     * exist, and a stored session for a user who no longer exists.
     *
     * `scope: 'local'` because a global sign-out is a server call on behalf of
     * a deleted user, which fails and would leave the stored session behind.
     */
    await clearLocalReminders().catch(() => {});
    await supabase.auth.signOut({ scope: 'local' });
    setPairing('unknown');
    setCoupleId(null);
    return result;
  }, []);

  const refreshPairing = useCallback(async (): Promise<PairingStatus> => {
    const { data } = await supabase.auth.getSession();
    return loadPairing(data.session);
  }, [loadPairing]);

  const unpair = useCallback(async (): Promise<AccountActionResult> => {
    const result = await leaveHubOnServer();
    if (!result.ok) return result;

    // Reminders were for the hub's calendar, which no longer exists.
    await clearLocalReminders().catch(() => {});
    await refreshPairing();
    return result;
  }, [refreshPairing]);

  /*
   * Re-check pairing whenever the app comes back to the foreground.
   *
   * The partner can end the hub while this phone is asleep. Realtime and the
   * push cover an open app and a closed one; this covers the gap between, and
   * any event a sleeping socket missed. One cheap query per foreground.
   */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && status === 'signed-in') void refreshPairing();
    });
    return () => sub.remove();
  }, [status, refreshPairing]);

  const api = useMemo<AuthApi>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      pairing,
      coupleId,
      signUp,
      signIn,
      signOut,
      deleteAccount,
      unpair,
      refreshPairing,
    }),
    [status, session, pairing, coupleId, signUp, signIn, signOut, deleteAccount, unpair, refreshPairing]
  );

  return <AuthContext value={api}>{children}</AuthContext>;
}

export function useAuth(): AuthApi {
  const api = use(AuthContext);
  if (!api) throw new Error('useAuth must be used inside <AuthProvider>');
  return api;
}
