-- ============================================================================
-- 0031 · Transactional email (Resend)
--
-- Two server-only tables and one lookup. Nothing here is reachable from the
-- app: RLS is on with no policies, and the grants go to `service_role` only.
-- The Edge Functions that send mail are the only readers and writers.
--
--   password_reset_codes   one-time codes for the custom reset flow. Supabase's
--                          built-in recovery email is not used, so the code is
--                          generated, stored and checked by `password-reset`.
--   email_sends            one row per one-time email (the welcome), so a
--                          retried request can't send it twice.
--   auth_user_id_by_email  the reset flow starts from an address, and the only
--                          table that maps one to an account is auth.users.
--
-- Idempotent.
-- ============================================================================

create table if not exists public.password_reset_codes (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,

  -- HMAC of the code, never the code. A six-digit code is guessable in a
  -- million tries, so a plain hash of it would be no protection at all if this
  -- table leaked; the HMAC key lives in the function's environment, not here.
  code_hash   text        not null,

  -- Wrong guesses against this code. The function refuses past five, which
  -- keeps a brute force at five in a million per code.
  attempts    int         not null default 0,

  expires_at  timestamptz not null,
  -- Set when the code is redeemed, or when a newer code replaces it. Either
  -- way it can't be used again.
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists password_reset_codes_live
  on public.password_reset_codes (user_id, created_at desc)
  where used_at is null;

alter table public.password_reset_codes enable row level security;
revoke all on public.password_reset_codes from anon, authenticated;
grant select, insert, update, delete on public.password_reset_codes to service_role;


create table if not exists public.email_sends (
  user_id  uuid        not null references auth.users (id) on delete cascade,
  kind     text        not null,
  sent_at  timestamptz not null default now(),
  primary key (user_id, kind)
);

alter table public.email_sends enable row level security;
revoke all on public.email_sends from anon, authenticated;
grant select, insert, update, delete on public.email_sends to service_role;


/**
 * Case-insensitive, because people type their address however they like and
 * GoTrue stores it lowercased.
 */
create or replace function public.auth_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id
  from auth.users
  where lower(email) = lower(trim(p_email))
    and deleted_at is null
  limit 1;
$$;

revoke all on function public.auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.auth_user_id_by_email(text) to service_role;
