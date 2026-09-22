-- ============================================================================
-- 0029 · Make the premium columns genuinely client-read-only
--
-- 0028 ended with:
--
--   revoke update (is_premium, premium_until) on public.profiles from authenticated;
--
-- which does nothing. `authenticated` holds a *table-level* UPDATE on
-- `profiles`, and a column-level revoke only removes column-level grants; the
-- table-wide one still covers every column, including the two that decide
-- whether this account pays. Verified after pushing 0028: the client could
-- still write `is_premium`, i.e. grant itself an ad-free app and an unlimited
-- coach.
--
-- The fix is the shape Postgres actually supports: drop the table-wide grant
-- and hand back UPDATE column by column, leaving the two out.
--
-- Anything added to `profiles` later is therefore NOT updatable by the client
-- until it is added here. That is the safer default for a table that now holds
-- an entitlement.
-- ============================================================================

revoke update on public.profiles from authenticated, anon;

-- Every column the app legitimately edits — `lib/profile.ts` writes the name
-- fields, the phone, the socials and the avatar. `id` and `created_at` are
-- identity, `updated_at` is the trigger's, and the premium pair is billing's.
grant update (
  display_name,
  first_name,
  last_name,
  avatar_url,
  phone,
  instagram,
  tiktok,
  x_handle,
  snapchat
) on public.profiles to authenticated;
