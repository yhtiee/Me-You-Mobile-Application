import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { GameIntro } from '@/components/play/game-intro';
import { ResultReveal } from '@/components/play/result-reveal';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useTheme } from '@/components/providers/theme-provider';
import { useCoinGame } from '@/hooks/use-play';
import { curve, gradients, motion, palette, radius, space } from '@/constants/tokens';

const SIZE = 176;

/**
 * Argument settler (PRD Module 2).
 *
 * The outcome is decided before the animation starts and the spin merely
 * reveals it — same as the reference mock. Rotation runs on the UI thread so
 * the 60fps requirement holds without a JS-thread frame loop.
 *
 * Two things the flat version was missing. First, a coin with no stated stake
 * is just a coin: the "what are we settling?" field turns an abstract result
 * into "Sarah goes first — taking the bins out", which is the sentence people
 * actually needed. Second, a tally, because the honest objection to a coin flip
 * is "you always win these" and the only answer to it is the record.
 */
export default function CoinTool() {
  const theme = useTheme();
  const { you, partner, flip, history, tally, error, refetch } = useCoinGame();

  // Every line on this screen names them. One fallback here beats six, and the
  // coin has to be flippable before the profiles have loaded.
  const partnerName = partner?.name ?? 'Your partner';

  const [stake, setStake] = useState('');
  const [result, setResult] = useState<'you' | 'partner' | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [revision, setRevision] = useState(0);

  const angle = useSharedValue(0);

  const settle = (winner: 'you' | 'partner') => {
    setSpinning(false);
    setResult(winner);
    setRevision((n) => n + 1);
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const onFlip = () => {
    if (spinning) return;
    const winner = flip(stake.trim() || null);
    const spins = 5 + Math.floor(Math.random() * 2);

    setSpinning(true);
    setResult(null);
    angle.value = withTiming(
      angle.value + spins * 360 + (winner === 'you' ? 0 : 180) - (angle.value % 360),
      { duration: motion.coin.ms, easing: Easing.bezier(...curve.coin) },
      (finished) => {
        if (finished) runOnJS(settle)(winner);
      }
    );
  };

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${angle.value}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${angle.value + 180}deg` }],
  }));

  const trimmedStake = stake.trim();
  const winnerName = result === 'you' ? 'You' : partnerName;

  return (
    <Screen gap={space.xl}>
      <GameIntro game="coin" />

      {/* Non-blocking. A failed history read costs the tally at the bottom of
          the screen; the coin above it still works, so this must not take the
          place of the game the way a full-screen error state would. */}
      {error ? <ErrorState message={error} onRetry={refetch} /> : null}

      <TextField
        label="What are we settling?"
        placeholder="Who takes the bins out…"
        value={stake}
        onChangeText={setStake}
        returnKeyType="done"
      />

      <View style={{ height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          style={[faceStyle, { experimental_backgroundImage: gradients.coin }, frontStyle]}
        >
          <Text role="display" color="#fff" style={{ fontSize: 30 }} numberOfLines={1}>
            {you.name}
          </Text>
        </Animated.View>
        <Animated.View style={[faceStyle, { backgroundColor: palette.brand.iris }, backStyle]}>
          <Text role="display" color="#fff" style={{ fontSize: 30 }} numberOfLines={1}>
            {partnerName}
          </Text>
        </Animated.View>
      </View>

      {result ? (
        <ResultReveal
          game="coin"
          revision={revision}
          kicker={trimmedStake ? trimmedStake : 'The coin says'}
          result={`${winnerName} goes first`}
          note={
            result === 'you'
              ? 'Being the bigger person costs nothing and buys a lot.'
              : `${partnerName} is up. Let them know.`
          }
        />
      ) : (
        <Text role="caption" center color={theme.color.textTertiary}>
          {spinning ? 'Spinning…' : 'Tap below when you’re both ready.'}
        </Text>
      )}

      <Button
        label={result ? 'Flip again' : 'Flip the coin'}
        full
        disabled={spinning}
        onPress={onFlip}
      />

      {tally.total > 0 ? (
        <View style={{ gap: space.md }}>
          <Text role="overline" color={theme.color.textTertiary}>
            Last {tally.total}
          </Text>

          {/*
           * A row of dots, oldest on the right. A bar chart of two numbers is a
           * chart in the pejorative sense; the dots answer "has it been fair?"
           * at a glance, which is the only question this data can support.
           */}
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
            {history.slice(0, 5).map((entry) => (
              <View
                key={entry.id}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: radius.pill,
                  backgroundColor:
                    entry.winner === 'you' ? theme.person.you : theme.person.partner,
                }}
              />
            ))}
            <Text role="caption" color={theme.color.textSecondary} style={{ marginLeft: space.sm }}>
              {tally.you === tally.partner
                ? 'Dead even so far.'
                : tally.you > tally.partner
                  ? `You’ve gone first ${tally.you} of ${tally.total}.`
                  : `${partnerName} has gone first ${tally.partner} of ${tally.total}.`}
            </Text>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const faceStyle = {
  position: 'absolute',
  width: SIZE,
  height: SIZE,
  borderRadius: SIZE / 2,
  alignItems: 'center',
  justifyContent: 'center',
  backfaceVisibility: 'hidden',
  paddingHorizontal: space.lg,
  boxShadow: '0 12px 28px rgba(240,84,111,0.30)',
} as const;
