import { FunctionsHttpError } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export type FeedbackKind = 'feedback' | 'bug' | 'safety';

/**
 * Files one piece of feedback or a safety report.
 *
 * Through `submit-feedback`, which saves it *and* emails it to the team (and
 * acknowledges a safety report to the reporter). If that function can't be
 * reached at all, the row is inserted directly instead: a report that arrives
 * without an email is better than one that doesn't arrive.
 *
 * The direct insert is insert-only: the row is not read back, so there is no
 * `.select()` — RLS gives the client no select policy on this table.
 */
export async function submitFeedback(input: {
  userId: string;
  kind: FeedbackKind;
  message: string;
  contact: string | null;
}): Promise<void> {
  const appVersion = Constants.expoConfig?.version ?? null;

  const { error: invokeError } = await supabase.functions.invoke<{ ok: true }>('submit-feedback', {
    method: 'POST',
    body: {
      kind: input.kind,
      message: input.message,
      contact: input.contact,
      appVersion,
      platform: Platform.OS,
    },
  });
  if (!invokeError) return;

  // A refusal the server explained (rate limit, bad input) is shown as-is.
  // Falling back would just get around it.
  if (invokeError instanceof FunctionsHttpError && invokeError.context.status < 500) {
    const body = (await invokeError.context.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? 'We couldn’t send that just now. Please try again.');
  }

  const { error } = await supabase.from('feedback').insert({
    user_id: input.userId,
    kind: input.kind,
    message: input.message,
    contact: input.contact,
    app_version: appVersion,
    platform: Platform.OS,
  });

  if (error) {
    throw new Error('We couldn’t send that just now. Check your connection and try again.');
  }
}
