-- ============================================================================
-- 0001 · Foundation
-- Enums and the shared `updated_at` trigger. Nothing here depends on any table.
--
-- The enums mirror `types/domain.ts` exactly, hyphens included. That is
-- deliberate: the UI already ships those literals, so matching them means the
-- API layer never has to translate between wire values and database values.
--
-- NOTE: the security helpers (`is_couple_member` and friends) deliberately do
-- NOT live here, even though 0007's policies are the thing that needs them.
-- They are `language sql`, and Postgres parses a SQL function body at CREATE
-- time — so defining them before `couple_members` exists fails outright with
-- `relation "public.couple_members" does not exist`. They live at the bottom of
-- 0002 instead, right after the table they read.
-- ============================================================================

-- gen_random_uuid() is core since Postgres 13, so no extension is required.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.mood_key as enum ('happy', 'neutral', 'sad', 'stressed');

create type public.need_key as enum ('quality-time', 'words', 'space', 'touch', 'acts');

create type public.love_language_key as enum ('words', 'quality-time', 'touch', 'gifts', 'acts');

create type public.wiki_category as enum ('favourites', 'sizes', 'dreams', 'wishlist');

create type public.event_kind as enum (
  'anniversary', 'birthday', 'first-date', 'proposal', 'date-night', 'custom'
);

/**
 * Wire roles, not UI roles.
 *
 * The UI calls these `you` / `coach` (`types/domain.ts`), but this table is
 * replayed straight into the model's `messages` array on every turn, so the
 * values match what the API expects. One mapping at the edge beats translating
 * the whole transcript on every request — and a stray `coach` reaching the API
 * is a 400.
 *
 * `system` is here because mid-conversation system messages are a real turn
 * type: they carry operator context (the partner's mood, today's check-in)
 * without rewriting the cached top-level prompt.
 */
create type public.coach_role as enum ('user', 'assistant', 'system');

/** Assistant turns are written before the model has finished producing them. */
create type public.coach_message_status as enum ('pending', 'streaming', 'complete', 'failed');

create type public.picker_kind as enum ('movie', 'meal');

create type public.tool_kind as enum ('coin', 'wheel');

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Progression ladder (PRD §5). Reference data, seeded in 0008.
-- ---------------------------------------------------------------------------

create table public.levels (
  level       integer primary key,
  title       text    not null,
  requirement text    not null
);

comment on table public.levels is
  'Static progression tiers. Read-only to clients; no couple data here.';
