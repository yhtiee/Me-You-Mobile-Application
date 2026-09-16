-- ============================================================================
-- 0026 · Ads — one definition of premium, and rewarded Coach questions
--
-- Two things ads made urgent.
--
-- 1. "Is this couple premium?" had three answers.
--
--    `claim_coach_question()` (0005) and `coach_quota()` (0015) both computed
--    `is_premium and (premium_until is null or premium_until > now())`, inlined,
--    with a comment asking whoever changes one to change the other. The client
--    read neither: Home selected the raw `is_premium` column and ignored expiry,
--    and every other ad slot read a *mock* provider where premium is hardcoded
--    to false.
--
--    While ads were dashed placeholders that was cosmetic. With real ads it
--    means a lapsed subscriber is treated as premium on Home and as free on
--    Coach, and a paying couple sees live ads on Calendar, You and Play. The
--    rule now lives in exactly one function and everything calls it.
--
-- 2. Rewarded ads on the Coach limit.
--
--    When today's free questions are spent, the limit dialog can offer "watch a
--    short ad for one more question" beside the Premium upsell. That is the one
--    ad format in the app the user explicitly chooses, so it never interrupts
--    anything. The grant is capped per day so the Coach cannot become an
--    ad-watching loop — for the user's sake as much as for abuse.
--
-- Nothing here removes or renames anything a deployed client reads.
-- `coach_quota()` keeps its exact signature, and its `allowance` column simply
-- starts including earned bonuses — which the composer's "2 of 3 left" line
-- already renders from, so the count updates with no client change.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Premium, defined once
-- ---------------------------------------------------------------------------

/**
 * Whether the caller's couple currently has premium.
 *
 * `security definer` so it reads `couples` regardless of which policy the
 * caller would otherwise see it through, and `stable` so Postgres may evaluate
 * it once per statement. Null couple (unpaired) reads as not premium.
 */
create or replace function public.current_couple_is_premium()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select c.is_premium and (c.premium_until is null or c.premium_until > now())
       from public.couples c
      where c.id = public.current_couple_id()),
    false
  );
$$;

revoke all on function public.current_couple_is_premium() from public, anon;
grant execute on function public.current_couple_is_premium() to authenticated;

-- ---------------------------------------------------------------------------
-- Rewarded bonus questions
-- ---------------------------------------------------------------------------

alter table public.coach_usage
  add column if not exists bonus_questions integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'coach_usage_bonus_non_negative'
  ) then
    alter table public.coach_usage
      add constraint coach_usage_bonus_non_negative check (bonus_questions >= 0);
  end if;
end $$;

/*
 * The free allowance and the daily rewarded cap, in one place.
 *
 * Functions rather than bare constants so every definition below reads the
 * same numbers. The old code repeated `3` in two functions with a comment
 * asking people to keep them in step, which is how the numbers would have
 * drifted the first time anyone changed one.
 */
create or replace function public.coach_free_allowance()
returns integer
language sql
immutable
as $$ select 3 $$;

/*
 * Three rewarded questions a day at most.
 *
 * The limit dialog exists to say "that's enough for today, come back tomorrow
 * or go premium". Letting ads undo that without a ceiling would turn a gentle
 * cap into a slot machine, which is the opposite of the product's tone — and
 * it would also be the easiest place in the app to farm ad views.
 */
create or replace function public.coach_rewarded_daily_cap()
returns integer
language sql
immutable
as $$ select 3 $$;

-- ---------------------------------------------------------------------------
-- Claim, now allowance-aware
--
-- Same behaviour as 0005 in every respect except the allowance: the atomic
-- upsert, the rollback on refusal so a refused attempt does not burn a
-- question, and premium short-circuiting the cap. Only the ceiling moved from
-- a literal to `free + earned bonus`.
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

  -- The conflict target is referenced by bare table name, not schema-qualified:
  -- `public.coach_usage.questions_used` is a parse error inside ON CONFLICT.
  insert into public.coach_usage as u (user_id, usage_date, questions_used)
  values (auth.uid(), today, 1)
  on conflict (user_id, usage_date) do update
    set questions_used = u.questions_used + 1
  returning u.questions_used, u.bonus_questions into used, bonus;

  if public.current_couple_is_premium() then
    return true;
  end if;

  if used > public.coach_free_allowance() + coalesce(bonus, 0) then
    -- Hand the claim back so a refused attempt does not burn an allowance.
    update public.coach_usage
       set questions_used = questions_used - 1
     where user_id = auth.uid() and usage_date = today;
    return false;
  end if;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Quota, now allowance-aware. Signature unchanged.
-- ---------------------------------------------------------------------------

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
    public.current_couple_is_premium();
$$;

-- ---------------------------------------------------------------------------
-- Grant one rewarded question
-- ---------------------------------------------------------------------------

/*
 * Called by the client after the ad SDK reports the reward was earned.
 *
 * Trust boundary, stated plainly: this trusts the client's word that an ad was
 * watched. A modified app could call it without watching anything. The daily
 * cap bounds what that is worth — at most three extra Coach questions a day —
 * which is an acceptable exposure while ads serve test creatives.
 *
 * Before production ads, AdMob server-side verification (SSV) should replace
 * this trust: AdMob calls a signed callback URL when a reward is earned, and
 * the grant happens there instead of on the client's say-so.
 *
 * Returns the new allowance, or null when nothing was granted — premium couples
 * have no cap to raise, and the daily rewarded cap may already be used.
 */
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

  if public.current_couple_is_premium() then
    return null;
  end if;

  insert into public.coach_usage as u (user_id, usage_date, questions_used, bonus_questions)
  values (auth.uid(), today, 0, 1)
  on conflict (user_id, usage_date) do update
    set bonus_questions = u.bonus_questions + 1
    -- The cap lives in the WHERE so the check and the increment are one atomic
    -- statement: two rewards landing at once cannot both slip under the cap.
    where u.bonus_questions < public.coach_rewarded_daily_cap()
  returning u.bonus_questions into granted;

  if granted is null then
    return null;
  end if;

  return public.coach_free_allowance() + granted;
end;
$$;

/*
 * How many rewarded questions are still available today.
 *
 * Lets the limit dialog decide whether to offer the ad at all. Offering a
 * reward the server will refuse would show someone an ad and then give them
 * nothing, which is both a broken promise and against AdMob's rewarded policy.
 */
create or replace function public.coach_rewarded_remaining()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.current_couple_is_premium() then 0
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

revoke all on function public.grant_coach_bonus()        from public, anon;
revoke all on function public.coach_rewarded_remaining() from public, anon;
grant execute on function public.grant_coach_bonus()        to authenticated;
grant execute on function public.coach_rewarded_remaining() to authenticated;
