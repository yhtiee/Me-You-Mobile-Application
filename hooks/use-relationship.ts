import { useCouple } from '@/components/providers/couple-provider';
import { yourLoveLanguages, partnerLoveLanguages } from '@/mocks/couple';
import { durationSince } from '@/utils/date';

/**
 * Everything the "Us" segment renders: goals, bucket list, love languages and
 * the relationship health bar.
 */
export function useRelationship() {
  const {
    you,
    partner,
    togetherSince,
    goals,
    addGoal,
    toggleGoal,
    bucketList,
    toggleBucketItem,
    streak,
    yourCheckin,
    partnerCheckin,
  } = useCouple();

  const goalsDone = goals.filter((g) => g.done).length;

  // DESIGN GAP — the PRD asks for a Relationship Health Bar (P2) but the
  // redesign mock has no visual for it. Composition below is a first pass from
  // the PRD wording: "streak length, completed check-ins, and active date
  // logging". Flagged for review.
  const health = Math.round(
    Math.min(100, streak / 1.2) * 0.5 +
      ((yourCheckin.savedToday ? 1 : 0) + (partnerCheckin.savedToday ? 1 : 0)) * 12.5 +
      (goals.length ? (goalsDone / goals.length) * 25 : 0),
  );

  return {
    togetherLabel: durationSince(togetherSince),
    you: { name: you.name, loveLanguages: yourLoveLanguages },
    partner: { name: partner.name, loveLanguages: partnerLoveLanguages },
    goals,
    goalsDone,
    addGoal,
    toggleGoal,
    bucketList,
    toggleBucketItem,
    health,
  };
}
