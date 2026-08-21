import { createContext, use, useCallback, useEffect, useRef, type ReactNode } from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { supabase } from '@/lib/supabase';

/**
 * One websocket for the whole app.
 *
 * Every screen that reads couple data needs to know when the other device
 * changes it, and opening a channel per hook would mean five or six sockets for
 * two people looking at one hub. Instead this opens a single channel scoped to
 * the couple, and hands screens a way to say which tables they care about.
 *
 * What arrives is treated as a *signal*, never as data: a change on any watched
 * table makes the subscribing hook re-run its own query. That is one extra
 * round trip per change, and it buys three things that patching from the
 * payload does not —
 *
 *   1. No merge logic per shape. `fetchHomeSnapshot` joins profiles and filters
 *      by today's date; a row-level payload cannot be folded into that result
 *      without reimplementing the query on the client.
 *   2. Deletes work. Postgres sends only the primary key for a DELETE unless
 *      the table is REPLICA IDENTITY FULL, so the payload is frequently not
 *      enough to know what was removed.
 *   3. It cannot drift. A refetch is authoritative; a patched cache is a second
 *      copy of the truth that has to be kept right forever.
 *
 * The focus refetch in `useAsyncData` stays as the backstop. A socket that was
 * asleep, backgrounded, or on a dead train misses events, and no realtime
 * system removes the need to re-read on the way back in.
 */

export type ChangeListener = {
  /** Table names this listener wants, unqualified: `goals`, `check_ins`. */
  tables: readonly string[];
  onChange: () => void;
};

type Subscribe = (listener: ChangeListener) => () => void;

const RealtimeContext = createContext<Subscribe>(() => () => {});

/** Tables carrying a `couple_id`, filtered to this couple server-side. */
const COUPLE_SCOPED = [
  'couple_members',
  'check_ins',
  'goals',
  'bucket_list_items',
  'wiki_entries',
  'calendar_events',
  /*
   * Play. The wheel is the one that has to be live: it is a shared list, and an
   * option added on one phone must be on the wheel before the other spins it.
   *
   * `date_ideas` and `trivia_questions` are couple-scoped here even though both
   * also hold stock rows with a null `couple_id` — those never change, so a
   * filter that excludes them costs nothing and keeps the subscription narrow.
   */
  'wheel_options',
  'date_ideas',
  'trivia_rounds',
] as const;

/**
 * Private to one person, and subscribed with a `user_id` filter below.
 *
 * `picker_swipes` is here rather than in `COUPLE_SCOPED` for a reason that is
 * not just tidiness: the table has a `couple_id`, so filtering on it would
 * work — and would forward the partner's swipes to this device. The whole
 * feature promises that never happens. Filtering on `user_id` keeps the socket
 * honest even though RLS would also refuse the read.
 */
const USER_SCOPED = ['todos', 'growth_habits', 'picker_swipes'] as const;

/**
 * Tables with no couple column. Subscribed unfiltered and scoped by RLS —
 * `profiles` and `love_languages` are both `shares_couple_with(...)`, so
 * Realtime only forwards the two people's rows.
 */
const RLS_SCOPED = ['profiles', 'love_languages'] as const;

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { coupleId, user } = useAuth();
  const userId = user?.id ?? null;

  /*
   * A ref, not state. Listeners come and go as screens mount, and re-rendering
   * this provider on every one of those would re-render the entire app under
   * it — including the screens whose subscriptions caused it.
   */
  const listeners = useRef(new Set<ChangeListener>());

  const subscribe = useCallback<Subscribe>((listener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!coupleId) return;

    const notify = (table: string) => {
      // Copied before iterating: a listener that unsubscribes inside its own
      // callback would otherwise mutate the set mid-loop.
      for (const listener of [...listeners.current]) {
        if (listener.tables.includes(table)) listener.onChange();
      }
    };

    const channel = supabase.channel(`couple:${coupleId}`);

    for (const table of COUPLE_SCOPED) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `couple_id=eq.${coupleId}` },
        () => notify(table)
      );
    }

    // The couple row itself — streak, level, premium, start date.
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'couples', filter: `id=eq.${coupleId}` },
      () => notify('couples')
    );

    for (const table of RLS_SCOPED) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => notify(table));
    }

    // Private to one person, but the same person may have two devices.
    if (userId) {
      for (const table of USER_SCOPED) {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
          () => notify(table)
        );
      }
    }

    channel.subscribe((status) => {
      // Deliberately quiet on success. `CHANNEL_ERROR` almost always means the
      // table is not in the `supabase_realtime` publication — see migration
      // 0009 — and that is worth saying out loud in development.
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(`[realtime] couple channel ${status.toLowerCase()}`);
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [coupleId, userId]);

  return <RealtimeContext value={subscribe}>{children}</RealtimeContext>;
}

/**
 * Run `onChange` when any of `tables` changes for this couple.
 *
 * `tables` must be a stable reference — declare it at module scope, not inline
 * in the component, or the subscription tears down and rebuilds every render.
 */
export function useTableChanges(tables: readonly string[] | undefined, onChange: () => void) {
  const subscribe = use(RealtimeContext);

  // The callback is read through a ref so a caller passing a fresh closure each
  // render does not resubscribe; only the table list decides that.
  const handler = useRef(onChange);
  useEffect(() => {
    handler.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!tables || tables.length === 0) return;

    /*
     * Coalesced. One user action is regularly several row events — saving love
     * languages writes five rows, and a check-in fires the insert plus the
     * streak trigger's update to `couples` — and each would otherwise be its
     * own refetch of the same query.
     */
    let timer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = subscribe({
      tables,
      onChange: () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => handler.current(), 220);
      },
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [subscribe, tables]);
}
