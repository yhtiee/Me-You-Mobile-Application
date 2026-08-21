-- ============================================================================
-- 0014 · Event reminders
--
-- The calendar screen has promised "we'll nudge you 7 days, 3 days and 1 day
-- before each one" since it was written, with nothing behind it. This is the
-- storage half of making that true; the device schedules the local
-- notifications from these rows (`lib/notifications.ts`).
--
-- Re-runnable.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Reminders belong to the event, not to the person
--
-- Both partners should be reminded of their own anniversary, and a reminder one
-- of them set is information the other needs too — this is a shared calendar.
-- So there is no `user_id` here: the row says "this event wants a nudge N days
-- out", and each device schedules that for itself.
--
-- The cost of that choice is that neither partner can silence a reminder just
-- for themselves. If that turns out to matter, the fix is a per-user mute table
-- rather than making these rows private, which would mean the person who added
-- the anniversary is the only one who ever hears about it.
-- ---------------------------------------------------------------------------

create table if not exists public.event_reminders (
  id         uuid        primary key default gen_random_uuid(),
  event_id   uuid        not null references public.calendar_events (id) on delete cascade,
  couple_id  uuid        not null references public.couples (id) on delete cascade,

  /*
   * Minutes before the event, not days.
   *
   * Days cannot express "two hours before dinner", and a date night is the one
   * kind of event where that is the useful reminder. Storing minutes keeps a
   * seven-day lead (10080) and a two-hour one (120) in the same column, and the
   * UI presents whichever presets make sense for the event's kind.
   *
   * Zero means "at the time of the event"; for an all-day event the device
   * resolves that against a sensible morning hour, since 00:00 is a nudge
   * nobody is awake for.
   */
  lead_minutes integer   not null,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),

  -- A year is the longest lead that means anything on an annual event, and a
  -- negative lead would be a reminder after the fact.
  constraint event_reminder_lead_range check (lead_minutes between 0 and 527040)
);

-- One nudge per lead time per event. Tapping "1 day before" twice is a toggle
-- in the UI, and this is what makes a double-tap-to-add impossible server-side.
create unique index if not exists event_reminders_unique
  on public.event_reminders (event_id, lead_minutes);

create index if not exists event_reminders_by_couple
  on public.event_reminders (couple_id);

-- ---------------------------------------------------------------------------
-- RLS — same rule as the events they hang off
-- ---------------------------------------------------------------------------

alter table public.event_reminders enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'event_reminders'
      and policyname = 'couple manages event reminders'
  ) then
    create policy "couple manages event reminders"
      on public.event_reminders for all
      to authenticated
      using (public.is_couple_member(couple_id))
      with check (public.is_couple_member(couple_id));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime
--
-- A reminder added on one phone has to reach the other, because the other phone
-- is the one that has to schedule it locally.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.event_reminders') is not null
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'event_reminders'
     )
  then
    alter publication supabase_realtime add table public.event_reminders;
  end if;
end $$;

-- Reminders are removed from the UI, and a DELETE carries only the primary key
-- unless the old row is in the WAL for the subscriber's filter to match. Same
-- reasoning as 0009.
alter table public.event_reminders replica identity full;
