import * as Haptics from 'expo-haptics';
import { Pressable, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { layout, motion, palette, radius, shadow, space } from '@/constants/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'premium'
  | 'neutral'
  | 'destructive'
  | 'chip';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  full?: boolean;
  left?: React.ReactNode;
  style?: ViewStyle;
};

/**
 * Press feedback follows the platform parity table: 0.96 scale + light haptic
 * on iOS, ripple and no scale on Android.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  full,
  left,
  style,
}: Props) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const isIos = process.env.EXPO_OS === 'ios';

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const spec = variantSpec(variant, theme.color.surface);
  const isChip = variant === 'chip';

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        if (!isIos) return;
        scale.value = withTiming(0.96, { duration: motion.tap.ms });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      onPressOut={() => {
        if (!isIos) return;
        scale.value = withTiming(1, { duration: motion.tap.ms });
      }}
      android_ripple={{ color: 'rgba(34,26,43,0.12)', borderless: false }}
      style={[
        {
          minHeight: isChip ? 34 : layout.minTarget,
          paddingVertical: isChip ? space.sm + 1 : space.lg,
          paddingHorizontal: isChip ? space.lg - 2 : space.xxxl - 2,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: space.sm,
          alignSelf: full ? 'stretch' : 'flex-start',
          backgroundColor: spec.bg,
          borderWidth: spec.borderColor ? 1.5 : 0,
          borderColor: spec.borderColor,
          boxShadow: spec.shadow,
          opacity: disabled ? 0.45 : 1,
          overflow: 'hidden',
        },
        animatedStyle,
        style,
      ]}
    >
      {left ? <View>{left}</View> : null}
      <Text role={isChip ? 'caption' : 'button'} color={spec.fg} style={isChip ? { fontFamily: 'Manrope_700Bold' } : undefined}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

function variantSpec(variant: ButtonVariant, surface: string) {
  switch (variant) {
    case 'primary':
      return { bg: palette.brand.rose, fg: '#fff', shadow: shadow.brand, borderColor: undefined };
    case 'secondary':
      return {
        bg: surface,
        fg: palette.brand.rose,
        shadow: undefined,
        borderColor: palette.brand.rose,
      };
    case 'premium':
      return { bg: palette.brand.iris, fg: '#fff', shadow: shadow.iris, borderColor: undefined };
    case 'neutral':
      return { bg: '#F7F4F8', fg: palette.light.textSecondary, shadow: undefined, borderColor: undefined };
    case 'destructive':
      return { bg: palette.light.danger, fg: '#fff', shadow: undefined, borderColor: undefined };
    case 'chip':
      return {
        bg: palette.brand.roseSoft,
        fg: palette.brand.rosePressed,
        shadow: undefined,
        borderColor: undefined,
      };
  }
}
