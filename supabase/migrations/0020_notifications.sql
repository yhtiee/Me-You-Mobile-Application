-- ============================================================================
-- 0020 · Notifications — the feed the bell has always pointed at
--
-- `app/notifications.tsx` has shipped as a deliberately empty screen since the
-- UI layer was built, with a comment saying it would grow a list "when the feed
-- exists". This is that feed.
--
-- Written by triggers, not by the client. Three reasons, in order of how much
-- they matter:
--
--   1. The recipient is the person who did *not* act, and their device is not
--      the one making the write. A client-authored notification would have to
--      be sent by the actor on the recipient's behalf, which means trusting one
--      partner's app to describe what it just did.
--   2. It cannot be skipped. A flip that notifies only when the flipping client
--      remembers to insert a row is a flip that silently does not notify from
--      an older build, or a dropped request, or a backgrounded app.
--   3. It is one place. Four screens writing their own notification rows is
--      four chances for the wording and the payload shape to drift.
--
-- This is the in-app half only. Push (`device_push_tokens` plus an Edge
-- Function posting to Expo) is deliberately deferred — Expo Go cannot receive
-- remote push at all, so it needs a development build to be testable, and
-- shipping an untestable sender is how you find out six weeks later that it has
-- never worked.
-- ============================================================================

create table if not exists public.notifications (
  id           uuid        primary key default gen_random_uuid(),
  couple_id    uuid        not null references public.couples  (id) on delete cascade,

  -- Who should see it. Always the partner of whoever acted.
  recipient_id uuid        not null references public.profiles (id) on delete cascade,
  -- Who caused it. Null for anything the system decided on its own.
  actor_id     uuid        references public.profiles (id) on delete set null,

  kind         text        not null,
  -- Shape varies per kind, exactly as `tool_events.payload` does. The client
  -- renders the sentence; storing the sentence would freeze today's wording
  -- into rows that outlive it.
  payload      jsonb       not null default '{}'::jsonb,

  read_at      timestamptz,
  created_at   timestamptz not null default now(),

  constraint notification_kind_length check (char_length(trim(kind)) between 1 and 48)
);

create index if not exists notifications_by_recipient
  on public.notifications (recipient_id, created_at desc);

-- Partial, because the only count the bell ever asks for is the unread one and
-- this table grows forever.
create index if not exists notifications_unread
  on public.notifications (recipient_id)
  where read_at is null;

-- ---------------------------------------------------------------------------
-- Who to tell
-- ---------------------------------------------------------------------------

/** The other active member of a couple, or null in a hub of one. */
create or replace function public.couple_partner_of(p_couple_id uuid, p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select cm.user_id
    from public.couple_members cm
   where cm.couple_id = p_couple_id
     and cm.left_at is null
     and cm.user_id is distinct from p_user_id
   limit 1;
$$;

/*
 * Insert one notification for the actor's partner.
 *
 * `security definer` because the triggers below run as whoever did the thing,
 * and that person has no business inserting rows addressed to someone else —
 * the RLS policy at the bottom of this file says exactly that. Centralising the
 * write here means the policy can stay strict.
 *
 * Silently does nothing in a hub with one member. A notification with nobody to
 * receive it is not an error; it is Tuesday for someone whose partner has not
 * joined yet.
 */
create or replace function public.notify_partner(
  p_couple_id uuid,
  p_actor_id  uuid,
  p_kind      text,
  p_payload   jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient uuid := public.couple_partner_of(p_couple_id, p_actor_id);
begin
  if v_recipient is null then
    return;
  end if;

  insert into public.notifications (couple_id, recipient_id, actor_id, kind, payload)
  values (p_couple_id, v_recipient, p_actor_id, p_kind, coalesce(p_payload, '{}'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

/** A coin flip, a wheel spin. Fires on the log every game already writes. */
create or replace function public.on_tool_event_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_partner(
    new.couple_id,
    new.user_id,
    'play.' || new.kind::text,
    new.payload
  );
  return new;
end;
$$;

drop trigger if exists tool_events_notify on public.tool_events;
create trigger tool_events_notify
  after insert on public.tool_events
  for each row execute function public.on_tool_event_notify();

/*
 * A finished trivia round.
 *
 * On UPDATE rather than INSERT, and guarded on the transition: a round is
 * inserted the moment somebody opens the game, and "your partner started
 * thinking about a quiz" is not news. `completed_at` going from null to
 * not-null is the event.
 */
create or replace function public.on_trivia_round_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.completed_at is null and new.completed_at is not null then
    perform public.notify_partner(
      new.couple_id,
      new.player_id,
      'play.trivia',
      jsonb_build_object('score', new.score, 'total', new.total, 'subject', new.subject_id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trivia_rounds_notify on public.trivia_rounds;
create trigger trivia_rounds_notify
  after update on public.trivia_rounds
  for each row execute function public.on_trivia_round_notify();

/*
 * A check-in.
 *
 * The one notification in here that is not a game, and the one people will
 * actually care about — it is the whole daily loop of the app. Fires on insert
 * and on a mood change, but not on every touch of the row: `checked_on_partner`
 * flipping is not worth a buzz.
 */
create or replace function public.on_checkin_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT'
     or old.mood is distinct from new.mood
     or old.battery is distinct from new.battery
  then
    perform public.notify_partner(
      new.couple_id,
      new.user_id,
      'checkin',
      jsonb_build_object('mood', new.mood, 'battery', new.battery, 'need', new.need)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists check_ins_notify on public.check_ins;
create trigger check_ins_notify
  after insert or update on public.check_ins
  for each row execute function public.on_checkin_notify();

/*
 * A picker match — both of you liked the same thing.
 *
 * The only trigger here that has to look at other rows: a swipe is only news
 * when it completes a pair, so it counts distinct likers for the item and fires
 * on exactly the second one. Anything else would notify on every swipe, which
 * is the opposite of the feature's promise that you swipe privately.
 */
create or replace function public.on_picker_swipe_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_likers integer;
  v_title  text;
begin
  if not new.liked then
    return new;
  end if;

  select count(distinct s.user_id)
    into v_likers
    from public.picker_swipes s
   where s.item_id = new.item_id
     and s.couple_id = new.couple_id
     and s.liked;

  if v_likers = 2 then
    select title into v_title from public.picker_items where id = new.item_id;

    perform public.notify_partner(
      new.couple_id,
      new.user_id,
      'play.match',
      jsonb_build_object('item', new.item_id, 'title', v_title)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists picker_swipes_notify on public.picker_swipes;
create trigger picker_swipes_notify
  after insert on public.picker_swipes
  for each row execute function public.on_picker_swipe_notify();

-- ---------------------------------------------------------------------------
-- RLS — read and mark read, nothing else
-- ---------------------------------------------------------------------------

alter table public.notifications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications'
      and policyname = 'read own notifications'
  ) then
    create policy "read own notifications"
      on public.notifications for select
      to authenticated
      using (recipient_id = auth.uid());
  end if;

  -- Marking read is the only write a client gets. There is deliberately no
  -- insert policy: every row comes from `notify_partner`, which is
  -- `security definer` precisely so this can stay closed. A client that could
  -- insert here could send its partner anything it liked.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications'
      and policyname = 'mark own notifications read'
  ) then
    create policy "mark own notifications read"
      on public.notifications for update
      to authenticated
      using (recipient_id = auth.uid())
      with check (recipient_id = auth.uid());
  end if;

  -- Clearing the list is a reasonable thing to want to do.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications'
      and policyname = 'delete own notifications'
  ) then
    create policy "delete own notifications"
      on public.notifications for delete
      to authenticated
      using (recipient_id = auth.uid());
  end if;
end $$;

revoke all on function public.couple_partner_of(uuid, uuid) from public, anon;
revoke all on function public.notify_partner(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.couple_partner_of(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
--
-- The bell has to light up without the app being told to look. Filtered by
-- `recipient_id` on the subscriber, not `couple_id` — these rows are addressed
-- to one person and the socket should say so, the same reasoning as
-- `picker_swipes` in 0009 and `daily_nudges` in 0017.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

alter table public.notifications replica identity full;
