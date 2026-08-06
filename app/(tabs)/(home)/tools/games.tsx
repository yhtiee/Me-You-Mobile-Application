import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { useTools } from '@/hooks/use-tools';
import { layout, palette, radius, space } from '@/constants/tokens';

/**
 * Couples Games & Challenges (PRD Module 2, P2). Two halves: trivia mini-game,
 * and the Weakness Growth Tracker with a weekly self-rating.
 */
export default function GamesTool() {
  const theme = useTheme();
  const { triviaQuestions, growthHabits, rateHabit } = useTools();
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const answered = Object.keys(answers).length;
  const correct = triviaQuestions.filter((q) => answers[q.id] === q.answer).length;

  return (
    <Screen gap={space.xl}>
      <View style={{ gap: space.sm }}>
        <Text role="title2">How well do you know them?</Text>
        <Text role="body" color={theme.color.textSecondary}>
          Three questions. No prizes, just bragging rights.
        </Text>
      </View>

      {triviaQuestions.map((q) => {
        const picked = answers[q.id];
        return (
          <Card key={q.id} style={{ gap: space.md }}>
            <Text role="cardTitle">{q.question}</Text>
            <View style={{ gap: space.sm }}>
              {q.options.map((option, i) => {
                const isPicked = picked === i;
                const revealed = picked != null;
                const isRight = i === q.answer;

                const border = !revealed
                  ? theme.color.border
                  : isRight
                    ? theme.color.success
                    : isPicked
                      ? theme.color.danger
                      : theme.color.border;

                return (
                  <Pressable
                    key={option}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isPicked, disabled: revealed }}
                    disabled={revealed}
                    onPress={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                    style={{
                      minHeight: layout.minTarget,
                      justifyContent: 'center',
                      paddingHorizontal: space.lg,
                      borderRadius: radius.md,
                      borderCurve: 'continuous',
                      borderWidth: 1.5,
                      borderColor: border,
                    }}
                  >
                    <Text role="body">{option}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        );
      })}

      {answered === triviaQuestions.length ? (
        <Card style={{ alignItems: 'center', gap: space.xs }}>
          <Text role="overline" color={theme.color.textTertiary}>
            Score
          </Text>
          <Text role="title2" tabular>
            {correct} / {triviaQuestions.length}
          </Text>
        </Card>
      ) : null}

      <View style={{ gap: space.sm, marginTop: space.md }}>
        <Text role="overline" color={theme.color.textTertiary}>
          Growing on purpose
        </Text>
        {/* DESIGN GAP — PRD P2 "Weakness Growth Tracker"; no mock design. */}
        <Card style={{ gap: space.xl }}>
          <Text role="body" color={theme.color.textSecondary}>
            Rate yourself each week. It’s for you, not a report card.
          </Text>
          {growthHabits.map((habit) => (
            <View key={habit.id} style={{ gap: space.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text role="bodyStrong" style={{ flex: 1 }}>
                  {habit.label}
                </Text>
                <Text role="caption" tabular color={theme.color.textSecondary}>
                  {habit.rating}/5
                </Text>
              </View>
              <ProgressBar value={habit.rating / 5} color={palette.brand.iris} height={6} />
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable
                    key={n}
                    accessibilityRole="button"
                    accessibilityLabel={`Rate ${habit.label} ${n} of 5`}
                    onPress={() => rateHabit(habit.id, n)}
                    style={{
                      flex: 1,
                      minHeight: 36,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: radius.sm,
                      borderCurve: 'continuous',
                      backgroundColor:
                        n <= habit.rating ? palette.brand.irisSoft : theme.color.surfaceSunken,
                    }}
                  >
                    <Text
                      role="caption"
                      tabular
                      color={n <= habit.rating ? palette.brand.iris : theme.color.textTertiary}
                    >
                      {n}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </Card>
      </View>
    </Screen>
  );
}
