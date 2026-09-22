-- ============================================================================
-- 0028 · Premium belongs to a person, not a hub
--
-- 0026 made "is this couple premium?" one function. The pricing changed: $1 a
-- month buys *one person* an ad-free app and an unlimited coach, so the
-- entitlement moves from `couples` to `profiles`.
--
-- Why this is a move and not an addition: a hub-level flag means one partner's
-- purchase silently pays for the other, and that is exactly what the store
-- listing must not promise. Leaving both would give the old question a second
-- answer, which is the bug 0026 existed to remove.
--
-- Nothing is live yet — no billing, no released build — so the flag is carried
-- over rather than mapped: anyone premium through their hub stays premium as a
-- person, and the hub's columns go.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The columns, on the person
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists is_premium    boolean not null default false,
  add column if not exists premium_until timestamptz;

comment on column public.profiles.is_premium is
  'Premium is per person. Written by the billing webhook; never by the client — the RLS policy on profiles allows a user to update their own row, so treat this as server-owned and re-check it there.';

-- Carry over anyone who was premium through their hub.
update public.profiles p
   set is_premium    = c.is_premium,
       premium_until = c.premium_until
  from public.couples c
  join public.couple_members m on m.couple_id = c.id and m.left_at is null
 where m.user_id = p.id
   and c.is_premium;

-- ---------------------------------------------------------------------------
-- Premium, defined once — now for the caller
-- ---------------------------------------------------------------------------

/**
 * Whether the caller currently has premium.
 *
 * `security definer` so the expiry rule cannot be read around by a policy, and
 * `stable` so Postgres may evaluate it once per statement. No session reads as
 * not premium.
 */
create or replace function public.current_user_is_premium()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_premium and (p.premium_until is null or p.premium_until > now())
       from public.profiles p
      where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.current_user_is_premium() from public, anon;
grant execute on function public.current_user_is_premium() to authenticated;

-- ---------------------------------------------------------------------------
-- Everything that asked the old question
--
-- Bodies are unchanged from 0026 apart from the entitlement call; see that
-- migration for why each one is shaped the way it is.
-- ---------------------------------------------------------------------------

create or replace function public.claim_coach_question()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  used  integer;
  bonus integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  insert into public.coach_usage as u (user_id, usage_date, questions_used)
  values (auth.uid(), today, 1)
  on conflict (user_id, usage_date) do update
    set questions_used = u.questions_used + 1
  returning u.questions_used, u.bonus_questions into used, bonus;

  if public.current_user_is_premium() then
    return true;
  end if;

  if used > public.coach_free_allowance() + coalesce(bonus, 0) then
    update public.coach_usage
       set questions_used = questions_used - 1
     where user_id = auth.uid() and usage_date = today;
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.coach_quota()
returns table (used integer, allowance integer, is_premium boolean)
language sql
stable
security definer
set search_path = public
as $$
  with today as (
    select u.questions_used, u.bonus_questions
      from public.coach_usage u
     where u.user_id = auth.uid()
       and u.usage_date = (now() at time zone 'utc')::date
  )
  select
    coalesce((select questions_used from today), 0),
    public.coach_free_allowance() + coalesce((select bonus_questions from today), 0),
    public.current_user_is_premium();
$$;

create or replace function public.grant_coach_bonus()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  today   date := (now() at time zone 'utc')::date;
  granted integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if public.current_user_is_premium() then
    return null;
  end if;

  insert into public.coach_usage as u (user_id, usage_date, questions_used, bonus_questions)
  values (auth.uid(), today, 0, 1)
  on conflict (user_id, usage_date) do update
    set bonus_questions = u.bonus_questions + 1
    where u.bonus_questions < public.coach_rewarded_daily_cap()
  returning u.bonus_questions into granted;

  if granted is null then
    return null;
  end if;

  return public.coach_free_allowance() + granted;
end;
$$;

create or replace function public.coach_rewarded_remaining()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.current_user_is_premium() then 0
    else greatest(
      0,
      public.coach_rewarded_daily_cap() - coalesce(
        (select u.bonus_questions
           from public.coach_usage u
          where u.user_id = auth.uid()
            and u.usage_date = (now() at time zone 'utc')::date),
        0
      )
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- The hub's copy goes
--
-- Dropped rather than deprecated: a column nothing writes is a column somebody
-- reads by accident. The function goes with it — the client that called it is
-- updated in the same change, and no build is published yet.
-- ---------------------------------------------------------------------------

drop function if exists public.current_couple_is_premium();

alter table public.couples
  drop column if exists is_premium,
  drop column if exists premium_until;

-- ---------------------------------------------------------------------------
-- The client may not sell itself premium
--
-- `profiles` has an "update your own row" policy (0007), which without this
-- would let a modified app set `is_premium = true` on itself and switch off its
-- own ads and coach limit. RLS decides which *rows* you may touch; column
-- privileges decide which *columns*, and are checked independently — so these
-- two stay writable only by the service role (the billing webhook) and by
-- `security definer` functions, which run as the owner.
--
-- `profile.ts` never sends these columns, so nothing in the app breaks.
-- ---------------------------------------------------------------------------

revoke insert (is_premium, premium_until) on public.profiles from authenticated, anon;
revoke update (is_premium, premium_until) on public.profiles from authenticated, anon;
