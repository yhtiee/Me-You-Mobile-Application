import { useCallback } from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { useToast } from '@/components/providers/toast-provider';
import { useAsyncData } from '@/hooks/use-async-data';
import { fetchHomeSnapshot, setCheckedOnPartner, type HomeCheckin, type HomeSnapshot } from '@/lib/home';
import { MOOD_LABELS, NEED_LABELS } from '@/types/domain';
import { palette } from '@/constants/tokens';
import { durationSince } from '@/utils/date';

/**
 * What a change on the other device has to touch for home to be stale.
 *
 * `couples` is in the list for the streak, which no client writes — the
 * `sync_couple_streak` trigger moves it when the second person checks in, so
 * this is the only way your partner's check-in updates your badge.
 *
 * Module scope, not inline: the subscription keys off this array's identity.
 */
const HOME_TABLES = ['couples', 'couple_members', 'profiles', 'check_ins'] as const;

/** One side of the duo card. `state` is null until that person checks in today. */
export type HomeSide = {
  name: string;
  avatarUrl: string | null;
  /** Person colour — rose for you, iris for them. Never swapped. */
  color: string;
  /** The soft wash of the same colour, which fills that person's card. */
  tint: string;
  state: {
    battery: number;
    moodLabel: string;
    moodColor: string;
    needLabel: string;
  } | null;
};

export type HomeView = {
  you: HomeSide;
  /** Null if the other half has not joined, or has left. */
  partner: HomeSide | null;
  streak: number;
  /**
   * Level on the PRD §5 ladder, for the streak section under the banner.
   *
   * Read from the snapshot this hook already fetches rather than through
   * `useStreak`. Both read the same `couples` row, so putting `useStreak` on
   * Home would spend a second query and a second realtime subscription to
   * re-derive a number already sitting in `data` — and give the banner and the
   * section under it two chances to disagree.
   */
  level: number;
  /** Both halves checked in today, so the streak is safe. */
  bothCheckedIn: boolean;
  /** Null when the couple has never set a start date. */
  togetherLabel: string | null;
  isPremium: boolean;
  /** Their battery and ask, for the "Right now" line. Null before they check in. */
  partnerCheckin: HomeCheckin | null;
  /** What they asked for, or null — only Sad and Stressed check-ins carry one. */
  partnerAsk: string | null;
  checkedOnThem: boolean;
  /**
   * The flag lives on today's check-in row, so there is nothing to write to
   * until one exists. False means the UI must offer the check-in instead.
   */
  canLogCheckedOnThem: boolean;
};

function toSide(
  person: { name: string; avatarUrl: string | null } | null,
  checkin: HomeCheckin | null,
  color: string,
  tint: string
): HomeSide | null {
  if (!person) return null;

  return {
    name: person.name,
    avatarUrl: person.avatarUrl,
    color,
    tint,
    state: checkin
      ? {
          battery: checkin.battery,
          moodLabel: MOOD_LABELS[checkin.mood],
          moodColor: palette.mood[checkin.mood],
          // A happy check-in has no ask attached — `need` is only offered after
          // Sad or Stressed — so this is a real state, not missing data.
          needLabel: checkin.need ? NEED_LABELS[checkin.need] : 'No ask today',
        }
      : null,
  };
}

/**
 * Everything the home screen renders, read from Supabase.
 *
 * This is the hook the seam was built for: screens always read through `hooks/`,
 * so moving home off the mock store is a rewrite of this file and the component
 * props it feeds — the rest of the app still reads `couple-provider` and is
 * untouched.
 *
 * Reads refresh whenever home regains focus (see `useAsyncData`), which is how
 * the check-in sheet's write shows up here without the two routes sharing state.
 */
export function useHome() {
  const { user, coupleId, pairing } = useAuth();
  const toast = useToast();
  // The card fills come from the theme, so the duo cards follow dark mode
  // without the screen having to know which side is which colour.
  const { tint } = useTheme();
  const userId = user?.id ?? null;

  /**
   * There is no couple to read and there never will be on this session.
   * `AuthGate` should have redirected already, so this is a backstop — but
   * without it `useAsyncData` sits in its loading state forever and home shows
   * a skeleton that never resolves, which is the worst of the three states.
   */
  const noHub = !coupleId && pairing === 'unpaired';

  const load = useCallback(async () => {
    if (!coupleId || !userId) throw new Error('You’re not in a hub yet.');
    return fetchHomeSnapshot(coupleId, userId);
  }, [coupleId, userId]);

  const { data, error, loading, refetch, setData } = useAsyncData(
    coupleId && userId ? load : null,
    HOME_TABLES
  );

  /**
   * Optimistic, with a rollback.
   *
   * A checkbox that waits for a round trip before it ticks reads as broken on a
   * slow connection, and this one is a throwaway daily action. On failure the
   * tick goes back and the toast says why — silently reverting would leave the
   * user believing they had logged it.
   */
  const toggleCheckedOnThem = useCallback(() => {
    if (!data?.yourCheckin || !userId) return;

    const next = !data.yourCheckin.checkedOnPartner;
    const previous: HomeSnapshot = data;
    setData({ ...data, yourCheckin: { ...data.yourCheckin, checkedOnPartner: next } });

    void setCheckedOnPartner(userId, next).catch((thrown: unknown) => {
      setData(previous);
      toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t save that.');
    });
  }, [data, userId, setData, toast]);

  const view: HomeView | null = data
    ? {
        // `toSide` only returns null for a null person, and `you` is never null.
        you: toSide(data.you, data.yourCheckin, palette.person.you, tint.rose.bg) as HomeSide,
        partner: toSide(data.partner, data.partnerCheckin, palette.person.partner, tint.iris.bg),
        streak: data.streak,
        level: data.level,
        // The streak trigger moves on the second check-in of the day, so "both
        // in" is exactly the condition that takes the streak out of danger.
        bothCheckedIn: data.yourCheckin !== null && data.partnerCheckin !== null,
        togetherLabel: data.togetherSince ? durationSince(data.togetherSince) : null,
        isPremium: data.isPremium,
        partnerCheckin: data.partnerCheckin,
        partnerAsk: data.partnerCheckin?.need ? NEED_LABELS[data.partnerCheckin.need] : null,
        checkedOnThem: data.yourCheckin?.checkedOnPartner ?? false,
        canLogCheckedOnThem: data.yourCheckin !== null,
      }
    : null;

  return {
    view,
    error: noHub ? 'You’re not paired with anyone yet.' : error,
    loading: loading && !noHub,
    refetch,
    toggleCheckedOnThem,
  };
}
