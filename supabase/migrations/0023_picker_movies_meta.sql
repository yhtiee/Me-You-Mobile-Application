-- ============================================================================
-- 0023 · Picker Movies Metadata & Posters
--
-- Extends picker_items with poster thumbnails, ratings, years, genres,
-- synopses, and external IDs (e.g. TMDB) for movie & meal matching.
-- ============================================================================

alter table public.picker_items
  add column if not exists image_url text,
  add column if not exists external_id text,
  add column if not exists rating numeric(3, 1),
  add column if not exists year integer,
  add column if not exists genre text,
  add column if not exists overview text;

create unique index if not exists picker_items_external_id_idx
  on public.picker_items (external_id)
  where external_id is not null;

-- Update picker_matches() to return image and metadata for match reveal
drop function if exists public.picker_matches();

create or replace function public.picker_matches()
returns table (
  item_id    uuid,
  kind       public.picker_kind,
  title      text,
  meta       text,
  image_url  text,
  rating     numeric,
  year       integer,
  overview   text,
  matched_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    i.id,
    i.kind,
    i.title,
    i.meta,
    i.image_url,
    i.rating,
    i.year,
    i.overview,
    max(s.created_at) as matched_at
  from public.picker_swipes s
  join public.picker_items i on i.id = s.item_id
  where s.liked
    and s.couple_id = public.current_couple_id()
  group by i.id, i.kind, i.title, i.meta, i.image_url, i.rating, i.year, i.overview
  having count(distinct s.user_id) = 2;
$$;

revoke all on function public.picker_matches() from public, anon;
grant execute on function public.picker_matches() to authenticated;
