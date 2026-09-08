/** Date helpers for the banner counter and calendar countdowns. */

const MS_PER_DAY = 86_400_000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** "2 years, 4 months" — the couple banner duration counter (PRD Module 1). */
export function durationSince(isoDate: string, now = new Date()): string {
  const start = new Date(isoDate);
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();

  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? 'month' : 'months'}`);
  if (parts.length === 0) return 'Just started';
  return parts.join(', ');
}

/** Whole days from today until `isoDate`. Negative once the date has passed. */
export function daysUntil(isoDate: string, now = new Date()): number {
  const target = startOfDay(new Date(isoDate));
  return Math.round((target.getTime() - startOfDay(now).getTime()) / MS_PER_DAY);
}

/** "Today" / "Tomorrow" / "in 12 days" / "14 days ago". */
export function countdownLabel(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days > 0) return `in ${days} days`;
  if (days === -1) return 'Yesterday';
  return `${Math.abs(days)} days ago`;
}

/** "14 Aug" */
export function formatEventDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * Today as `YYYY-MM-DD` in the device's own timezone.
 *
 * `toISOString().slice(0, 10)` is the tempting one-liner and it is wrong: it
 * converts to UTC first, so anyone west of Greenwich gets yesterday's date for
 * part of every evening. That matters here because this string seeds the Play
 * hero's game-of-the-day — the pick would roll at 7pm rather than midnight.
 */
export function todayIso(now = new Date()): string {
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Parse `YYYY-MM-DD` as a *local* date.
 *
 * `new Date('2026-08-14')` is specified to parse as UTC midnight, which is the
 * 13th locally anywhere west of Greenwich — so a birthday renders on the wrong
 * square of the grid for half the world. Every date in this file is a calendar
 * day, never an instant, so it must be built from parts.
 */
export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/**
 * Where an annually-recurring event lands next.
 *
 * `calendar_events.recurs_annually` has existed since 0004 and nothing read it,
 * so a birthday stored as `2026-08-14` kept its stored year for ever: the day
 * after it passed the calendar said "1 day ago", and a week later "7 days ago",
 * on an event that recurs every year. This rolls the stored month and day into
 * the current year, then to the next one if that has already gone by.
 *
 * 29 February is the case worth stating: `new Date(2027, 1, 29)` rolls over to
 * 1 March on a non-leap year, which is the convention most calendars use and
 * the only one that shows the event at all in three years out of four.
 */
export function nextOccurrence(
  isoDate: string,
  recursAnnually: boolean,
  now = new Date()
): string {
  if (!recursAnnually) return isoDate;

  const source = parseIsoDate(isoDate);
  const today = startOfDay(now);

  const thisYear = new Date(now.getFullYear(), source.getMonth(), source.getDate());
  if (thisYear.getTime() >= today.getTime()) return todayIso(thisYear);

  return todayIso(new Date(now.getFullYear() + 1, source.getMonth(), source.getDate()));
}

/** How many years this will have been, on its next occurrence. Null if not annual. */
export function anniversaryCount(isoDate: string, recursAnnually: boolean, now = new Date()) {
  if (!recursAnnually) return null;
  const next = parseIsoDate(nextOccurrence(isoDate, recursAnnually, now));
  const years = next.getFullYear() - parseIsoDate(isoDate).getFullYear();
  return years > 0 ? years : null;
}

/** First of the month, `offset` months from `iso`'s month. */
export function shiftMonth(iso: string, offset: number): string {
  const d = parseIsoDate(iso);
  return todayIso(new Date(d.getFullYear(), d.getMonth() + offset, 1));
}

/** "August 2026" */
export function formatMonthYear(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** "Friday 21 August" — the day-detail heading. */
export function formatDayLong(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** `HH:MM` in the device's own 12/24-hour convention. */
export function formatTimeLabel(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * The six-by-seven grid for a month, as ISO dates.
 *
 * Always six rows, even when five would fit. A grid that changes height as you
 * page through the year makes everything under it jump, and the row that
 * appears and disappears is the one people are most likely to be aiming at.
 *
 * Weeks start Monday. Not locale-derived: the runtime API for that
 * (`Intl.Locale.getWeekInfo`) is not in Hermes, and guessing from the locale
 * string is worse than being consistently one thing.
 */
export const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

export function monthGrid(monthIso: string): string[][] {
  const first = parseIsoDate(monthIso);
  const firstOfMonth = new Date(first.getFullYear(), first.getMonth(), 1);

  // getDay() is 0=Sunday; shift so Monday is 0.
  const lead = (firstOfMonth.getDay() + 6) % 7;
  const start = new Date(firstOfMonth);
  start.setDate(start.getDate() - lead);

  const weeks: string[][] = [];
  const cursor = new Date(start);

  for (let w = 0; w < 6; w++) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(todayIso(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
}

/** Whether `iso` falls inside the month `monthIso` belongs to. */
export function isSameMonth(iso: string, monthIso: string): boolean {
  return iso.slice(0, 7) === monthIso.slice(0, 7);
}

/**
 * The ISO date `years` whole years before today.
 *
 * The lossy half of the "how many years?" shortcut: someone who says "3 years"
 * gets 3 years ago *today*, which is the only defensible reading of a number
 * with no month in it. Anyone who wants the real day picks it instead — this
 * exists so the quick answer is available, not so it is the only one.
 */
export function yearsAgoIso(years: number, now = new Date()): string {
  const then = new Date(now.getFullYear() - years, now.getMonth(), now.getDate());
  return todayIso(then);
}

/** Whole years between an ISO date and today. The inverse of `yearsAgoIso`. */
export function yearsSince(isoDate: string, now = new Date()): number {
  const start = parseIsoDate(isoDate);
  let years = now.getFullYear() - start.getFullYear();

  // Not yet this year's anniversary, so the last one was a year earlier.
  const beforeAnniversary =
    now.getMonth() < start.getMonth() ||
    (now.getMonth() === start.getMonth() && now.getDate() < start.getDate());

  if (beforeAnniversary) years -= 1;

  return Math.max(0, years);
}
