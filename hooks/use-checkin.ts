import { useCouple } from '@/components/providers/couple-provider';
import { MOOD_LABELS, NEED_LABELS, type MoodKey } from '@/types/domain';
import { palette } from '@/constants/tokens';

/**
 * DEAD — nothing imports this any more. Do not wire a new screen to it.
 *
 * Today's mood and battery are read from Supabase now: home goes through
 * `hooks/use-home.ts`, and the check-in sheet and its follow-up call
 * `lib/home.ts` directly. This file is the last mock-backed view of the same
 * data and is kept only until the remaining mock screens (Us, Play, Coach,
 * Calendar) are migrated and `couple-provider` can be deleted whole.
 */
export function useCheckin() {
  const {
    you,
    partner,
    yourCheckin,
    partnerCheckin,
    setMood,
    setBattery,
    setNeed,
    saveCheckin,
  } = useCouple();

  /** Sad or Stressed triggers the "what do you need?" prompt (PRD Module 1). */
  const needsFollowUp = yourCheckin.mood === 'sad' || yourCheckin.mood === 'stressed';

  return {
    you: {
      name: you.name,
      ...yourCheckin,
      moodLabel: MOOD_LABELS[yourCheckin.mood],
      moodColor: palette.mood[yourCheckin.mood],
      needLabel: NEED_LABELS[yourCheckin.need],
      color: palette.person.you,
    },
    partner: {
      name: partner.name,
      ...partnerCheckin,
      moodLabel: MOOD_LABELS[partnerCheckin.mood],
      moodColor: palette.mood[partnerCheckin.mood],
      needLabel: NEED_LABELS[partnerCheckin.need],
      color: palette.person.partner,
    },
    needsFollowUp,
    setMood: (m: MoodKey) => setMood(m),
    setBattery,
    setNeed,
    save: saveCheckin,
  };
}
