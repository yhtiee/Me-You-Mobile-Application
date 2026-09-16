import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type AccountActionResult = { ok: true } | { ok: false; message: string };

/**
 * Calls one of the destructive account functions.
 *
 * Both act on the caller's session only; nothing here names an account or a
 * hub. Neither touches local state — the caller (`AuthProvider`) does that
 * once the server has finished.
 */
async function invoke(
  name: 'delete-account' | 'leave-hub',
  fallback: string
): Promise<AccountActionResult> {
  try {
    const { error } = await supabase.functions.invoke<{ ok: true }>(name, {
      method: 'POST',
    });
    if (!error) return { ok: true };

    // The functions answer with `{ error }` in plain language; surface that
    // rather than the client library's "non-2xx status code".
    if (error instanceof FunctionsHttpError) {
      const body = (await error.context.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (body?.error) return { ok: false, message: body.error };
    }
    return { ok: false, message: fallback };
  } catch {
    return { ok: false, message: fallback };
  }
}

/** Permanently deletes the signed-in account (`delete-account`). */
export function deleteAccountOnServer(): Promise<AccountActionResult> {
  return invoke(
    'delete-account',
    'We couldn’t delete your account just now. Check your connection and try again.'
  );
}

/**
 * Ends the caller's hub for both people (`leave-hub`): shared data goes, each
 * person keeps their account and private data, and the partner is told.
 */
export function leaveHubOnServer(): Promise<AccountActionResult> {
  return invoke(
    'leave-hub',
    'We couldn’t end your hub just now. Check your connection and try again.'
  );
}
