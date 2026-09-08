import { useCallback, useEffect, useRef } from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { useAsyncData } from '@/hooks/use-async-data';
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllRead,
  type AppNotification,
} from '@/lib/notifications-feed';

/** Rows are addressed to one person; the socket is filtered to them. */
const NOTIFICATION_TABLES = ['notifications'] as const;

const NONE: AppNotification[] = [];

/**
 * The notification list, and the side effect of having read it.
 *
 * Marks everything read once, on mount, rather than on a "mark all read"
 * button. Opening the screen is the act the bell was asking for, and a badge
 * that survives the user plainly having looked at the list is a badge they stop
 * believing.
 */
export function useNotifications() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const load = useCallback(async () => {
    if (!userId) throw new Error('Your session ended. Log in again to continue.');
    return fetchNotifications();
  }, [userId]);

  const { data, loading, error, refetch } = useAsyncData(
    userId ? load : null,
    NOTIFICATION_TABLES
  );

  /*
   * Once per mount, and only after something has actually loaded.
   *
   * Guarded by a ref rather than by a dependency list because the realtime
   * subscription refetches: without it, a notification arriving while the
   * screen is open would mark itself read before the user's eyes reached it.
   */
  const marked = useRef(false);
  const hasItems = (data?.length ?? 0) > 0;

  useEffect(() => {
    if (marked.current || !hasItems) return;
    marked.current = true;
    void markAllRead();
  }, [hasItems]);

  return {
    items: data ?? NONE,
    /** For "You" vs their name — only this device knows who is reading. */
    userId,
    loading,
    error,
    refetch,
  };
}

/**
 * Just the badge number, for the header bell.
 *
 * Separate from `useNotifications` on purpose: this one mounts on every screen
 * with a header, so it must not pull forty rows to render a dot. `head: true`
 * with an exact count is a `COUNT(*)` over a partial index and no payload at
 * all.
 */
export function useUnreadCount(): number {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const load = useCallback(async () => {
    if (!userId) throw new Error('No session.');
    return fetchUnreadCount();
  }, [userId]);

  const { data } = useAsyncData(userId ? load : null, NOTIFICATION_TABLES);

  return data ?? 0;
}
