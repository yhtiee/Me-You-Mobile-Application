-- ============================================================================
-- 0027 · Coach usage, live
--
-- A rewarded ad grants a question by updating today's `coach_usage` row. The
-- Coach composer decides whether sending is allowed from its own copy of the
-- quota — "0 left" blocks the send before any request is made — and that copy
-- was only ever refreshed on screen focus.
--
-- The limit dialog is a transparent modal, so the Coach screen underneath it
-- never loses focus and never regains it. Without this, someone could watch an
-- ad, be told a question was unlocked, return to the composer, and still find it
-- saying zero and refusing to send. That is a broken promise made by an ad,
-- which is the worst kind.
--
-- Publishing the table makes the grant arrive as a change signal, the same way
-- every other shared or per-user table in this app stays current. It also keeps
-- "2 of 3 left" correct across one person's devices, which it never was.
--
-- The subscriber filters on `user_id`, like `todos` and `picker_swipes`: usage
-- is private to one person, and the socket should say so even though RLS would
-- also refuse anyone else's rows.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'coach_usage'
  ) then
    alter publication supabase_realtime add table public.coach_usage;
  end if;
end $$;
