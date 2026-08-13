import { useCallback } from 'react';

import { useAsyncData } from '@/hooks/use-async-data';
import { useAuth } from '@/components/providers/auth-provider';
import { fetchCoupleProgress } from '@/lib/home';
import { levels } from '@/mocks/couple';

/** The streak moves by trigger when your partner checks in — watch both. */
const STREAK_TABLES = ['couples', 'check_ins'] as const;

/**
 * Love streak, current level, and the next milestone on the PRD §5 ladder.
 *
 * The count and level are read from `couples` — the same row the home banner
 * shows, which is the point: this hook feeds the dialog that opens when you tap
 * that banner's badge, and the two disagreeing by 47 days is exactly the bug
 * that comes of migrating one of them and not the other.
 *
 * The ladder itself is still the static list from `mocks/couple`. It is
 * reference data, identical to what `0008_seed.sql` puts in the `levels` table,
 * and spending a query on five rows that ship in the bundle would buy nothing —
 * read it from the table when a level's copy needs editing without a release.
 */
export function useStreak() {
  const { coupleId } = useAuth();

  const load = useCallback(async () => {
    if (!coupleId) throw new Error('You’re not in a hub yet.');
    return fetchCoupleProgress(coupleId);
  }, [coupleId]);

  const { data, loading, error, refetch } = useAsyncData(coupleId ? load : null, STREAK_TABLES);

  const count = data?.streak ?? 0;
  const level = data?.level ?? 1;
  const bothCheckedIn = data?.bothCheckedInToday ?? false;

  const current = levels.findLast((l) => l.level <= level) ?? levels[0];
  const next = levels.find((l) => l.level > level) ?? null;

  return {
    count,
    level,
    levelTitle: current.title,
    nextMilestone: next,
    bothCheckedIn,
    atRisk: !bothCheckedIn,
    /** Progress toward the next level, 0-1. */
    progress: next ? Math.min(1, (level - current.level) / (next.level - current.level)) : 1,
    levels,
    loading,
    error,
    refetch,
  };
}
