-- ============================================================================
-- 0018 · Coin sessions — one flipper, one outcome, one argument at a time
--
-- The coin was decided on the device: `Math.random()` in `useCoinGame.flip()`,
-- animated, then logged. Two consequences, both bad for a game whose entire
-- premise is "we will both accept what this says":
--
--   1. Both partners could flip at the same moment and get *different*
--      answers, because each phone rolled its own die. There was nothing to
--      reconcile them and nothing that even noticed.
--   2. There was no notion of a turn, so "who flips" was whoever tapped first.
--
-- This adds the missing state: a session is one thing being settled, exactly
-- one person may flip it, the result is produced server-side so both phones
-- read the same row, and it stays open until somebody explicitly ends it.
--
-- `tool_events` is untouched and still the log. This table is the *state
-- machine*, not the history — `play_stats()`, `fetchCoinFlips` and the tally on
-- the coin screen all keep working against the rows they already read, and
-- `flip_coin_session` writes one for every flip so they stay complete.
-- ============================================================================

create table if not exists public.coin_sessions (
  id             uuid        primary key default gen_random_uuid(),
  couple_id      uuid        not null references public.couples  (id) on delete cascade,

  -- Who is allowed to flip. Assigned by `claim_coin_session`, never chosen.
  flipper_id     uuid        not null references public.profiles (id) on delete cascade,

  -- What is being settled ("who takes the bins out"). Optional: sometimes you
  -- just want a coin.
  stake          text,

  -- Null until flipped. This is the *outcome*, i.e. who the coin picked — not
  -- who flipped it, which is `flipper_id`.
  result_user_id uuid        references public.profiles (id) on delete set null,
  flipped_at     timestamptz,

  -- Set by `end_coin_session`. While null this session is the couple's open
  -- one and no other can be created.
  ended_at       timestamptz,
  created_at     timestamptz not null default now(),

  constraint coin_session_stake_length check (stake is null or char_length(trim(stake)) between 1 and 120),
  -- A result without a timestamp (or the reverse) is a half-written flip.
  constraint coin_session_result_complete
    check ((result_user_id is null) = (flipped_at is null))
);

/*
 * One open session per couple, enforced by the database.
 *
 * This is the whole feature, and it has to live here rather than in the client:
 * two phones tapping "settle something" in the same second both see zero open
 * sessions and both insert. A partial unique index makes the second insert fail
 * instead, and `claim_coin_session` turns that failure into "here is the one
 * that already exists" — so a race produces one session and two people looking
 * at it, which is the correct outcome rather than merely a handled error.
 */
create unique index if not exists coin_sessions_one_open_per_couple
  on public.coin_sessions (couple_id)
  where ended_at is null;

create index if not exists coin_sessions_by_couple
  on public.coin_sessions (couple_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Whose turn it is
-- ---------------------------------------------------------------------------

/*
 * Alternate from the last session that was actually flipped.
 *
 * Not "whoever taps first", which is the rule the old build had by accident and
 * which rewards whoever is holding their phone. Not random per session either:
 * a coin that also randomises *who tosses it* is asking the user to trust two
 * invisible decisions instead of one, and the flip is the one that is supposed
 * to feel arbitrary.
 *
 * Alternation is checkable — "you did the last one" is a sentence either
 * partner can verify — and it needs no negotiation. Sessions ended without a
 * flip are skipped: abandoning a session should not cost you your turn.
 *
 * Falls back to the caller when there is no history, and when the couple has
 * only one member (the partner lookup returns null and there is nobody to
 * alternate to).
 */
create or replace function public.next_coin_flipper(p_couple_id uuid)
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  with last_flip as (
    select flipper_id
      from public.coin_sessions
     where couple_id = p_couple_id
       and flipped_at is not null
     order by flipped_at desc
     limit 1
  )
  select coalesce(
    -- The other *active* member of the couple, relative to whoever flipped
    -- last. `left_at is null` matches `current_couple_id()` and
    -- `is_couple_member()`: a partner who has unpaired keeps their row, so
    -- without this the turn could be handed to somebody who has left and the
    -- coin would wait for a flip that can never come.
    (select cm.user_id
       from public.couple_members cm
      where cm.couple_id = p_couple_id
        and cm.left_at is null
        and cm.user_id is distinct from (select flipper_id from last_flip)
      limit 1),
    auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Claim / flip / end
-- ---------------------------------------------------------------------------

/*
 * Return the couple's open session, creating one if there is none.
 *
 * Idempotent by design: both phones call this on opening the coin screen and
 * both must end up looking at the same row. The insert races against the
 * partial unique index above, and a conflict means the other device won — so we
 * re-read rather than error.
 *
 * `p_stake` only applies to a session this call creates. It deliberately does
 * not overwrite the stake on a session that already exists: the person who
 * opened the argument named it, and the second person to arrive should not be
 * able to silently rename what is being settled.
 */
create or replace function public.claim_coin_session(p_stake text default null)
returns public.coin_sessions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_couple_id uuid := public.current_couple_id();
  v_session   public.coin_sessions;
begin
  if v_couple_id is null then
    raise exception 'You are not in a hub yet.' using errcode = 'P0001';
  end if;

  select * into v_session
    from public.coin_sessions
   where couple_id = v_couple_id and ended_at is null
   limit 1;

  if found then
    return v_session;
  end if;

  begin
    insert into public.coin_sessions (couple_id, flipper_id, stake)
    values (v_couple_id, public.next_coin_flipper(v_couple_id), nullif(trim(p_stake), ''))
    returning * into v_session;
  exception when unique_violation then
    -- The other device created it between our select and our insert.
    select * into v_session
      from public.coin_sessions
     where couple_id = v_couple_id and ended_at is null
     limit 1;
  end;

  return v_session;
end;
$$;

/*
 * Flip it. Server-side, once, by the assigned flipper only.
 *
 * The randomness lives here rather than on the device for the reason at the top
 * of this file: two phones rolling separately is two answers. `flipped_at is
 * null` in the WHERE clause makes this idempotent under a double tap — the
 * second call updates nothing and re-reads the settled row, so a flaky network
 * cannot produce two outcomes for one session.
 *
 * Also writes the `tool_events` row the history and stats already read, so
 * there is exactly one place a flip is recorded from.
 */
create or replace function public.flip_coin_session(p_session_id uuid)
returns public.coin_sessions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_session public.coin_sessions;
  v_winner  uuid;
  v_members uuid[];
begin
  select * into v_session
    from public.coin_sessions
   where id = p_session_id
   for update;

  if not found then
    raise exception 'That coin session no longer exists.' using errcode = 'P0001';
  end if;

  if v_session.ended_at is not null then
    raise exception 'That session has already been closed.' using errcode = 'P0001';
  end if;

  if v_session.flipper_id <> auth.uid() then
    raise exception 'It is not your turn to flip.' using errcode = 'P0001';
  end if;

  -- Already flipped: hand back what it landed on rather than rolling again.
  if v_session.flipped_at is not null then
    return v_session;
  end if;

  -- Active members only: an unpaired partner's row survives, and a coin that
  -- can land on someone who has left is a coin that loses arguments for you.
  select array_agg(user_id order by user_id)
    into v_members
    from public.couple_members
   where couple_id = v_session.couple_id
     and left_at is null;

  -- A hub with one member can still flip; the coin just always picks them.
  v_winner := v_members[1 + floor(random() * array_length(v_members, 1))::int];

  update public.coin_sessions
     set result_user_id = v_winner,
         flipped_at     = now()
   where id = p_session_id
     and flipped_at is null
  returning * into v_session;

  insert into public.tool_events (couple_id, user_id, kind, payload)
  values (
    v_session.couple_id,
    auth.uid(),
    'coin',
    jsonb_build_object('winner', v_winner, 'stake', v_session.stake, 'session', p_session_id)
  );

  return v_session;
end;
$$;

/*
 * Close it, so the next argument gets its own session.
 *
 * Either partner may end a session, not just the flipper — the person who lost
 * the toss is at least as likely to be the one who says "fine, done". The
 * screen asks before it closes.
 */
create or replace function public.end_coin_session(p_session_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.coin_sessions
     set ended_at = now()
   where id = p_session_id
     and ended_at is null
     and public.is_couple_member(couple_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.coin_sessions enable row level security;

do $$
begin
  -- Couple-scoped for everything. Both partners must see the same session —
  -- that is the point — and either may create or close one. The single rule the
  -- table enforces about *who flips* is enforced in `flip_coin_session`, not
  -- here, because it is a rule about one column rather than about the row.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'coin_sessions'
      and policyname = 'couple manages coin sessions'
  ) then
    create policy "couple manages coin sessions"
      on public.coin_sessions for all
      to authenticated
      using (public.is_couple_member(couple_id))
      with check (public.is_couple_member(couple_id));
  end if;
end $$;

revoke all on function public.next_coin_flipper(uuid)  from public, anon;
revoke all on function public.claim_coin_session(text)  from public, anon;
revoke all on function public.flip_coin_session(uuid)   from public, anon;
revoke all on function public.end_coin_session(uuid)    from public, anon;

grant execute on function public.next_coin_flipper(uuid) to authenticated;
grant execute on function public.claim_coin_session(text) to authenticated;
grant execute on function public.flip_coin_session(uuid)  to authenticated;
grant execute on function public.end_coin_session(uuid)   to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
--
-- The load-bearing subscription of the whole feature: the partner's screen has
-- to turn from "waiting for them to flip" into the result without anyone
-- touching anything. `tool_events` joins the publication here too — it was
-- never in it, which is why nothing in Play has ever updated live.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['coin_sessions', 'tool_events'] loop
    if to_regclass('public.' || t) is not null
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
       )
    then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Ending a session is an UPDATE, but a cascade delete of a couple is not, and
-- the subscriber filters on `couple_id`. See the note in 0009.
alter table public.coin_sessions replica identity full;
