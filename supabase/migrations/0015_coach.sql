-- ============================================================================
-- 0015 · Making the coach real
--
-- 0005 modelled the transcript properly and left three things for whoever
-- actually wired a model to it:
--
--   1. `coach_conversations.model` defaulted to a Claude id. The coach runs on
--      Gemini.
--   2. `seq` was assigned by the writer, with the unique constraint catching a
--      collision after the fact. README open question 7 flagged that as fine
--      for one device and broken for two. It is now server-side.
--   3. Nothing could be attached to a message.
--
-- Re-runnable.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The model
--
-- Only the default changes. Existing rows keep whatever they were created with,
-- which is the entire reason the column is per-conversation: a thread's history
-- may only be replayed to the model that produced it.
-- ---------------------------------------------------------------------------

alter table public.coach_conversations
  alter column model set default 'gemini-2.5-flash';

-- ---------------------------------------------------------------------------
-- Server-assigned `seq`
--
-- Closes README open question 7. Two devices posting to one thread used to race:
-- both read `max(seq)`, both wrote the same number, and the loser's insert was
-- rejected — after the model had already been paid for.
--
-- The advisory lock is per conversation, so two threads never block each other,
-- and it is released at commit. `pg_advisory_xact_lock` rather than `SELECT ...
-- FOR UPDATE` on the parent, because the parent row is not what is being
-- protected: the invariant is over the *set* of child rows, and locking a gap
-- that does not exist yet is exactly what advisory locks are for.
-- ---------------------------------------------------------------------------

create or replace function public.assign_coach_message_seq()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A caller may still pin `seq` deliberately; only fill it when absent.
  if new.seq is not null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.conversation_id::text, 0));

  select coalesce(max(seq), 0) + 1
  into new.seq
  from public.coach_messages
  where conversation_id = new.conversation_id;

  return new;
end;
$$;

-- `seq` is NOT NULL, so the column has to accept a null long enough for the
-- trigger to fill it. The trigger is what keeps it non-null in practice.
alter table public.coach_messages alter column seq drop not null;

drop trigger if exists coach_messages_assign_seq on public.coach_messages;
create trigger coach_messages_assign_seq
  before insert on public.coach_messages
  for each row execute function public.assign_coach_message_seq();

-- ---------------------------------------------------------------------------
-- Attachments
--
-- Files are referenced from the message's own `content` blocks — the column is
-- already "the API content-block array, verbatim", and an attachment is a
-- content block. This table exists alongside that for one job the blocks cannot
-- do: telling us which objects in the bucket are still referenced, so a deleted
-- conversation can take its files with it.
-- ---------------------------------------------------------------------------

create table if not exists public.coach_attachments (
  id              uuid        primary key default gen_random_uuid(),
  message_id      uuid references public.coach_messages (id) on delete cascade,
  conversation_id uuid        not null references public.coach_conversations (id) on delete cascade,
  user_id         uuid        not null references public.profiles (id) on delete cascade,

  -- Path inside the bucket, never a URL. Same reasoning as `couple_media`: a
  -- URL carries a host and, for a private bucket, a signature with an expiry.
  storage_path    text        not null unique,
  mime_type       text        not null,
  size_bytes      integer     not null,
  file_name       text,

  created_at      timestamptz not null default now(),

  -- Mirrors the bucket limit. The client checks first for a decent message,
  -- storage rejects the object, and this rejects the row.
  constraint coach_attachment_size_cap check (size_bytes <= 10 * 1024 * 1024)
);

create index if not exists coach_attachments_by_conversation
  on public.coach_attachments (conversation_id);

alter table public.coach_attachments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'coach_attachments'
      and policyname = 'own coach attachments only'
  ) then
    -- Owner-only, exactly like the transcript they belong to. The coach is only
    -- useful if you can be candid about the person who would otherwise read it.
    create policy "own coach attachments only"
      on public.coach_attachments for all
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Storage
--
-- Its own bucket, and a **private** one.
--
-- The existing `me&u` bucket is public-read — correct for an avatar, which is
-- shown to the one person allowed to see it anyway, and completely wrong here.
-- A screenshot of an argument uploaded to a coach thread must not be readable
-- by anyone holding the URL. Objects live at `<user_id>/<conversation_id>/<uuid>`,
-- so the first path segment is the authorisation key.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'coach-uploads',
  'coach-uploads',
  false,
  10 * 1024 * 1024,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'application/pdf', 'text/plain', 'text/markdown', 'text/csv'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

/**
 * Owner check on the first path segment.
 *
 * A function with an exception handler rather than inline `parts[1]::uuid`,
 * for the reason `is_couple_media_path` spells out: a cast that raises inside a
 * policy fails the whole request, so one junk filename in the bucket would
 * break unrelated uploads.
 */
create or replace function public.is_own_coach_path(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[];
begin
  parts := storage.foldername(object_name);
  if parts is null or array_length(parts, 1) < 1 then return false; end if;
  return parts[1]::uuid = auth.uid();
exception
  when others then
    return false;
end;
$$;

do $$
declare
  bucket_name constant text := 'coach-uploads';
begin
  drop policy if exists "read own coach uploads" on storage.objects;
  execute format(
    $p$create policy "read own coach uploads"
         on storage.objects for select
         to authenticated
         using (bucket_id = %L and public.is_own_coach_path(name))$p$,
    bucket_name
  );

  drop policy if exists "write own coach uploads" on storage.objects;
  execute format(
    $p$create policy "write own coach uploads"
         on storage.objects for insert
         to authenticated
         with check (bucket_id = %L and public.is_own_coach_path(name))$p$,
    bucket_name
  );

  drop policy if exists "delete own coach uploads" on storage.objects;
  execute format(
    $p$create policy "delete own coach uploads"
         on storage.objects for delete
         to authenticated
         using (bucket_id = %L and public.is_own_coach_path(name))$p$,
    bucket_name
  );
end $$;

-- ---------------------------------------------------------------------------
-- Quota, readable
--
-- `claim_coach_question()` spends an allowance; nothing could report how much
-- was left without spending one. The composer shows "2 of 3 left today", so it
-- needs to ask. Mirrors the constants inside the claim function — change both.
-- ---------------------------------------------------------------------------

create or replace function public.coach_quota()
returns table (used integer, allowance integer, is_premium boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(
      (select u.questions_used
         from public.coach_usage u
        where u.user_id = auth.uid()
          and u.usage_date = (now() at time zone 'utc')::date),
      0
    ),
    3,
    coalesce(
      (select c.is_premium and (c.premium_until is null or c.premium_until > now())
         from public.couples c
        where c.id = public.current_couple_id()),
      false
    );
$$;

revoke all on function public.coach_quota() from public, anon;
grant execute on function public.coach_quota() to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
--
-- `coach_messages` and `coach_conversations` were already published in 0009.
-- Attachments join them so a thread opened on a second device renders its
-- images without a manual reload.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.coach_attachments') is not null
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'coach_attachments'
     )
  then
    alter publication supabase_realtime add table public.coach_attachments;
  end if;
end $$;
