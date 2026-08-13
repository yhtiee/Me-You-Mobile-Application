import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useTableChanges } from '@/components/providers/realtime-provider';

export type AsyncData<T> = {
  data: T | null;
  /** Written message, already fit to show a user. */
  error: string | null;
  /** First load, with nothing on screen yet — this is what draws a skeleton. */
  loading: boolean;
  /** A reload behind data that is already rendered. Never draws a skeleton. */
  refreshing: boolean;
  refetch: () => void;
  /** Optimistic local write. Replaced by whatever the next fetch returns. */
  setData: (next: T) => void;
};

/**
 * The one data-fetching primitive in the app.
 *
 * Deliberately not TanStack Query. This buys the three things the screens
 * actually need — a loading flag that distinguishes first paint from a refresh,
 * a written error, and a refetch on focus — in a file you can read in a minute,
 * against a dependency list the project has kept deliberately short. Swap it
 * for a real cache when two screens want the same data at the same time; today
 * none do.
 *
 * `load` must be stable (wrap it in `useCallback`) — it is the dependency that
 * decides when a refetch happens. Pass `null` for "not ready yet", e.g. before
 * the session has produced a couple id; the hook stays in its loading state
 * rather than firing a query it knows will fail.
 *
 * `tables` names the Postgres tables whose changes should trigger a reload, so
 * the other partner's device updates this one without either person touching
 * anything. It must be a stable reference — declare it at module scope. See
 * `RealtimeProvider` for why a change is a signal to refetch rather than a
 * payload to merge.
 */
export function useAsyncData<T>(
  load: (() => Promise<T>) | null,
  tables?: readonly string[]
): AsyncData<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(true);

  /**
   * Only the newest request may write to state. Without this, a slow refetch
   * resolving after a faster one rolls the screen back to older data — the
   * classic race that makes a list flicker between two versions of itself.
   */
  const requestId = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    if (!load) return;

    const id = requestId.current + 1;
    requestId.current = id;
    setPending(true);

    try {
      const next = await load();
      if (!alive.current || id !== requestId.current) return;
      setData(next);
      setError(null);
    } catch (thrown) {
      if (!alive.current || id !== requestId.current) return;
      setError(thrown instanceof Error ? thrown.message : 'Something went wrong.');
    } finally {
      if (alive.current && id === requestId.current) setPending(false);
    }
  }, [load]);

  useEffect(() => {
    void run();
  }, [run]);

  /**
   * Refetch when the screen comes back into focus, skipping the first focus —
   * the effect above already covers mount.
   *
   * This is the whole reason home updates after the check-in sheet closes.
   * The sheet writes and pops; home is focused again and re-reads. No event
   * bus, no cache invalidation, no provider shared between two routes.
   */
  const focusedBefore = useRef(false);

  /**
   * Held in a ref so the focus callback below can stay `[]`-stable. Depending on
   * `run` directly would re-arm the effect whenever `load` changes — which fires
   * a *second* request alongside the mount effect above every time an id the
   * loader closes over resolves.
   */
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  useFocusEffect(
    useCallback(() => {
      if (!focusedBefore.current) {
        focusedBefore.current = true;
        return;
      }
      void runRef.current();
    }, [])
  );

  /**
   * The other device changed something this screen is showing.
   *
   * Runs whether or not the screen is focused. A background refresh of a screen
   * sitting under a pushed one costs a query nobody is waiting on, and buys a
   * screen that is already correct when the user swipes back to it.
   */
  const onRemoteChange = useCallback(() => {
    void runRef.current();
  }, []);

  useTableChanges(tables, onRemoteChange);

  return {
    data,
    error,
    loading: pending && data === null,
    refreshing: pending && data !== null,
    refetch: run,
    setData,
  };
}
