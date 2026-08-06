-- ============================================================================
-- 0007 · Row Level Security
--
-- Every policy lives here rather than beside its table, so the whole access
-- surface can be read top to bottom in one sitting. If you review one file in
-- this folder, review this one.
--
-- Three tiers, and the difference between them is the product, not a detail:
--
--   shared   — either partner. goals, bucket list, wiki, calendar, check-ins.
--   private  — the owner only. todos, coach, growth habits, picker swipes.
--   derived  — reached through a SECURITY DEFINER function, never selected
--              directly. pairing, coach quota, picker matches.
--
-- Note there is no `service_role` carve-out anywhere below. That key bypasses
-- RLS by design, so it must never reach the client — it is not in `.env`, and
-- `EXPO_PUBLIC_` prefixed variables are compiled into the bundle.
-- ============================================================================

alter table public.levels             enable row level security;
alter table public.profiles           enable row level security;
alter table public.couples            enable row level security;
alter table public.couple_members     enable row level security;
alter table public.check_ins          enable row level security;
alter table public.love_languages     enable row level security;
alter table public.goals              enable row level security;
alter table public.bucket_list_items  enable row level security;
alter table public.wiki_entries       enable row level security;
alter table public.calendar_events    enable row level security;
alter table public.todos              enable row level security;
alter table public.coach_conversations enable row level security;
alter table public.coach_messages     enable row level security;
alter table public.coach_usage        enable row level security;
alter table public.growth_habits      enable row level security;
alter table public.picker_items       enable row level security;
alter table public.picker_swipes      enable row level security;
alter table public.trivia_questions   enable row level security;
alter table public.trivia_responses   enable row level security;
alter table public.date_ideas         enable row level security;
alter table public.tool_events        enable row level security;

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

create policy "levels are readable by anyone signed in"
  on public.levels for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create policy "read own profile and partner's"
  on public.profiles for select
  to authenticated
  using (public.shares_couple_with(id));

create policy "update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Insert is normally the `on_auth_user_created` trigger's job. This policy is
-- the backstop for a user whose signup predates that trigger; it cannot be used
-- to forge a row for anyone else.
create policy "insert own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- couples and membership
--
-- No INSERT policy on either table: rows are only ever created through
-- `create_couple()` and `redeem_couple_code()`, which are SECURITY DEFINER and
-- so bypass RLS. That is intentional — a client that could insert directly
-- could mint itself a couple, or add itself to someone else's.
-- ---------------------------------------------------------------------------

create policy "read own couple"
  on public.couples for select
  to authenticated
  using (public.is_couple_member(id));

create policy "update own couple"
  on public.couples for update
  to authenticated
  using (public.is_couple_member(id))
  with check (public.is_couple_member(id));

create policy "read own membership rows"
  on public.couple_members for select
  to authenticated
  using (public.is_couple_member(couple_id));

-- ---------------------------------------------------------------------------
-- check_ins — shared to read, own to write
--
-- Both halves matter. The partner's mood is the point of the home screen, so
-- SELECT is couple-wide; but nobody gets to check in on their partner's behalf,
-- so writes are pinned to `auth.uid()`.
-- ---------------------------------------------------------------------------

create policy "read both check-ins"
  on public.check_ins for select
  to authenticated
  using (public.is_couple_member(couple_id));

create policy "write own check-in"
  on public.check_ins for insert
  to authenticated
  with check (user_id = auth.uid() and public.is_couple_member(couple_id));

create policy "amend own check-in"
  on public.check_ins for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- love_languages — partner-visible, self-editable
-- ---------------------------------------------------------------------------

create policy "read own and partner's love languages"
  on public.love_languages for select
  to authenticated
  using (public.shares_couple_with(user_id));

create policy "manage own love languages"
  on public.love_languages for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Shared couple data — either partner, full CRUD
-- ---------------------------------------------------------------------------

create policy "couple manages goals"
  on public.goals for all
  to authenticated
  using (public.is_couple_member(couple_id))
  with check (public.is_couple_member(couple_id));

create policy "couple manages bucket list"
  on public.bucket_list_items for all
  to authenticated
  using (public.is_couple_member(couple_id))
  with check (public.is_couple_member(couple_id));

create policy "couple manages wiki"
  on public.wiki_entries for all
  to authenticated
  using (public.is_couple_member(couple_id))
  with check (public.is_couple_member(couple_id));

create policy "couple manages calendar"
  on public.calendar_events for all
  to authenticated
  using (public.is_couple_member(couple_id))
  with check (public.is_couple_member(couple_id));

-- ---------------------------------------------------------------------------
-- Private data — owner only
--
-- These deliberately do NOT consult `is_couple_member`. The to-do screen
-- promises the partner never sees them, and the coach is only useful if you can
-- be candid about the person who would otherwise be reading it.
-- ---------------------------------------------------------------------------

create policy "own todos only"
  on public.todos for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "own coach conversations only"
  on public.coach_conversations for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "own coach thread only"
  on public.coach_messages for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "own growth habits only"
  on public.growth_habits for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Read-only to the client. The counter is written solely by
-- `claim_coach_question()`; if clients could UPDATE it, the free tier would be
-- editable from the device and the paywall would be decorative.
create policy "read own coach usage"
  on public.coach_usage for select
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Picker
--
-- Swipes are owner-only on purpose: "swipe separately, you'll only hear about
-- the matches". Matches come back through `picker_matches()`, which is the only
-- thing allowed to see both sides.
-- ---------------------------------------------------------------------------

create policy "read stock and own picker items"
  on public.picker_items for select
  to authenticated
  using (couple_id is null or public.is_couple_member(couple_id));

create policy "couple adds picker items"
  on public.picker_items for insert
  to authenticated
  with check (couple_id is not null and public.is_couple_member(couple_id));

create policy "own swipes only"
  on public.picker_swipes for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_couple_member(couple_id));

-- ---------------------------------------------------------------------------
-- Trivia and date ideas
--
-- Responses are couple-readable, unlike picker swipes: the game only pays off
-- when you find out what they guessed about you.
-- ---------------------------------------------------------------------------

create policy "read stock and own trivia"
  on public.trivia_questions for select
  to authenticated
  using (couple_id is null or public.is_couple_member(couple_id));

create policy "couple writes own trivia"
  on public.trivia_questions for insert
  to authenticated
  with check (couple_id is not null and public.is_couple_member(couple_id));

create policy "couple reads trivia responses"
  on public.trivia_responses for select
  to authenticated
  using (public.is_couple_member(couple_id));

create policy "answer trivia as self"
  on public.trivia_responses for insert
  to authenticated
  with check (user_id = auth.uid() and public.is_couple_member(couple_id));

create policy "read stock and own date ideas"
  on public.date_ideas for select
  to authenticated
  using (couple_id is null or public.is_couple_member(couple_id));

create policy "couple manages own date ideas"
  on public.date_ideas for all
  to authenticated
  using (couple_id is not null and public.is_couple_member(couple_id))
  with check (couple_id is not null and public.is_couple_member(couple_id));

-- ---------------------------------------------------------------------------
-- Tool log
-- ---------------------------------------------------------------------------

create policy "couple reads tool events"
  on public.tool_events for select
  to authenticated
  using (public.is_couple_member(couple_id));

create policy "log own tool events"
  on public.tool_events for insert
  to authenticated
  with check (user_id = auth.uid() and public.is_couple_member(couple_id));

-- ---------------------------------------------------------------------------
-- Execute grants
--
-- Locked to `authenticated`: every one of these reads `auth.uid()`, and an
-- anonymous caller would either error or — worse for the pairing functions —
-- act with no identity at all.
-- ---------------------------------------------------------------------------

revoke all on function public.create_couple(date)        from public, anon;
revoke all on function public.redeem_couple_code(text)   from public, anon;
revoke all on function public.leave_couple()             from public, anon;
revoke all on function public.claim_coach_question()     from public, anon;
revoke all on function public.picker_matches()           from public, anon;
revoke all on function public.generate_invite_code()     from public, anon, authenticated;

grant execute on function public.create_couple(date)      to authenticated;
grant execute on function public.redeem_couple_code(text) to authenticated;
grant execute on function public.leave_couple()           to authenticated;
grant execute on function public.claim_coach_question()   to authenticated;
grant execute on function public.picker_matches()         to authenticated;
