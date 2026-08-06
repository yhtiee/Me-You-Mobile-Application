-- ============================================================================
-- 0006 · Play & Settle (PRD Module 2)
-- The picker, trivia, date ideas, and a log for the coin and wheel.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Movie & meal picker
--
-- "Swipe separately. You'll only hear about the matches." That one line is the
-- whole design: swipes are private until they agree, so a partner's swipe must
-- never be readable on its own. The policy in 0007 restricts this table to the
-- swiper, and `picker_matches` below is the only way the other side surfaces.
-- ---------------------------------------------------------------------------

create table public.picker_items (
  id         uuid        primary key default gen_random_uuid(),
  -- Null means app-supplied content shared by everyone; a couple id means the
  -- pair added it themselves.
  couple_id  uuid references public.couples (id) on delete cascade,
  kind       public.picker_kind not null,
  title      text        not null,
  meta       text,
  created_at timestamptz not null default now()
);

create index picker_items_by_kind on public.picker_items (kind, couple_id);

create table public.picker_swipes (
  item_id    uuid        not null references public.picker_items (id) on delete cascade,
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  couple_id  uuid        not null references public.couples (id) on delete cascade,
  liked      boolean     not null,
  created_at timestamptz not null default now(),
  primary key (item_id, user_id)
);

create index picker_swipes_by_couple on public.picker_swipes (couple_id, liked);

/**
 * Items both partners swiped right on.
 *
 * A function rather than a view, and SECURITY DEFINER rather than invoker,
 * because the two requirements pull against each other: the caller must not be
 * able to read their partner's individual swipes (0007 restricts the table to
 * the swiper), but computing a match requires reading both sides. An invoker
 * view would run under the caller's own policy, see one row where it needs two,
 * and quietly return no matches ever.
 *
 * The definer rights are contained by the function's shape: it only ever emits
 * items where the count is 2, and it hard-scopes to the caller's own couple, so
 * there is no argument that can widen what it returns.
 */
create or replace function public.picker_matches()
returns table (
  item_id    uuid,
  kind       public.picker_kind,
  title      text,
  meta       text,
  matched_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    i.id,
    i.kind,
    i.title,
    i.meta,
    max(s.created_at) as matched_at
  from public.picker_swipes s
  join public.picker_items i on i.id = s.item_id
  where s.liked
    and s.couple_id = public.current_couple_id()
  group by i.id, i.kind, i.title, i.meta
  having count(distinct s.user_id) = 2;
$$;

-- ---------------------------------------------------------------------------
-- Trivia ("how well do you know each other")
-- ---------------------------------------------------------------------------

create table public.trivia_questions (
  id            uuid        primary key default gen_random_uuid(),
  -- Null for the app's stock question bank.
  couple_id     uuid references public.couples (id) on delete cascade,
  -- Whose answer is "correct" — the question is about one of them.
  subject_user_id uuid references public.profiles (id) on delete cascade,
  question      text        not null,
  -- Plain text array rather than jsonb: it is a fixed list of short strings and
  -- Postgres can constrain the length, which jsonb cannot.
  options       text[]      not null,
  correct_index integer     not null,
  created_at    timestamptz not null default now(),

  constraint trivia_options_length check (array_length(options, 1) between 2 and 6),
  constraint trivia_correct_in_range
    check (correct_index >= 0 and correct_index < array_length(options, 1))
);

create table public.trivia_responses (
  question_id  uuid        not null references public.trivia_questions (id) on delete cascade,
  user_id      uuid        not null references public.profiles (id) on delete cascade,
  couple_id    uuid        not null references public.couples (id) on delete cascade,
  chosen_index integer     not null,
  answered_at  timestamptz not null default now(),
  primary key (question_id, user_id),

  constraint trivia_response_non_negative check (chosen_index >= 0)
);

-- ---------------------------------------------------------------------------
-- Date ideas
-- ---------------------------------------------------------------------------

create table public.date_ideas (
  id         uuid        primary key default gen_random_uuid(),
  couple_id  uuid references public.couples (id) on delete cascade,
  title      text        not null,
  location   text,
  -- Free text ("Sat 7:30 pm"). A timestamp would imply a booking this is not;
  -- a scheduled date becomes a `calendar_events` row instead.
  time_hint  text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index date_ideas_by_couple on public.date_ideas (couple_id);

-- ---------------------------------------------------------------------------
-- Coin flips and wheel spins
-- ---------------------------------------------------------------------------

/**
 * A log, not state. The tools are decided the moment they land, so nothing
 * reads this to render — it exists so "who has been the bigger person lately"
 * is answerable later. Drop the table if that never ships; nothing depends on
 * it.
 */
create table public.tool_events (
  id         uuid        primary key default gen_random_uuid(),
  couple_id  uuid        not null references public.couples (id) on delete cascade,
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  kind       public.tool_kind not null,
  -- Shape varies per tool (coin: winner; wheel: options + landed index), which
  -- is exactly the case jsonb is for.
  payload    jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index tool_events_by_couple on public.tool_events (couple_id, created_at desc);
