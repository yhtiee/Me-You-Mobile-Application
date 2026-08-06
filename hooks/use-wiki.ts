import { useCouple } from '@/components/providers/couple-provider';
import type { WikiEntry } from '@/types/domain';

const CATEGORY_LABELS: Record<WikiEntry['category'], string> = {
  favourites: 'Favourites',
  sizes: 'Sizes',
  dreams: 'Dreams',
  wishlist: 'Wishlist',
};

/**
 * Partner cheat-sheet. The PRD requires these to be readable offline, so the
 * UI surfaces a cached indicator per entry; actual persistence lands with the
 * API layer.
 */
export function useWiki() {
  const { wiki, updateWikiEntry, partner } = useCouple();

  const sections = (Object.keys(CATEGORY_LABELS) as WikiEntry['category'][])
    .map((category) => ({
      category,
      title: CATEGORY_LABELS[category],
      entries: wiki.filter((w) => w.category === category),
    }))
    .filter((s) => s.entries.length > 0);

  return {
    partnerName: partner.name,
    entries: wiki,
    sections,
    filledCount: wiki.filter((w) => w.value.length > 0).length,
    update: updateWikiEntry,
  };
}
