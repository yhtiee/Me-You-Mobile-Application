-- ============================================================================
-- 0012 · Play — the gaps 0006 left
--
-- 0006 modelled the picker, trivia, date ideas and a tool log, which was enough
-- to render every Play screen once. Wiring them up surfaced three things it
-- could not do:
--
--   1. The wheel had nowhere to keep its options, so they were device-local and
--      the partner never saw the list they were being judged by.
--   2. `trivia_responses` is keyed `(question_id, user_id)`, so a question can
--      be answered exactly once per person, for ever. The screen has a "Play
--      again" button. It could not have worked.
--   3. The hub wants a live line per tile, which was six queries.
--
-- NOT here, deliberately: growth-habit history. README open question 2 defers it
-- "until the UI shows a trend", and the redesigned growth screen still shows
-- only the current week. Adding the table now would be a schema nobody reads.
--
-- Re-runnable, unlike 0001–0007: every statement guards itself. The trivia
-- change is the one destructive step and it is called out where it happens.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Wheel options
--
-- Couple-scoped and shared, not per-user. "Whose turn" only works if both
-- people are looking at the same wheel — a private list of chores you assign to
-- someone else is a very different, much worse product.
-- ---------------------------------------------------------------------------

create table if not exists public.wheel_options (
  id         uuid        primary key default gen_random_uuid(),
  couple_id  uuid        not null references public.couples (id) on delete cascade,
  label      text        not null,
  -- Explicit, because the wedge colours are assigned by index: ordering by
  -- `created_at` would re-colour the whole wheel whenever a row was removed.
  position   integer     not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint wheel_option_label_length check (char_length(trim(label)) between 1 and 60)
);

create index if not exists wheel_options_by_couple
  on public.wheel_options (couple_id, position);

-- One couple cannot list the same chore twice. Case-insensitive, because
-- "Dishes" and "dishes" on one wheel is a data-entry slip, not two options.
create unique index if not exists wheel_options_unique_label
  on public.wheel_options (couple_id, lower(trim(label)));

-- ---------------------------------------------------------------------------
-- Trivia rounds
--
-- A round is one sitting: three questions, one score, replayable. Without it
-- `trivia_responses` can only ever hold a person's first-ever answer to a
-- question, which makes the score permanent and the game single-use.
-- ---------------------------------------------------------------------------

create table if not exists public.trivia_rounds (
  id           uuid        primary key default gen_random_uuid(),
  couple_id    uuid        not null references public.couples (id) on delete cascade,
  player_id    uuid        not null references public.profiles (id) on delete cascade,
  -- Whom the round was about. Both partners answer questions about each other,
  -- so a round belongs to one player guessing about one subject.
  subject_id   uuid references public.profiles (id) on delete set null,
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  -- Denormalised on completion. The hub asks "your best score" on every open
  -- and counting responses per round to answer that is three joins deep.
  score        integer,
  total        integer,

  constraint trivia_round_score_range
    check (score is null or (total is not null and score between 0 and total))
);

create index if not exists trivia_rounds_by_player
  on public.trivia_rounds (player_id, completed_at desc);

/*
 * Scope responses to a round.
 *
 * DESTRUCTIVE, once: existing responses have no round to belong to and the
 * column is `not null`, so they are deleted. That is safe in practice — the
 * trivia screen was never wired to Postgres, so this table is empty on every
 * environment that exists. If yours is not, back it up before running this.
 */
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trivia_responses'
      and column_name = 'round_id'
  ) then
    delete from public.trivia_responses;

    alter table public.trivia_responses
      drop constraint if exists trivia_responses_pkey;

    alter table public.trivia_responses
      add column round_id uuid not null
        references public.trivia_rounds (id) on delete cascade;

    -- A question appears once per round; a person answers it once in that
    -- round. `user_id` stays in the key because a round is per player and this
    -- keeps the constraint true even if rounds ever become shared.
    alter table public.trivia_responses
      add constraint trivia_responses_pkey
        primary key (round_id, question_id, user_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Hub stats
--
-- One round trip for the six tile lines, instead of six.
--
-- `security invoker` (the default) on purpose: every count below is already
-- visible to the caller under the 0007 policies, and the one number that is not
-- — how many items both partners liked — is delegated to `picker_matches()`,
-- which is the function that owns that privilege and contains it.
-- ---------------------------------------------------------------------------

/*
 * The `_count` suffixes are load-bearing, not house style.
 *
 * A `returns table` column name is in scope inside the body as if it were a
 * parameter, so naming one `wheel_options` — with `public.wheel_options` also
 * being a real table this function selects from — puts a variable and a
 * relation under one identifier. Postgres resolves that in favour of the
 * variable in some positions and errors with "column reference is ambiguous"
 * in others, and the failure mode is a stat that silently reads wrong rather
 * than a migration that refuses to apply. `wheel_options`, `picker_matches`
 * and `trivia_rounds` are all names of real objects here; do not shorten them
 * back to match the JSON keys.
 */
create or replace function public.play_stats()
returns table (
  coin_flips         bigint,
  wheel_spins        bigint,
  wheel_option_count bigint,
  picker_match_count bigint,
  picker_remaining   bigint,
  trivia_best        integer,
  trivia_round_count bigint,
  habits_rated       bigint,
  habits_total       bigint
)
language sql
stable
set search_path = public
as $$
  select
    (select count(*) from public.tool_events
      where kind = 'coin' and couple_id = public.current_couple_id()),
    (select count(*) from public.tool_events
      where kind = 'wheel' and couple_id = public.current_couple_id()),
    (select count(*) from public.wheel_options
      where couple_id = public.current_couple_id()),
    (select count(*) from public.picker_matches()),
    -- Items this person has not swiped yet: stock rows plus their own couple's,
    -- minus their own swipes. Their partner's swipes are invisible here and
    -- must stay that way.
    (select count(*)
       from public.picker_items i
      where (i.couple_id is null or i.couple_id = public.current_couple_id())
        and not exists (
          select 1 from public.picker_swipes s
          where s.item_id = i.id and s.user_id = auth.uid()
        )),
    (select max(score) from public.trivia_rounds
      where player_id = auth.uid() and completed_at is not null),
    (select count(*) from public.trivia_rounds
      where player_id = auth.uid() and completed_at is not null),
    (select count(*) from public.growth_habits
      where user_id = auth.uid() and rating is not null),
    (select count(*) from public.growth_habits
      where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.wheel_options  enable row level security;
alter table public.trivia_rounds  enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wheel_options'
      and policyname = 'couple manages wheel options'
  ) then
    create policy "couple manages wheel options"
      on public.wheel_options for all
      to authenticated
      using (public.is_couple_member(couple_id))
      with check (public.is_couple_member(couple_id));
  end if;

  -- Rounds are couple-readable, matching `trivia_responses` in 0007: the game
  -- only pays off when you find out how they did guessing about you.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trivia_rounds'
      and policyname = 'couple reads trivia rounds'
  ) then
    create policy "couple reads trivia rounds"
      on public.trivia_rounds for select
      to authenticated
      using (public.is_couple_member(couple_id));
  end if;

  -- But only you can start or finish your own round. Without the separate
  -- write policy either partner could post a score in the other's name.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trivia_rounds'
      and policyname = 'play own trivia rounds'
  ) then
    create policy "play own trivia rounds"
      on public.trivia_rounds for insert
      to authenticated
      with check (player_id = auth.uid() and public.is_couple_member(couple_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trivia_rounds'
      and policyname = 'finish own trivia rounds'
  ) then
    create policy "finish own trivia rounds"
      on public.trivia_rounds for update
      to authenticated
      using (player_id = auth.uid())
      with check (player_id = auth.uid());
  end if;
end $$;

revoke all on function public.play_stats() from public, anon;
grant execute on function public.play_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
--
-- `wheel_options` is the one that matters: the wheel is shared, so an option
-- added on one phone has to appear on the other before it is spun. The others
-- follow the same reasoning as 0009.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  wanted text[] := array['wheel_options', 'trivia_rounds', 'trivia_responses', 'date_ideas'];
begin
  foreach t in array wanted loop
    if to_regclass('public.' || t) is not null
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = t
       )
    then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Options and ideas are both deleted from the UI, and a DELETE carries only the
-- primary key unless the old row is in the WAL — which is what the subscriber's
-- `couple_id=eq.…` filter has to match against. See the note in 0009.
do $$
declare
  t text;
begin
  foreach t in array array['wheel_options', 'date_ideas'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I replica identity full', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Stock content the seed was missing
--
-- 0008 seeded five movies for a feature called "Movie & meal" and no meals, so
-- half the picker had nothing to swipe on. Same idempotent guard as 0008.
-- ---------------------------------------------------------------------------

insert into public.picker_items (couple_id, kind, title, meta)
select null, 'meal'::public.picker_kind, v.title, v.meta
from (values
  ('Thai from the place on the corner', 'Takeaway · 30 min'),
  ('Actually cook the pasta',           'Cook in · 25 min'),
  ('Breakfast for dinner',              'Cook in · 15 min'),
  ('That new ramen spot',               'Eat out · book ahead'),
  ('Cheese, bread, and no plan',        'Assembly · 5 min'),
  ('Jollof and plantain',               'Cook in · 45 min')
) as v (title, meta)
where not exists (
  select 1 from public.picker_items p
  where p.couple_id is null and p.kind = 'meal' and p.title = v.title
);

insert into public.date_ideas (couple_id, title, location, time_hint)
select null, v.title, v.location, v.time_hint
from (values
  ('Cook something neither of you can', 'Home',        'Any evening'),
  ('The museum you keep walking past',  'Town centre', 'Sun afternoon'),
  ('Drive somewhere with no plan',      'Anywhere',    'Sat morning')
) as v (title, location, time_hint)
where not exists (
  select 1 from public.date_ideas d
  where d.couple_id is null and d.title = v.title
);

-- More stock trivia. Three questions is one round and then the bank is dry;
-- these give a couple a few rounds before they start writing their own.
insert into public.trivia_questions (couple_id, subject_user_id, question, options, correct_index)
select null, null, v.question, v.options, v.correct_index
from (values
  ('What''s my go-to order?',        array['Something spicy', 'The safe option', 'Whatever you''re having', 'Dessert first'], 0),
  ('How do I take bad news?',        array['Quietly', 'Out loud', 'With a joke', 'I go for a walk'],                          2),
  ('What''s my love language?',      array['Words', 'Time', 'Touch', 'Acts'],                                                 1),
  ('Where would I move tomorrow?',   array['Somewhere hot', 'Somewhere green', 'A big city', 'Nowhere, I''m happy'],          3),
  ('What am I secretly good at?',    array['Remembering names', 'Parallel parking', 'Wrapping presents', 'Keeping plants alive'], 1)
) as v (question, options, correct_index)
where not exists (
  select 1 from public.trivia_questions t
  where t.couple_id is null and t.question = v.question
);
