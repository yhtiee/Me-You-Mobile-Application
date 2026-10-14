import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export type FeedbackKind = 'feedback' | 'bug' | 'safety';

/**
 * Files one piece of feedback or a safety report (`public.feedback`).
 *
 * Insert-only: the row is not read back, so there is no `.select()` — RLS
 * gives the client no select policy on this table and asking would fail.
 */
export async function submitFeedback(input: {
  userId: string;
  kind: FeedbackKind;
  message: string;
  contact: string | null;
}): Promise<void> {
  const { error } = await supabase.from('feedback').insert({
    user_id: input.userId,
    kind: input.kind,
    message: input.message,
    contact: input.contact,
    app_version: Constants.expoConfig?.version ?? null,
    platform: Platform.OS,
  });

  if (error) {
    throw new Error('We couldn’t send that just now. Check your connection and try again.');
  }
}
