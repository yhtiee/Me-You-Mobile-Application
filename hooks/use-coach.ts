import { useCouple } from '@/components/providers/couple-provider';
import { coachSuggestions } from '@/mocks/couple';

/**
 * AI coach thread. Replies are canned until the LLM call lands with the API
 * layer; the free-tier daily cap is enforced here so the limit dialog is real.
 */
export function useCoach() {
  const { coachThread, coachQuestionsUsed, coachQuestionsAllowed, askCoach, isPremium } =
    useCouple();

  const remaining = isPremium
    ? Infinity
    : Math.max(0, coachQuestionsAllowed - coachQuestionsUsed);

  return {
    thread: coachThread,
    suggestions: coachSuggestions,
    remaining,
    isUnlimited: isPremium,
    limitReached: !isPremium && remaining === 0,
    remainingLabel: isPremium
      ? 'Unlimited'
      : `${remaining} of ${coachQuestionsAllowed} left today`,
    ask: askCoach,
  };
}
