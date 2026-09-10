import { supabase } from '@/lib/supabase';

/**
 * What this person wants to be buzzed about.
 *
 * Read by the client for the Settings switches and by the `notify` Edge
 * Function — through `wants_notification()` — before it sends anything. The
 * in-app feed deliberately ignores these: turning off "partner check-ins" means
 * "stop buzzing my phone", not "hide this from the list I opened on purpose".
 */

export type NotificationPrefs = {
  /** Their check-in landed. The daily loop, and the one people actually want. */
  partnerCheckins: boolean;
  /** Anything from Play: a flip, a spin, a finished quiz, a match. */
  playActivity: boolean;
  /** Streak warnings and calendar countdowns. */
  reminders: boolean;
};

/**
 * Defaults are on, and they are the *same* defaults `wants_notification()`
 * applies server-side when no row exists.
 *
 * Nobody has a row until they first change something, so this is the state most
 * users are actually in. If the two sides disagreed, the switches would show one
 * thing and the sender would do another — which is exactly the class of bug that
 * makes people stop trusting a settings screen.
 */
export const DEFAULT_PREFS: NotificationPrefs = {
  partnerCheckins: true,
  playActivity: true,
  reminders: true,
};

function toMessage(error: { message: string }, what: string): Error {
  return new Error(`We couldn’t ${what}. ${error.message}`);
}

export async function fetchNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  const { data, error } = await supabase
    .from('notification_prefs')
    .select('partner_checkins, play_activity, reminders')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw toMessage(error, 'load your notification settings');
  if (!data) return DEFAULT_PREFS;

  return {
    partnerCheckins: data.partner_checkins as boolean,
    playActivity: data.play_activity as boolean,
    reminders: data.reminders as boolean,
  };
}

/**
 * Write the whole set, not one field.
 *
 * The row may not exist, so every save is an upsert — and an upsert of a partial
 * set would write database defaults over the switches the user did not touch.
 * Sending all three keeps the row a faithful copy of what is on screen.
 */
export async function saveNotificationPrefs(
  userId: string,
  prefs: NotificationPrefs
): Promise<void> {
  const { error } = await supabase.from('notification_prefs').upsert(
    {
      user_id: userId,
      partner_checkins: prefs.partnerCheckins,
      play_activity: prefs.playActivity,
      reminders: prefs.reminders,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) throw toMessage(error, 'save your notification settings');
}
