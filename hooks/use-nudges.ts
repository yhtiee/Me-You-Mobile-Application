import { useCallback } from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/providers/toast-provider';
import { useAsyncData } from '@/hooks/use-async-data';
import { fetchTodayNudges, markNudgeSent, unmarkNudgeSent } from '@/lib/nudges';

/**
 * Your own rows, so this stays in step across your own devices. Not the
 * partner's — see the RLS note in `0017_daily_nudges.sql`.
 */
const NUDGE_TABLES = ['daily_nudges'] as const;

/** Stable empty array, so a null result never re-renders on identity alone. */
const NONE: string[] = [];

/**
 * Which apps you have told us you messaged them on today.
 *
 * A self-report, deliberately. Opening WhatsApp does not tick WhatsApp — you
 * can open an app and send nothing, and a checklist that quietly marks itself
 * as you browse is one that lies to the person relying on it. The tap that
 * ticks it is separate from the tap that opens the app.
 */
export function useNudges() {
  const { user, coupleId } = useAuth();
  const toast = useToast();
  const userId = user?.id ?? null;

  const load = useCallback(async () => {
    if (!userId) throw new Error('Your session ended. Log in again to continue.');
    return fetchTodayNudges(userId);
  }, [userId]);

  const { data, loading, error, refetch, setData } = useAsyncData(
    userId ? load : null,
    NUDGE_TABLES
  );

  const sent = data ?? NONE;

  const toggle = useCallback(
    async (channel: string) => {
      if (!userId || !coupleId) {
        toast.error('Your session ended. Log in again to continue.');
        return;
      }

      const wasSent = sent.includes(channel);
      const previous = sent;

      // Optimistic: this is a checkbox, and a checkbox that waits for a round
      // trip before it fills in feels broken rather than careful.
      setData(wasSent ? sent.filter((c) => c !== channel) : [...sent, channel]);

      try {
        if (wasSent) await unmarkNudgeSent({ userId, channel });
        else await markNudgeSent({ coupleId, userId, channel });
        refetch();
      } catch (thrown) {
        setData(previous);
        toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t save that.');
      }
    },
    [userId, coupleId, sent, setData, refetch, toast]
  );

  return {
    /** Channel keys ticked today. */
    sent,
    isSent: useCallback((channel: string) => sent.includes(channel), [sent]),
    toggle,
    /** How many channels you have used today, for the sheet's summary line. */
    count: sent.length,
    loading,
    error,
    refetch,
  };
}
