import { useCallback } from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { useAsyncData } from '@/hooks/use-async-data';
import { fetchCouplePeople, type CouplePeople } from '@/lib/people';

/**
 * Membership and names. A partner joining, leaving or renaming themselves has
 * to reach every screen that addresses them.
 */
const PEOPLE_TABLES = ['couple_members', 'profiles'] as const;

/**
 * The two names, for any screen that has to address someone.
 *
 * Replaces reading `partner` off the mock `CoupleProvider`, which only ever
 * answered "Sarah".
 */
export function useCouplePeople() {
  const { user, coupleId } = useAuth();
  const userId = user?.id ?? null;

  const load = useCallback(async () => {
    if (!userId || !coupleId) throw new Error('Your session ended. Log in again to continue.');
    return fetchCouplePeople(coupleId, userId);
  }, [userId, coupleId]);

  const { data, error, loading } = useAsyncData(
    userId && coupleId ? load : null,
    PEOPLE_TABLES
  );

  /*
   * Falls back to a usable pair rather than null. Every caller renders a name
   * into a sentence, and threading "the names have not loaded yet" through every
   * screen buys nothing over one frame of "your partner".
   */
  const people: CouplePeople = data ?? {
    you: { id: userId ?? 'you', name: 'You' },
    partner: null,
  };

  return { ...people, loading, error };
}

/**
 * The partner's name for use *inside* a sentence.
 *
 * "Say something to Your partner" reads as a typo, so the fallback is lowercased
 * here, once, instead of every caller remembering to. A real name is returned
 * untouched.
 */
export function partnerNameInSentence(people: CouplePeople): string {
  const name = people.partner?.name;
  if (!name || name === 'Your partner') return 'your partner';
  return name;
}
