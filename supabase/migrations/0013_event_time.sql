-- ============================================================================
-- 0013 · An optional time on a calendar event
--
-- `calendar_events` has carried a bare `event_date` since 0004, which was right
-- for what the table was built for: birthdays and anniversaries are days, not
-- moments. Date night is not. The date setter now offers a real time picker,
-- and "Dinner at Mirabelle" with no 7:30 attached is half an arrangement.
--
-- Nullable, and null keeps its meaning: this is an all-day event. Every row
-- that exists today is one, which is why there is no backfill below.
--
-- Re-runnable.
-- ============================================================================

alter table public.calendar_events
  add column if not exists event_time time;

comment on column public.calendar_events.event_time is
  'Local wall-clock time, or null for an all-day event. Deliberately `time` and '
  'not `timestamptz`: a couple agreeing on "7:30" means 7:30 where they are, and '
  'storing an instant would shift the dinner when one of them travels. See the '
  'README''s open question on time zones — this column takes the same position '
  '`check_ins.entry_date` already does.';

/*
 * The ordering index gains the time.
 *
 * Two date nights on one evening sorted arbitrarily before this, because
 * `event_date` alone could not separate them — and the calendar renders them in
 * the order the query returns. Replaces the 0004 index rather than adding a
 * second one on an overlapping prefix.
 */
drop index if exists public.calendar_events_by_couple_date;

create index if not exists calendar_events_by_couple_date
  on public.calendar_events (couple_id, event_date, event_time nulls first);
