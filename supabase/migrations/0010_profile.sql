-- ============================================================================
-- 0010 · Profile details and the avatar bucket
--
-- Adds the fields the "finish your profile" prompt checks for, and the storage
-- bucket their photo lives in. Idempotent — safe to re-run.
--
-- ⚠ SET YOUR BUCKET NAME. It appears once, at the top of the second block
--   below, and must match `EXPO_PUBLIC_SUPABASE_AVATAR_BUCKET` in `.env`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Profile columns
-- ---------------------------------------------------------------------------

/*
 * A column per network rather than one `socials jsonb`.
 *
 * The blob is easier to extend and worse at everything else: each of these has
 * its own handle rules and its own URL to build, none of them can be
 * constrained or indexed inside jsonb without an expression index per key, and
 * "which fields count as a complete profile" stops being answerable in SQL.
 * Adding a fifth network is a migration, which is the correct amount of
 * friction for a decision that changes what the app asks every user for.
 *
 * `x_handle`, not `x` — a one-letter column name in a table this central is a
 * gift to whoever greps for it later.
 */
alter table public.profiles
  add column if not exists phone     text,
  add column if not exists instagram text,
  add column if not exists tiktok    text,
  add column if not exists x_handle  text,
  add column if not exists snapchat  text;

comment on column public.profiles.phone is
  'Free text, not validated in the database. Formats vary by country and a CHECK here would reject valid numbers.';

comment on column public.profiles.instagram is
  'Handle only, stored without the leading @. The client strips it on save.';

-- ---------------------------------------------------------------------------
-- Avatar storage
--
-- Public-read, owner-write. This settles README open question 5 for avatars
-- only: a profile photo is shown to the one person who is allowed to see it
-- anyway, and signed URLs would mean re-signing on every render of the home
-- banner and every list row. Anything more sensitive should not go in here.
--
-- Objects are keyed `<user_id>/avatar`, and the first path segment is what the
-- write policies check — that is the whole authorisation model, so the client
-- must never write to a path it did not build from `auth.uid()`.
-- ---------------------------------------------------------------------------

do $$
declare
  bucket_name constant text := 'me&u';  -- must match EXPO_PUBLIC_SUPABASE_AVATAR_BUCKET
begin
  insert into storage.buckets (id, name, public)
  values (bucket_name, bucket_name, true)
  on conflict (id) do update set public = true;

  -- Dropped first so re-running this file updates the policy rather than
  -- failing on a name that already exists.
  drop policy if exists "avatars are publicly readable" on storage.objects;
  execute format(
    $p$create policy "avatars are publicly readable"
         on storage.objects for select
         using (bucket_id = %L)$p$,
    bucket_name
  );

  drop policy if exists "users upload their own avatar" on storage.objects;
  execute format(
    $p$create policy "users upload their own avatar"
         on storage.objects for insert
         to authenticated
         with check (
           bucket_id = %L
           and (storage.foldername(name))[1] = auth.uid()::text
         )$p$,
    bucket_name
  );

  drop policy if exists "users replace their own avatar" on storage.objects;
  execute format(
    $p$create policy "users replace their own avatar"
         on storage.objects for update
         to authenticated
         using (
           bucket_id = %L
           and (storage.foldername(name))[1] = auth.uid()::text
         )
         with check (
           bucket_id = %L
           and (storage.foldername(name))[1] = auth.uid()::text
         )$p$,
    bucket_name, bucket_name
  );

  drop policy if exists "users delete their own avatar" on storage.objects;
  execute format(
    $p$create policy "users delete their own avatar"
         on storage.objects for delete
         to authenticated
         using (
           bucket_id = %L
           and (storage.foldername(name))[1] = auth.uid()::text
         )$p$,
    bucket_name
  );
end $$;
