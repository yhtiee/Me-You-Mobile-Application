import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/providers/toast-provider';
import { useAsyncData } from '@/hooks/use-async-data';
import {
  addCalendarEvent,
  addReminder,
  deleteCalendarEvent,
  fetchEvents,
  removeReminder,
  updateCalendarEvent,
} from '@/lib/calendar';
import * as notifications from '@/lib/notifications';
import { countdownLabel, daysUntil, formatEventDate, nextOccurrence, todayIso } from '@/utils/date';
import type { CalendarEvent } from '@/types/domain';

/**
 * Relationship calendar (PRD Module 3), read from Postgres.
 *
 * This was the last screen still reading `mocks/couple.ts`, which is why the
 * date setter appeared to do nothing: Play wrote a real `calendar_events` row
 * and the calendar was rendering a hardcoded array. Both now read the same
 * table, so an event created in a game shows up here the moment the tab is
 * focused — and on the partner's device without either of them refreshing.
 */
const CALENDAR_TABLES = ['calendar_events', 'event_reminders'] as const;

const NO_EVENTS: CalendarEvent[] = [];

/**
 * Separate from `NO_EVENTS` because it is a different type, and shared rather
 * than inlined because a fresh `[]` for an empty day would give `selectedEvents`
 * a new identity on every render.
 */
const NO_DATED: DatedEvent[] = [];

/** An event resolved to the date it actually next falls on. */
export type DatedEvent = CalendarEvent & {
  /** Where it lands next — the stored date for one-offs, rolled forward for annuals. */
  occursOn: string;
  daysAway: number;
  dateLabel: string;
  countdown: string;
  /** A one-off whose day has passed. Annual events are never past. */
  isPast: boolean;
};

export function useCalendar() {
  const { user, coupleId } = useAuth();
  const toast = useToast();
  const userId = user?.id ?? null;

  const [selected, setSelected] = useState(() => todayIso());

  const load = useCallback(async () => {
    if (!userId || !coupleId) throw new Error('You’re not in a hub yet.');
    return fetchEvents();
  }, [userId, coupleId]);

  const { data, error, loading, refetch } = useAsyncData(
    userId && coupleId ? load : null,
    CALENDAR_TABLES
  );

  const events = data ?? NO_EVENTS;

  /**
   * Resolve every event to its next real date.
   *
   * This is where `recurs_annually` finally gets read. Without it a birthday
   * stored in 2026 was simply in the past for ever — the list said "7 days ago"
   * about an event that happens every year.
   */
  const dated = useMemo<DatedEvent[]>(() => {
    const today = todayIso();

    return events
      .map((event) => {
        const occursOn = nextOccurrence(event.date, event.recursAnnually ?? false);
        const away = daysUntil(occursOn);
        return {
          ...event,
          occursOn,
          daysAway: away,
          dateLabel: formatEventDate(occursOn),
          countdown: countdownLabel(away),
          isPast: !event.recursAnnually && occursOn < today,
        };
      })
      .sort((a, b) => {
        if (a.occursOn !== b.occursOn) return a.occursOn.localeCompare(b.occursOn);
        // All-day first within a day, matching the server-side ordering.
        return (a.time ?? '').localeCompare(b.time ?? '');
      });
  }, [events]);

  /** Every date carrying something, for the grid's dots. */
  const byDate = useMemo(() => {
    const map = new Map<string, DatedEvent[]>();
    for (const event of dated) {
      const list = map.get(event.occursOn);
      if (list) list.push(event);
      else map.set(event.occursOn, [event]);
    }
    return map;
  }, [dated]);

  const upcoming = useMemo(() => dated.filter((e) => !e.isPast), [dated]);

  /**
   * Keep the device's pending notifications in step with the data.
   *
   * On every load rather than only on write, because the rows are shared: a
   * reminder your partner added reaches this device as a realtime refetch, and
   * this is what turns it into a notification here. No-ops without permission.
   */
  useEffect(() => {
    if (!data) return;
    void notifications.sync(data);
  }, [data]);

  const add = useCallback(
    async (input: {
      title: string;
      date: string;
      time?: string | null;
      kind: CalendarEvent['kind'];
      recursAnnually?: boolean;
      reminderLeads?: number[];
    }): Promise<boolean> => {
      if (!userId || !coupleId) return false;
      try {
        await addCalendarEvent({ userId, coupleId, ...input });
        refetch();
        setSelected(input.date);
        return true;
      } catch (thrown) {
        toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t save that.');
        return false;
      }
    },
    [userId, coupleId, refetch, toast]
  );

  const update = useCallback(
    async (eventId: string, patch: Parameters<typeof updateCalendarEvent>[1]) => {
      try {
        await updateCalendarEvent(eventId, patch);
        refetch();
        return true;
      } catch (thrown) {
        toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t save that.');
        return false;
      }
    },
    [refetch, toast]
  );

  const remove = useCallback(
    async (eventId: string) => {
      try {
        await deleteCalendarEvent(eventId);
        refetch();
        return true;
      } catch (thrown) {
        toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t delete that.');
        return false;
      }
    },
    [refetch, toast]
  );

  /**
   * Turn a reminder on or off.
   *
   * Asks for notification permission on the way in, and only the first time it
   * is actually needed — a prompt at launch, before the user has any events, is
   * the one most reliably denied, and a denial is permanent.
   *
   * A refused prompt still writes the row. The reminder is shared, so it may be
   * the partner's phone that ends up delivering it, and silently discarding the
   * user's choice because *this* device cannot ring is the wrong call.
   */
  const toggleReminder = useCallback(
    async (event: CalendarEvent, leadMinutes: number) => {
      if (!userId || !coupleId) return;

      const existing = (event.reminders ?? []).find((r) => r.leadMinutes === leadMinutes);

      try {
        if (existing) {
          await removeReminder(existing.id);
        } else {
          const granted = await notifications.ensurePermission();
          await addReminder({ eventId: event.id, coupleId, userId, leadMinutes });
          if (!granted) {
            // `success`, not `error`: the reminder did save. What failed is
            // this phone's ability to ring, which the user still needs telling.
            toast.success(
              'Saved — turn on notifications in Settings for us to nudge you on this phone.'
            );
          }
        }
        refetch();
      } catch (thrown) {
        toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t change that.');
      }
    },
    [userId, coupleId, refetch, toast]
  );

  return {
    /** Everything, resolved and sorted — including past one-offs. */
    events: dated,
    upcoming,
    next: upcoming[0] ?? null,
    byDate,
    selected,
    setSelected,
    selectedEvents: byDate.get(selected) ?? NO_DATED,
    loading,
    error,
    refetch,
    add,
    update,
    remove,
    toggleReminder,
  };
}
