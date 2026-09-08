import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { motion, playAccents, radius } from '@/constants/tokens';

type Props = {
  /** Bump this to fire another burst. Nothing plays while it is 0. */
  trigger: number;
  /** Width of the area to scatter across. */
  width: number;
  count?: number;
};

const COLORS = [
  playAccents.coin,
  playAccents.wheel,
  playAccents.date,
  playAccents.picker,
  playAccents.trivia,
  playAccents.growth,
];

/**
 * A one-shot confetti burst.
 *
 * Twelve absolutely-positioned squares on a fixed random layout, each animating
 * a single `progress` value on the UI thread — no physics loop, no per-frame JS,
 * nothing retained after it lands. That is the whole reason it is hand-rolled
 * rather than a library: this plays on a screen that is simultaneously running a
 * 1.4s wheel spin, and the budget for "and also some confetti" is close to zero.
 *
 * The pieces are laid out once with `useMemo` and never re-randomised. Shuffling
 * them per burst would mean a new array identity on every render of the parent,
 * which is exactly the kind of thing that turns a decoration into a jank source.
 */
export function Confetti({ trigger, width, count = 12 }: Props) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        color: COLORS[i % COLORS.length],
        // Spread across the width with a little jitter, rather than pure random,
        // so a burst never clumps into one corner.
        left: ((i + 0.5) / count) * width + (Math.random() - 0.5) * (width / count),
        size: 6 + Math.random() * 6,
        drift: (Math.random() - 0.5) * 90,
        spin: (Math.random() - 0.5) * 720,
        delay: Math.random() * 120,
        fall: 150 + Math.random() * 90,
      })),
    [count, width]
  );

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}
    >
      {pieces.map((piece, i) => (
        <Piece key={i} {...piece} trigger={trigger} />
      ))}
    </View>
  );
}

type PieceProps = {
  trigger: number;
  color: string;
  left: number;
  size: number;
  drift: number;
  spin: number;
  delay: number;
  fall: number;
};

function Piece({ trigger, color, left, size, drift, spin, delay, fall }: PieceProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (trigger === 0) return;
    progress.set(0);
    progress.set(
      withDelay(
        delay,
        withTiming(1, {
          duration: motion.celebrate.ms,
          // Fast out, slow in — the burst leaves quickly and the fall settles,
          // which is what makes it read as thrown rather than dropped.
          easing: Easing.out(Easing.quad),
        })
      )
    );
  }, [trigger, delay, progress]);

  const style = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      // Held at zero before the first burst so twelve squares are not sitting
      // visible at the top of the card on mount.
      opacity: p === 0 || p > 0.85 ? 0 : 1,
      transform: [
        { translateY: -20 + p * fall },
        { translateX: p * drift },
        { rotate: `${p * spin}deg` },
        { scale: 0.6 + p * 0.4 },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left,
          width: size,
          height: size,
          borderRadius: radius.sm / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}
