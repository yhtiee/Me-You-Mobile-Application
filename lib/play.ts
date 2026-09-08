import { supabase } from '@/lib/supabase';
import type {
    CoinFlip,
    CoinSession,
    DateIdea,
    GrowthHabit,
    PickerCard,
    PickerMatch,
    PlayStats,
    TriviaQuestion,
    WheelOption,
} from '@/types/domain';

/**
 * Play & Settle — the data layer (PRD Module 2).
 *
 * Split by game rather than by table, because that is how the hooks consume it.
 * The one rule that cuts across all of them: **the partner's individual picker
 * swipes never cross this boundary.** Nothing here selects another person's row
 * from `picker_swipes`; matches come back through `picker_matches()`, which is
 * the only thing with the rights to see both sides. Adding a convenience query
 * that joins the partner's swipes would defeat the feature's whole promise, and
 * RLS would refuse it anyway.
 */

function toMessage(error: { message: string }, what: string): Error {
  if (/network|fetch|timeout/i.test(error.message)) {
    return new Error('You’re offline. Check your connection and try again.');
  }
  return new Error(`Couldn’t ${what}. ${error.message}`);
}

// ---------------------------------------------------------------------------
// Who's playing
// ---------------------------------------------------------------------------

/** Just the two names and ids. Deliberately not the home snapshot. */
export type PlayPeople = {
  you: { id: string; name: string };
  /** Null while unpaired, or after the other half leaves. */
  partner: { id: string; name: string } | null;
};

/**
 * The two people, for screens that only need to say a name.
 *
 * `fetchHomeSnapshot` already returns this and more, and reusing it was the
 * obvious move — but it also fires three queries including today's check-ins,
 * and the coin screen has no business loading a mood to print "Sarah goes
 * first". One query, two columns.
 */
export async function fetchPlayPeople(coupleId: string, userId: string): Promise<PlayPeople> {
  const { data, error } = await supabase
    .from('couple_members')
    .select('user_id, profiles(display_name)')
    .eq('couple_id', coupleId)
    .is('left_at', null);

  if (error) throw toMessage(error, 'load your hub');

  const rows = (data ?? []) as {
    user_id: string;
    // PostgREST types an embedded to-one relation as an array in some versions;
    // `lib/home.ts` normalises the same way for the same reason.
    profiles: { display_name: string | null } | { display_name: string | null }[] | null;
  }[];

  const nameOf = (row: (typeof rows)[number] | undefined, fallback: string) => {
    if (!row) return fallback;
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return profile?.display_name?.trim() || fallback;
  };

  const mine = rows.find((row) => row.user_id === userId);
  const theirs = rows.find((row) => row.user_id !== userId);

  // The fallbacks differ on purpose. Your own missing name reads fine as "You" —
  // it is what the copy would have said anyway. Theirs cannot be "They", which
  // would put "They goes first" on the coin, so it falls back to "Your partner".
  return {
    you: { id: userId, name: nameOf(mine, 'You') },
    partner: theirs ? { id: theirs.user_id, name: nameOf(theirs, 'Your partner') } : null,
  };
}

// ---------------------------------------------------------------------------
// Hub
// ---------------------------------------------------------------------------

export async function fetchPlayStats(): Promise<PlayStats> {
  const { data, error } = await supabase.rpc('play_stats');
  if (error) throw toMessage(error, 'load your games');

  // The function returns a one-row set, which PostgREST hands back as an array.
  const row = (Array.isArray(data) ? data[0] : data) ?? {};

  return {
    coinFlips: Number(row.coin_flips ?? 0),
    wheelSpins: Number(row.wheel_spins ?? 0),
    // `_count` on the wire, not in the domain type — the suffixes exist to keep
    // three SQL identifiers off the names of real tables. See `play_stats()`.
    wheelOptions: Number(row.wheel_option_count ?? 0),
    pickerMatches: Number(row.picker_match_count ?? 0),
    pickerRemaining: Number(row.picker_remaining ?? 0),
    triviaBest: row.trivia_best == null ? null : Number(row.trivia_best),
    triviaRounds: Number(row.trivia_round_count ?? 0),
    habitsRated: Number(row.habits_rated ?? 0),
    habitsTotal: Number(row.habits_total ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Coin
// ---------------------------------------------------------------------------

/**
 * Recent flips, newest first.
 *
 * `winner` is stored in the payload as a user id and resolved to you/partner
 * here, so the screen never has to know whose id it is holding. Capped at 20 —
 * the tally only ever shows five, and this is a log that grows for ever.
 */
export async function fetchCoinFlips(userId: string): Promise<CoinFlip[]> {
  const { data, error } = await supabase
    .from('tool_events')
    .select('id, payload, created_at')
    .eq('kind', 'coin')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw toMessage(error, 'load your flips');

  return (data ?? []).map((row) => ({
    id: row.id as string,
    winner: (row.payload as { winner?: string } | null)?.winner === userId ? 'you' : 'partner',
    createdAt: row.created_at as string,
  }));
}

export async function logCoinFlip(input: {
  userId: string;
  coupleId: string;
  winnerUserId: string;
  stake: string | null;
}): Promise<void> {
  const { error } = await supabase.from('tool_events').insert({
    user_id: input.userId,
    couple_id: input.coupleId,
    kind: 'coin',
    payload: { winner: input.winnerUserId, stake: input.stake },
  });

  if (error) throw toMessage(error, 'save that flip');
}

/**
 * Row shape of `public.coin_sessions`, as PostgREST returns it.
 *
 * Only the columns the client reads. `couple_id` and `ended_at` are on the
 * table but never needed here: the RPC only ever hands back the couple's own
 * open session, so both are constants from this side.
 */
type CoinSessionRow = {
  id: string;
  flipper_id: string;
  stake: string | null;
  result_user_id: string | null;
  flipped_at: string | null;
};

function toSession(row: CoinSessionRow): CoinSession {
  return {
    id: row.id,
    flipperId: row.flipper_id,
    stake: row.stake,
    resultUserId: row.result_user_id,
    flippedAt: row.flipped_at,
  };
}

/**
 * The couple's open session, created on first call.
 *
 * Idempotent — see `claim_coin_session` in 0018. Both partners call this when
 * the screen opens and both end up on the same row, including when they open it
 * in the same second.
 */
export async function claimCoinSession(stake: string | null): Promise<CoinSession> {
  const { data, error } = await supabase.rpc('claim_coin_session', { p_stake: stake });

  if (error) throw toMessage(error, 'open a coin session');
  if (!data) throw new Error('We couldn’t open a coin session.');

  return toSession(data as CoinSessionRow);
}

/**
 * Flip it. The outcome is chosen server-side so both phones read one answer —
 * the old client-side `Math.random()` gave two devices two different results
 * with nothing to reconcile them.
 */
export async function flipCoinSession(sessionId: string): Promise<CoinSession> {
  const { data, error } = await supabase.rpc('flip_coin_session', { p_session_id: sessionId });

  if (error) throw toMessage(error, 'flip the coin');
  if (!data) throw new Error('We couldn’t flip the coin.');

  return toSession(data as CoinSessionRow);
}

/** Close the session so the next argument gets its own. Either partner may. */
export async function endCoinSession(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc('end_coin_session', { p_session_id: sessionId });

  if (error) throw toMessage(error, 'close that session');
}

// ---------------------------------------------------------------------------
// Wheel
// ---------------------------------------------------------------------------

export async function fetchWheelOptions(): Promise<WheelOption[]> {
  const { data, error } = await supabase
    .from('wheel_options')
    .select('id, label')
    // Explicit position, then id as the tie-break — two options added in the
    // same second must not swap places between reads, or the wedge colours
    // shuffle under the user.
    .order('position', { ascending: true })
    .order('id', { ascending: true });

  if (error) throw toMessage(error, 'load the wheel');
  return (data ?? []) as WheelOption[];
}

export async function addWheelOption(input: {
  userId: string;
  coupleId: string;
  label: string;
  position: number;
}): Promise<void> {
  const { error } = await supabase.from('wheel_options').insert({
    couple_id: input.coupleId,
    created_by: input.userId,
    label: input.label,
    position: input.position,
  });

  if (error) {
    // 23505 is the case-insensitive unique index. Worth its own sentence:
    // "duplicate key value violates unique constraint" is not something to show
    // someone who just typed "dishes" twice.
    if (error.code === '23505') throw new Error('That’s already on the wheel.');
    throw toMessage(error, 'add that');
  }
}

export async function deleteWheelOption(optionId: string): Promise<void> {
  const { error } = await supabase.from('wheel_options').delete().eq('id', optionId);
  if (error) throw toMessage(error, 'remove that');
}

export async function logWheelSpin(input: {
  userId: string;
  coupleId: string;
  options: string[];
  landedOn: string;
}): Promise<void> {
  const { error } = await supabase.from('tool_events').insert({
    user_id: input.userId,
    couple_id: input.coupleId,
    kind: 'wheel',
    payload: { options: input.options, landed_on: input.landedOn },
  });

  if (error) throw toMessage(error, 'save that spin');
}

// ---------------------------------------------------------------------------
// Picker
// ---------------------------------------------------------------------------

/**
 * Everything this person has not swiped on yet.
 *
 * Two queries rather than a `not.in` filter on one: the id list can outgrow
 * what fits in a URL, and PostgREST puts filters in the query string. Reading
 * your own swipe ids first is cheap and bounded by how much you have played.
 */
/**
 * Decks already fetched, per user and filter combination.
 *
 * `page` rides along with the cards because the TMDB pool is paginated and the
 * next fetch for this filter has to resume where the last one stopped rather
 * than re-requesting a page whose cards have all been swiped.
 */
type CachedDeck = { cards: PickerCard[]; page: number };

const deckCache = new Map<string, CachedDeck>();

/**
 * How far to page forward looking for unswiped cards before giving up.
 *
 * The Edge Function filters out what you have already swiped, so a page you
 * have worked through comes back empty rather than short. Five pages is ~100
 * titles past wherever you are, which is more than anyone swipes in a sitting;
 * beyond that the honest answer is the empty state.
 */
const MAX_PAGE_PROBES = 5;

/** Decade id to inclusive year range, matching the Edge Function's own bounds. */
const DECADE_RANGES: Record<string, [number, number] | undefined> = {
  all: undefined,
  '2020s': [2020, 2029],
  '2010s': [2010, 2019],
  '2000s': [2000, 2009],
  '90s': [1990, 1999],
};

/**
 * TMDB genre id to the label the Edge Function writes into `picker_items.genre`.
 *
 * Duplicated from `supabase/functions/movies/index.ts` rather than shared,
 * because a Deno function and the app bundle have no module in common. Keep the
 * two in step: drift here shows up only as a fallback deck that quietly ignores
 * one genre.
 */
const MOVIE_GENRE_LABELS: Record<string, string> = {
  '28': 'Action',
  '12': 'Adventure',
  '16': 'Animation',
  '35': 'Comedy',
  '80': 'Crime',
  '99': 'Documentary',
  '18': 'Drama',
  '10751': 'Family',
  '14': 'Fantasy',
  '36': 'History',
  '27': 'Horror',
  '10402': 'Music',
  '9648': 'Mystery',
  '10749': 'Romance',
  '878': 'Sci-Fi',
  '10770': 'TV Movie',
  '53': 'Thriller',
  '10752': 'War',
  '37': 'Western',
};

function deckKey(
  userId: string | null,
  filters?: { genre?: string | number | null; decade?: string | null; kind?: PickerCard['kind'] }
): string {
  // Keyed by user. Without it this module-scope map survives a sign-out and
  // hands the next account the previous one's deck, including cards it has
  // already swiped and rows its own RLS would never have returned.
  return [
    userId ?? 'anon',
    filters?.kind ?? 'movie',
    filters?.genre ?? 'trending',
    filters?.decade ?? 'all',
  ].join('_');
}

export function clearPickerCache(cacheKey?: string) {
  if (cacheKey) {
    deckCache.delete(cacheKey);
  } else {
    deckCache.clear();
  }
}

/**
 * Drop every cached deck belonging to one person.
 *
 * Called after a swipe. A cached deck is a snapshot of "what you had not swiped
 * *at the time it was fetched*", so it goes stale the moment you swipe - and
 * `useAsyncData` refetches on focus, which was quietly re-serving that stale
 * snapshot. Leaving the screen and coming back therefore replayed cards that had
 * already been decided on.
 */
export function clearPickerCacheForUser(userId: string | null) {
  const prefix = (userId ?? 'anon') + '_';
  for (const key of [...deckCache.keys()]) {
    if (key.startsWith(prefix)) deckCache.delete(key);
  }
}

export async function fetchPickerQueue(
  filters?: {
    genre?: string | number | null;
    decade?: string | null;
    kind?: PickerCard['kind'];
  },
  options?: { bypassCache?: boolean; userId?: string | null }
): Promise<PickerCard[]> {
  const userId = options?.userId ?? null;
  const cacheKey = deckKey(userId, filters);
  const cached = deckCache.get(cacheKey);

  if (!options?.bypassCache && cached && cached.cards.length > 0) {
    return cached.cards;
  }

  const isMovies = !filters?.kind || filters.kind === 'movie';

  if (isMovies) {
    /*
     * Page forward until something comes back, and treat "empty" and "failed"
     * as the different things they are.
     *
     * The old code sent no page at all, so every filter combination was
     * permanently TMDB page 1 - about twenty titles. Worse, it tested
     * `data.cards.length > 0` and fell through to the database on a *successful
     * but empty* response, which is exactly what happens once you have swiped
     * that page. So the deck silently changed source mid-session: twenty
     * curated Horror titles, then an unfiltered grab-bag of every movie any user
     * had ever pulled in. That is the inconsistency.
     *
     * Now an empty page means "you have seen these, show me the next one", and
     * only a genuine error drops through to the local fallback.
     */
    let failed = false;

    for (let probe = 0; probe < MAX_PAGE_PROBES; probe++) {
      const page = (cached?.page ?? 1) + probe;

      try {
        const { data, error } = await supabase.functions.invoke<{ cards: PickerCard[] }>('movies', {
          body: {
            genre: filters?.genre ?? 'trending',
            decade: filters?.decade && filters.decade !== 'all' ? filters.decade : null,
            page,
          },
        });

        if (error) {
          failed = true;
          break;
        }

        const cards = data?.cards ?? [];
        if (cards.length > 0) {
          deckCache.set(cacheKey, { cards, page });
          return cards;
        }
        // Empty page: keep probing forward.
      } catch (err) {
        console.warn('Movies function call failed, falling back to database query:', err);
        failed = true;
        break;
      }
    }

    // Ran out of pages rather than hitting an error: there genuinely is nothing
    // left under this filter. Returning the local grab-bag here would be the old
    // bug wearing a different hat.
    if (!failed) {
      deckCache.set(cacheKey, { cards: [], page: cached?.page ?? 1 });
      return [];
    }
  }

  const { data: swiped, error: swipeError } = await supabase
    .from('picker_swipes')
    .select('item_id');

  if (swipeError) throw toMessage(swipeError, 'load your picks');

  const seen = new Set((swiped ?? []).map((row) => row.item_id as string));

  let query = supabase
    .from('picker_items')
    .select('id, kind, title, meta, image_url, rating, year, genre, overview')
    .order('created_at', { ascending: false });

  if (filters?.kind) {
    query = query.eq('kind', filters.kind);
  }

  /*
   * The fallback has to honour the same filters the chips claim to apply.
   *
   * It only ever filtered on `kind`, so the moment it took over, the Horror /
   * 90s selection the user had made stopped meaning anything while the chips
   * stayed lit. A filter that silently stops filtering is worse than one that
   * returns nothing.
   */
  if (isMovies && filters?.genre && filters.genre !== 'trending' && filters.genre !== 'all') {
    // The stored `genre` is TMDB's comma-joined label list ("Horror, Thriller")
    // and the chip's id is numeric, so match on the label the row actually has.
    const label = MOVIE_GENRE_LABELS[String(filters.genre)];
    if (label) query = query.ilike('genre', '%' + label + '%');
  }

  const decadeRange = DECADE_RANGES[filters?.decade ?? 'all'];
  if (decadeRange) {
    query = query.gte('year', decadeRange[0]).lte('year', decadeRange[1]);
  }

  const { data, error } = await query;

  if (error) throw toMessage(error, 'load your picks');

  const cards = (data ?? [])
    .filter((row) => !seen.has(row.id as string))
    .map((row) => ({
      id: row.id as string,
      kind: row.kind as PickerCard['kind'],
      title: row.title as string,
      meta: (row.meta as string | null) ?? null,
      imageUrl: (row.image_url as string | null) ?? null,
      rating: row.rating ? Number(row.rating) : null,
      year: row.year ? Number(row.year) : null,
      genre: (row.genre as string | null) ?? null,
      overview: (row.overview as string | null) ?? null,
    }));

  deckCache.set(cacheKey, { cards, page: cached?.page ?? 1 });
  return cards;
}

/**
 * Record a swipe and report whether it completed a match.
 *
 * The match check runs *after* the insert and reads `picker_matches()`, so the
 * answer accounts for the swipe just made. Doing it the other way round would
 * miss the case this feature exists for: the second partner swiping right on
 * something the first already liked.
 */
export async function recordSwipe(input: {
  itemId: string;
  userId: string;
  coupleId: string;
  liked: boolean;
}): Promise<boolean> {
  const { error } = await supabase.from('picker_swipes').upsert(
    {
      item_id: input.itemId,
      user_id: input.userId,
      couple_id: input.coupleId,
      liked: input.liked,
    },
    { onConflict: 'item_id,user_id' }
  );

  if (error) throw toMessage(error, 'save that swipe');
  if (!input.liked) return false;

  const { data, error: matchError } = await supabase.rpc('picker_matches');
  // A failed match check must not lose the swipe, which is already saved. The
  // worst case is a match that surfaces on the next open instead of right now.
  if (matchError) return false;

  return (data ?? []).some((row: { item_id: string }) => row.item_id === input.itemId);
}

export async function fetchPickerMatches(): Promise<PickerMatch[]> {
  const { data, error } = await supabase.rpc('picker_matches');
  if (error) throw toMessage(error, 'load your matches');

  return (data ?? []).map(
    (row: {
      item_id: string;
      kind: string;
      title: string;
      meta: string | null;
      image_url: string | null;
      rating: number | null;
      year: number | null;
      overview: string | null;
      matched_at: string;
    }) => ({
      itemId: row.item_id,
      kind: row.kind as PickerMatch['kind'],
      title: row.title,
      meta: row.meta,
      imageUrl: row.image_url,
      rating: row.rating ? Number(row.rating) : null,
      year: row.year,
      overview: row.overview,
      matchedAt: row.matched_at,
    })
  );
}

// ---------------------------------------------------------------------------
// Date ideas
// ---------------------------------------------------------------------------

export async function fetchDateIdeas(): Promise<DateIdea[]> {
  const { data, error } = await supabase
    .from('date_ideas')
    .select('id, title, location, time_hint, couple_id')
    // The couple's own ideas first — RLS already limits this to stock rows plus
    // theirs, and their own are the ones they meant.
    .order('couple_id', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) throw toMessage(error, 'load date ideas');

  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    location: (row.location as string | null) ?? null,
    time: (row.time_hint as string | null) ?? null,
    coupleId: (row.couple_id as string | null) ?? null,
  }));
}

export async function addDateIdea(input: {
  userId: string;
  coupleId: string;
  title: string;
  location: string | null;
  time: string | null;
}): Promise<void> {
  const { error } = await supabase.from('date_ideas').insert({
    couple_id: input.coupleId,
    created_by: input.userId,
    title: input.title,
    location: input.location,
    time_hint: input.time,
  });

  if (error) throw toMessage(error, 'save that idea');
}

// ---------------------------------------------------------------------------
// Trivia
// ---------------------------------------------------------------------------

/** The question bank: stock rows plus anything the couple wrote. */
/**
 * Three questions for a round, about your partner.
 *
 * The subject filter is the correctness fix that authoring forces. This used to
 * select the whole table, which was harmless only while every row was stock and
 * about nobody. The moment couples write their own, an unfiltered read asks you
 * questions *about yourself* — where the "correct" answer is one you supplied,
 * so you either score full marks or discover the app thinks you are wrong about
 * your own coffee order. Neither is the game.
 *
 * The couple's own questions come first and stock only tops up the shortfall,
 * so a couple who have written four questions play theirs and never see the
 * bank again. That ordering is the whole point of letting them write any.
 */
export async function fetchTriviaQuestions(
  partnerId: string | null,
  limit = 3
): Promise<TriviaQuestion[]> {
  const toQuestion = (row: Record<string, unknown>): TriviaQuestion => ({
    id: row.id as string,
    question: row.question as string,
    options: (row.options as string[]) ?? [],
    answer: row.correct_index as number,
  });

  // Written by the partner, about the partner. RLS already limits this to the
  // caller's couple; the filter is about *whose* questions, not about access.
  const mine = partnerId
    ? await supabase
        .from('trivia_questions')
        .select('id, question, options, correct_index')
        .not('couple_id', 'is', null)
        .eq('subject_user_id', partnerId)
    : null;

  if (mine?.error) throw toMessage(mine.error, 'load your questions');

  const own = shuffle((mine?.data ?? []).map(toQuestion));

  if (own.length >= limit) return own.slice(0, limit);

  // Top up from the bank. Stock rows are about nobody in particular, which is
  // why they can stand in before a couple has written enough of their own.
  const stock = await supabase
    .from('trivia_questions')
    .select('id, question, options, correct_index')
    .is('couple_id', null);

  if (stock.error) throw toMessage(stock.error, 'load the questions');

  return [...own, ...shuffle((stock.data ?? []).map(toQuestion))].slice(0, limit);
}

/**
 * Fisher-Yates, on the client.
 *
 * Postgres has no cheap random sample — `order by random()` sorts the whole
 * relation — and the bank is a few dozen rows RLS has already scoped. Doing it
 * here also means two rounds in a row are not the same three questions, which
 * is the entire reason "Play again" exists.
 */
function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** One question this person has written about themselves, for the editor. */
export type OwnTriviaQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
};

/** The questions you have set about yourself, newest first. */
export async function fetchOwnTriviaQuestions(userId: string): Promise<OwnTriviaQuestion[]> {
  const { data, error } = await supabase
    .from('trivia_questions')
    .select('id, question, options, correct_index')
    .eq('subject_user_id', userId)
    .not('couple_id', 'is', null)
    .order('created_at', { ascending: false });

  if (error) throw toMessage(error, 'load your questions');

  return (data ?? []).map((row) => ({
    id: row.id as string,
    question: row.question as string,
    options: (row.options as string[]) ?? [],
    correctIndex: row.correct_index as number,
  }));
}

/**
 * Write one about yourself.
 *
 * `subject_user_id` is the caller and not a parameter: the insert policy in
 * 0021 requires it to be `auth.uid()`, and offering it as an argument would
 * only let a caller construct a row the database is going to refuse.
 */
export async function addTriviaQuestion(input: {
  coupleId: string;
  userId: string;
  question: string;
  options: string[];
  correctIndex: number;
}): Promise<void> {
  const { error } = await supabase.from('trivia_questions').insert({
    couple_id: input.coupleId,
    subject_user_id: input.userId,
    question: input.question.trim(),
    options: input.options.map((o) => o.trim()),
    correct_index: input.correctIndex,
  });

  if (error) throw toMessage(error, 'save that question');
}

/** Remove one of your own. RLS refuses anything else, including stock rows. */
export async function deleteTriviaQuestion(questionId: string): Promise<void> {
  const { error } = await supabase.from('trivia_questions').delete().eq('id', questionId);

  if (error) throw toMessage(error, 'delete that question');
}

export async function startTriviaRound(input: {
  userId: string;
  coupleId: string;
  subjectId: string | null;
  total: number;
}): Promise<string> {
  const { data, error } = await supabase
    .from('trivia_rounds')
    .insert({
      couple_id: input.coupleId,
      player_id: input.userId,
      subject_id: input.subjectId,
      total: input.total,
    })
    .select('id')
    .single();

  if (error) throw toMessage(error, 'start the round');
  return data.id as string;
}

export async function recordTriviaAnswer(input: {
  roundId: string;
  questionId: string;
  userId: string;
  coupleId: string;
  chosenIndex: number;
}): Promise<void> {
  const { error } = await supabase.from('trivia_responses').insert({
    round_id: input.roundId,
    question_id: input.questionId,
    user_id: input.userId,
    couple_id: input.coupleId,
    chosen_index: input.chosenIndex,
  });

  if (error) throw toMessage(error, 'save that answer');
}

export async function completeTriviaRound(roundId: string, score: number): Promise<void> {
  const { error } = await supabase
    .from('trivia_rounds')
    .update({ score, completed_at: new Date().toISOString() })
    .eq('id', roundId);

  if (error) throw toMessage(error, 'save your score');
}

// ---------------------------------------------------------------------------
// Growth habits
// ---------------------------------------------------------------------------

export async function fetchGrowthHabits(): Promise<GrowthHabit[]> {
  const { data, error } = await supabase
    .from('growth_habits')
    .select('id, label, rating')
    .order('created_at', { ascending: true });

  if (error) throw toMessage(error, 'load your habits');

  return (data ?? []).map((row) => ({
    id: row.id as string,
    label: row.label as string,
    rating: (row.rating as number | null) ?? null,
  }));
}

export async function addGrowthHabit(input: {
  userId: string;
  coupleId: string | null;
  label: string;
}): Promise<void> {
  const { error } = await supabase.from('growth_habits').insert({
    user_id: input.userId,
    couple_id: input.coupleId,
    label: input.label,
  });

  if (error) throw toMessage(error, 'add that');
}

export async function rateGrowthHabit(habitId: string, rating: number): Promise<void> {
  const { error } = await supabase
    .from('growth_habits')
    // `rated_at` alongside the rating, not instead of it: the column is what
    // makes "this week's rating" answerable once a trend view exists, and a
    // rating with no timestamp is not recoverable later.
    .update({ rating, rated_at: new Date().toISOString() })
    .eq('id', habitId);

  if (error) throw toMessage(error, 'save that');
}

export async function deleteGrowthHabit(habitId: string): Promise<void> {
  const { error } = await supabase.from('growth_habits').delete().eq('id', habitId);
  if (error) throw toMessage(error, 'remove that');
}

// ---------------------------------------------------------------------------
// Activity feed
// ---------------------------------------------------------------------------

/** One thing that happened, already merged and sorted by `play_activity()`. */
export type PlayActivity = {
  id: string;
  kind: 'coin' | 'wheel' | 'trivia' | 'picker';
  /** Who did it. Null for a picker match, which neither of you did alone. */
  actorId: string | null;
  /** Who it was about — the coin's winner, the trivia round's subject. */
  subjectId: string | null;
  /** The headline detail: the stake, the wedge, the score, the title. */
  label: string | null;
  detail: string | null;
  occurredAt: string;
};

type PlayActivityRow = {
  id_col: string;
  kind_col: string;
  actor_id_col: string | null;
  subject_id_col: string | null;
  label_col: string | null;
  detail_col: string | null;
  occurred_at_col: string;
};

/**
 * Recent play, across every game, newest first.
 *
 * The union and the sort happen in Postgres — see `0019_play_activity.sql` —
 * rather than here, because merging four differently-shaped result sets on the
 * client means four round trips and a sort over data most of which gets thrown
 * away by the limit.
 */
export async function fetchPlayActivity(limit = 12): Promise<PlayActivity[]> {
  const { data, error } = await supabase.rpc('play_activity', { p_limit: limit });

  if (error) throw toMessage(error, 'load your recent play');

  return ((data ?? []) as PlayActivityRow[]).map((row) => ({
    id: row.id_col,
    kind: row.kind_col as PlayActivity['kind'],
    actorId: row.actor_id_col,
    subjectId: row.subject_id_col,
    label: row.label_col,
    detail: row.detail_col,
    occurredAt: row.occurred_at_col,
  }));
}
