import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Glyph } from '@/components/ui/glyph';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { motion, radius, shadow, space } from '@/constants/tokens';
import type { PlayGame } from '@/constants/play';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  game: PlayGame;
  /** Position in the grid — drives the entrance stagger only. */
  index: number;
  /**
   * Live one-liner under the tagline: "3 waiting", "12 flips". Absent while the
   * hub has nothing to say, which is most of the time on a fresh account.
   */
  stat?: string;
};

/**
 * One game in the hub grid.
 *
 * The old Play list was five full-width rows of white card, 52px emoji square,
 * title, body, chevron — visually identical to the Settings list, the To-do
 * list and the Wiki list. Nothing about it said "these are games".
 *
 * Three things change that here, in order of how much they matter: the tile is
 * *filled* with the game's own colour rather than sitting on white, so the grid
 * reads as six things instead of one list; it is a half-width square, so six
 * fit on a screen and the choice is visible without scrolling; and it arrives
 * with a stagger, which is the cheapest possible way to make a screen feel
 * assembled for you rather than just present.
 */
export function GameTile({ game, index, stat }: Props) {
  const theme = useTheme();
  const tint = theme.play[game.key];
  const isIos = process.env.EXPO_OS === 'ios';

  const scale = useSharedValue(1);
  const enter = useSharedValue(0);

  useEffect(() => {
    enter.value = withDelay(
      index * motion.stagger.ms,
      withTiming(1, { duration: motion.screen.ms, easing: Easing.out(Easing.cubic) })
    );
  }, [index, enter]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { scale: scale.value },
      // Rises the last 14px into place. Paired with the fade so a tile never
      // slides in fully opaque, which reads as a layout shift rather than an
      // entrance.
      { translateY: (1 - enter.value) * 14 },
    ],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={`${game.title}. ${game.tagline}.${stat ? ` ${stat}.` : ''}`}
      onPress={() => {
        if (isIos) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(game.href);
      }}
      onPressIn={() => {
        if (!isIos) return;
        scale.value = withTiming(0.96, { duration: motion.tap.ms });
      }}
      onPressOut={() => {
        if (!isIos) return;
        scale.value = withTiming(1, { duration: motion.tap.ms });
      }}
      android_ripple={{ color: 'rgba(34,26,43,0.10)', borderless: false }}
      style={[
        {
          flex: 1,
          minHeight: 148,
          padding: space.lg,
          borderRadius: radius.lg,
          borderCurve: 'continuous',
          backgroundColor: tint.bg,
          boxShadow: shadow.s1,
          overflow: 'hidden',
          justifyContent: 'space-between',
          gap: space.md,
        },
        animatedStyle,
      ]}
    >
      {/*
       * One glyph, whole.
       *
       * This used to be two: a 64px watermark bled off the top-right corner
       * under a 26px icon in the flow. The bleed was the point — but a glyph
       * deliberately cut by its own tile's `overflow: 'hidden'` reads as a
       * rendering fault rather than as texture, and the second copy underneath
       * meant the same emoji appeared twice on a 148px tile. So the watermark
       * is gone and the icon is the icon, sized up to carry the corner on its
       * own and sitting entirely inside the padding.
       */}
      <Glyph size={34}>{game.glyph}</Glyph>

      <View style={{ gap: space.xs }}>
        <Text role="cardTitle" color={tint.fg} numberOfLines={2}>
          {game.title}
        </Text>
        <Text role="caption" color={tint.muted} numberOfLines={2}>
          {stat ?? game.tagline}
        </Text>
      </View>
    </AnimatedPressable>
  );
}
