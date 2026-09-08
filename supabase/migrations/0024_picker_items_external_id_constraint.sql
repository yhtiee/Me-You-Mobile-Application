-- ============================================================================
-- 0024 · Picker Items Unique Constraint
--
-- Replaces the partial index with a standard unique constraint on external_id
-- so PostgREST upsert (onConflict: 'external_id') functions properly.
-- ============================================================================

drop index if exists public.picker_items_external_id_idx;

alter table public.picker_items
  drop constraint if exists picker_items_external_id_key;

alter table public.picker_items
  add constraint picker_items_external_id_key unique (external_id);
