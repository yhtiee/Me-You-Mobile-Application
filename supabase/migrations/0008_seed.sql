-- ============================================================================
-- 0008 · Reference and stock content
--
-- Safe to re-run: every insert is idempotent. Nothing here is couple data, so
-- this file is fine to apply against production.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Progression ladder (PRD §5), matching `mocks/couple.ts`
-- ---------------------------------------------------------------------------

insert into public.levels (level, title, requirement) values
  (1,  'Crushes',            'Initial pairing & account setup complete.'),
  (5,  'Lovers',             '7-day streak + 2 dates completed.'),
  (10, 'Soulmates',          '30-day streak + 5 partner wiki entries filled.'),
  (20, 'Power Couple',       '90-day streak + 10 shared goals accomplished.'),
  (50, 'Relationship GOATs', '365-day streak + ultimate relationship status achieved.')
on conflict (level) do update
  set title = excluded.title,
      requirement = excluded.requirement;

-- ---------------------------------------------------------------------------
-- Stock picker content (couple_id null = available to everyone)
--
-- Guarded on title rather than a natural key, because these have no stable id
-- and re-running the file should not duplicate them.
-- ---------------------------------------------------------------------------

insert into public.picker_items (couple_id, kind, title, meta)
select null, 'movie'::public.picker_kind, v.title, v.meta
from (values
  ('Past Lives',                          'Drama · 1h 45m'),
  ('The Grand Budapest Hotel',            'Comedy · 1h 39m'),
  ('Everything Everywhere All at Once',   'Sci-fi · 2h 19m'),
  ('Before Sunrise',                      'Romance · 1h 41m'),
  ('Paddington 2',                        'Family · 1h 43m')
) as v (title, meta)
where not exists (
  select 1 from public.picker_items p
  where p.couple_id is null and p.kind = 'movie' and p.title = v.title
);

-- ---------------------------------------------------------------------------
-- Stock date ideas
-- ---------------------------------------------------------------------------

insert into public.date_ideas (couple_id, title, location, time_hint)
select null, v.title, v.location, v.time_hint
from (values
  ('Sunset walk + gelato', 'Riverside',   'Sun 6:00 pm'),
  ('That pottery class',   'Kiln Studio', 'Thu 6:30 pm')
) as v (title, location, time_hint)
where not exists (
  select 1 from public.date_ideas d
  where d.couple_id is null and d.title = v.title
);

-- ---------------------------------------------------------------------------
-- Stock trivia
--
-- `subject_user_id` stays null on stock rows: these are prompts a couple
-- answers about each other, so the subject is only known once a couple adopts
-- one. Couple-authored questions set it.
-- ---------------------------------------------------------------------------

insert into public.trivia_questions (couple_id, subject_user_id, question, options, correct_index)
select null, null, v.question, v.options, v.correct_index
from (values
  ('Where did we first meet?',            array['A wedding', 'A bookshop', 'Work', 'A bar'],                  1),
  ('What''s my worst habit, honestly?',   array['Snoring', 'Being late', 'Interrupting', 'Loud chewing'],     2),
  ('My comfort film?',                    array['Paddington 2', 'Titanic', 'Heat', 'Shrek'],                  0)
) as v (question, options, correct_index)
where not exists (
  select 1 from public.trivia_questions t
  where t.couple_id is null and t.question = v.question
);
