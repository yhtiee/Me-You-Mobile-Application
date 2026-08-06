import { View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';

import { useTheme } from '@/components/providers/theme-provider';
import { curve, motion, palette } from '@/constants/tokens';

type Props = {
  /** 0-1. */
  value: number;
  color?: string;
  /** Use the amber→rose XP gradient instead of a flat colour. */
  gradient?: string;
  height?: number;
  /** XP and reward bars animate with motion.reward; static bars don't. */
  animated?: boolean;
};

/** Track surface.sunken, 6-8px, radius 4. */
export function ProgressBar({
  value,
  color = palette.brand.amber,
  gradient,
  height = 8,
  animated = true,
}: Props) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(1, value));

  const fillStyle = useAnimatedStyle(() => ({
    width: animated
      ? withTiming(`${clamped * 100}%`, {
          duration: motion.reward.ms,
          easing: Easing.bezier(...curve.screen),
        })
      : `${clamped * 100}%`,
  }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{
        height,
        borderRadius: 4,
        backgroundColor: theme.color.surfaceSunken,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[
          {
            height: '100%',
            borderRadius: 4,
            backgroundColor: gradient ? undefined : color,
            experimental_backgroundImage: gradient,
          },
          fillStyle,
        ]}
      />
    </View>
  );
}
