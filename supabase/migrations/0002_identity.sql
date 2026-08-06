-- ============================================================================
-- 0002 · Identity and pairing
-- profiles → couples → couple_members, plus the two RPCs the pairing screens
-- need (create-hub and join-partner).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user
-- ---------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,

  first_name   text,
  last_name    text,

  /**
   * What the UI actually renders — the couple banner, "things you know about
   * Sarah", the coach's prompts. Kept as its own column rather than derived on
   * read: it defaults to the first name but is the thing a user would change if
   * their partner calls them something else, and that preference has nowhere to
   * live if the name is computed.
   */
  display_name text        not null default 'You',

  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

/**
 * Mirror every new auth user into `profiles`.
 *
 * Without this the app has to create its own profile row on first launch, which
 * races the very first query and fails whenever a social sign-in returns before
 * the client is ready. Doing it in the same transaction as the signup means a
 * profile always exists by the time a session does.
 */
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_first text := nullif(trim(new.raw_user_meta_data ->> 'first_name'), '');
  meta_last  text := nullif(trim(new.raw_user_meta_data ->> 'last_name'), '');
  meta_full  text := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), '')
  );
begin
  /*
   * Two sources feed this. Email sign-up sends `first_name` / `last_name`
   * explicitly; OAuth providers send a single `full_name` or `name` and nothing
   * split out. Splitting the OAuth case on the first space is a guess — plenty
   * of names do not divide that way — but it is only used to seed the fields,
   * and the user can correct them in settings. `display_name` is what the app
   * renders, and it prefers the first name either way.
   */
  insert into public.profiles (id, first_name, last_name, display_name, avatar_url)
  values (
    new.id,
    coalesce(meta_first, nullif(split_part(meta_full, ' ', 1), '')),
    coalesce(
      meta_last,
      nullif(substr(meta_full, strpos(meta_full, ' ') + 1), meta_full)
    ),
    coalesce(
      meta_first,
      nullif(split_part(meta_full, ' ', 1), ''),
      meta_full,
      split_part(coalesce(new.email, 'You'), '@', 1)
    ),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- couples
-- ---------------------------------------------------------------------------

create table public.couples (
  id                  uuid primary key default gen_random_uuid(),

  -- 6 characters, always stored uppercase; `redeem_couple_code` upper-cases the
  -- input so "lv82k9" and "LV82K9" match. Deliberately plain `text` rather than
  -- `citext`: Supabase installs extensions into the `extensions` schema, and
  -- every function here pins `search_path = public`, so a citext cast inside one
  -- fails at runtime with `type "citext" does not exist`.
  --
  -- Nulled out once redeemed: the PRD copy promises "it only works once", and
  -- dropping the value is a stronger guarantee than a boolean somebody forgets
  -- to check.
  invite_code         text unique,
  invite_expires_at   timestamptz,
  invite_redeemed_at  timestamptz,

  together_since      date,

  -- Denormalised streak. Recomputed by trigger in 0003 rather than counted on
  -- read, because the home screen asks for it on every render.
  streak_count        integer not null default 0,
  streak_last_date    date,

  -- Deliberately NOT a foreign key to `levels`. That table holds the five named
  -- tiers (1, 5, 10, 20, 50), and an FK would make every level between them
  -- unrepresentable — a couple could never sit at level 7. Resolve the title by
  -- taking the highest tier at or below this number.
  level               integer not null default 1,

  is_premium          boolean not null default false,
  premium_until       timestamptz,

  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint couples_streak_non_negative check (streak_count >= 0)
);

create trigger couples_touch_updated_at
  before update on public.couples
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- couple_members
-- ---------------------------------------------------------------------------

create table public.couple_members (
  couple_id uuid        not null references public.couples (id) on delete cascade,
  user_id   uuid        not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  -- Set rather than deleted on unpair, so history survives and a re-pair does
  -- not silently inherit the old couple's streak.
  left_at   timestamptz,
  primary key (couple_id, user_id)
);

/** A person can be in exactly one active couple. */
create unique index couple_members_one_active_per_user
  on public.couple_members (user_id)
  where left_at is null;

create index couple_members_by_couple
  on public.couple_members (couple_id)
  where left_at is null;

/**
 * Two people to a couple. Enforced by trigger because the rule is "at most two
 * *active* rows per couple", which no unique index can express.
 */
create or replace function public.enforce_couple_size()
returns trigger
language plpgsql
as $$
begin
  if (
    select count(*)
    from public.couple_members
    where couple_id = new.couple_id
      and left_at is null
  ) > 2 then
    raise exception 'A couple can only have two members'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create constraint trigger couple_members_max_two
  after insert or update on public.couple_members
  deferrable initially immediate
  for each row execute function public.enforce_couple_size();

-- ---------------------------------------------------------------------------
-- Security helpers
--
-- Defined here, not in 0001, because these are `language sql` and Postgres
-- parses a SQL function body at CREATE time — declaring them before
-- `couple_members` exists fails with `relation "public.couple_members" does not
-- exist`. (plpgsql bodies are not parsed until first call, which is why the
-- RPCs below can reference each other freely.)
--
-- All SECURITY DEFINER on purpose. A policy on `couple_members` that queries
-- `couple_members` re-enters that table's own policies and Postgres aborts with
-- infinite recursion. Running the lookup as the definer skips RLS on the inner
-- read, which breaks the cycle — this is why every policy in 0007 calls these
-- instead of writing subqueries inline.
--
-- `search_path` is pinned on each so a caller cannot shadow `public` with their
-- own schema and change what these resolve to.
-- ---------------------------------------------------------------------------

/** The couple the current user actively belongs to, or null. */
create or replace function public.current_couple_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select m.couple_id
  from public.couple_members m
  where m.user_id = auth.uid()
    and m.left_at is null
  limit 1;
$$;

/** Is the current user an active member of this couple? */
create or replace function public.is_couple_member(target_couple uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.couple_members m
    where m.couple_id = target_couple
      and m.user_id = auth.uid()
      and m.left_at is null
  );
$$;

/** Is this other user the current user's partner (or the user themselves)? */
create or replace function public.shares_couple_with(other_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select other_user = auth.uid() or exists (
    select 1
    from public.couple_members me
    join public.couple_members them
      on them.couple_id = me.couple_id
     and them.left_at is null
    where me.user_id = auth.uid()
      and me.left_at is null
      and them.user_id = other_user
  );
$$;

-- ---------------------------------------------------------------------------
-- Pairing RPCs
--
-- Both are SECURITY DEFINER because they must touch rows the caller cannot yet
-- see: redeeming a code means reading a couple you are — by definition — not a
-- member of, which RLS correctly forbids. Keeping that lookup inside a function
-- with a narrow contract is what lets the policies stay strict.
-- ---------------------------------------------------------------------------

/** 6 chars, no I/O/0/1 — those are the pairs people misread off a screen. */
create or replace function public.generate_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  attempt   integer := 0;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;

    exit when not exists (
      select 1 from public.couples c where c.invite_code = candidate
    );

    attempt := attempt + 1;
    if attempt > 50 then
      raise exception 'Could not allocate an unused invite code';
    end if;
  end loop;

  return candidate;
end;
$$;

/**
 * Create a hub and return it with a fresh code.
 *
 * Idempotent for a user who already has an active couple: it returns that one
 * instead of stranding them in a second. Tapping "Create our hub" twice is one
 * back-swipe away, and the alternative is an orphaned couple row plus a code
 * that will never be redeemed.
 */
create or replace function public.create_couple(p_together_since date default null)
returns public.couples
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id uuid := public.current_couple_id();
  couple      public.couples;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if existing_id is not null then
    select * into couple from public.couples where id = existing_id;
    return couple;
  end if;

  insert into public.couples (invite_code, invite_expires_at, together_since, created_by)
  values (
    public.generate_invite_code(),
    now() + interval '7 days',
    p_together_since,
    auth.uid()
  )
  returning * into couple;

  insert into public.couple_members (couple_id, user_id)
  values (couple.id, auth.uid());

  return couple;
end;
$$;

/**
 * Join a partner's hub with their code.
 *
 * Returns the couple id. Raises with distinguishable messages so the join
 * screen can say which of the three things went wrong rather than "invalid".
 */
create or replace function public.redeem_couple_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  couple      public.couples;
  member_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if public.current_couple_id() is not null then
    raise exception 'You are already paired' using errcode = 'P0001';
  end if;

  -- Normalised here rather than by column type: people type codes in lowercase
  -- and paste them with stray spaces.
  select * into couple
  from public.couples c
  where c.invite_code = upper(trim(p_code))
  for update;

  if couple.id is null then
    raise exception 'That code does not match a hub' using errcode = 'P0002';
  end if;

  if couple.invite_expires_at is not null and couple.invite_expires_at < now() then
    raise exception 'That code has expired' using errcode = 'P0003';
  end if;

  select count(*) into member_count
  from public.couple_members
  where couple_id = couple.id and left_at is null;

  if member_count >= 2 then
    raise exception 'That hub is already full' using errcode = 'P0004';
  end if;

  insert into public.couple_members (couple_id, user_id)
  values (couple.id, auth.uid());

  -- Burn the code. Single use, as promised on the create-hub screen.
  update public.couples
  set invite_code = null,
      invite_redeemed_at = now()
  where id = couple.id;

  return couple.id;
end;
$$;

/** Leave the current couple. Keeps the row, so the history is auditable. */
create or replace function public.leave_couple()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.couple_members
  set left_at = now()
  where user_id = auth.uid()
    and left_at is null;
end;
$$;
