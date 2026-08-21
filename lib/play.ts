import { supabase } from '@/lib/supabase';
import type {
  CoinFlip,
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
export async function fetchPickerQueue(): Promise<PickerCard[]> {
  const { data: swiped, error: swipeError } = await supabase
    .from('picker_swipes')
    .select('item_id');

  if (swipeError) throw toMessage(swipeError, 'load your picks');

  const seen = new Set((swiped ?? []).map((row) => row.item_id as string));

  const { data, error } = await supabase
    .from('picker_items')
    .select('id, kind, title, meta')
    .order('created_at', { ascending: true });

  if (error) throw toMessage(error, 'load your picks');

  return (data ?? [])
    .filter((row) => !seen.has(row.id as string))
    .map((row) => ({
      id: row.id as string,
      kind: row.kind as PickerCard['kind'],
      title: row.title as string,
      meta: (row.meta as string | null) ?? null,
    }));
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
    (row: { item_id: string; kind: string; title: string; meta: string | null; matched_at: string }) => ({
      itemId: row.item_id,
      kind: row.kind as PickerMatch['kind'],
      title: row.title,
      meta: row.meta,
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
export async function fetchTriviaQuestions(limit = 3): Promise<TriviaQuestion[]> {
  const { data, error } = await supabase
    .from('trivia_questions')
    .select('id, question, options, correct_index');

  if (error) throw toMessage(error, 'load the questions');

  const all = (data ?? []).map((row) => ({
    id: row.id as string,
    question: row.question as string,
    options: (row.options as string[]) ?? [],
    answer: row.correct_index as number,
  }));

  /*
   * Shuffled on the client, then cut to `limit`.
   *
   * Postgres has no cheap random sample — `order by random()` sorts the whole
   * table — and the bank is a few dozen rows that RLS has already scoped. Doing
   * it here also means two rounds in a row are not the same three questions,
   * which is the entire reason "Play again" exists.
   */
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }

  return all.slice(0, limit);
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
