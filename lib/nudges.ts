import { supabase } from '@/lib/supabase';
import { todayKey } from '@/lib/home';

/**
 * Which channels you have ticked today.
 *
 * Plain async functions over `supabase`, like every other `lib/` module — the
 * loading and error story belongs to `hooks/use-nudges.ts`. These throw an
 * `Error` carrying a written message rather than returning a result union,
 * matching `lib/home.ts`: the sheet has exactly one failure UI (a toast), so
 * there is nothing for the caller to branch on.
 */

function toMessage(error: { message: string }, what: string): Error {
  return new Error(`We couldn’t ${what}. ${error.message}`);
}

/** Channel keys ticked today, as a set the sheet can test membership against. */
export async function fetchTodayNudges(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('daily_nudges')
    .select('channel')
    .eq('user_id', userId)
    .eq('day', todayKey());

  if (error) throw toMessage(error, 'load today’s messages');

  return ((data ?? []) as { channel: string }[]).map((row) => row.channel);
}

/**
 * Tick a channel for today.
 *
 * Upsert rather than insert: the unique index on `(user_id, day, channel)`
 * makes a second tick the same fact, and two devices racing to record it should
 * both succeed rather than one getting a duplicate-key error for agreeing.
 */
export async function markNudgeSent(input: {
  coupleId: string;
  userId: string;
  channel: string;
}): Promise<void> {
  const { error } = await supabase.from('daily_nudges').upsert(
    {
      couple_id: input.coupleId,
      user_id: input.userId,
      channel: input.channel,
      day: todayKey(),
    },
    { onConflict: 'user_id,day,channel' }
  );

  if (error) throw toMessage(error, 'save that');
}

/** Untick it. The row *is* the boolean, so unmarking is a delete. */
export async function unmarkNudgeSent(input: {
  userId: string;
  channel: string;
}): Promise<void> {
  const { error } = await supabase
    .from('daily_nudges')
    .delete()
    .eq('user_id', input.userId)
    .eq('channel', input.channel)
    .eq('day', todayKey());

  if (error) throw toMessage(error, 'undo that');
}
