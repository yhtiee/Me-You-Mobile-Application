import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { useAuth } from '@/components/providers/auth-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { curve, motion, space } from '@/constants/tokens';

const AnimatedImage = Animated.createAnimatedComponent(Image);

/** How long the mark holds before the next screen takes over. */
const HOLD_MS = 2000;

/**
 * Brand intro — the first thing on a cold start, ahead of the walkthrough.
 *
 * The logo is already the wordmark, heart and all, so there is deliberately no
 * "Me&u" set in type underneath it: that would render the name twice.
 *
 * The box is tall because the asset is mostly glow. The lettering occupies
 * roughly 9% of a 1024x1536 canvas, so a modest box would shrink the words to
 * nothing while the halo did all the work.
 */
export default function Intro() {
  const theme = useTheme();
  const { status, pairing } = useAuth();
  const enter = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    enter.value = withTiming(1, {
      duration: motion.screen.ms * 2,
      easing: Easing.bezier(...curve.screen),
    });

    // One soft beat once it has landed — a heartbeat, for an app about a pair.
    pulse.value = withDelay(
      560,
      withSequence(
        withTiming(1.04, { duration: 260, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 320, easing: Easing.inOut(Easing.quad) })
      )
    );
  }, [enter, pulse]);

  useEffect(() => {
    if (status === 'restoring') return;

    const timer = setTimeout(() => {
      if (status === 'signed-in') {
        if (pairing === 'paired') {
          router.replace('/(tabs)/(home)');
        } else {
          router.replace('/pair');
        }
      } else {
        router.replace('/walkthrough');
      }
    }, HOLD_MS);

    return () => clearTimeout(timer);
  }, [status, pairing]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: (0.86 + enter.value * 0.14) * pulse.value }],
  }));

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.color.bgBase,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        pointerEvents="none"
        style={{ position: 'absolute', inset: 0, experimental_backgroundImage: theme.wash }}
      />

      <AnimatedImage
        source={require('@/assets/images/logo.png')}
        style={[{ width: '100%', height: 420 }, logoStyle]}
        contentFit="contain"
        accessibilityLabel="Me&u"
        accessibilityIgnoresInvertColors
      />

      <Animated.View
        entering={FadeInDown.delay(620).duration(motion.screen.ms + 160)}
        style={{ alignItems: 'center', marginTop: -space.xxl }}
      >
        <Text role="body" center color={theme.color.textSecondary}>
          Two people, one place.
        </Text>
      </Animated.View>
    </View>
  );
}
