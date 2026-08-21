import { useCallback, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/providers/toast-provider';
import { useAsyncData } from '@/hooks/use-async-data';
import { PLAY_GAMES, gameOfTheDay, type PlayGame } from '@/constants/play';
import type { PlayGameKey } from '@/constants/tokens';
import { todayIso } from '@/utils/date';
import { addCalendarEvent, fetchUpcomingEvents } from '@/lib/calendar';
import {
  addGrowthHabit,
  addWheelOption,
  completeTriviaRound,
  deleteGrowthHabit,
  deleteWheelOption,
  fetchCoinFlips,
  fetchDateIdeas,
  fetchGrowthHabits,
  fetchPickerQueue,
  fetchPlayPeople,
  fetchPlayStats,
  fetchTriviaQuestions,
  fetchWheelOptions,
  logCoinFlip,
  logWheelSpin,
  rateGrowthHabit,
  recordSwipe,
  recordTriviaAnswer,
  startTriviaRound,
  type PlayPeople,
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
const PICKER_TABLES = ['picker_swipes'] as const;
const DATE_TABLES = ['date_ideas'] as const;
const GROWTH_TABLES = ['growth_habits'] as const;
const EVENT_TABLES = ['calendar_events'] as const;
const PEOPLE_TABLES = ['couple_members', 'profiles'] as const;

const NO_QUESTIONS: TriviaQuestion[] = [];
const NO_OPTIONS: WheelOption[] = [];
const NO_FLIPS: CoinFlip[] = [];
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
 * Every game screen needs this and none of them need anything else about the
 * couple, which is why it is here rather than reached for through `useHome`.
 * Both partners' names change rarely, so the realtime subscription is really
 * only earning its keep for the moment a partner first joins.
 */
export function usePlayPeople() {
  const { user, coupleId } = useAuth();
  const userId = user?.id ?? null;

  const load = useCallback(async () => {
    if (!userId || !coupleId) throw sessionError();
    return fetchPlayPeople(coupleId, userId);
  }, [userId, coupleId]);

  const { data, error, loading } = useAsyncData(
    userId && coupleId ? load : null,
    PEOPLE_TABLES
  );

  /*
   * Falls back to a usable pair rather than null. Every caller renders a name
   * into a sentence, and threading "the names have not loaded yet" through six
   * screens buys nothing over one frame of "Your partner".
   */
  const people: PlayPeople = data ?? {
    you: { id: userId ?? 'you', name: 'You' },
    partner: null,
  };

  return { ...people, loading, error };
}

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
export function useCoinGame() {
  const { user, coupleId } = useAuth();
  const { you, partner } = usePlayPeople();
  const toast = useToast();
  const userId = user?.id ?? null;

  const load = useCallback(async () => {
    if (!userId) throw sessionError();
    return fetchCoinFlips(userId);
  }, [userId]);

  const { data, error, loading, refetch, setData } = useAsyncData(
    userId ? load : null,
    // Deliberately not subscribed to `tool_events`: this is an append-only log
    // the user writes themselves, and the flip is already on screen before the
    // insert returns. A realtime round trip would only redraw what is there.
    undefined
  );

  const history = data ?? NO_FLIPS;

  /**
   * Decide, then record.
   *
   * Returns synchronously so the animation can start on the same frame — the
   * write is fire-and-forget behind it. A flip that fails to log is a lost row
   * in a tally, not a lost outcome, so it must never block the coin.
   */
  const flip = useCallback(
    (stake: string | null): 'you' | 'partner' => {
      const winner: 'you' | 'partner' = Math.random() < 0.5 ? 'you' : 'partner';

      if (userId && coupleId) {
        const winnerUserId = winner === 'you' ? userId : (partner?.id ?? userId);

        // Optimistic, with the id the row will not have — this entry is
        // replaced wholesale by the next fetch and nothing keys off it.
        setData([
          { id: `pending-${Date.now()}`, winner, createdAt: new Date().toISOString() },
          ...history,
        ]);

        void logCoinFlip({ userId, coupleId, winnerUserId, stake })
          .then(() => refetch())
          .catch((thrown: unknown) => {
            setData(history);
            toast.error(thrown instanceof Error ? thrown.message : 'That flip didn’t save.');
          });
      }

      return winner;
    },
    [userId, coupleId, partner?.id, history, setData, refetch, toast]
  );

  const tally = useMemo(() => {
    const recent = history.slice(0, 5);
    return {
      you: recent.filter((w) => w.winner === 'you').length,
      partner: recent.filter((w) => w.winner === 'partner').length,
      total: recent.length,
    };
  }, [history]);

  return { you, partner, flip, history, tally, loading, error, refetch };
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

  const load = useCallback(async () => {
    if (!userId || !coupleId) throw sessionError();
    return fetchPickerQueue();
  }, [userId, coupleId]);

  const { data, error, loading, refetch } = useAsyncData(
    userId && coupleId ? load : null,
    PICKER_TABLES
  );

  const cards = useMemo(() => data ?? [], [data]);
  const card: PickerCard | null = cards[index] ?? null;

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
    setIndex(0);
    refetch();
  }, [refetch]);

  return {
    partner,
    card,
    index,
    total: cards.length,
    remaining: Math.max(0, cards.length - index),
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
    return fetchTriviaQuestions();
  }, [userId, coupleId, nonce]);

  const { data, error, loading } = useAsyncData(userId && coupleId ? load : null);

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
