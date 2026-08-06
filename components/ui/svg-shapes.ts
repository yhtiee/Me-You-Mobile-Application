/**
 * Path data shared by the hand-drawn illustrations.
 *
 * Kept in one place so the same heart and sparkle appear across screens rather
 * than drifting into near-identical variants — the fastest way for a drawn set
 * to stop looking like a set.
 */

/**
 * Four-point sparkle, drawn around its own origin (0,0) rather than a corner,
 * so callers can place it with `translate` and scale it about its centre.
 */
export const SPARKLE =
  'M0-9C1.3-3.3 3.3-1.3 9 0 3.3 1.3 1.3 3.3 0 9-1.3 3.3-3.3 1.3-9 0-3.3-1.3-1.3-3.3 0-9Z';

/** Heart on a 24-unit grid, origin at the top-left corner of that grid. */
export const HEART =
  'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z';
