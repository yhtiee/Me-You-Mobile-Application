import { useEffect } from 'react';
import type { DimensionValue } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/components/providers/theme-provider';
import { radius } from '@/constants/tokens';

type Props = {
  width?: DimensionValue;
  height?: number;
  /** Defaults to a pill for short bars, matching the text they stand in for. */
  round?: number;
  /**
   * Override the block fill. Needed on coloured surfaces — a sunken-grey block
   * on the gradient banner reads as a rendering fault, not as a placeholder.
   */
  color?: string;
};

/**
 * A placeholder block that breathes.
 *
 * Opacity, not a moving shimmer gradient: a sweep needs a masked gradient per
 * block and reads as its own animation competing with the content that lands a
 * moment later. A slow pulse says "not yet" without asking to be watched.
 *
 * Skeletons are only ever drawn for a *first* load. A refetch behind data that
 * is already on screen keeps the data — replacing filled-in content with grey
 * boxes on every focus is worse than a half-second of slightly stale numbers.
 */
export function Skeleton({ width = '100%', height = 14, round, color }: Props) {
  const theme = useTheme();
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 780, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      // One `accessible` node per skeleton group would be better, but each block
      // is decorative and the group is announced by the screen it sits on.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: round ?? radius.sm,
          borderCurve: 'continuous',
          backgroundColor: color ?? theme.color.surfaceSunken,
        },
        animatedStyle,
      ]}
    />
  );
}
