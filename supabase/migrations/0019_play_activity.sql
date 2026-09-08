-- ============================================================================
-- 0019 · Play activity — what the two of you have actually been doing
--
-- Play could tell you totals ("4 flips", "12 spins") through `play_stats()`,
-- and nothing else. There was no way to see that your partner spun the wheel an
-- hour ago and it landed on them, which is the only part of a shared game that
-- is worth coming back for.
--
-- One round trip for a mixed feed, rather than four queries and a client-side
-- merge sort. The alternative — a physical `play_activity` table written by
-- triggers — was rejected: every row here is derivable from data that already
-- exists, and a denormalised copy is a second version of the truth that has to
-- be kept right forever. This is a view over the log, not a new log.
--
-- `security invoker` (the default) throughout, except where it calls
-- `picker_matches()`, which is already `security definer` and owns the one
-- privilege the caller does not have: seeing that *both* of you liked an item.
-- Everything else is visible to the caller under the 0007 policies.
-- ============================================================================

/*
 * The `_col` suffixes exist for the same reason as the `_count` ones in 0012.
 *
 * A `returns table` column name is in scope inside the body as if it were a
 * variable, so naming a column `kind` while also selecting `kind` from
 * `picker_items` makes one identifier mean two things. Postgres resolves that
 * in favour of the variable in some positions and raises "column reference is
 * ambiguous" in others — and the bad case is the silent one. Do not rename
 * these to match the JSON keys the client wants; the client renames them.
 */
create or replace function public.play_activity(p_limit integer default 20)
returns table (
  id_col          text,
  kind_col        text,
  actor_id_col    uuid,
  subject_id_col  uuid,
  label_col       text,
  detail_col      text,
  occurred_at_col timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with events as (
    -- Coin. `payload->>'winner'` is a user id; the client resolves it to
    -- "You" or their name, because only the client knows who is reading.
    select
      'coin:' || e.id::text                        as id_col,
      'coin'                                       as kind_col,
      e.user_id                                    as actor_id_col,
      nullif(e.payload->>'winner', '')::uuid       as subject_id_col,
      nullif(trim(e.payload->>'stake'), '')        as label_col,
      null::text                                   as detail_col,
      e.created_at                                 as occurred_at_col
    from public.tool_events e
    where e.kind = 'coin'
      and e.couple_id = public.current_couple_id()

    union all

    -- Wheel. The landed option is the whole story; the option list it was
    -- drawn from is in the payload but is noise in a feed.
    select
      'wheel:' || e.id::text,
      'wheel',
      e.user_id,
      null::uuid,
      nullif(trim(e.payload->>'landed_on'), ''),
      null::text,
      e.created_at
    from public.tool_events e
    where e.kind = 'wheel'
      and e.couple_id = public.current_couple_id()

    union all

    -- Trivia. Only completed rounds: an abandoned one is not a result, and a
    -- feed of things nobody finished is a feed of nagging.
    select
      'trivia:' || r.id::text,
      'trivia',
      r.player_id,
      r.subject_id,
      r.score::text || '/' || r.total::text,
      null::text,
      r.completed_at
    from public.trivia_rounds r
    where r.couple_id = public.current_couple_id()
      and r.completed_at is not null
      and r.score is not null
      and r.total is not null

    union all

    -- Picker matches. No actor: a match is the one event here that neither
    -- person did on their own, which is exactly what makes it worth showing.
    select
      'picker:' || m.item_id::text,
      'picker',
      null::uuid,
      null::uuid,
      m.title,
      m.meta,
      m.matched_at
    from public.picker_matches() m
  )
  select
    id_col, kind_col, actor_id_col, subject_id_col, label_col, detail_col, occurred_at_col
  from events
  where occurred_at_col is not null
  order by occurred_at_col desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

revoke all on function public.play_activity(integer) from public, anon;
grant execute on function public.play_activity(integer) to authenticated;
