import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Glyph } from '@/components/ui/glyph';
import { Text } from '@/components/ui/text';
import { gradients, motion, radius, shadow, space } from '@/constants/tokens';
import type { PlayGame } from '@/constants/play';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  game: PlayGame;
  /** Overline above the pitch. "Today's pick", or a reason it was chosen. */
  kicker: string;
};

/**
 * The one thing on the Play screen that tells you what to do.
 *
 * Six equally-weighted tiles is a menu, and a menu is a decision — which is the
 * exact thing this whole feature exists to spare a couple. So the hub opens
 * with a single suggestion, picked from the date so both partners see the same
 * one, and the grid below it is for when you have your own idea.
 *
 * White text throughout, on `gradients.play`, whose stops and midpoints all
 * clear 4.5:1 against white. See the token for why the amber end is darkened.
 */
export function PlayHero({ game, kicker }: Props) {
  const isIos = process.env.EXPO_OS === 'ios';

  const scale = useSharedValue(1);
  const glyph = useSharedValue(0);

  useEffect(() => {
    /*
     * A slow, small tilt on the glyph — 3 degrees each way over 2.6s.
     *
     * The hero is the only thing on this screen that moves on its own, and it
     * has to be at the very bottom of what counts as motion: this sits under a
     * scroll view a user may be reading past. Anything faster or wider becomes
     * a thing you have to look away from.
     */
    glyph.value = withRepeat(
      withSequence(
        withTiming(1, { duration: motion.idle.ms / 2, easing: Easing.inOut(Easing.quad) }),
        withTiming(-1, { duration: motion.idle.ms / 2, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
  }, [glyph]);

  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glyphStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${glyph.value * 3}deg` }, { scale: 1 + Math.abs(glyph.value) * 0.03 }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={`${kicker}: ${game.title}. ${game.invitation}`}
      onPress={() => {
        if (isIos) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push(game.href);
      }}
      onPressIn={() => {
        if (!isIos) return;
        scale.value = withTiming(0.98, { duration: motion.tap.ms });
      }}
      onPressOut={() => {
        if (!isIos) return;
        scale.value = withTiming(1, { duration: motion.tap.ms });
      }}
      style={[
        {
          experimental_backgroundImage: gradients.play,
          borderRadius: radius.xl,
          borderCurve: 'continuous',
          padding: space.xl,
          gap: space.lg,
          boxShadow: shadow.hero,
          overflow: 'hidden',
        },
        pressStyle,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
        <Animated.View style={glyphStyle}>
          <Glyph size={44}>{game.glyph}</Glyph>
        </Animated.View>

        <View style={{ flex: 1, gap: space.xs }}>
          {/* 82% white, not a separate token: an overline at 10px in solid
              white over a gradient this saturated vibrates. The alpha sits it
              back a step without dropping it under 4.5:1. */}
          <Text role="overline" color="rgba(255,255,255,0.82)">
            {kicker}
          </Text>
          <Text role="title3" color="#fff">
            {game.title}
          </Text>
        </View>
      </View>

      <Text role="body" color="rgba(255,255,255,0.92)">
        {game.invitation}
      </Text>

      {/* A label, not a nested Pressable — the whole card is the target. A real
          button inside a button gives screen readers two overlapping actions
          for one destination. */}
      <View
        style={{
          alignSelf: 'flex-start',
          paddingVertical: space.sm,
          paddingHorizontal: space.lg,
          borderRadius: radius.pill,
          backgroundColor: 'rgba(255,255,255,0.20)',
        }}
      >
        <Text role="button" color="#fff">
          Play now
        </Text>
      </View>
    </AnimatedPressable>
  );
}
