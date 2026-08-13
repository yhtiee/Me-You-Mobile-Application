-- ============================================================================
-- 0011 · Couple gallery
-- Shared photos and videos, kept for the history of it. Idempotent.
--
-- ⚠ The bucket name appears once, in the DO block at the bottom. It must match
--   0010 and `EXPO_PUBLIC_SUPABASE_AVATAR_BUCKET`.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'media_kind') then
    create type public.media_kind as enum ('image', 'video');
  end if;
end $$;

create table if not exists public.couple_media (
  id           uuid        primary key default gen_random_uuid(),
  couple_id    uuid        not null references public.couples (id) on delete cascade,

  -- Who added it. `set null` rather than cascade: a memory does not stop being
  -- the couple's because one of them deleted their account.
  uploaded_by  uuid        references public.profiles (id) on delete set null,

  -- Path inside the bucket, never a URL. URLs carry a project host and, if the
  -- bucket ever goes private, a signature with an expiry — neither belongs in a
  -- row that is meant to outlive both.
  storage_path text        not null unique,

  kind         public.media_kind not null,
  mime_type    text        not null,
  size_bytes   integer     not null,

  width        integer,
  height       integer,
  duration_ms  integer,

  caption      text,

  /**
   * When the moment happened, which is not when it was uploaded. Falls back to
   * `created_at` on read; the picker gives us the asset's own timestamp, so a
   * photo from last summer files itself under last summer.
   */
  taken_at     timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint couple_media_size_positive check (size_bytes > 0),
  -- Mirrors the bucket's own limit. Belt and braces: the client checks before
  -- it uploads, storage rejects the object, and this rejects the row.
  constraint couple_media_size_cap check (size_bytes <= 5 * 1024 * 1024)
);

create index if not exists couple_media_by_couple
  on public.couple_media (couple_id, coalesce(taken_at, created_at) desc);

drop trigger if exists couple_media_touch_updated_at on public.couple_media;
create trigger couple_media_touch_updated_at
  before update on public.couple_media
  for each row execute function public.touch_updated_at();

alter table public.couple_media enable row level security;

drop policy if exists "couple manages media" on public.couple_media;
create policy "couple manages media"
  on public.couple_media for all
  to authenticated
  using (public.is_couple_member(couple_id))
  with check (public.is_couple_member(couple_id));

-- ---------------------------------------------------------------------------
-- Storage
--
-- Objects live at `couples/<couple_id>/<uuid>`, so the *second* path segment is
-- the authorisation key — unlike avatars, where it is the first and is a user
-- id. Both sets of policies coexist on `storage.objects`; a request passes if
-- either allows it.
-- ---------------------------------------------------------------------------

/**
 * Wrapped in a function with an exception handler rather than inlined in the
 * policy. `parts[2]::uuid` raises on any object whose path does not look like
 * one of ours, and an exception inside a policy fails the whole request — so a
 * junk filename in the bucket would break unrelated uploads.
 */
create or replace function public.is_couple_media_path(object_name text)
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

  if parts is null or array_length(parts, 1) < 2 then return false; end if;
  if parts[1] <> 'couples' then return false; end if;

  return public.is_couple_member(parts[2]::uuid);
exception
  when others then
    return false;
end;
$$;

do $$
declare
  bucket_name constant text := 'me&u';
begin
  -- 5 MB, enforced by storage itself. The client's own check exists to give a
  -- decent message; this is what makes the limit true.
  update storage.buckets set file_size_limit = 5 * 1024 * 1024 where id = bucket_name;

  drop policy if exists "couples read their media" on storage.objects;
  execute format(
    $p$create policy "couples read their media"
         on storage.objects for select
         to authenticated
         using (bucket_id = %L and public.is_couple_media_path(name))$p$,
    bucket_name
  );

  drop policy if exists "couples upload their media" on storage.objects;
  execute format(
    $p$create policy "couples upload their media"
         on storage.objects for insert
         to authenticated
         with check (bucket_id = %L and public.is_couple_media_path(name))$p$,
    bucket_name
  );

  drop policy if exists "couples delete their media" on storage.objects;
  execute format(
    $p$create policy "couples delete their media"
         on storage.objects for delete
         to authenticated
         using (bucket_id = %L and public.is_couple_media_path(name))$p$,
    bucket_name
  );
end $$;

-- Realtime, so a memory added on one phone appears on the other.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'couple_media'
  ) then
    alter publication supabase_realtime add table public.couple_media;
  end if;
end $$;

alter table public.couple_media replica identity full;
