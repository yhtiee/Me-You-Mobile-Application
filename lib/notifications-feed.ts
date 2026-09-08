import { supabase } from '@/lib/supabase';

/**
 * The in-app notification feed.
 *
 * Named `notifications-feed` rather than `notifications` because `lib/
 * notifications.ts` already exists and is a different thing entirely — that one
 * schedules *local device* reminders through `expo-notifications`. This one
 * reads rows your partner's actions created. Merging them would put a module
 * that must lazily require a native package next to one that only talks to
 * Postgres, and the whole point of that file's lazy require is that it is the
 * only thing importing the fragile dependency.
 */

function toMessage(error: { message: string }, what: string): Error {
  return new Error(`We couldn’t ${what}. ${error.message}`);
}

/** Kinds the triggers in 0020 emit. Unknown kinds render as a generic line. */
export type NotificationKind =
  | 'checkin'
  | 'play.coin'
  | 'play.wheel'
  | 'play.trivia'
  | 'play.match'
  | (string & {});

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  /** Who caused it. Null for anything the system decided on its own. */
  actorId: string | null;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  kind: string;
  actor_id: string | null;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

/**
 * Newest first, capped.
 *
 * No pagination. This table grows forever but the screen is a glanceable list
 * of what happened lately, not an archive — and a cursor on a feed nobody
 * scrolls past the first screen of is machinery with no reader.
 */
export async function fetchNotifications(limit = 40): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, kind, actor_id, payload, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw toMessage(error, 'load your notifications');

  return ((data ?? []) as Row[]).map((row) => ({
    id: row.id,
    kind: row.kind,
    actorId: row.actor_id,
    payload: row.payload ?? {},
    readAt: row.read_at,
    createdAt: row.created_at,
  }));
}

/** How many are still unread — the number on the bell. */
export async function fetchUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);

  if (error) throw toMessage(error, 'check your notifications');

  return count ?? 0;
}

/**
 * Mark everything read.
 *
 * All at once on opening the screen, rather than per row as each scrolls into
 * view. The bell means "something happened since you last looked"; opening the
 * list *is* looking, and a per-row scheme leaves a count that disagrees with a
 * list the user has plainly just read.
 *
 * RLS scopes the update to this user, so no `recipient_id` filter is needed —
 * but `is('read_at', null)` is, or every open rewrites the whole table.
 */
export async function markAllRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);

  if (error) throw toMessage(error, 'update your notifications');
}
