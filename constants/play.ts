import type { Href } from 'expo-router';

import type { PlayGameKey } from '@/constants/tokens';

/**
 * The Play catalogue.
 *
 * One list, read by the hub grid, the hero, and every game screen's own header.
 * Previously this lived inline in `play-segment.tsx`, which meant the wheel's
 * title existed in three places — the grid card, the stack's `title` option and
 * the screen's own heading — and they had already drifted ("Games" vs "Games &
 * growth").
 *
 * `tagline` is the grid's one-liner; `blurb` is the longer line the game screen
 * puts under its own title. They are different sentences on purpose: the grid
 * has to sell the game in four words, the screen has to explain the rules.
 */

/**
 * How long the game takes, which is the thing people actually choose on.
 *
 * `instant` settles an argument in one tap and you put the phone down.
 * `session` is something you sit down and do together. The hub groups by this
 * rather than by category, because "we have two minutes" and "we have an
 * evening" are different moods and the old flat list of five served neither.
 */
export type PlayPace = 'instant' | 'session';

export type PlayGame = {
  key: PlayGameKey;
  href: Href;
  /** Short name — the grid tile and the stack header. */
  title: string;
  /** Four-to-six words. Sells the game on the tile. */
  tagline: string;
  /** A sentence. Sits under the title on the game's own screen. */
  blurb: string;
  glyph: string;
  pace: PlayPace;
  /**
   * Second-person line shown on the hero when this game is the day's pick.
   * Written as an invitation, not a description.
   */
  invitation: string;
};

export const PLAY_GAMES: PlayGame[] = [
  {
    key: 'coin',
    href: '/tools/coin',
    title: 'Bigger person',
    tagline: 'One flip, no scorekeeping',
    blurb: 'No fault, no scorekeeping. Just a coin, and then you both move on.',
    glyph: '🪙',
    pace: 'instant',
    invitation: 'Someone has to go first. Let the coin pick.',
  },
  {
    key: 'wheel',
    href: '/tools/wheel',
    title: 'Whose turn',
    tagline: 'The wheel takes no sides',
    blurb: 'Add whatever you keep bickering about. The wheel doesn’t take sides.',
    glyph: '🎡',
    pace: 'instant',
    invitation: 'Still arguing about the dishes? Give it to the wheel.',
  },
  {
    key: 'picker',
    href: '/tools/picker',
    title: 'Movie & meal',
    tagline: 'Swipe apart, match together',
    blurb: 'You each swipe on your own. We only say something when you both said yes.',
    glyph: '🍿',
    pace: 'session',
    invitation: 'Swipe separately. You’ll only hear about the matches.',
  },
  {
    key: 'date',
    href: '/tools/date',
    title: 'Date setter',
    tagline: 'Plan it or let us decide',
    blurb: 'Pick one, or let us decide if neither of you will.',
    glyph: '📅',
    pace: 'session',
    invitation: 'You haven’t planned anything yet. Fix that in two taps.',
  },
  {
    key: 'trivia',
    href: '/tools/trivia',
    title: 'How well do you know them',
    tagline: 'Three questions, real stakes',
    blurb: 'Three questions about each other. No prizes, just bragging rights.',
    glyph: '🎯',
    pace: 'session',
    invitation: 'Three questions. Find out who’s been paying attention.',
  },
  {
    key: 'growth',
    href: '/tools/growth',
    title: 'Growing on purpose',
    tagline: 'Rate yourself, not them',
    blurb: 'Rate yourself each week. It’s for you, not a report card.',
    glyph: '🌱',
    pace: 'session',
    invitation: 'One honest rating. It’s for you, not a report card.',
  },
];

/**
 * Starters for the growth tracker.
 *
 * Not seeded into the database, unlike the trivia bank and the picker items:
 * these are things a person claims about themselves, and pre-filling someone's
 * private list with five failings the app picked is a different and much worse
 * product than offering them as suggestions they tap.
 *
 * Phrased as the behaviour to build, never the flaw to fix — "Say the thing
 * before it festers", not "Stop bottling things up". The screen promises this
 * is not a report card and the wording has to hold that up.
 */
export const GROWTH_SUGGESTIONS: string[] = [
  'Better active listening',
  'Say the thing before it festers',
  'Phones down at dinner',
  'Ask instead of assuming',
  'Apologise without a “but”',
  'Notice the small stuff out loud',
];

export const PLAY_BY_KEY: Record<PlayGameKey, PlayGame> = Object.fromEntries(
  PLAY_GAMES.map((game) => [game.key, game])
) as Record<PlayGameKey, PlayGame>;

/**
 * Which game the hero offers today.
 *
 * Derived from the date rather than random, so both partners open the app to
 * the same suggestion — "did you see today's one?" only works if there is a
 * today's one. Seeded off the ISO date string so it rolls at local midnight
 * without a timer.
 */
export function gameOfTheDay(isoDate: string, pool: PlayGame[] = PLAY_GAMES): PlayGame {
  let hash = 0;
  for (let i = 0; i < isoDate.length; i++) {
    hash = (hash * 31 + isoDate.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length];
}
