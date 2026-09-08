import { palette } from '@/constants/tokens';
import type { LoveLanguage, WikiEntry } from '@/types/domain';

/**
 * Form definitions, not seed data.
 *
 * These two lists are fixed sets the *schema* expects the client to own:
 *
 * - `wiki_entries` has a unique constraint on `(couple_id, subject_user_id,
 *   label)` specifically so "the app can upsert on the natural key instead of
 *   tracking row ids for a form that is really a fixed list" — its words. A row
 *   only exists once someone fills it, so the list of slots has to come from
 *   somewhere, and a table of empty rows per couple is a worse answer than a
 *   constant.
 * - `love_languages` is keyed by an enum of exactly five values. The labels are
 *   presentation and belong here rather than in Postgres.
 *
 * Neither is `mocks/` — nothing here stands in for data we intend to fetch.
 */

/**
 * `blurb` is the plain-English version of each name. "Acts of Service" is a
 * term from a book, not something people say about themselves, and asking
 * someone to rate five phrases they half-recognise gets you five threes.
 *
 * `color` is used only where the five have to be told apart from *each other* —
 * the editor and its spectrum bar. On the Us screen the same five are coloured
 * by person instead (rose is you, iris is them), because there the question is
 * whose bar is whose, not which language is which.
 */
export const LOVE_LANGUAGES: {
  key: LoveLanguage['key'];
  label: string;
  blurb: string;
  color: string;
}[] = [
  {
    key: 'quality-time',
    label: 'Quality Time',
    blurb: 'Undivided attention, phones down',
    color: palette.brand.iris,
  },
  {
    key: 'words',
    label: 'Words of Affirmation',
    blurb: 'Being told, out loud',
    color: palette.brand.rose,
  },
  {
    key: 'touch',
    label: 'Physical Touch',
    blurb: 'A hand, a hug, sitting close',
    color: palette.brand.amber,
  },
  {
    key: 'acts',
    label: 'Acts of Service',
    blurb: 'Something taken off your plate',
    color: palette.light.success,
  },
  {
    key: 'gifts',
    label: 'Receiving Gifts',
    blurb: 'Proof they were thinking of you',
    color: palette.mood.sad,
  },
];

export const WIKI_CATEGORY_LABELS: Record<WikiEntry['category'], string> = {
  favourites: 'Favorites',
  personal: 'Personal Information',
  sizes: 'Sizes',
  dreams: 'Dreams & Goals',
  wishlist: 'Wishlist',
};

/** The cheat-sheet every couple starts with. Order is the render order. */
export const WIKI_SLOTS: { category: WikiEntry['category']; label: string }[] = [
  // Favorites
  { category: 'favourites', label: 'Favorite food' },
  { category: 'favourites', label: 'Favorite drink' },
  { category: 'favourites', label: 'Favorite snack' },
  { category: 'favourites', label: 'Favorite restaurant' },
  { category: 'favourites', label: 'Favorite flower' },
  { category: 'favourites', label: 'Favorite perfume/cologne' },
  { category: 'favourites', label: 'Favorite color' },
  { category: 'favourites', label: 'Favorite movie' },
  { category: 'favourites', label: 'Favorite TV show' },
  { category: 'favourites', label: 'Favorite artist' },
  { category: 'favourites', label: 'Favorite song' },
  { category: 'favourites', label: 'Favorite hobby' },

  // Personal Information
  { category: 'personal', label: 'Birthday' },
  { category: 'personal', label: 'Zodiac sign' },
  { category: 'personal', label: 'Blood group' },
  { category: 'personal', label: 'Allergies' },
  { category: 'personal', label: 'Emergency contact' },
  { category: 'personal', label: 'Home town' },
  { category: 'personal', label: 'Languages spoken' },

  // Sizes
  { category: 'sizes', label: 'Ring size' },
  { category: 'sizes', label: 'Shoe size' },
  { category: 'sizes', label: 'Clothes size' },

  // Dreams & Goals
  { category: 'dreams', label: 'Dream vacation' },
  { category: 'dreams', label: 'Dream house' },
  { category: 'dreams', label: 'Dream car' },
  { category: 'dreams', label: 'Career goals' },
  { category: 'dreams', label: 'Bucket list' },
  { category: 'dreams', label: 'Places to visit together' },
  { category: 'dreams', label: 'Things to learn together' },
];

