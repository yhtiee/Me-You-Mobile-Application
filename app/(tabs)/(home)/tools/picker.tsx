import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { GameIntro } from '@/components/play/game-intro';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { usePicker } from '@/hooks/use-play';
import { gradients, radius, shadow, space } from '@/constants/tokens';

const SWIPE_THRESHOLD = 110;
const CARD_HEIGHT = 340;

/**
 * Movie & Meal Picker (PRD Module 2). "Alerts only when both swipe right" is
 * a server-side coincidence check; here the hook reports whether a swipe
 * completed a match, and the screen routes to the match dialog when it did.
 *
 * The redesign is mostly one change: there is a *stack*. The old screen
 * rendered a single card, so a swipe threw it off the edge and left an empty
 * hole for a frame before the next one appeared from nowhere. Two cards behind
 * the live one — scaled down and offset, rising as the top card leaves — is
 * what makes a deck feel like a deck, and it costs two static views.
 */
export default function PickerTool() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { partner, card, index, total, remaining, swipe, restart } = usePicker();

  const x = useSharedValue(0);
  const y = useSharedValue(0);

  const finish = async (liked: boolean) => {
    const matched = await swipe(liked);
    x.value = 0;
    y.value = 0;

    if (matched) {
      if (process.env.EXPO_OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.push('/match');
    } else if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const commit = (liked: boolean) => {
    x.value = withTiming(liked ? width : -width, { duration: 200 }, (done) => {
      if (done) runOnJS(finish)(liked);
    });
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      x.value = e.translationX;
      y.value = e.translationY;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
        const liked = e.translationX > 0;
        x.value = withTiming(liked ? width : -width, { duration: 200 }, (done) => {
          if (done) runOnJS(finish)(liked);
        });
      } else {
        x.value = withSpring(0);
        y.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${(x.value / width) * 14}deg` },
    ],
  }));

  const likeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
    transform: [
      { rotate: '-12deg' },
      { scale: interpolate(x.value, [0, SWIPE_THRESHOLD], [0.8, 1], Extrapolation.CLAMP) },
    ],
  }));
  const passStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, -SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
    transform: [
      { rotate: '12deg' },
      { scale: interpolate(x.value, [0, -SWIPE_THRESHOLD], [0.8, 1], Extrapolation.CLAMP) },
    ],
  }));

  /**
   * The card immediately behind rises toward full size as the top one is
   * dragged away — tied to how far the drag has gone, not to a timer, so
   * pulling a card halfway and letting go runs the whole thing backwards.
   */
  const nextStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      Math.abs(x.value),
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ scale: 0.94 + progress * 0.06 }, { translateY: 14 - progress * 14 }],
      opacity: 0.72 + progress * 0.28,
    };
  });

  return (
    <Screen gap={space.xl}>
      <GameIntro game="picker" />

      <View style={{ height: CARD_HEIGHT + 24, justifyContent: 'center' }}>
        {!card ? (
          <EmptyState label="That’s everything for now — check back later" />
        ) : (
          <>
            {/* Third card down. Static: it never becomes interactive without a
                render in between, so animating it buys nothing. */}
            {remaining > 2 ? (
              <View
                style={{
                  ...deckStyle,
                  backgroundColor: theme.color.surface,
                  transform: [{ scale: 0.88 }, { translateY: 28 }],
                  opacity: 0.5,
                }}
              />
            ) : null}

            {remaining > 1 ? (
              <Animated.View
                style={[deckStyle, { backgroundColor: theme.color.surface }, nextStyle]}
              />
            ) : null}

            <GestureDetector gesture={pan}>
              <Animated.View style={[{ height: CARD_HEIGHT }, cardStyle]}>
                <View
                  style={{
                    flex: 1,
                    borderRadius: radius.xl,
                    borderCurve: 'continuous',
                    overflow: 'hidden',
                    backgroundColor: theme.color.surface,
                    boxShadow: shadow.s2,
                  }}
                >
                  {/*
                   * A gradient panel where a poster would go. There is no
                   * artwork in the data and inventing a placeholder image would
                   * be worse than admitting it — so the top two-thirds is the
                   * brand sweep with the title's own initial set large in it,
                   * which gives each card a distinct face without pretending to
                   * be a poster.
                   */}
                  <View
                    style={{
                      flex: 1,
                      experimental_backgroundImage: gradients.play,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text role="display" color="rgba(255,255,255,0.9)" style={{ fontSize: 76 }}>
                      {card.title.charAt(0)}
                    </Text>
                  </View>

                  <View style={{ padding: space.xl, gap: space.xs }}>
                    <Text role="title2" numberOfLines={2}>
                      {card.title}
                    </Text>
                    <Text role="body" color={theme.color.textSecondary}>
                      {card.meta}
                    </Text>
                  </View>

                  <Animated.View
                    style={[stampStyle, { borderColor: theme.color.success }, likeStyle]}
                  >
                    <Text role="title3" color={theme.color.success}>
                      YES
                    </Text>
                  </Animated.View>
                  <Animated.View
                    style={[
                      stampStyle,
                      { borderColor: theme.color.danger, right: space.xl, left: undefined },
                      passStyle,
                    ]}
                  >
                    <Text role="title3" color={theme.color.danger}>
                      NOPE
                    </Text>
                  </Animated.View>
                </View>
              </Animated.View>
            </GestureDetector>
          </>
        )}
      </View>

      {card ? (
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Button label="Pass" variant="neutral" full onPress={() => commit(false)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Yes" full onPress={() => commit(true)} />
          </View>
        </View>
      ) : (
        <Button label="Start over" variant="secondary" full onPress={restart} />
      )}

      {/* Dots rather than "3 of 5". A deck this short has a visible end, and
          showing it as a shape means the count is read without being parsed. */}
      <View style={{ flexDirection: 'row', gap: space.sm, justifyContent: 'center' }}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={{
              width: i === index ? 20 : 6,
              height: 6,
              borderRadius: radius.pill,
              backgroundColor:
                i === index
                  ? theme.playAccent.picker
                  : i < index
                    ? theme.color.textTertiary
                    : theme.color.border,
            }}
          />
        ))}
      </View>

      <Text role="caption" center color={theme.color.textTertiary}>
        {partner?.name ?? 'Your partner'} never sees the ones you pass on.
      </Text>
    </Screen>
  );
}

const deckStyle = {
  position: 'absolute',
  left: 0,
  right: 0,
  height: CARD_HEIGHT,
  borderRadius: radius.xl,
  borderCurve: 'continuous',
  boxShadow: shadow.s1,
} as const;

const stampStyle = {
  position: 'absolute',
  top: space.xl,
  left: space.xl,
  borderWidth: 3,
  borderRadius: radius.sm,
  paddingHorizontal: space.md,
  paddingVertical: space.xs,
  backgroundColor: 'rgba(255,255,255,0.92)',
} as const;
