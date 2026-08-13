import { useCallback } from 'react';

import { useAsyncData } from '@/hooks/use-async-data';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/providers/toast-provider';
import {
  fetchUsSnapshot,
  incrementGoal,
  setBucketItemDone,
  setGoalDone,
  type UsGoal,
  type UsSnapshot,
} from '@/lib/us';
import { LOVE_LANGUAGES, WIKI_SLOTS } from '@/constants/relationship';
import type { LoveLanguage } from '@/types/domain';

/**
 * Everything the Us snapshot reads. Broad on purpose — one hook backs the Us
 * screen, the bucket list and the to-do screen's shared card, and a goal ticked
 * on the other device should move all three.
 */
const US_TABLES = [
  'couples',
  'couple_members',
  'check_ins',
  'goals',
  'bucket_list_items',
  'wiki_entries',
  'love_languages',
] as const;

/** One row of the love-language comparison: the same trait, both people. */
export type LoveLanguageRow = {
  key: LoveLanguage['key'];
  label: string;
  you: number;
  partner: number;
};

export type UsView = {
  partnerName: string;
  goals: UsGoal[];
  goalsDone: number;
  bucket: { id: string; label: string; done: boolean }[];
  bucketDone: number;
  wikiFilled: number;
  wikiTotal: number;
  loveLanguages: LoveLanguageRow[];
  /** True when neither person has set theirs — the card has nothing to compare. */
  loveLanguagesUnset: boolean;
  health: number;
  /**
   * What the health number is made of, so the card can show its working rather
   * than asserting a percentage at the user.
   */
  healthParts: { label: string; value: string; share: number }[];
};

/**
 * Everything the Us screen renders, read from Supabase.
 *
 * DESIGN GAP — the PRD asks for a Relationship Health Bar (P2) but the redesign
 * mock has no visual for it, and the composition below is still a first pass
 * from the PRD wording: "streak length, completed check-ins, and active date
 * logging". It is now computed from real rows rather than mock ones, but the
 * *formula* remains unreviewed. The UI shows its three inputs precisely because
 * a number nobody has signed off on should at least be auditable by the person
 * looking at it.
 */
export function useRelationship() {
  const { user, coupleId, pairing } = useAuth();
  const toast = useToast();
  const userId = user?.id ?? null;

  const load = useCallback(async () => {
    if (!coupleId || !userId) throw new Error('You’re not in a hub yet.');
    return fetchUsSnapshot(coupleId, userId);
  }, [coupleId, userId]);

  const { data, error, loading, refetch, setData } = useAsyncData(
    coupleId && userId ? load : null,
    US_TABLES
  );

  const noHub = !coupleId && pairing === 'unpaired';

  /** Optimistic, with a rollback — same contract as home's checkbox. */
  const mutate = useCallback(
    (next: UsSnapshot, run: () => Promise<void>) => {
      if (!data) return;
      const previous = data;
      setData(next);
      void run().catch((thrown: unknown) => {
        setData(previous);
        toast.error(thrown instanceof Error ? thrown.message : 'That didn’t save.');
      });
    },
    [data, setData, toast]
  );

  const logGoalProgress = useCallback(
    (goal: UsGoal) => {
      if (!data || goal.done) return;
      const current = Math.min(goal.current + 1, goal.target);
      mutate(
        {
          ...data,
          goals: data.goals.map((g) =>
            g.id === goal.id ? { ...g, current, done: current >= g.target } : g
          ),
        },
        () => incrementGoal(goal)
      );
    },
    [data, mutate]
  );

  const toggleGoal = useCallback(
    (goal: UsGoal) => {
      if (!data) return;
      mutate(
        {
          ...data,
          goals: data.goals.map((g) => (g.id === goal.id ? { ...g, done: !g.done } : g)),
        },
        () => setGoalDone(goal.id, !goal.done)
      );
    },
    [data, mutate]
  );

  const toggleBucketItem = useCallback(
    (item: { id: string; done: boolean }) => {
      if (!data) return;
      mutate(
        {
          ...data,
          bucket: data.bucket.map((b) => (b.id === item.id ? { ...b, done: !b.done } : b)),
        },
        () => setBucketItemDone(item.id, !item.done)
      );
    },
    [data, mutate]
  );

  const view: UsView | null = data ? toView(data, userId) : null;

  return {
    view,
    error: noHub ? 'You’re not paired with anyone yet.' : error,
    loading: loading && !noHub,
    refetch,
    logGoalProgress,
    toggleGoal,
    toggleBucketItem,
  };
}

function toView(data: UsSnapshot, userId: string | null): UsView {
  const goalsDone = data.goals.filter((g) => g.done).length;

  // Only slots the app still offers are counted. A label removed from
  // `WIKI_SLOTS` leaves its row behind in the table, and counting it would make
  // the total on the card disagree with the list on the wiki screen.
  const known = new Set(WIKI_SLOTS.map((s) => s.label));
  const wikiFilled = data.wiki.filter(
    (w) =>
      w.subjectUserId === data.partner?.userId &&
      known.has(w.label) &&
      (w.value?.trim().length ?? 0) > 0
  ).length;

  const shareFor = (id: string | null | undefined, key: LoveLanguage['key']) =>
    data.loveLanguages.find((l) => l.userId === id && l.key === key)?.value ?? 0;

  const loveLanguages: LoveLanguageRow[] = LOVE_LANGUAGES.map((language) => ({
    key: language.key,
    label: language.label,
    you: shareFor(userId, language.key),
    partner: shareFor(data.partner?.userId, language.key),
  }));

  const streakShare = Math.min(100, data.streak / 1.2) * 0.5;
  const checkinShare = data.checkedInToday * 12.5;
  const goalShare = data.goals.length ? (goalsDone / data.goals.length) * 25 : 0;

  return {
    partnerName: data.partner?.name ?? 'your partner',
    goals: data.goals,
    goalsDone,
    bucket: data.bucket,
    bucketDone: data.bucket.filter((b) => b.done).length,
    wikiFilled,
    wikiTotal: WIKI_SLOTS.length,
    loveLanguages,
    loveLanguagesUnset: loveLanguages.every((l) => l.you === 0 && l.partner === 0),
    health: Math.round(streakShare + checkinShare + goalShare),
    healthParts: [
      {
        label: 'Streak',
        value: data.streak === 1 ? '1 day' : `${data.streak} days`,
        share: streakShare / 50,
      },
      {
        label: 'Checked in today',
        value: `${data.checkedInToday} of 2`,
        share: checkinShare / 25,
      },
      {
        label: 'Goals done',
        value: `${goalsDone} of ${data.goals.length}`,
        share: goalShare / 25,
      },
    ],
  };
}
