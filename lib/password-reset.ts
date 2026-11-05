import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

/**
 * The custom forgot-password flow (`supabase/functions/password-reset`).
 *
 * Supabase's `resetPasswordForEmail` is deliberately not used: it mails a link
 * that has to deep-link back into the app. This mails a six-digit code instead,
 * sent through Resend from our own domain.
 */

export type ResetField = 'email' | 'code' | 'password';
export type ResetResult = { ok: true } | { ok: false; message: string; field?: ResetField };

async function call(body: Record<string, string>, fallback: string): Promise<ResetResult> {
  try {
    const { error } = await supabase.functions.invoke<{ ok: true }>('password-reset', {
      method: 'POST',
      body,
    });
    if (!error) return { ok: true };

    if (error instanceof FunctionsHttpError) {
      const payload = (await error.context.json().catch(() => null)) as {
        error?: string;
        field?: ResetField;
      } | null;
      if (payload?.error) return { ok: false, message: payload.error, field: payload.field };
    }
    return { ok: false, message: fallback };
  } catch {
    return { ok: false, message: fallback };
  }
}

/**
 * Asks for a code. Succeeds whether or not the address has an account — the
 * server answers the same either way, so the screen must too.
 */
export function requestPasswordResetCode(email: string): Promise<ResetResult> {
  return call(
    { action: 'request', email: email.trim() },
    'We couldn’t send a code just now. Check your connection and try again.'
  );
}

/** Redeems a code and sets the new password. Does not sign in. */
export function confirmPasswordReset(input: {
  email: string;
  code: string;
  password: string;
}): Promise<ResetResult> {
  return call(
    { action: 'confirm', email: input.email.trim(), code: input.code.trim(), password: input.password },
    'We couldn’t reset your password just now. Check your connection and try again.'
  );
}
