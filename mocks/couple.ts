import type {
  BucketListItem,
  CalendarEvent,
  CheckinState,
  CoachMessage,
  Goal,
  Level,
  LoveLanguage,
  Person,
  Todo,
  WikiEntry,
} from '@/types/domain';

/**
 * Seed data for the UI layer. Nothing outside `hooks/` and
 * `components/providers/` may import this module — screens read through hooks
 * so the API swap does not touch a single screen file.
 *
 * Demo values match the interactive mock: level 10 "Soulmates", 47-day streak.
 */

export const you: Person = { id: 'you', name: 'You', avatarUri: null };
export const partner: Person = { id: 'partner', name: 'Sarah', avatarUri: null };

/** Together since — drives the "Together 2 years, 4 months" banner counter. */
export const togetherSince = '2023-03-18';

export const initialStreak = 47;
export const initialLevel = 10;

/** PRD §5 progression ladder. */
export const levels: Level[] = [
  { level: 1, title: 'Crushes', requirement: 'Initial pairing & account setup complete.' },
  { level: 5, title: 'Lovers', requirement: '7-day streak + 2 dates completed.' },
  { level: 10, title: 'Soulmates', requirement: '30-day streak + 5 partner wiki entries filled.' },
  { level: 20, title: 'Power Couple', requirement: '90-day streak + 10 shared goals accomplished.' },
  {
    level: 50,
    title: 'Relationship GOATs',
    requirement: '365-day streak + ultimate relationship status achieved.',
  },
];

export const yourCheckin: CheckinState = {
  mood: 'neutral',
  battery: 72,
  need: 'space',
  savedToday: false,
};

export const partnerCheckin: CheckinState = {
  mood: 'happy',
  battery: 82,
  need: 'quality-time',
  savedToday: true,
};

export const coupleCode = 'LV82K9';

export const yourLoveLanguages: LoveLanguage[] = [
  { key: 'quality-time', label: 'Quality Time', value: 34 },
  { key: 'touch', label: 'Physical Touch', value: 26 },
  { key: 'words', label: 'Words of Affirmation', value: 20 },
  { key: 'acts', label: 'Acts of Service', value: 12 },
  { key: 'gifts', label: 'Receiving Gifts', value: 8 },
];

export const partnerLoveLanguages: LoveLanguage[] = [
  { key: 'words', label: 'Words of Affirmation', value: 38 },
  { key: 'quality-time', label: 'Quality Time', value: 28 },
  { key: 'gifts', label: 'Receiving Gifts', value: 15 },
  { key: 'touch', label: 'Physical Touch', value: 11 },
  { key: 'acts', label: 'Acts of Service', value: 8 },
];

export const goals: Goal[] = [
  { id: 'g1', label: 'Go on 4 dates this month', current: 2, target: 4, unit: 'dates', done: false },
  // Dual currency is a PRD requirement the redesign mock dropped — kept so the
  // API layer knows NGN/USD both matter.
  { id: 'g2', label: 'Save ₦50,000 / $100 together', current: 32000, target: 50000, unit: '₦', done: false },
  { id: 'g3', label: 'Watch 3 movies together', current: 3, target: 3, unit: 'movies', done: true },
  { id: 'g4', label: 'Pray / read a book together daily', current: 5, target: 7, unit: 'days', done: false },
];

export const bucketList: BucketListItem[] = [
  { id: 'b1', label: 'Santorini at sunset', done: false },
  { id: 'b2', label: 'Learn to cook jollof properly', done: true },
  { id: 'b3', label: 'Road trip with no plan', done: false },
  { id: 'b4', label: 'Matching tattoos (maybe)', done: false },
];

export const wiki: WikiEntry[] = [
  { id: 'w1', category: 'favourites', label: 'Favourite food', value: 'Pad thai, extra lime', cachedOffline: true },
  { id: 'w2', category: 'favourites', label: 'Favourite flowers', value: 'White peonies', cachedOffline: true },
  { id: 'w3', category: 'sizes', label: 'Ring size', value: 'UK L / US 6', cachedOffline: true },
  { id: 'w4', category: 'sizes', label: 'Shoe size', value: 'UK 5.5 / EU 38.5', cachedOffline: true },
  { id: 'w5', category: 'sizes', label: 'Clothes size', value: 'Tops S, jeans 27', cachedOffline: true },
  { id: 'w6', category: 'dreams', label: 'Dream vacation', value: 'Kyoto in cherry-blossom season', cachedOffline: true },
  { id: 'w7', category: 'wishlist', label: 'Birthday wishlist', value: 'Film camera, that green scarf', cachedOffline: false },
];

/*
 * The `calendar` array lived here. It is gone because the calendar tab now
 * reads `calendar_events` through `lib/calendar.ts` — and while both existed,
 * the date setter wrote a real row that this hardcoded list could never show.
 */

export const todos: Todo[] = [
  { id: 't1', label: 'Buy flowers on the way home', done: false },
  { id: 't2', label: 'Pick up her favourite snack', done: false },
  { id: 't3', label: 'Book the table for Saturday', done: true },
];

export const coachThread: CoachMessage[] = [
  {
    id: 'm1',
    from: 'coach',
    text: 'Hey. I’m here whenever something’s sitting heavy, or when you just want a good date idea. What’s on your mind?',
  },
];

/** Canned replies — the LLM call lands with the API layer. */
export const coachReplies: string[] = [
  'That sounds like a lot to carry quietly. Try naming the feeling before the fix — “I felt distant this week” lands softer than “you were distant”.',
  'Sarah’s love language leans words of affirmation. A specific compliment about something she did, not how she looks, tends to go furthest.',
  'Low-effort, high-warmth: cook something together with the phones in another room. The shared task does the talking.',
  'You don’t have to resolve it tonight. Agree on a time to come back to it — that alone lowers the temperature.',
];

export const coachSuggestions: string[] = [
  'How do I apologise properly?',
  'Date idea for a rainy Tuesday',
  'Gift ideas under $50',
];

/*
 * Play's seed data used to live here — `movieCards`, `wheelOptions`,
 * `dateIdeas`, `growthHabits` and `triviaQuestions`.
 *
 * It is gone rather than left in place because Play now reads Postgres
 * (`lib/play.ts`), and the equivalent rows are stock content in
 * `0008_seed.sql` and `0012_play.sql`. Two copies of the same list, one of
 * which nothing renders, is how the seed and the schema drift apart.
 */
