import { useCouple } from '@/components/providers/couple-provider';
import { MOOD_LABELS, NEED_LABELS, type MoodKey } from '@/types/domain';
import { palette } from '@/constants/tokens';

/**
 * Today's mood + battery for both people.
 *
 * At API time the body of this hook becomes a query/mutation pair. The returned
 * shape must not change — screens depend on it.
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
