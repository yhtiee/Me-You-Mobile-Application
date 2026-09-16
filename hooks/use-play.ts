import { useCallback, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/providers/toast-provider';
import type { MovieDecadeFilter } from '@/constants/movies';
import { PLAY_GAMES, gameOfTheDay, type PlayGame } from '@/constants/play';
import type { PlayGameKey } from '@/constants/tokens';
import { useAsyncData } from '@/hooks/use-async-data';
import { useCouplePeople } from '@/hooks/use-couple-people';
import { addCalendarEvent, fetchUpcomingEvents } from '@/lib/calendar';
import {
  addGrowthHabit,
  addTriviaQuestion,
  addWheelOption,
  claimCoinSession,
  clearPickerCache,
  clearPickerCacheForUser,
  completeTriviaRound,
  deleteGrowthHabit,
  deleteTriviaQuestion,
  deleteWheelOption,
  endCoinSession,
  fetchCoinFlips,
  fetchDateIdeas,
  fetchGrowthHabits,
  fetchOwnTriviaQuestions,
  fetchPickerQueue,
  fetchPlayActivity,
  fetchPlayStats,
  fetchTriviaQuestions,
  fetchWheelOptions,
  flipCoinSession,
  logWheelSpin,
  rateGrowthHabit,
  recordSwipe,
  recordTriviaAnswer,
  startTriviaRound,
  type OwnTriviaQuestion,
  type PlayActivity,
} from '@/lib/play';
import type {
  CalendarEvent,
  CoinFlip,
  DateIdea,
  GrowthHabit,
  PickerCard,
  TriviaQuestion,
  WheelOption,
} from '@/types/domain';
import { todayIso } from '@/utils/date';

/**
 * The Play feature's data layer, as the screens see it.
 *
 * One hook per game, because each is a different table with a different write
 * path — the picker is `picker_swipes` plus the `picker_matches()` function,
 * trivia is a round plus its responses, the coin and wheel are append-only
 * `tool_events`. The single `useTools()` this replaced returned four mock
 * arrays and would have had to load all of them for any one screen.
 *
 * Realtime table lists are module constants, not inline arrays: `useAsyncData`
 * takes the reference as a dependency, and a fresh array each render
 * resubscribes the channel on every one.
 */

const STATS_TABLES = ['tool_events', 'picker_swipes', 'trivia_rounds', 'growth_habits'] as const;
const WHEEL_TABLES = ['wheel_options'] as const;
/*
 * No `PICKER_TABLES`. The picker deliberately takes no subscription — a swipe
 * deck has to stay frozen while it is being swiped, and refetching on each
 * `picker_swipes` insert made the deck mutate under the user's thumb. Kept as a
 * note rather than a constant so nobody wires one back in to "fix" the missing
 * live updates; `usePicker` says the same thing at the call site.
 */
const DATE_TABLES = ['date_ideas'] as const;
const GROWTH_TABLES = ['growth_habits'] as const;
const EVENT_TABLES = ['calendar_events'] as const;

const NO_QUESTIONS: TriviaQuestion[] = [];
const NO_OPTIONS: WheelOption[] = [];
const NO_FLIPS: CoinFlip[] = [];

/** The session is shared, so the partner's flip has to reach this device. */
const COIN_TABLES = ['coin_sessions'] as const;

/** Shared: one partner writes the questions the other plays against. */
const TRIVIA_TABLES = ['trivia_questions'] as const;
const NO_IDEAS: DateIdea[] = [];
const NO_HABITS: GrowthHabit[] = [];
const NO_EVENTS: CalendarEvent[] = [];

/** Session ended mid-screen. The one error every hook here can hit. */
function sessionError() {
  return new Error('Your session ended. Log in again to continue.');
}

/**
 * The two names, for any Play screen that has to address someone.
 *
 * An alias now. The implementation moved to `useCouplePeople`, which every
 * screen that names the partner shares — so a rename lands everywhere at once.
 */
export const usePlayPeople = useCouplePeople;

// ---------------------------------------------------------------------------
// Hub
// ---------------------------------------------------------------------------

/** What the hub needs: the day's pick, plus a live line for each tile. */
export function usePlayHub() {
  const { user, coupleId } = useAuth();
  const { partner } = usePlayPeople();

  const today = todayIso();

  const load = useCallback(async () => {
    if (!user) throw sessionError();
    return fetchPlayStats();
  }, [user]);

  const { data, error, loading, refetch } = useAsyncData(
    user && coupleId ? load : null,
    STATS_TABLES
  );

  /*
   * A second, separate query rather than folding a count into `play_stats()`.
   *
   * The hero needs to know whether anything is booked, and the honest place for
   * that is the calendar — putting it in the Play stats function would make a
   * Play RPC the authority on the couple's diary, which is exactly the kind of
   * cross-feature coupling that makes the next change to either one hurt.
   */
  const loadEvents = useCallback(async () => {
    if (!user || !coupleId) throw sessionError();
    return fetchUpcomingEvents(today, 1);
  }, [user, coupleId, today]);

  const { data: events } = useAsyncData(
    user && coupleId ? loadEvents : null,
    EVENT_TABLES
  );

  /**
   * Something is already booked from today onward.
   *
   * Gates the date setter out of the hero: its invitation reads "you haven't
   * planned anything yet", and showing that to a couple with a table booked on
   * Saturday is how a suggestion loses trust on its first impression. It stays
   * in the grid — having plans is not a reason to hide the planner, only a
   * reason not to nag about it.
   */
  const hasUpcomingDate = (events ?? NO_EVENTS).length > 0;

  const pick = useMemo<PlayGame>(() => {
    const eligible = hasUpcomingDate
      ? PLAY_GAMES.filter((game) => game.key !== 'date')
      : PLAY_GAMES;
    return gameOfTheDay(today, eligible);
  }, [today, hasUpcomingDate]);

  const kicker = useMemo(
    () => (pick.pace === 'instant' ? 'Settle it in one tap' : 'Today’s pick'),
    [pick]
  );

  /**
   * Per-tile live lines.
   *
   * `undefined` falls back to the catalogue tagline, and that is the correct
   * empty state rather than a fallback of last resort: a tile reading "0 flips"
   * on a fresh account is worse than one that says what the game is. So every
   * line below is gated on the number being worth saying.
   */
  const stats = useMemo<Record<PlayGameKey, string | undefined>>(() => {
    if (!data) return EMPTY_STATS;
    const partnerName = partner?.name ?? 'them';

    return {
      coin: data.coinFlips > 0 ? plural(data.coinFlips, 'flip') : undefined,
      wheel: data.wheelOptions > 0 ? `${data.wheelOptions} on the wheel` : undefined,
      picker:
        data.pickerMatches > 0
          ? data.pickerMatches === 1
            ? `1 match with ${partnerName}`
            : `${data.pickerMatches} matches waiting`
          : data.pickerRemaining > 0
            ? `${data.pickerRemaining} left to swipe`
            : undefined,
      date: undefined,
      trivia:
        data.triviaBest != null ? `Best so far: ${data.triviaBest}` : undefined,
      growth:
        data.habitsTotal > 0
          ? `${data.habitsRated} of ${data.habitsTotal} rated`
          : undefined,
    };
  }, [data, partner?.name]);

  return {
    pick,
    kicker,
    stats,
    instant: PLAY_GAMES.filter((g) => g.pace === 'instant'),
    session: PLAY_GAMES.filter((g) => g.pace === 'session'),
    loading,
    error,
    refetch,
  };
}

const EMPTY_STATS: Record<PlayGameKey, string | undefined> = {
  coin: undefined,
  wheel: undefined,
  picker: undefined,
  date: undefined,
  trivia: undefined,
  growth: undefined,
};

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// ---------------------------------------------------------------------------
// Coin
// ---------------------------------------------------------------------------

/** Coin flip. The result is decided here so the screen only animates it. */
/**
 * The coin, as a turn-based session shared by both phones.
 *
 * Two fetches rather than one, deliberately. The *session* is live state both
 * devices watch (`coin_sessions`); the *history* is an append-only log only
 * this device's tally reads. Folding them into one query would put the tally
 * behind the realtime subscription and redraw five dots every time the partner
 * opened the screen.
 */
export function useCoinGame() {
  const { user, coupleId } = useAuth();
  const { you, partner } = usePlayPeople();
  const toast = useToast();
  const userId = user?.id ?? null;

  // ---- History: the tally at the bottom. Not live; see above. ----
  const loadHistory = useCallback(async () => {
    if (!userId) throw sessionError();
    return fetchCoinFlips(userId);
  }, [userId]);

  const {
    data: historyData,
    error: historyError,
    loading,
    refetch: refetchHistory,
  } = useAsyncData(userId ? loadHistory : null, undefined);

  // ---- Session: live, shared, and the thing that decides whose turn it is. ----
  const loadSession = useCallback(async () => {
    if (!userId || !coupleId) throw sessionError();
    // Claiming on open rather than on first tap is what makes both partners
    // land on the same session: whoever arrives second joins the row the first
    // one created instead of starting a rival argument.
    return claimCoinSession(null);
  }, [userId, coupleId]);

  const {
    data: session,
    error: sessionErr,
    refetch: refetchSession,
    setData: setSession,
  } = useAsyncData(userId && coupleId ? loadSession : null, COIN_TABLES);

  const history = historyData ?? NO_FLIPS;

  /** Whose turn. Null until the session lands, so the button can stay disabled. */
  const isYourTurn = session ? session.flipperId === userId : null;

  /**
   * What the coin landed on, resolved against the reading user.
   *
   * Derived from the session rather than from local state, so the partner —
   * who never tapped anything — sees the same reveal the flipper does the
   * moment the realtime update arrives.
   */
  const settled: 'you' | 'partner' | null = session?.resultUserId
    ? session.resultUserId === userId
      ? 'you'
      : 'partner'
    : null;

  /**
   * Flip, and wait for the server to say what it landed on.
   *
   * Async now, where the old version returned synchronously from a local
   * `Math.random()`. That change is the point: two phones rolling their own die
   * produced two different answers for one argument. The caller starts an
   * indeterminate spin immediately and lands it when this resolves, so the coin
   * still moves on the same frame as the tap.
   */
  const flip = useCallback(async (): Promise<'you' | 'partner' | null> => {
    if (!session || !userId) return null;

    try {
      const next = await flipCoinSession(session.id);
      setSession(next);
      // The flip wrote a `tool_events` row; the tally has to see it.
      refetchHistory();
      return next.resultUserId === userId ? 'you' : 'partner';
    } catch (thrown) {
      toast.error(thrown instanceof Error ? thrown.message : 'That flip didn’t land.');
      // Re-read: "it is not your turn" means this device's copy is stale.
      refetchSession();
      return null;
    }
  }, [session, userId, setSession, refetchHistory, refetchSession, toast]);

  /** Close it and open the next one, so a new argument starts clean. */
  const endSession = useCallback(
    async (nextStake: string | null) => {
      if (!session) return;

      try {
        await endCoinSession(session.id);
        // Claim straight away rather than leaving the screen sessionless: the
        // turn alternates on the way through, so the next flip is already
        // assigned to the other person by the time anyone looks.
        const next = await claimCoinSession(nextStake);
        setSession(next);
      } catch (thrown) {
        toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t close that.');
        refetchSession();
      }
    },
    [session, setSession, refetchSession, toast]
  );

  const tally = useMemo(() => {
    const recent = history.slice(0, 5);
    return {
      you: recent.filter((w) => w.winner === 'you').length,
      partner: recent.filter((w) => w.winner === 'partner').length,
      total: recent.length,
    };
  }, [history]);

  return {
    you,
    partner,
    session,
    isYourTurn,
    settled,
    flip,
    endSession,
    history,
    tally,
    loading,
    // The session error is the blocking one — without a session there is no
    // game. A failed history read only costs the tally.
    error: sessionErr ?? historyError,
    refetch: () => {
      refetchSession();
      refetchHistory();
    },
  };
}

// ---------------------------------------------------------------------------
// Wheel
// ---------------------------------------------------------------------------

/** Whose-turn wheel. Options are shared with the partner and live. */
export function useWheelGame() {
  const { user, coupleId } = useAuth();
  const toast = useToast();
  const userId = user?.id ?? null;

  const load = useCallback(async () => {
    if (!userId || !coupleId) throw sessionError();
    return fetchWheelOptions();
  }, [userId, coupleId]);

  const { data, error, loading, refetch } = useAsyncData(
    userId && coupleId ? load : null,
    WHEEL_TABLES
  );

  const options = data ?? NO_OPTIONS;

  /**
   * Not optimistic, unlike the removals below: the row's id comes from the
   * database and an optimistic insert would need a fake one plus a
   * reconciliation step. The write is one round trip and the field clears
   * immediately, which is the part that has to feel instant.
   */
  const add = useCallback(
    async (label: string) => {
      const trimmed = label.trim();
      if (!trimmed || !userId || !coupleId) return false;

      try {
        await addWheelOption({
          userId,
          coupleId,
          label: trimmed,
          // Append. Positions are only ever compared, never packed, so a gap
          // left by a removal is harmless.
          position: options.length,
        });
        refetch();
        return true;
      } catch (thrown) {
        toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t add that.');
        return false;
      }
    },
    [userId, coupleId, options.length, refetch, toast]
  );

  const remove = useCallback(
    (option: WheelOption) => {
      void deleteWheelOption(option.id)
        .then(() => refetch())
        .catch((thrown: unknown) => {
          toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t remove that.');
          refetch();
        });
    },
    [refetch, toast]
  );

  /** Logged so the hub can say how much the wheel has been leaned on. */
  const recordSpin = useCallback(
    (landedOn: string) => {
      if (!userId || !coupleId) return;
      // Silent on failure. A spin that does not reach the log still happened on
      // both screens, and a toast about it would interrupt the result.
      void logWheelSpin({
        userId,
        coupleId,
        options: options.map((o) => o.label),
        landedOn,
      }).catch(() => {});
    },
    [userId, coupleId, options]
  );

  return { options, add, remove, recordSpin, loading, error, refetch };
}

// ---------------------------------------------------------------------------
// Picker
// ---------------------------------------------------------------------------

/** Movie & meal picker. */
export function usePicker() {
  const { user, coupleId } = useAuth();
  const { partner } = usePlayPeople();
  const toast = useToast();
  const userId = user?.id ?? null;

  const [index, setIndex] = useState(0);
  const [kind, setKind] = useState<PickerCard['kind']>('movie');
  const [genre, setGenre] = useState<string | number>('trending');
  const [decade, setDecade] = useState<MovieDecadeFilter>('all');

  const load = useCallback(async () => {
    if (!userId || !coupleId) throw sessionError();
    // `userId` scopes the deck cache. Without it the module-scope map
    // outlives a sign-out and hands the next account this one's deck.
    return fetchPickerQueue({ kind, genre, decade }, { userId });
  }, [userId, coupleId, kind, genre, decade]);

  // Deliberately no table subscriptions here:
  // A swipe deck must stay frozen in place while the user swipes through it.
  // Re-fetching from realtime on each swipe caused the deck to mutate and jump.
  const { data, error, loading, refetch } = useAsyncData(
    userId && coupleId ? load : null
  );

  const cards = useMemo(() => data ?? [], [data]);
  const card: PickerCard | null = cards[index] ?? null;

  const canRewind = index > 0;
  const rewind = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const changeKind = useCallback((newKind: PickerCard['kind']) => {
    setKind(newKind);
    setIndex(0);
  }, []);

  const changeGenre = useCallback((newGenre: string | number) => {
    setGenre(newGenre);
    setIndex(0);
  }, []);

  const changeDecade = useCallback((newDecade: MovieDecadeFilter) => {
    setDecade(newDecade);
    setIndex(0);
  }, []);

  /**
   * Records the swipe and reports whether it completed a match.
   *
   * The index advances before the round trip resolves — the card is already
   * flying off screen, and making the next one wait on the network would put a
   * stall in the middle of the one interaction that has to stay fluid.
   */
  const swipe = useCallback(
    async (liked: boolean): Promise<boolean> => {
      const current = cards[index];
      setIndex((i) => i + 1);

      if (!current || !userId || !coupleId) return false;

      /*
       * The cached deck is now wrong.
       *
       * It is a snapshot of what had not been swiped when it was fetched, and
       * `useAsyncData` refetches on focus — so without this, leaving the screen
       * and coming back re-served the same array with this card still in it,
       * from index 0. Dropping the cache costs one fetch on the way back in and
       * is the difference between a deck that remembers and one that does not.
       */
      clearPickerCacheForUser(userId);

      try {
        return await recordSwipe({
          itemId: current.id,
          userId,
          coupleId,
          liked,
        });
      } catch (thrown) {
        toast.error(thrown instanceof Error ? thrown.message : 'That swipe didn’t save.');
        return false;
      }
    },
    [cards, index, userId, coupleId, toast]
  );

  /**
   * Back to the top of what is left.
   *
   * Not a re-swipe of everything: the queue is "items you have not swiped", so
   * once the deck is done the honest restart is to re-read it and find out
   * whether the partner or the stock list has added anything. On an unchanged
   * deck this correctly shows the empty state again.
   */
  const restart = useCallback(() => {
    clearPickerCache();
    setIndex(0);
    refetch();
  }, [refetch]);

  return {
    partner,
    card,
    index,
    total: cards.length,
    remaining: Math.max(0, cards.length - index),
    kind,
    genre,
    decade,
    changeKind,
    changeGenre,
    changeDecade,
    canRewind,
    rewind,
    swipe,
    restart,
    loading,
    error,
  };
}

// ---------------------------------------------------------------------------
// Date setter
// ---------------------------------------------------------------------------

/** Date setter, including the indecision resolver and the raincheck. */
export function useDatePlanner() {
  const { user, coupleId } = useAuth();
  const toast = useToast();
  const userId = user?.id ?? null;

  const load = useCallback(async () => {
    if (!user) throw sessionError();
    return fetchDateIdeas();
  }, [user]);

  const { data, error, loading, refetch } = useAsyncData(
    user && coupleId ? load : null,
    DATE_TABLES
  );

  /**
   * Reports success so the screen can decide what to say.
   *
   * The old flow set a "saved" flag the moment the button was pressed and never
   * looked back, so a failed insert still read "Added to your calendar" — the
   * one outcome a user would act on and be wrong about.
   */
  const addEvent = useCallback(
    async (event: Omit<CalendarEvent, 'id'>): Promise<boolean> => {
      if (!userId || !coupleId) return false;
      try {
        await addCalendarEvent({
          userId,
          coupleId,
          title: event.title,
          date: event.date,
          kind: event.kind,
        });
        return true;
      } catch (thrown) {
        toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t save that.');
        return false;
      }
    },
    [userId, coupleId, toast]
  );

  return { ideas: data ?? NO_IDEAS, addEvent, loading, error, refetch };
}

// ---------------------------------------------------------------------------
// Trivia
// ---------------------------------------------------------------------------

/**
 * One trivia round. Scoring lives here so the screen stays a view.
 *
 * A round row is created lazily, on the first answer rather than on mount —
 * otherwise every glance at the screen leaves an abandoned empty round behind,
 * and `trivia_best` starts counting sittings nobody played.
 */
export function useTrivia() {
  const { user, coupleId } = useAuth();
  const { partner } = usePlayPeople();
  const toast = useToast();
  const userId = user?.id ?? null;

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [nonce, setNonce] = useState(0);

  /**
   * Held in a ref, not state: the round id is needed by the *next* answer's
   * write, and a state update would not have landed by the time two answers are
   * given in quick succession.
   */
  const roundId = useRef<string | null>(null);
  const roundPending = useRef<Promise<string> | null>(null);

  const load = useCallback(async () => {
    if (!userId || !coupleId) throw sessionError();
    // `nonce` is the dependency that makes "Play again" fetch a fresh, freshly
    // shuffled set rather than replaying the three questions just answered.
    void nonce;
    // About the partner, never about the reader — see `fetchTriviaQuestions`.
    return fetchTriviaQuestions(partner?.id ?? null);
  }, [userId, coupleId, partner?.id, nonce]);

  // Live: a question the partner writes should be answerable here without a
  // reload, the same way wheel options are.
  const { data, error, loading } = useAsyncData(
    userId && coupleId ? load : null,
    TRIVIA_TABLES
  );

  const questions = data ?? NO_QUESTIONS;

  /** Starts the round if it has not started, and never starts it twice. */
  const ensureRound = useCallback(async (): Promise<string | null> => {
    if (!userId || !coupleId) return null;
    if (roundId.current) return roundId.current;
    if (roundPending.current) return roundPending.current;

    roundPending.current = startTriviaRound({
      userId,
      coupleId,
      subjectId: partner?.id ?? null,
      total: questions.length,
    });

    try {
      const id = await roundPending.current;
      roundId.current = id;
      return id;
    } catch {
      // A round that will not start must not stop the game. The answers stay
      // local and the score simply is not recorded.
      return null;
    } finally {
      roundPending.current = null;
    }
  }, [userId, coupleId, partner?.id, questions.length]);

  const answer = useCallback(
    (questionId: string, choice: number) => {
      setAnswers((a) => (questionId in a ? a : { ...a, [questionId]: choice }));

      void (async () => {
        const id = await ensureRound();
        if (!id || !userId || !coupleId) return;
        try {
          await recordTriviaAnswer({
            roundId: id,
            questionId,
            userId,
            coupleId,
            chosenIndex: choice,
          });
        } catch {
          // Silent: the answer is already revealed on screen and re-showing the
          // question would be worse than an unrecorded response.
        }
      })();
    },
    [ensureRound, userId, coupleId]
  );

  const answered = Object.keys(answers).length;
  const correct = questions.filter((q) => answers[q.id] === q.answer).length;
  const complete = questions.length > 0 && answered === questions.length;

  /** Writes the final score once, when the last answer lands. */
  const finish = useCallback(async () => {
    const id = roundId.current;
    if (!id) return;
    roundId.current = null;
    try {
      await completeTriviaRound(id, correct);
    } catch (thrown) {
      toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t save your score.');
    }
  }, [correct, toast]);

  const restart = useCallback(() => {
    setAnswers({});
    roundId.current = null;
    setNonce((n) => n + 1);
  }, []);

  return {
    partner,
    questions,
    answers,
    answer,
    finish,
    restart,
    answered,
    correct,
    complete,
    loading,
    error,
  };
}

// ---------------------------------------------------------------------------
// Growth
// ---------------------------------------------------------------------------

/** Weekly self-rating. Private to the rater — never shown to the partner. */
export function useGrowth() {
  const { user, coupleId } = useAuth();
  const toast = useToast();
  const userId = user?.id ?? null;

  const load = useCallback(async () => {
    if (!userId) throw sessionError();
    return fetchGrowthHabits();
  }, [userId]);

  const { data, error, loading, refetch, setData } = useAsyncData(
    userId ? load : null,
    GROWTH_TABLES
  );

  const habits = data ?? NO_HABITS;

  /** Optimistic with a rollback — the same contract as the other write paths. */
  const rate = useCallback(
    (habitId: string, rating: number) => {
      if (!data) return;
      const previous = data;
      setData(data.map((h) => (h.id === habitId ? { ...h, rating } : h)));

      void rateGrowthHabit(habitId, rating).catch((thrown: unknown) => {
        setData(previous);
        toast.error(thrown instanceof Error ? thrown.message : 'That didn’t save.');
      });
    },
    [data, setData, toast]
  );

  /**
   * Not optimistic — the id comes from the database, same as the wheel.
   *
   * `couple_id` is passed even though the policy is `user_id = auth.uid()`: the
   * column exists so a habit survives an unpair (`on delete set null`), and a
   * row that never carried one cannot be attributed afterwards. Same reasoning
   * as `lib/todos.ts`.
   */
  const add = useCallback(
    async (label: string) => {
      const trimmed = label.trim();
      if (!trimmed || !userId) return false;

      try {
        await addGrowthHabit({ userId, coupleId, label: trimmed });
        refetch();
        return true;
      } catch (thrown) {
        toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t add that.');
        return false;
      }
    },
    [userId, coupleId, refetch, toast]
  );

  const remove = useCallback(
    (habitId: string) => {
      if (!data) return;
      const previous = data;
      setData(data.filter((h) => h.id !== habitId));

      void deleteGrowthHabit(habitId).catch((thrown: unknown) => {
        setData(previous);
        toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t remove that.');
      });
    },
    [data, setData, toast]
  );

  return { habits, rate, add, remove, loading, error, refetch };
}

// ---------------------------------------------------------------------------
// Activity feed
// ---------------------------------------------------------------------------

/**
 * Every table a game writes to. `tool_events` and `coin_sessions` joined the
 * publication in 0018; without them the feed only moved when the screen was
 * re-focused, which for a *shared* feed is the wrong half of the time.
 */
const ACTIVITY_TABLES = [
  'tool_events',
  'coin_sessions',
  'trivia_rounds',
  'picker_swipes',
] as const;

const NO_ACTIVITY: PlayActivity[] = [];

/** Recent play across every game, for the summary on the Play hub. */
export function usePlayActivity(limit = 12) {
  const { user, coupleId } = useAuth();
  const userId = user?.id ?? null;

  const load = useCallback(async () => {
    if (!coupleId) throw sessionError();
    return fetchPlayActivity(limit);
  }, [coupleId, limit]);

  const { data, loading, error, refetch } = useAsyncData(
    coupleId ? load : null,
    ACTIVITY_TABLES
  );

  return {
    items: data ?? NO_ACTIVITY,
    /**
     * Resolves an id to a name the reader understands. Lives here rather than
     * in the component so "You" is decided in one place — the server cannot do
     * it, because only this device knows who is holding it.
     */
    userId,
    loading,
    error,
    refetch,
  };
}

/**
 * The questions you have set about yourself.
 *
 * Separate from `useTrivia`, which plays a round against your *partner's*
 * questions. The two never overlap by design — you cannot be quizzed on
 * yourself — so sharing a hook would mean one fetch filtered two opposite ways
 * depending on which screen was mounted.
 */
export function useOwnTriviaQuestions() {
  const { user, coupleId } = useAuth();
  const toast = useToast();
  const userId = user?.id ?? null;

  const load = useCallback(async () => {
    if (!userId) throw sessionError();
    return fetchOwnTriviaQuestions(userId);
  }, [userId]);

  const { data, loading, error, refetch } = useAsyncData(
    userId ? load : null,
    TRIVIA_TABLES
  );

  const add = useCallback(
    async (question: string, options: string[], correctIndex: number) => {
      if (!userId || !coupleId) {
        toast.error('Your session ended. Log in again to continue.');
        return false;
      }

      try {
        await addTriviaQuestion({ coupleId, userId, question, options, correctIndex });
        refetch();
        return true;
      } catch (thrown) {
        toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t save that.');
        return false;
      }
    },
    [userId, coupleId, refetch, toast]
  );

  const remove = useCallback(
    async (questionId: string) => {
      try {
        await deleteTriviaQuestion(questionId);
        refetch();
      } catch (thrown) {
        toast.error(thrown instanceof Error ? thrown.message : 'Couldn’t delete that.');
      }
    },
    [refetch, toast]
  );

  const questions: OwnTriviaQuestion[] = data ?? NO_OWN_QUESTIONS;

  return { questions, add, remove, loading, error, refetch };
}

const NO_OWN_QUESTIONS: OwnTriviaQuestion[] = [];
