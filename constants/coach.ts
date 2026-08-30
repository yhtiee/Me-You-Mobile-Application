/**
 * Openers offered on an empty coach thread.
 *
 * These moved out of `mocks/couple.ts` when the coach went live. They were
 * never mock data in the first place — a mock stands in for something the API
 * will later provide, and nothing is ever going to provide these. They are
 * written copy, and the rule that screens must not import `@/mocks` was
 * quietly making a liar of the one that did.
 *
 * Chosen to cover the three reasons someone opens this screen: a rupture to
 * repair, a plan to make, and a thing to buy.
 */
export const COACH_SUGGESTIONS: string[] = [
  'How do I apologise properly?',
  'Date idea for a rainy Tuesday',
  'Gift ideas under $50',
];
