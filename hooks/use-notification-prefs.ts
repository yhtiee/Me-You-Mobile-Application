import { useCallback, useState } from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/providers/toast-provider';
import { useAsyncData } from '@/hooks/use-async-data';
import {
  DEFAULT_PREFS,
  fetchNotificationPrefs,
  saveNotificationPrefs,
  type NotificationPrefs,
} from '@/lib/notification-prefs';

/** Own row, so a change on one device reaches the same person's other one. */
const PREFS_TABLES = ['notification_prefs'] as const;

/**
 * The Settings switches, connected to something for the first time.
 *
 * These three were local `useState` — they moved, looked like they worked, and
 * did nothing at all. That was survivable only while no notification was ever
 * sent; shipping push on top of decorative controls would mean a user turning
 * something off and then being buzzed by it.
 */
export function useNotificationPrefs() {
  const { user } = useAuth();
  const toast = useToast();
  const userId = user?.id ?? null;

  const load = useCallback(async () => {
    if (!userId) throw new Error('Your session ended. Log in again to continue.');
    return fetchNotificationPrefs(userId);
  }, [userId]);

  const { data, loading, error, refetch, setData } = useAsyncData(
    userId ? load : null,
    PREFS_TABLES
  );

  const [saving, setSaving] = useState(false);

  const prefs = data ?? DEFAULT_PREFS;

  const toggle = useCallback(
    async (key: keyof NotificationPrefs) => {
      if (!userId) {
        toast.error('Your session ended. Log in again to continue.');
        return;
      }

      const next = { ...prefs, [key]: !prefs[key] };
      const previous = prefs;

      // Optimistic. A switch that waits on a round trip before it moves reads as
      // broken, and this one has spent its whole life moving instantly.
      setData(next);
      setSaving(true);

      try {
        await saveNotificationPrefs(userId, next);
        refetch();
      } catch (thrown) {
        setData(previous);
        toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t save that.');
      } finally {
        setSaving(false);
      }
    },
    [userId, prefs, setData, refetch, toast]
  );

  return { prefs, toggle, saving, loading, error, refetch };
}
