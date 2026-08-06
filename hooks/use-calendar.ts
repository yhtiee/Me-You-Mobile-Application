import { useCouple } from '@/components/providers/couple-provider';
import { daysUntil, formatEventDate } from '@/utils/date';

/**
 * Relationship calendar with countdowns. Push notifications at 7/3/1 days are
 * an API-layer concern; the UI just renders the countdown.
 */
export function useCalendar() {
  const { calendar, addEvent } = useCouple();

  const events = calendar
    .map((e) => ({
      ...e,
      daysAway: daysUntil(e.date),
      dateLabel: formatEventDate(e.date),
    }))
    .sort((a, b) => a.daysAway - b.daysAway);

  return {
    events,
    next: events[0] ?? null,
    addEvent,
  };
}
