import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { GameIntro, GameScore } from '@/components/play/game-intro';
import { ResultReveal } from '@/components/play/result-reveal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { useTrivia } from '@/hooks/use-play';
import { layout, motion, radius, space } from '@/constants/tokens';

/**
 * "How well do you know them" (PRD Module 2, P2).
 *
 * One question at a time, not all three at once. The old screen printed every
 * question as a stacked card with all its options visible, which meant you
 * could read question three while answering question one — and a quiz you can
 * skim ahead in is a form, not a game. Committing to one screen per question is
 * what buys the reveal, the running score, and any sense of stakes at all.
 *
 * The growth tracker that used to share this file now has its own screen. They
 * were never one feature; they were two features in one route.
 */
export default function TriviaTool() {
  const theme = useTheme();
  const { partner, questions, answers, answer, finish, restart, correct, complete, loading, error } =
    useTrivia();

  const [step, setStep] = useState(0);
  const [revision, setRevision] = useState(0);

  const partnerName = partner?.name ?? 'them';

  const question = questions[step];
  const picked = question ? answers[question.id] : undefined;
  const revealed = picked != null;
  const isLast = step === questions.length - 1;

  const onPick = (choice: number) => {
    if (!question || revealed) return;
    answer(question.id, choice);

    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(
        choice === question.answer
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning
      );
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (isLast) {
      setRevision((n) => n + 1);
      /*
       * The final score is written here rather than in an effect watching
       * `complete`. `correct` is derived from state this call is still in the
       * middle of setting, so the hook recomputes it before `finish` reads it —
       * whereas an effect would also fire on the remount that "Play again"
       * causes, closing a round that had just been reset.
       */
      void finish();
    }
  };

  const playAgain = () => {
    restart();
    setStep(0);
    setRevision(0);
  };

  if (error) {
    return (
      <Screen gap={space.xl}>
        <GameIntro game="trivia" title="How well do you know them?" />
        <ErrorState message={error} />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen gap={space.xl}>
        <GameIntro game="trivia" title="How well do you know them?" />
        <Card style={{ gap: space.xl }}>
          <Skeleton height={22} width="80%" />
          <View style={{ gap: space.md }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={layout.minTarget} round={radius.md} />
            ))}
          </View>
        </Card>
      </Screen>
    );
  }

  if (!question) {
    return (
      <Screen gap={space.xl}>
        <GameIntro game="trivia" title="How well do you know them?" />
        <Text role="body" color={theme.color.textSecondary}>
          No questions yet. Come back once you’ve both written a few.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen gap={space.xl}>
      <GameIntro
        game="trivia"
        title="How well do you know them?"
        trailing={<GameScore game="trivia" value={`${correct}`} label="right" />}
      />

      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text role="overline" color={theme.color.textTertiary}>
            Question {step + 1} of {questions.length}
          </Text>
          <Text role="overline" color={theme.color.textTertiary}>
            About {partnerName}
          </Text>
        </View>
        <ProgressBar
          value={(step + (revealed ? 1 : 0)) / questions.length}
          color={theme.playAccent.trivia}
          height={6}
        />
      </View>

      {/* Keyed on the question id so React remounts on advance — that is what
          replays the entrance animation for each option without any explicit
          reset. */}
      <Card key={question.id} style={{ gap: space.xl }}>
        <Text role="title3">{question.question}</Text>

        <View style={{ gap: space.md }}>
          {question.options.map((option, i) => (
            <Option
              key={option}
              index={i}
              label={option}
              picked={picked === i}
              isAnswer={i === question.answer}
              revealed={revealed}
              onPress={() => onPick(i)}
            />
          ))}
        </View>

        {revealed ? (
          <Text role="caption" color={theme.color.textSecondary}>
            {picked === question.answer
              ? 'Correct. You were listening.'
              : `Not quite — it’s “${question.options[question.answer]}”.`}
          </Text>
        ) : null}
      </Card>

      {revealed && !isLast ? (
        <Button label="Next question" full onPress={() => setStep((s) => s + 1)} />
      ) : null}

      {complete ? (
        <>
          <ResultReveal
            game="trivia"
            revision={revision}
            kicker="Final score"
            result={`${correct} out of ${questions.length}`}
            note={verdict(correct, questions.length, partnerName)}
            celebrate={correct > questions.length / 2}
          />
          <Button label="Play again" variant="secondary" full onPress={playAgain} />
        </>
      ) : null}
    </Screen>
  );
}

type OptionProps = {
  index: number;
  label: string;
  picked: boolean;
  isAnswer: boolean;
  revealed: boolean;
  onPress: () => void;
};

function Option({ index, label, picked, isAnswer, revealed, onPress }: OptionProps) {
  const theme = useTheme();
  const enter = useSharedValue(0);

  useEffect(() => {
    enter.value = withDelay(
      index * motion.stagger.ms,
      withTiming(1, { duration: motion.screen.ms, easing: Easing.out(Easing.cubic) })
    );
  }, [index, enter]);

  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateX: (1 - enter.value) * 16 }],
  }));

  /**
   * After the reveal the right answer goes green and a wrong pick goes red —
   * but the other two options *fade*, rather than staying at full strength.
   * Four equally-loud rows where two of them no longer mean anything is what
   * made the old reveal hard to read at a glance.
   */
  const state = !revealed
    ? 'idle'
    : isAnswer
      ? 'right'
      : picked
        ? 'wrong'
        : 'muted';

  const border =
    state === 'right'
      ? theme.color.success
      : state === 'wrong'
        ? theme.color.danger
        : theme.color.border;

  const fill =
    state === 'right'
      ? theme.tint.success.bg
      : state === 'wrong'
        ? theme.tint.rose.bg
        : 'transparent';

  return (
    <Animated.View style={style}>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: picked, disabled: revealed }}
        accessibilityLabel={
          revealed && isAnswer ? `${label}. Correct answer.` : label
        }
        disabled={revealed}
        onPress={onPress}
        style={({ pressed }) => ({
          minHeight: layout.minTarget,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          paddingHorizontal: space.lg,
          paddingVertical: space.md,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          borderWidth: 1.5,
          borderColor: border,
          backgroundColor: fill,
          opacity: state === 'muted' ? 0.45 : pressed ? 0.7 : 1,
        })}
      >
        <Text role="body" style={{ flex: 1 }}>
          {label}
        </Text>
        {state === 'right' ? (
          <Text role="bodyStrong" color={theme.color.success}>
            ✓
          </Text>
        ) : state === 'wrong' ? (
          <Text role="bodyStrong" color={theme.color.danger}>
            ✕
          </Text>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

/** The line under the final score. Never scolding — a wrong answer is a prompt. */
function verdict(correct: number, total: number, partnerName: string): string {
  if (correct === total) return `Flawless. ${partnerName} has no secrets from you.`;
  if (correct === 0) return `Brutal. Ask them about the ones you missed — that’s the game.`;
  if (correct >= total / 2) return `Solid. Go find out about the ${total - correct} you missed.`;
  return `Room to improve, which is the whole point. Ask ${partnerName} about them.`;
}
