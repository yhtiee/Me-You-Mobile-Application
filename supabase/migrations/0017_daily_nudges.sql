-- ============================================================================
-- 0017 · Daily nudges — "did I actually message them today?"
--
-- The hand-off sheet has always been able to *open* WhatsApp. It has never been
-- able to remember that you did, so the one question the check-in box asks —
-- have you reached out today — had no answer beyond a single boolean on
-- `check_ins.checked_on_partner`, which cannot say *where*.
--
-- Deliberately NOT an enum for `channel`. `mood_key` and `tool_kind` are enums
-- because they are closed sets the schema owns; the list of messaging apps is
-- owned by the app and changes with a release, not a migration. An older client
-- writing a channel this database has never heard of should store a row, not
-- raise a constraint violation on a user trying to tick a box.
-- ============================================================================

create table if not exists public.daily_nudges (
  id         uuid        primary key default gen_random_uuid(),
  couple_id  uuid        not null references public.couples  (id) on delete cascade,
  user_id    uuid        not null references public.profiles (id) on delete cascade,

  -- Same convention as `check_ins.entry_date`: a plain UTC date, because "did
  -- you message them today" is a calendar question and the row is the answer.
  -- The client's `todayKey()` computes the identical value.
  day        date        not null default (now() at time zone 'utc')::date,

  -- Matches a key in `constants/nudges.ts`. Unknown values are inert.
  channel    text        not null,
  created_at timestamptz not null default now(),

  constraint daily_nudge_channel_length check (char_length(trim(channel)) between 1 and 32)
);

-- Ticking the same app twice in a day is the same fact, so the row is the
-- toggle: insert to mark, delete to unmark. No boolean to keep in sync.
create unique index if not exists daily_nudges_one_per_day
  on public.daily_nudges (user_id, day, channel);

create index if not exists daily_nudges_by_user_day
  on public.daily_nudges (user_id, day desc);

-- ---------------------------------------------------------------------------
-- RLS — own rows only, and that is a product decision rather than an oversight.
--
-- Everything else in this schema that touches the couple is couple-readable,
-- because the whole app is about the two of you seeing each other. This one is
-- not. A per-app checklist of which channels you used is a record of your own
-- behaviour kept to help *you* remember, and surfacing "they opened Instagram
-- but not WhatsApp" to a partner turns a reminder into surveillance.
--
-- What the partner already sees is the fact that matters: `checked_on_partner`
-- on today's check-in, which is couple-readable under 0007.
-- ---------------------------------------------------------------------------

alter table public.daily_nudges enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'daily_nudges'
      and policyname = 'own nudges only'
  ) then
    create policy "own nudges only"
      on public.daily_nudges for all
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid() and public.is_couple_member(couple_id));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime
--
-- Scoped to `user_id` by the subscriber, not `couple_id`: the same reasoning as
-- `picker_swipes` in 0009 — the table carries a couple id, so a couple filter
-- would forward these rows to the partner's device even though RLS would refuse
-- the read. Keeping the socket honest matters as much as keeping the query
-- honest.
--
-- `replica identity full` because unticking is a DELETE, and Postgres sends
-- only the primary key for a DELETE otherwise — which the subscriber's
-- `user_id=eq.…` filter has nothing to match against.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'daily_nudges'
  ) then
    alter publication supabase_realtime add table public.daily_nudges;
  end if;
end $$;

alter table public.daily_nudges replica identity full;
