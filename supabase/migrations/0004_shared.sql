-- ============================================================================
-- 0004 · Shared couple data
-- Goals, bucket list, partner wiki, calendar. Everything here is visible to
-- both partners by definition — contrast 0005, which is private by definition.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Shared goals (PRD Module 3)
-- ---------------------------------------------------------------------------

create table public.goals (
  id           uuid        primary key default gen_random_uuid(),
  couple_id    uuid        not null references public.couples (id) on delete cascade,
  label        text        not null,

  -- numeric, not integer: the PRD's own example is a savings goal
  -- ("₦50,000 / $100"), and money is not always whole units.
  current      numeric(14, 2) not null default 0,
  target       numeric(14, 2) not null,

  -- Free-text for countable goals ("dates", "movies", "days").
  unit         text,

  -- Set only for monetary goals. ISO 4217, so NGN and USD both work — the PRD
  -- shows dual currency and the mock dropped it; keeping the column means the
  -- requirement survives even while the UI shows one.
  currency     char(3),

  done         boolean     not null default false,
  completed_at timestamptz,

  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint goals_target_positive check (target > 0),
  constraint goals_current_non_negative check (current >= 0)
);

create index goals_by_couple on public.goals (couple_id, done, created_at desc);

create trigger goals_touch_updated_at
  before update on public.goals
  for each row execute function public.touch_updated_at();

/** Keep `completed_at` honest without asking the client to remember. */
create or replace function public.sync_goal_completion()
returns trigger
language plpgsql
as $$
begin
  if new.done and not coalesce(old.done, false) then
    new.completed_at = now();
  elsif not new.done then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

create trigger goals_sync_completion
  before insert or update on public.goals
  for each row execute function public.sync_goal_completion();

-- ---------------------------------------------------------------------------
-- Bucket list
-- ---------------------------------------------------------------------------

create table public.bucket_list_items (
  id         uuid        primary key default gen_random_uuid(),
  couple_id  uuid        not null references public.couples (id) on delete cascade,
  label      text        not null,
  done       boolean     not null default false,
  done_at    timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bucket_list_by_couple on public.bucket_list_items (couple_id, done);

create trigger bucket_list_touch_updated_at
  before update on public.bucket_list_items
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Partner wiki (PRD §6)
-- ---------------------------------------------------------------------------

create table public.wiki_entries (
  id              uuid        primary key default gen_random_uuid(),
  couple_id       uuid        not null references public.couples (id) on delete cascade,

  -- Who the fact is *about*, which is not who wrote it. The home screen counts
  -- "N of M things you know about <partner>", so this column is what that query
  -- filters on — without it the count cannot be built.
  subject_user_id uuid        not null references public.profiles (id) on delete cascade,
  author_user_id  uuid references public.profiles (id) on delete set null,

  category        public.wiki_category not null,
  label           text        not null,
  value           text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- One "Ring size" per person per couple. Lets the app upsert on the natural
  -- key instead of tracking row ids for a form that is really a fixed list.
  constraint wiki_entries_unique_label unique (couple_id, subject_user_id, label)
);

create index wiki_entries_by_subject
  on public.wiki_entries (couple_id, subject_user_id, category);

create trigger wiki_entries_touch_updated_at
  before update on public.wiki_entries
  for each row execute function public.touch_updated_at();

comment on column public.wiki_entries.value is
  'Null means the slot exists but is unfilled — that is what drives the "N of M filled" progress.';

-- ---------------------------------------------------------------------------
-- Calendar
-- ---------------------------------------------------------------------------

create table public.calendar_events (
  id               uuid        primary key default gen_random_uuid(),
  couple_id        uuid        not null references public.couples (id) on delete cascade,
  title            text        not null,
  event_date       date        not null,
  kind             public.event_kind not null default 'custom',

  -- Birthdays and anniversaries repeat; a dinner reservation does not. Stored
  -- rather than inferred from `kind` so a one-off anniversary dinner is still
  -- expressible.
  recurs_annually  boolean     not null default false,

  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index calendar_events_by_couple_date
  on public.calendar_events (couple_id, event_date);

create trigger calendar_events_touch_updated_at
  before update on public.calendar_events
  for each row execute function public.touch_updated_at();
