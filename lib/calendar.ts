import { supabase } from '@/lib/supabase';
import type { CalendarEvent } from '@/types/domain';

/** Reminder presets, in minutes before the event. Shared by the UI and the scheduler. */
export const REMINDER_PRESETS: { minutes: number; label: string; timedOnly?: boolean }[] = [
  { minutes: 10080, label: '1 week before' },
  { minutes: 4320, label: '3 days before' },
  { minutes: 1440, label: '1 day before' },
  { minutes: 120, label: '2 hours before', timedOnly: true },
  { minutes: 0, label: 'On the day' },
];

/**
 * Shared calendar reads and writes.
 *
 * Its own file rather than living in `lib/play.ts`, even though Play is the only
 * caller today: the Calendar tab is still on `mocks/couple.ts` (see the README's
 * "what the client actually uses"), and when it moves this is the module it
 * moves onto. Putting a calendar write inside the Play layer would mean finding
 * it again from a screen that has nothing to do with games.
 *
 * Play needs both halves — the date setter writes an event, and the Play hero
 * reads whether anything is already booked before offering to plan one.
 */

function toMessage(error: { message: string }, what: string): Error {
  if (/network|fetch|timeout/i.test(error.message)) {
    return new Error('You’re offline. Check your connection and try again.');
  }
  return new Error(`Couldn’t ${what}. ${error.message}`);
}

/**
 * Events from `from` onward, soonest first.
 *
 * Filtered server-side on the date rather than fetched whole and filtered here.
 * A relationship calendar accumulates for years and the callers only ever want
 * what is ahead.
 */
/** The select every read below shares, reminders embedded. */
const EVENT_COLUMNS =
  'id, title, event_date, event_time, kind, recurs_annually, event_reminders(id, lead_minutes)';

type EventRow = {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  kind: string;
  recurs_annually: boolean;
  event_reminders: { id: string; lead_minutes: number }[] | null;
};

function toEvent(row: EventRow): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    date: row.event_date,
    // Postgres hands back `19:30:00`; the domain type is `HH:MM`.
    time: row.event_time ? row.event_time.slice(0, 5) : null,
    kind: row.kind as CalendarEvent['kind'],
    recursAnnually: row.recurs_annually,
    reminders: (row.event_reminders ?? [])
      .map((r) => ({ id: r.id, leadMinutes: r.lead_minutes }))
      .sort((a, b) => b.leadMinutes - a.leadMinutes),
  };
}

/**
 * Every event, once.
 *
 * Not filtered by date, unlike the first version of this function. Two things
 * broke that: the grid pages backwards as well as forwards, so "from today" hid
 * the past the user had just scrolled to; and an annually-recurring birthday
 * stored in 2024 is *upcoming*, while `event_date >= today` excludes it. Whether
 * a row is in the future is a question about `recurs_annually` too, and that is
 * decided in `useCalendar` where both halves are known.
 *
 * A relationship calendar holds tens of rows, not thousands. Revisit when
 * someone has five years of date nights, and page by month when you do.
 */
export async function fetchEvents(): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select(EVENT_COLUMNS)
    .order('event_date', { ascending: true })
    // All-day events sort before timed ones on the same day, matching the
    // index added in 0013 so the order is stable across both devices.
    .order('event_time', { ascending: true, nullsFirst: true });

  if (error) throw toMessage(error, 'load your calendar');
  return ((data ?? []) as unknown as EventRow[]).map(toEvent);
}

/**
 * Events from `from` onward, soonest first.
 *
 * Kept for the Play hero, which only asks "is anything booked?" and would
 * otherwise pull the whole calendar to find out. Annual events are invisible to
 * this by design — a birthday is not the "have you made plans" signal.
 */
export async function fetchUpcomingEvents(from: string, limit = 20): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select(EVENT_COLUMNS)
    .gte('event_date', from)
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) throw toMessage(error, 'load your calendar');
  return ((data ?? []) as unknown as EventRow[]).map(toEvent);
}

/**
 * Create an event and its reminders together.
 *
 * Returns the new id so the caller can select the day it landed on. The
 * reminders go in as a second statement rather than a nested insert, which
 * PostgREST cannot do — if that write fails the event still stands, and the
 * user can add the reminder again from the event itself.
 */
export async function addCalendarEvent(input: {
  userId: string;
  coupleId: string;
  title: string;
  date: string;
  time?: string | null;
  kind: CalendarEvent['kind'];
  recursAnnually?: boolean;
  reminderLeads?: number[];
}): Promise<string> {
  const { data, error } = await supabase
    .from('calendar_events')
    .insert({
      couple_id: input.coupleId,
      created_by: input.userId,
      title: input.title,
      event_date: input.date,
      event_time: input.time ?? null,
      kind: input.kind,
      recurs_annually: input.recursAnnually ?? false,
    })
    .select('id')
    .single();

  if (error) throw toMessage(error, 'add that to your calendar');

  const eventId = data.id as string;
  const leads = input.reminderLeads ?? [];

  if (leads.length > 0) {
    const { error: reminderError } = await supabase.from('event_reminders').insert(
      leads.map((lead) => ({
        event_id: eventId,
        couple_id: input.coupleId,
        created_by: input.userId,
        lead_minutes: lead,
      }))
    );
    if (reminderError) throw toMessage(reminderError, 'save those reminders');
  }

  return eventId;
}

export async function updateCalendarEvent(
  eventId: string,
  patch: {
    title?: string;
    date?: string;
    time?: string | null;
    kind?: CalendarEvent['kind'];
    recursAnnually?: boolean;
  }
): Promise<void> {
  const { error } = await supabase
    .from('calendar_events')
    .update({
      ...(patch.title != null && { title: patch.title }),
      ...(patch.date != null && { event_date: patch.date }),
      ...(patch.time !== undefined && { event_time: patch.time }),
      ...(patch.kind != null && { kind: patch.kind }),
      ...(patch.recursAnnually != null && { recurs_annually: patch.recursAnnually }),
    })
    .eq('id', eventId);

  if (error) throw toMessage(error, 'save that change');
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  // Reminders go with it — `on delete cascade` in 0014.
  const { error } = await supabase.from('calendar_events').delete().eq('id', eventId);
  if (error) throw toMessage(error, 'delete that');
}

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

export async function addReminder(input: {
  eventId: string;
  coupleId: string;
  userId: string;
  leadMinutes: number;
}): Promise<void> {
  const { error } = await supabase.from('event_reminders').insert({
    event_id: input.eventId,
    couple_id: input.coupleId,
    created_by: input.userId,
    lead_minutes: input.leadMinutes,
  });

  // 23505 is the one-per-lead-time unique index. Two devices toggling the same
  // reminder at once is a no-op, not something to shout about.
  if (error && error.code !== '23505') throw toMessage(error, 'add that reminder');
}

export async function removeReminder(reminderId: string): Promise<void> {
  const { error } = await supabase.from('event_reminders').delete().eq('id', reminderId);
  if (error) throw toMessage(error, 'remove that reminder');
}
