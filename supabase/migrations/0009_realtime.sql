-- ============================================================================
-- 0009 · Realtime
-- Publishes the tables both partners share, so a change on one device reaches
-- the other without waiting for a screen to be re-opened.
--
-- Safe to re-run, unlike 0001-0007: every statement checks first. Realtime is
-- the one thing you are likely to want to add a table to later.
-- ============================================================================

/*
 * Supabase projects ship with this publication, but a database reset (see the
 * README's "starting over") drops it along with everything else in `public`.
 */
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

/*
 * The client subscribes with per-table filters (`couple_id=eq.<id>`) and relies
 * on RLS for the two tables that have no couple column — `profiles` and
 * `love_languages`, both of which are already scoped by `shares_couple_with`.
 * Realtime evaluates those policies per subscriber before it sends anything, so
 * publishing a table here does not widen who can read it.
 *
 * `to_regclass` guards each name so this file survives a table being renamed or
 * not existing yet rather than aborting halfway through.
 */
do $$
declare
  t text;
  wanted text[] := array[
    'couples',
    'couple_members',
    'profiles',
    'check_ins',
    'love_languages',
    'goals',
    'bucket_list_items',
    'wiki_entries',
    'calendar_events',
    'todos',
    'growth_habits',
    'coach_conversations',
    'coach_messages',
    'picker_swipes'
  ];
begin
  foreach t in array wanted loop
    if to_regclass('public.' || t) is not null
       and not exists (
         select 1
         from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = t
       )
    then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

/*
 * REPLICA IDENTITY FULL on the tables a delete can happen to.
 *
 * By default Postgres puts only the primary key in the WAL for a DELETE, which
 * leaves Realtime with a row it cannot match against either the subscriber's
 * `couple_id=eq.…` filter or the table's RLS policy — so deletes either reach
 * nobody or reach everybody, depending on the table. FULL puts the old row in
 * the WAL so both checks can run.
 *
 * The cost is WAL volume, which is why it is not set on `check_ins` or
 * `coach_messages`: those are append-and-amend tables that nothing deletes, and
 * `coach_messages` rows carry whole model transcripts.
 */
do $$
declare
  t text;
  deletable text[] := array[
    'goals',
    'bucket_list_items',
    'wiki_entries',
    'calendar_events',
    'todos',
    'love_languages',
    'couple_members'
  ];
begin
  foreach t in array deletable loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I replica identity full', t);
    end if;
  end loop;
end $$;
