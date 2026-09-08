import { useCallback, useState } from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/providers/toast-provider';
import { useAsyncData } from '@/hooks/use-async-data';
import { fetchTogetherSince, setTogetherSince } from '@/lib/home';
import { durationSince, yearsAgoIso, yearsSince } from '@/utils/date';

/** The banner reads the same column, so a change there has to reach here. */
const TOGETHER_TABLES = ['couples'] as const;

/**
 * When the two of you started, and the two ways to say it.
 *
 * Both partners write the same `couples` row, so this subscribes to `couples`:
 * one person setting the date has to move the other's screen without a reload,
 * and the home banner is reading the same value through `useHome`.
 */
export function useTogether() {
  const { coupleId } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!coupleId) throw new Error('You’re not in a hub yet.');
    return fetchTogetherSince(coupleId);
  }, [coupleId]);

  const { data, loading, error, refetch, setData } = useAsyncData(
    coupleId ? load : null,
    TOGETHER_TABLES
  );

  // `data` is `string | null` and `useAsyncData` also uses null for "not loaded
  // yet", so the two are indistinguishable here. That is fine: both mean "no
  // date to show", and `loading` separates them for anything that cares.
  const since = data ?? null;

  const save = useCallback(
    async (iso: string | null) => {
      if (!coupleId) {
        toast.error('You’re not in a hub yet.');
        return false;
      }

      setSaving(true);
      // Optimistic: the banner updates as the sheet closes rather than a round
      // trip later. Rolled back below if the write is refused.
      const previous = data ?? null;
      setData(iso);

      try {
        await setTogetherSince(coupleId, iso);
        refetch();
        return true;
      } catch (thrown) {
        setData(previous);
        toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t save that.');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [coupleId, data, setData, refetch, toast]
  );

  return {
    /** ISO `YYYY-MM-DD`, or null if it has never been set. */
    since,
    /** "2 years, 4 months" — what the banner shows. Null when unset. */
    label: since ? durationSince(since) : null,
    /** Whole years, for the number field. Null when unset. */
    years: since ? yearsSince(since) : null,
    /** Save an exact date. */
    save,
    /** Save "we've been together N years", resolved to N years ago today. */
    saveYears: useCallback((years: number) => save(yearsAgoIso(years)), [save]),
    saving,
    loading,
    error,
    refetch,
  };
}
