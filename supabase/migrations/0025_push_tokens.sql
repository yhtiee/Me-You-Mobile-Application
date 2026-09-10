-- ============================================================================
-- 0025 · Push tokens — where a notification is actually delivered
--
-- 0020 built the in-app half and said so in its header: rows written by
-- triggers, read by the bell, with push "deliberately deferred" because Expo Go
-- cannot receive remote notifications and shipping an untestable sender is how
-- you discover six weeks later that it has never worked. There is a development
-- build now, so this is the other half.
--
-- One row per device, not per user. A person with a phone and a tablet has to
-- be reachable on both, and the same person reinstalling gets a fresh token
-- while the old one keeps existing until Expo tells us it is dead.
-- ============================================================================

create table if not exists public.device_push_tokens (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles (id) on delete cascade,

  -- An Expo push token ("ExponentPushToken[…]"), not a raw FCM or APNs one.
  -- Expo's service is the transport for both platforms, so the sender needs one
  -- address format and no per-platform branch. FCM is still underneath on
  -- Android; it is just behind Expo.
  token      text        not null,

  -- Kept for diagnostics only. Nothing branches on it — see above.
  platform   text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint push_token_shape check (char_length(trim(token)) between 1 and 512)
);

/*
 * Unique on the token alone, not on (user_id, token).
 *
 * A token identifies a *device installation*, and installations get handed
 * between accounts: sign out, sign in as someone else, and the same token now
 * belongs to a different person. Keyed per user, both rows would survive and
 * the previous account would keep receiving that phone's notifications. Keyed
 * on the token, the upsert in `registerPushToken` moves ownership instead.
 */
create unique index if not exists device_push_tokens_unique
  on public.device_push_tokens (token);

create index if not exists device_push_tokens_by_user
  on public.device_push_tokens (user_id);

create trigger device_push_tokens_touch_updated_at
  before update on public.device_push_tokens
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
--
-- Own rows only, like `daily_nudges`. A client has no reason to read anyone
-- else's delivery addresses, and the sender does not go through RLS at all —
-- the Edge Function uses the service role, because it has to look up the
-- *recipient's* tokens while running as nobody in particular.
-- ---------------------------------------------------------------------------

alter table public.device_push_tokens enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'device_push_tokens'
      and policyname = 'own push tokens only'
  ) then
    create policy "own push tokens only"
      on public.device_push_tokens for all
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Notification preferences
--
-- The three switches in Settings have always been local `useState` — they moved
-- and did nothing. Shipping push while they stay decorative is worse than not
-- having them at all, so they get a row before the first notification is sent.
--
-- Defaults are on. Someone who has installed a couples app and paired with a
-- partner has opted into hearing from them; the switches exist to turn that
-- down, not up.
-- ---------------------------------------------------------------------------

create table if not exists public.notification_prefs (
  user_id           uuid        primary key references public.profiles (id) on delete cascade,
  -- Their check-in landed. The daily loop, and the one people actually want.
  partner_checkins  boolean     not null default true,
  -- Anything from Play: a flip, a spin, a finished quiz, a match.
  play_activity     boolean     not null default true,
  -- Streak at risk, and calendar countdowns.
  reminders         boolean     not null default true,
  updated_at        timestamptz not null default now()
);

alter table public.notification_prefs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notification_prefs'
      and policyname = 'own notification prefs'
  ) then
    create policy "own notification prefs"
      on public.notification_prefs for all
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

create trigger notification_prefs_touch_updated_at
  before update on public.notification_prefs
  for each row execute function public.touch_updated_at();

/*
 * Resolve a preference for one notification kind.
 *
 * `security definer` because the sender runs as the service role against the
 * *recipient's* row, and because a missing row must read as "yes" rather than
 * as an error — nobody has one until they first open Settings, and defaulting
 * to silence would mean push appears broken for every existing user.
 *
 * Kinds are matched by prefix so a new `play.*` trigger is covered the day it
 * is added rather than the day somebody remembers to update this function.
 */
create or replace function public.wants_notification(p_user_id uuid, p_kind text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_kind = 'checkin'        then coalesce(p.partner_checkins, true)
    when p_kind like 'play.%'      then coalesce(p.play_activity, true)
    when p_kind like 'reminder.%'  then coalesce(p.reminders, true)
    else true
  end
  from (select 1) as _
  left join public.notification_prefs p on p.user_id = p_user_id;
$$;

revoke all on function public.wants_notification(uuid, text) from public, anon;
grant execute on function public.wants_notification(uuid, text) to authenticated, service_role;
