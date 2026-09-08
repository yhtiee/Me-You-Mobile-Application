/**
 * Domain model for the UI layer. These types are the contract the API layer
 * will have to satisfy — the mock store and the eventual real client both
 * produce exactly these shapes.
 */

export type MoodKey = 'happy' | 'neutral' | 'sad' | 'stressed';

export const MOOD_LABELS: Record<MoodKey, string> = {
  happy: 'Happy',
  neutral: 'Steady',
  sad: 'Sad',
  stressed: 'Stressed',
};

/** Offered when a check-in comes back Sad or Stressed (PRD Module 1). */
export type NeedKey = 'quality-time' | 'words' | 'space' | 'touch' | 'acts';

export const NEED_LABELS: Record<NeedKey, string> = {
  'quality-time': 'Needs quality time',
  words: 'Needs words of affirmation',
  space: 'Needs a little space',
  touch: 'Needs physical touch',
  acts: 'Needs acts of service',
};

export type PersonId = 'you' | 'partner';

export type Person = {
  id: PersonId;
  name: string;
  avatarUri: string | null;
};

export type CheckinState = {
  mood: MoodKey;
  /** 0-100 "battery" / loved percentage. */
  battery: number;
  need: NeedKey;
  /** Whether today's check-in has been saved. */
  savedToday: boolean;
};

export type LoveLanguage = {
  key: 'words' | 'quality-time' | 'touch' | 'gifts' | 'acts';
  label: string;
  /** 0-100 share of this person's profile. */
  value: number;
};

export type Goal = {
  id: string;
  label: string;
  current: number;
  target: number;
  unit: string;
  done: boolean;
};

export type BucketListItem = {
  id: string;
  label: string;
  done: boolean;
};

export type WikiEntry = {
  id: string;
  category: 'favourites' | 'sizes' | 'dreams' | 'wishlist';
  label: string;
  value: string;
  /** Wiki is cached for offline access (PRD §6). */
  cachedOffline: boolean;
};

export type CalendarEvent = {
  id: string;
  title: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /**
   * Local wall-clock `HH:MM`, or null for an all-day event.
   *
   * Not part of `date` and not a timestamp: a birthday genuinely has no time,
   * and "7:30" on a date night means 7:30 where the couple is. See
   * `calendar_events.event_time`.
   */
  time?: string | null;
  kind: 'anniversary' | 'birthday' | 'first-date' | 'proposal' | 'date-night' | 'custom';
  /**
   * Repeats every year on the same month and day.
   *
   * Stored rather than inferred from `kind`, so a one-off anniversary dinner is
   * still expressible. Where the event next *lands* is computed with
   * `nextOccurrence` — the stored `date` keeps its original year, because that
   * is what makes "their 3rd birthday together" answerable.
   */
  recursAnnually?: boolean;
  reminders?: EventReminder[];
};

/** A nudge, N minutes before an event. Shared by the couple, not per-person. */
export type EventReminder = {
  id: string;
  leadMinutes: number;
};

export type Todo = {
  id: string;
  label: string;
  done: boolean;
};

/** A file on a coach message. `localUri` exists only before the upload lands. */
export type CoachAttachment = {
  storagePath: string;
  mimeType: string;
  fileName: string | null;
  /** Device path, kept so a just-picked image renders before it is fetched back. */
  localUri?: string;
};

export type CoachMessage = {
  id: string;
  from: 'you' | 'coach';
  text: string;
  attachments?: CoachAttachment[];
  /**
   * `pending`/`streaming` are in-flight states the UI renders differently.
   * `failed` covers both a refusal and a turn the user stopped.
   */
  status?: 'pending' | 'streaming' | 'complete' | 'failed';
  stopReason?: string | null;
  createdAt?: string;
};

export type CoachConversation = {
  id: string;
  title: string;
  lastMessageAt: string;
};

export type Level = {
  level: number;
  title: string;
  requirement: string;
};

export type PickerKind = 'movie' | 'meal';

export type PickerCard = {
  id: string;
  kind: PickerKind;
  title: string;
  meta: string | null;
};

/**
 * A movie or meal you both swiped right on.
 *
 * There is deliberately no `partnerLiked` on `PickerCard` any more. The mock
 * carried one, and shipping it would have broken the feature's one promise —
 * "swipe separately, you'll only hear about the matches" — because a client
 * holding that flag has already been told what its partner picked, whatever it
 * chooses to render. Matches arrive only through `picker_matches()`, after both
 * sides are in.
 */
export type PickerMatch = {
  itemId: string;
  kind: PickerKind;
  title: string;
  meta: string | null;
  matchedAt: string;
};

export type GrowthHabit = {
  id: string;
  label: string;
  /** Weekly self-rating, 1-5. Null until rated. */
  rating: number | null;
};

export type DateIdea = {
  id: string;
  title: string;
  location: string | null;
  /** Free text ("Sat 7:30 pm"), not a timestamp — see `date_ideas.time_hint`. */
  time: string | null;
  /** Null on the app's stock ideas; set on ones the couple wrote. */
  coupleId: string | null;
};

export type TriviaQuestion = {
  id: string;
  question: string;
  options: string[];
  answer: number;
};

/** One coin flip, newest first. Drives the "has this been fair?" tally. */
export type CoinFlip = {
  id: string;
  /** Who the coin picked, resolved against the reading user. */
  winner: 'you' | 'partner';
  createdAt: string;
};

/**
 * The couple's open coin session — one argument being settled.
 *
 * Distinct from `CoinFlip`, which is the log. This is the live state: whose
 * turn it is, what is at stake, and what it landed on. Exactly one of these is
 * open per couple at a time, enforced by a partial unique index.
 */
export type CoinSession = {
  id: string;
  /** Who is allowed to flip. Assigned by the server, never chosen. */
  flipperId: string;
  /** What is being settled, or null when it is just a coin. */
  stake: string | null;
  /** Who the coin picked. Null until it has been flipped. */
  resultUserId: string | null;
  flippedAt: string | null;
};

export type WheelOption = {
  id: string;
  label: string;
};

/** One row from `play_stats()` — the hub's six tile lines in one round trip. */
export type PlayStats = {
  coinFlips: number;
  wheelSpins: number;
  wheelOptions: number;
  pickerMatches: number;
  pickerRemaining: number;
  triviaBest: number | null;
  triviaRounds: number;
  habitsRated: number;
  habitsTotal: number;
};
