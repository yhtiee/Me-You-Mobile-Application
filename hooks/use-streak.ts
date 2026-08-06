import { useCouple } from '@/components/providers/couple-provider';
import { levels } from '@/mocks/couple';

/** Love streak, current level, and the next milestone on the PRD §5 ladder. */
export function useStreak() {
  const { streak, level, yourCheckin, partnerCheckin } = useCouple();

  const current = levels.findLast((l) => l.level <= level) ?? levels[0];
  const next = levels.find((l) => l.level > level) ?? null;

  /** The streak only holds if BOTH partners check in (PRD Module 1). */
  const bothCheckedIn = yourCheckin.savedToday && partnerCheckin.savedToday;

  return {
    count: streak,
    level,
    levelTitle: current.title,
    nextMilestone: next,
    bothCheckedIn,
    atRisk: !bothCheckedIn,
    /** Progress toward the next level, 0-1. */
    progress: next ? Math.min(1, (level - current.level) / (next.level - current.level)) : 1,
    levels,
  };
}
