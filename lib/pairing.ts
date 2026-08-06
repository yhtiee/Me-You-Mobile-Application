import { supabase } from '@/lib/supabase';

export type PairingResult<T> = { ok: true; data: T } | { ok: false; message: string };

/**
 * Postgres `raise exception` messages arrive on `error.message` with the
 * SQLSTATE alongside. `redeem_couple_code` raises four distinct P000x codes for
 * exactly this reason — so the join screen can say which of the four things
 * went wrong instead of "invalid code", which leaves the user with nothing to
 * act on.
 *
 * Matched on message text rather than `error.code`: PostgREST surfaces the
 * SQLSTATE inconsistently across versions, and the messages are ours — defined
 * in migration 0002 — so they are the more stable contract of the two.
 */
function readPairingError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('already paired')) {
    return 'You’re already linked with someone. Unpair first to join a new hub.';
  }
  if (lower.includes('does not match')) {
    return 'No hub with that code. Check it against their screen.';
  }
  if (lower.includes('expired')) {
    return 'That code has expired. Ask them to share a fresh one.';
  }
  if (lower.includes('already full')) {
    return 'That hub already has two people in it.';
  }
  if (lower.includes('not authenticated')) {
    return 'Your session ended. Log in again to continue.';
  }
  return message;
}

export type Couple = {
  id: string;
  invite_code: string | null;
  invite_expires_at: string | null;
  together_since: string | null;
};

/**
 * Creates the couple and returns it with a fresh invite code.
 *
 * Idempotent server-side: calling it with an existing couple returns that one
 * rather than creating a second, so the create-hub screen can call it on mount
 * without tracking whether it already has.
 */
export async function createCouple(): Promise<PairingResult<Couple>> {
  const { data, error } = await supabase.rpc('create_couple');

  if (error) return { ok: false, message: readPairingError(error.message) };
  if (!data) return { ok: false, message: 'Could not create your hub. Try again.' };

  // The function returns a `couples` row; PostgREST hands single-row returns
  // back either bare or wrapped in a one-element array depending on version.
  const couple = (Array.isArray(data) ? data[0] : data) as Couple;
  return { ok: true, data: couple };
}

/** Joins a partner's hub. Burns the code server-side on success. */
export async function redeemCoupleCode(code: string): Promise<PairingResult<string>> {
  const { data, error } = await supabase.rpc('redeem_couple_code', {
    p_code: code.trim().toUpperCase(),
  });

  if (error) return { ok: false, message: readPairingError(error.message) };
  return { ok: true, data: data as string };
}
