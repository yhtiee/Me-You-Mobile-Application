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
  kind: 'anniversary' | 'birthday' | 'first-date' | 'proposal' | 'date-night' | 'custom';
};

export type Todo = {
  id: string;
  label: string;
  done: boolean;
};

export type CoachMessage = {
  id: string;
  from: 'you' | 'coach';
  text: string;
};

export type Level = {
  level: number;
  title: string;
  requirement: string;
};

export type PickerCard = {
  id: string;
  title: string;
  meta: string;
  /** Mock-only: whether the partner already swiped right on this. */
  partnerLiked: boolean;
};

export type GrowthHabit = {
  id: string;
  label: string;
  /** Weekly self-rating, 1-5. */
  rating: number;
};

export type DateIdea = {
  id: string;
  title: string;
  location: string;
  time: string;
};
