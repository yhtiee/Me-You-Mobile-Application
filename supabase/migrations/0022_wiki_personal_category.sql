-- ============================================================================
-- 0022 · Wiki personal category & slot expansion
--
-- Adds 'personal' to the `wiki_category` enum so partners can record personal
-- details (birthday, zodiac sign, blood group, allergies, etc.).
--
-- Also migrates legacy label spellings ('Favourite food' -> 'Favorite food' and
-- 'Favourite flowers' -> 'Favorite flower') to match the updated client slots.
-- ============================================================================

alter type public.wiki_category add value if not exists 'personal';

-- Migrate existing entries if they exist under previous British English labels
update public.wiki_entries
  set label = 'Favorite food'
  where label = 'Favourite food';

update public.wiki_entries
  set label = 'Favorite flower'
  where label = 'Favourite flowers';
