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

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useCouple } from '@/components/providers/couple-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { curve, gradients, motion, palette, space } from '@/constants/tokens';

const SIZE = 168;

/**
 * Argument settler (PRD Module 2).
 *
 * The outcome is decided before the animation starts and the spin merely
 * reveals it — same as the reference mock. Rotation runs on the UI thread so
 * the 60fps requirement holds without a JS-thread frame loop.
 */
export default function CoinTool() {
  const theme = useTheme();
  const { partner } = useCouple();
  const [result, setResult] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);

  const angle = useSharedValue(0);

  const settle = (heads: boolean) => {
    setSpinning(false);
    setResult(heads ? 'You go first this time' : `${partner.name} goes first this time`);
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const flip = () => {
    if (spinning) return;
    const heads = Math.random() < 0.5;
    const spins = 5 + Math.floor(Math.random() * 2);

    setSpinning(true);
    setResult(null);
    angle.value = withTiming(
      angle.value + spins * 360 + (heads ? 0 : 180) - (angle.value % 360),
      { duration: motion.coin.ms, easing: Easing.bezier(...curve.coin) },
      (finished) => {
        if (finished) runOnJS(settle)(heads);
      },
    );
  };

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${angle.value}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${angle.value + 180}deg` }],
  }));

  return (
    <Screen gap={space.xl}>
      <View style={{ gap: space.sm }}>
        <Text role="title2">Who’s the bigger person?</Text>
        <Text role="body" color={theme.color.textSecondary}>
          No fault, no scorekeeping. Just a coin, and then you both move on.
        </Text>
      </View>

      <View style={{ height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[faceStyle, { experimental_backgroundImage: gradients.coin }, frontStyle]}>
          <Text role="display" color="#fff">
            You
          </Text>
        </Animated.View>
        <Animated.View style={[faceStyle, { backgroundColor: palette.brand.iris }, backStyle]}>
          <Text role="display" color="#fff" style={{ fontSize: 28 }} numberOfLines={1}>
            {partner.name}
          </Text>
        </Animated.View>
      </View>

      {result ? (
        <Card style={{ alignItems: 'center', gap: space.xs }}>
          <Text role="overline" color={theme.color.textTertiary}>
            Result
          </Text>
          <Text role="title3" center>
            {result}
          </Text>
        </Card>
      ) : (
        <Text role="caption" center color={theme.color.textTertiary}>
          {spinning ? 'Spinning…' : 'Tap below when you’re both ready.'}
        </Text>
      )}

      <Button label={result ? 'Flip again' : 'Flip the coin'} full disabled={spinning} onPress={flip} />
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
  boxShadow: '0 12px 28px rgba(240,84,111,0.30)',
} as const;
