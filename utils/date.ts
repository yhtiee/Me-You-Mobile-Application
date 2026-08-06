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
