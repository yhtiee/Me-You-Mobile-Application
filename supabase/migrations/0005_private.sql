-- ============================================================================
-- 0005 · Private per-user data
--
-- Everything in this file is visible to exactly one person. The to-do screen
-- says so out loud — "Private — <partner> never sees these" — and the coach is
-- somewhere you go to talk *about* the relationship, which only works if the
-- other half cannot read it.
--
-- These tables carry `couple_id` for scoping and cascade-on-unpair, never for
-- access: the policies in 0007 key on `user_id` alone. Do not "fix" that.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Private to-dos
-- ---------------------------------------------------------------------------

create table public.todos (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  couple_id  uuid references public.couples (id) on delete set null,
  label      text        not null,
  done       boolean     not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index todos_by_user on public.todos (user_id, done, created_at);

create trigger todos_touch_updated_at
  before update on public.todos
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- AI coach (PRD §5)
-- ---------------------------------------------------------------------------

/**
 * One conversation with the coach. Threads exist because the coach is a model,
 * not a person: every turn resends the whole transcript, so "the conversation"
 * has to be a bounded, orderable thing rather than one endless per-user list.
 */
create table public.coach_conversations (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references public.profiles (id) on delete cascade,
  couple_id       uuid references public.couples (id) on delete set null,
  title           text,

  -- Pinned per conversation, not global. Thinking blocks may only be replayed
  -- to the model that produced them, so a mid-conversation model swap has to be
  -- a deliberate decision, not a config change that silently invalidates
  -- history. Also invalidates the prompt cache, which is per-model.
  model           text        not null default 'claude-opus-5',

  -- Which build of the system prompt this thread started under. Editing the
  -- prompt mid-thread breaks the cached prefix and shifts behaviour mid-
  -- conversation; recording the version makes that visible instead of puzzling.
  prompt_version  integer     not null default 1,

  last_message_at timestamptz,
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index coach_conversations_by_user
  on public.coach_conversations (user_id, last_message_at desc nulls last);

create trigger coach_conversations_touch_updated_at
  before update on public.coach_conversations
  for each row execute function public.touch_updated_at();

create table public.coach_messages (
  id              uuid        primary key default gen_random_uuid(),
  conversation_id uuid        not null references public.coach_conversations (id) on delete cascade,
  -- Denormalised so the RLS policy is a column check rather than a join.
  user_id         uuid        not null references public.profiles (id) on delete cascade,

  -- Explicit ordinal, not a timestamp. Replay order must be exactly stable:
  -- two rows written in the same millisecond would order arbitrarily, and any
  -- reshuffle of the prefix invalidates the prompt cache from that point on —
  -- turning a cheap cache read into a full re-process of the thread.
  seq             integer     not null,

  role            public.coach_role not null,

  /**
   * The API content-block array, verbatim — not the extracted text.
   *
   * Flattening to a string looks equivalent and is not: with thinking on by
   * default, an assistant turn carries thinking blocks that must be passed back
   * *unchanged* on the same model, and dropping them breaks the next turn.
   * Store what the API returned; render from it.
   */
  content         jsonb       not null,

  /** Flattened text for list previews and search. Never replayed to the model. */
  preview         text,

  status          public.coach_message_status not null default 'complete',

  -- Worth its own column: a safety decline arrives as a normal 200 with
  -- `stop_reason: refusal` and empty content, so without this a refused turn is
  -- indistinguishable from a turn that produced nothing.
  stop_reason     text,
  error           text,

  -- Which model actually answered. May differ from the conversation's `model`
  -- when a refusal is served by a fallback.
  model           text,

  -- Usage, split the way the API reports it. Cached reads bill at roughly a
  -- tenth of fresh input, so collapsing these into one number makes the coach
  -- look far more expensive than it is and hides a broken cache.
  input_tokens                 integer,
  output_tokens                integer,
  cache_creation_input_tokens  integer,
  cache_read_input_tokens      integer,

  created_at      timestamptz not null default now(),

  constraint coach_messages_seq_unique unique (conversation_id, seq),
  constraint coach_messages_content_is_array check (jsonb_typeof(content) = 'array')
);

create index coach_messages_thread on public.coach_messages (conversation_id, seq);

/**
 * Daily quota for the free tier.
 *
 * A separate counter rather than `count(*)` over `coach_messages`, because the
 * two answer different questions: messages are a transcript the user may one
 * day delete, and deleting your history should not hand you three more
 * questions.
 */
create table public.coach_usage (
  user_id        uuid not null references public.profiles (id) on delete cascade,
  usage_date     date not null default (now() at time zone 'utc')::date,
  questions_used integer not null default 0,
  primary key (user_id, usage_date),

  constraint coach_usage_non_negative check (questions_used >= 0)
);

/**
 * Claim one question, or refuse.
 *
 * Server-side because a client-side limit is not a limit — the paywall it
 * guards is the app's only revenue path. Returns false when the free allowance
 * is spent, which is the signal the limit dialog renders from.
 *
 * `on conflict ... do update` makes the whole thing a single atomic statement,
 * so two devices tapping send at once cannot both see "2 used" and both pass.
 */
create or replace function public.claim_coach_question()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  free_allowance constant integer := 3;
  today          date := (now() at time zone 'utc')::date;
  couple_premium boolean;
  used           integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select c.is_premium and (c.premium_until is null or c.premium_until > now())
  into couple_premium
  from public.couples c
  where c.id = public.current_couple_id();

  -- The conflict target is referenced by bare table name, not schema-qualified:
  -- `public.coach_usage.questions_used` is a parse error inside ON CONFLICT.
  insert into public.coach_usage as u (user_id, usage_date, questions_used)
  values (auth.uid(), today, 1)
  on conflict (user_id, usage_date) do update
    set questions_used = u.questions_used + 1
  returning u.questions_used into used;

  if coalesce(couple_premium, false) then
    return true;
  end if;

  if used > free_allowance then
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
-- Growth habits
-- ---------------------------------------------------------------------------

create table public.growth_habits (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  couple_id  uuid references public.couples (id) on delete set null,
  label      text        not null,
  -- Weekly self-rating, 1-5. Current value only; see the README for why the
  -- history table is deliberately not here yet.
  rating     integer,
  rated_at   timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint growth_habits_rating_range check (rating is null or rating between 1 and 5)
);

create index growth_habits_by_user on public.growth_habits (user_id);

create trigger growth_habits_touch_updated_at
  before update on public.growth_habits
  for each row execute function public.touch_updated_at();
