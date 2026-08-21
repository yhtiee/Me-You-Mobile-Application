import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { GameIntro, GameScore } from '@/components/play/game-intro';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { CloseIcon } from '@/components/ui/icons';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useTheme } from '@/components/providers/theme-provider';
import { useGrowth } from '@/hooks/use-play';
import { GROWTH_SUGGESTIONS } from '@/constants/play';
import { layout, radius, space } from '@/constants/tokens';

/**
 * Weakness Growth Tracker (PRD Module 2, P2).
 *
 * Split out of the trivia screen, where it had been sharing a route with a quiz
 * it has nothing to do with — one is a game you play at each other, this is a
 * private admission you make to yourself.
 *
 * Which is why the rating control changed. A row of five numbered boxes is a
 * survey instrument; it asks you to score yourself out of five and gives no
 * indication what a 3 is supposed to mean. The labelled scale below says what
 * each step *is* ("Rarely", "Getting there", "Most days"), so the answer is a
 * description rather than a grade — and the card never shows a total, because
 * the moment this has a score it becomes the report card it promises not to be.
 */
const SCALE: { value: number; label: string }[] = [
  { value: 1, label: 'Rarely' },
  { value: 2, label: 'Sometimes' },
  { value: 3, label: 'Getting there' },
  { value: 4, label: 'Most days' },
  { value: 5, label: 'Nailed it' },
];

export default function GrowthTool() {
  const theme = useTheme();
  const { habits, rate, add, remove, loading, error, refetch } = useGrowth();

  const [draft, setDraft] = useState('');

  const rated = habits.filter((h) => h.rating != null).length;
  const taken = new Set(habits.map((h) => h.label.toLowerCase()));
  const suggestions = GROWTH_SUGGESTIONS.filter((s) => !taken.has(s.toLowerCase()));

  if (error) {
    return (
      <Screen gap={space.xl}>
        <GameIntro game="growth" />
        <ErrorState message={error} onRetry={refetch} />
      </Screen>
    );
  }

  return (
    <Screen gap={space.xl}>
      <GameIntro
        game="growth"
        trailing={<GameScore game="growth" value={`${rated}/${habits.length}`} label="rated" />}
      />

      {loading ? (
        <Card style={{ gap: space.lg }}>
          <Skeleton height={18} width="60%" />
          <Skeleton height={layout.minTarget} round={radius.sm} />
        </Card>
      ) : null}

      {!loading && habits.length === 0 ? (
        <Card style={{ gap: space.md }}>
          <Text role="cardTitle">Nothing here yet</Text>
          <Text role="body" color={theme.color.textSecondary}>
            Name one thing you’re working on. Start with a suggestion, or write
            your own — either way it stays private to you.
          </Text>
        </Card>
      ) : null}

      {habits.map((habit) => {
        const current = SCALE.find((s) => s.value === habit.rating);

        return (
          <Card key={habit.id} style={{ gap: space.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
              <View style={{ flex: 1, gap: space.xs }}>
                <Text role="cardTitle">{habit.label}</Text>
                <Text role="caption" color={theme.color.textSecondary}>
                  {current ? `This week: ${current.label.toLowerCase()}` : 'Not rated this week'}
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${habit.label}`}
                hitSlop={space.sm}
                onPress={() => remove(habit.id)}
                style={({ pressed }) => ({
                  width: 32,
                  height: 32,
                  borderRadius: radius.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.color.surfaceSunken,
                  opacity: pressed ? 0.5 : 1,
                })}
              >
                <CloseIcon color={theme.color.textSecondary} />
              </Pressable>
            </View>

            {/*
             * Segments, not dots on a track. Each is its own 48px target with
             * its own label, which is the only way a five-point scale is both
             * usable with a thumb and readable without a legend.
             */}
            <View style={{ flexDirection: 'row', gap: space.xs }}>
              {SCALE.map((step) => {
                // `rating` is null until rated for the first time, which is a
                // real state and not a zero: an unrated habit shows an empty
                // scale, not "Rarely".
                const active = habit.rating != null && habit.rating >= step.value;
                const exact = habit.rating === step.value;

                return (
                  <Pressable
                    key={step.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: exact }}
                    accessibilityLabel={`${habit.label}: ${step.label}`}
                    onPress={() => {
                      rate(habit.id, step.value);
                      if (process.env.EXPO_OS === 'ios') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                    }}
                    style={{
                      flex: 1,
                      minHeight: layout.minTarget,
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: space.xs,
                      paddingVertical: space.sm,
                      borderRadius: radius.sm,
                      borderCurve: 'continuous',
                      backgroundColor: active
                        ? theme.play.growth.bg
                        : theme.color.surfaceSunken,
                      borderWidth: 1.5,
                      borderColor: exact ? theme.playAccent.growth : 'transparent',
                    }}
                  >
                    <View
                      style={{
                        width: '100%',
                        height: 4,
                        borderRadius: radius.pill,
                        backgroundColor: active
                          ? theme.playAccent.growth
                          : theme.color.border,
                      }}
                    />
                    <Text
                      role="caption"
                      center
                      numberOfLines={2}
                      color={active ? theme.play.growth.fg : theme.color.textTertiary}
                      style={{ fontSize: 10 }}
                    >
                      {step.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        );
      })}

      <Card style={{ gap: space.md }}>
        <Text role="cardTitle">Add something</Text>

        {suggestions.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {suggestions.map((label) => (
              <Button
                key={label}
                label={label}
                variant="chip"
                onPress={() => void add(label)}
              />
            ))}
          </View>
        ) : null}

        <TextField
          placeholder="Or write your own…"
          value={draft}
          onChangeText={setDraft}
          returnKeyType="done"
          onSubmitEditing={() => {
            void add(draft).then((ok) => {
              if (ok) setDraft('');
            });
          }}
        />
      </Card>

      <Text role="caption" center color={theme.color.textTertiary}>
        Only you see these. They’re never shown to your partner.
      </Text>
    </Screen>
  );
}
