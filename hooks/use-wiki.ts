import { useCallback } from 'react';

import { useAsyncData } from '@/hooks/use-async-data';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/providers/toast-provider';
import { fetchUsSnapshot, saveWikiEntry, type UsSnapshot } from '@/lib/us';
import { WIKI_CATEGORY_LABELS, WIKI_SLOTS } from '@/constants/relationship';
import type { WikiEntry } from '@/types/domain';

/** Narrower than the Us screen's: this one only renders the wiki. */
const WIKI_TABLES = ['wiki_entries', 'couple_members', 'profiles'] as const;

export type WikiSlot = {
  category: WikiEntry['category'];
  label: string;
  /** Empty string when the slot exists but has never been filled. */
  value: string;
};

/**
 * Partner cheat-sheet (PRD §6).
 *
 * The list of slots is a constant, not a query — see `constants/relationship`.
 * A row in `wiki_entries` only exists once someone fills it, so the screen
 * renders `WIKI_SLOTS` and merges whatever rows came back on top; saving upserts
 * on the natural key and does not care whether a row was there before.
 *
 * The PRD's offline requirement is still unmet. The old mock carried a
 * `cachedOffline` flag per entry and rendered a tick for it, which was a
 * decoration over data that never left memory — that tick is gone rather than
 * left lying about persistence the app does not have.
 */
export function useWiki() {
  const { user, coupleId } = useAuth();
  const toast = useToast();
  const userId = user?.id ?? null;

  const load = useCallback(async () => {
    if (!coupleId || !userId) throw new Error('You’re not in a hub yet.');
    return fetchUsSnapshot(coupleId, userId);
  }, [coupleId, userId]);

  const { data, error, loading, refetch, setData } = useAsyncData(
    coupleId && userId ? load : null,
    WIKI_TABLES
  );

  const subjectId = data?.partner?.userId ?? null;

  const slots: WikiSlot[] = WIKI_SLOTS.map((slot) => ({
    category: slot.category,
    label: slot.label,
    value:
      data?.wiki.find((w) => w.subjectUserId === subjectId && w.label === slot.label)?.value ?? '',
  }));

  const sections = (Object.keys(WIKI_CATEGORY_LABELS) as WikiEntry['category'][])
    .map((category) => ({
      category,
      title: WIKI_CATEGORY_LABELS[category],
      slots: slots.filter((s) => s.category === category),
    }))
    .filter((section) => section.slots.length > 0);

  const save = useCallback(
    (slot: WikiSlot, value: string) => {
      if (!data || !coupleId || !userId || !subjectId) return;

      const previous: UsSnapshot = data;
      const trimmed = value.trim();

      setData({
        ...data,
        wiki: [
          ...data.wiki.filter((w) => !(w.subjectUserId === subjectId && w.label === slot.label)),
          {
            subjectUserId: subjectId,
            category: slot.category,
            label: slot.label,
            value: trimmed || null,
          },
        ],
      });

      void saveWikiEntry({
        coupleId,
        subjectUserId: subjectId,
        authorUserId: userId,
        category: slot.category,
        label: slot.label,
        value: trimmed,
      }).catch((thrown: unknown) => {
        setData(previous);
        toast.error(thrown instanceof Error ? thrown.message : 'That didn’t save.');
      });
    },
    [data, coupleId, userId, subjectId, setData, toast]
  );

  return {
    partnerName: data?.partner?.name ?? 'your partner',
    /** False when the hub has one member — there is nobody to keep notes about. */
    hasPartner: subjectId !== null,
    sections,
    filledCount: slots.filter((s) => s.value.length > 0).length,
    total: slots.length,
    loading,
    error,
    refetch,
    save,
  };
}
