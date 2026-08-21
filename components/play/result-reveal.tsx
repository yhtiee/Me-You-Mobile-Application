import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Confetti } from '@/components/play/confetti';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { motion, radius, shadow, space } from '@/constants/tokens';
import type { PlayGameKey } from '@/constants/tokens';

type Props = {
  game: PlayGameKey;
  /** Small label above the result — "The wheel says", "Result". */
  kicker: string;
  /** The answer itself. Kept short; this is set at title size. */
  result: string;
  /** Optional line under the result, e.g. a nudge about what to do next. */
  note?: string;
  /** Changes whenever a *new* result lands, re-firing the entrance. */
  revision: number;
  /** Suppresses confetti for results that are not a win (a raincheck, a miss). */
  celebrate?: boolean;
  children?: React.ReactNode;
};

/**
 * The moment every Play game builds to.
 *
 * All six games used to end in the same flat `Card` with an overline and a line
 * of text, which made a coin flip and a trivia score feel identical — and made
 * neither feel like anything. This is one component so that the payoff is
 * consistent *and* actually a payoff: the card scales in past its resting size,
 * the result counts up out of a blur of motion, and confetti fires once.
 *
 * It is deliberately not a modal. A dialog would demand a dismissal for a
 * result the user can simply read and act on, and on the instant games it would
 * put a tap between "flip" and "flip again".
 */
export function ResultReveal({
  game,
  kicker,
  result,
  note,
  revision,
  celebrate = true,
  children,
}: Props) {
  const theme = useTheme();
  const tint = theme.play[game];

  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  /**
   * Measured rather than assumed: the burst has to span the card, and the card
   * is whatever width the screen gutter leaves it. Zero until the first layout,
   * which is fine — the confetti cannot fire before the card exists.
   */
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (revision === 0) return;

    opacity.value = withTiming(1, { duration: motion.tap.ms * 2 });
    // Overshoot then settle. The tokens file already fixes the overshoot at 4%
    // for reward motion, so this is the same gesture the streak badge makes.
    scale.value = withSequence(
      withTiming(1 + motion.reward.overshoot, {
        duration: motion.reward.ms * 0.6,
        easing: Easing.out(Easing.back(1.4)),
      }),
      withTiming(1, { duration: motion.reward.ms * 0.4, easing: Easing.out(Easing.quad) })
    );
  }, [revision, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      // Announced as one unit — a screen reader should say the whole outcome,
      // not walk the kicker, the result and the note as three separate nodes.
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${kicker}. ${result}.${note ? ` ${note}` : ''}`}
      style={[
        {
          backgroundColor: tint.bg,
          borderRadius: radius.lg,
          borderCurve: 'continuous',
          padding: space.xl,
          gap: space.xs,
          alignItems: 'center',
          boxShadow: shadow.s2,
          overflow: 'hidden',
        },
        animatedStyle,
      ]}
    >
      {celebrate && width > 0 ? <Confetti trigger={revision} width={width} /> : null}

      <Text role="overline" color={tint.muted}>
        {kicker}
      </Text>
      <Text role="title2" center color={tint.fg}>
        {result}
      </Text>
      {note ? (
        <Text role="caption" center color={tint.muted} style={{ marginTop: space.xs }}>
          {note}
        </Text>
      ) : null}
      {children ? <View style={{ marginTop: space.md }}>{children}</View> : null}
    </Animated.View>
  );
}
