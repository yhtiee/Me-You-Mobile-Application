import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { gutter, radius, space } from '@/constants/tokens';

type Props = {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  /** Rendered pinned at the bottom of the dialog. */
  actions?: React.ReactNode;
};

/**
 * radius.xl 26, centred, 24px padding, 24px page margin.
 *
 * Presented via a transparent-modal route so the system handles the backdrop
 * and dismissal; tapping the scrim pops the route.
 */
export function Dialog({ title, subtitle, children, actions }: Props) {
  const theme = useTheme();

  return (
    <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: gutter + 4 }}>
      <Animated.View
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(140)}
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(28,18,34,0.42)' }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={{ flex: 1 }}
          onPress={() => router.back()}
        />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.springify().damping(18)}
        style={{
          backgroundColor: theme.color.surface,
          borderRadius: radius.xl,
          borderCurve: 'continuous',
          padding: space.xxl,
          gap: space.md,
        }}
      >
        <Text role="title3">{title}</Text>
        {subtitle ? (
          <Text role="body" color={theme.color.textSecondary}>
            {subtitle}
          </Text>
        ) : null}
        {children}
        {actions ? <View style={{ gap: space.sm, marginTop: space.xs }}>{actions}</View> : null}
      </Animated.View>
    </View>
  );
}
