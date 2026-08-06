import { useCouple } from '@/components/providers/couple-provider';
import {
  dateIdeas,
  movieCards,
  triviaQuestions,
  wheelOptions,
} from '@/mocks/couple';

/**
 * Seed content for the Play tools.
 *
 * Screens must not reach into `@/mocks` themselves — this hook is the seam, so
 * when these lists come from the API (or from user customisation) only the body
 * below changes.
 */
export function useTools() {
  const { growthHabits, rateHabit, addEvent } = useCouple();

  return {
    /** Whose-turn wheel starting options; the screen may add or remove its own. */
    wheelOptions,
    /** Indecision resolver candidates for the date setter. */
    dateIdeas,
    /** Swipe deck for the movie & meal picker. */
    pickerCards: movieCards,
    /** Trivia mini-game. */
    triviaQuestions,
    growthHabits,
    rateHabit,
    addEvent,
  };
}
