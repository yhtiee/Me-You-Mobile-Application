-- ============================================================================
-- 0003 · Daily check-ins, love languages, streak
-- PRD Module 1. One check-in per person per day; the streak advances only on
-- days both of them showed up.
-- ============================================================================

create table public.check_ins (
  id                  uuid        primary key default gen_random_uuid(),
  couple_id           uuid        not null references public.couples (id) on delete cascade,
  user_id             uuid        not null references public.profiles (id) on delete cascade,

  -- Stored as a plain date, not a timestamp. "Did you check in today" is a
  -- calendar question, and the row is the answer.
  entry_date          date        not null default (now() at time zone 'utc')::date,

  mood                public.mood_key not null,
  battery             integer     not null,

  -- Only offered when the mood comes back sad or stressed (PRD Module 1), so
  -- nullable by design rather than by omission.
  need                public.need_key,

  -- "Yes, I've checked up on <partner> today" on the home screen.
  checked_on_partner  boolean     not null default false,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint check_ins_battery_range check (battery between 0 and 100),
  constraint check_ins_one_per_day unique (user_id, entry_date)
);

create index check_ins_by_couple_date
  on public.check_ins (couple_id, entry_date desc);

create trigger check_ins_touch_updated_at
  before update on public.check_ins
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Streak
-- ---------------------------------------------------------------------------

/**
 * Advance the couple's streak when the day becomes mutual.
 *
 * The rule is "the streak only grows when you both show up" — straight off the
 * first onboarding page — so this fires on the *second* check-in of a given
 * date, not the first. Guarding on `streak_last_date` keeps it idempotent: a
 * partner editing their mood later the same day re-runs the trigger but must
 * not bump the count again.
 *
 * Note this trusts `entry_date`, which is UTC. A couple in different time zones
 * can disagree about which day it is — see the README's open questions.
 */
create or replace function public.sync_couple_streak()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  members_in    integer;
  couple_row    public.couples;
begin
  select count(distinct user_id) into members_in
  from public.check_ins
  where couple_id = new.couple_id
    and entry_date = new.entry_date;

  if members_in < 2 then
    return new;
  end if;

  select * into couple_row from public.couples where id = new.couple_id for update;

  -- Already counted this date.
  if couple_row.streak_last_date is not distinct from new.entry_date then
    return new;
  end if;

  update public.couples
  set streak_count = case
        when couple_row.streak_last_date = new.entry_date - 1 then couple_row.streak_count + 1
        else 1
      end,
      streak_last_date = new.entry_date
  where id = new.couple_id;

  return new;
end;
$$;

create trigger check_ins_sync_streak
  after insert or update on public.check_ins
  for each row execute function public.sync_couple_streak();

-- ---------------------------------------------------------------------------
-- Love languages
-- ---------------------------------------------------------------------------

create table public.love_languages (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  key        public.love_language_key not null,
  -- Share of this person's profile, 0-100. The five rows are meant to total
  -- 100, but that is not enforced: a CHECK cannot see sibling rows, and a
  -- trigger doing it would reject every intermediate state while the user is
  -- still dragging the sliders. The API layer normalises on save.
  value      integer     not null,
  updated_at timestamptz not null default now(),

  constraint love_languages_value_range check (value between 0 and 100),
  constraint love_languages_one_per_key unique (user_id, key)
);

create trigger love_languages_touch_updated_at
  before update on public.love_languages
  for each row execute function public.touch_updated_at();
