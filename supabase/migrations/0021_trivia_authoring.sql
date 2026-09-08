-- ============================================================================
-- 0021 · Trivia authoring — couples write their own questions
--
-- Almost everything needed for this already existed and had never been used:
-- `trivia_questions.couple_id` is nullable precisely so couple-authored rows can
-- sit alongside the stock bank, `subject_user_id` records whom a question is
-- about, and 0007 already granted an insert. What was missing was the rule about
-- *who may write what*, the ability to fix or remove a question afterwards, and
-- a client that ever called any of it.
--
-- The rule this migration adds is the one the game depends on:
--
--   You write questions about YOURSELF. Your partner guesses.
--
-- That is not an arbitrary restriction, it is the only arrangement in which a
-- `correct_index` means anything. If I write a question about my partner and
-- mark what I *believe* the answer is, then a "wrong" answer from them is me
-- being wrong about them — scored against them. The person who knows the answer
-- has to be the person who sets it.
--
-- 0007's insert policy allowed either partner to write about either of them, so
-- it is replaced rather than added to. Nothing has ever written through it — no
-- client called `addTriviaQuestion` because none existed — so there are no rows
-- to migrate.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Insert: only about yourself, only into your own couple
-- ---------------------------------------------------------------------------

drop policy if exists "couple writes own trivia" on public.trivia_questions;

create policy "write trivia about yourself"
  on public.trivia_questions for insert
  to authenticated
  with check (
    couple_id is not null
    and public.is_couple_member(couple_id)
    -- The stock bank has a null subject. A couple-authored row must name one,
    -- and it must be the author: see the note at the top.
    and subject_user_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- Update and delete: your own questions only
--
-- Neither existed, so a typo in a question was permanent and a question that
-- stopped being true could never be removed. Both are scoped to rows the caller
-- is the subject of, which also makes it impossible to touch the stock bank
-- (`subject_user_id is null` there, and null never equals `auth.uid()`).
-- ---------------------------------------------------------------------------

create policy "edit own trivia"
  on public.trivia_questions for update
  to authenticated
  using (couple_id is not null and subject_user_id = auth.uid())
  with check (couple_id is not null and subject_user_id = auth.uid());

create policy "delete own trivia"
  on public.trivia_questions for delete
  to authenticated
  using (couple_id is not null and subject_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Indexes
--
-- Two queries exist now where there was one full-table read: "the questions I
-- have written about me", for the authoring screen, and "questions about my
-- partner", for a round.
-- ---------------------------------------------------------------------------

create index if not exists trivia_questions_by_subject
  on public.trivia_questions (couple_id, subject_user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Realtime
--
-- A question written on one phone has to be answerable on the other without a
-- reload — the same reasoning as `wheel_options` in 0012, and for the same
-- reason: this is a shared list one person edits and the other plays against.
--
-- `replica identity full` because questions are deleted from the authoring
-- screen, and a DELETE carries only the primary key otherwise, which the
-- subscriber's `couple_id=eq.…` filter has nothing to match against.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'trivia_questions'
  ) then
    alter publication supabase_realtime add table public.trivia_questions;
  end if;
end $$;

alter table public.trivia_questions replica identity full;
