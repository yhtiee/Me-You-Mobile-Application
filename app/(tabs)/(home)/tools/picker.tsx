import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
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
import { useTheme } from '@/components/providers/theme-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { MOVIE_DECADES, MOVIE_GENRES } from '@/constants/movies';
import { gradients, radius, shadow, space } from '@/constants/tokens';
import { usePicker } from '@/hooks/use-play';

const SWIPE_THRESHOLD = 110;
const CARD_HEIGHT = 440;

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
  const {
    partner,
    card,
    index,
    total,
    remaining,
    genre,
    decade,
    changeGenre,
    changeDecade,
    canRewind,
    rewind,
    swipe,
    restart,
    loading,
  } = usePicker();

  const x = useSharedValue(0);
  const y = useSharedValue(0);

  const finish = async (liked: boolean) => {
    const swipedCard = card;
    const matched = await swipe(liked);
    x.value = 0;
    y.value = 0;

    if (matched) {
      if (process.env.EXPO_OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.push({
        pathname: '/match',
        params: {
          title: swipedCard?.title ?? '',
          imageUrl: swipedCard?.imageUrl ?? '',
          meta: swipedCard?.meta ?? '',
          rating: swipedCard?.rating ? String(swipedCard.rating) : '',
        },
      });
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

  if (loading) {
    return <PickerSkeleton />;
  }

  return (
    <Screen gap={space.xl}>
      <GameIntro game="picker" />

      {/* Genre & Era Filters */}
      <View style={{ gap: space.sm }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space.sm, paddingHorizontal: 2 }}
        >
          {MOVIE_GENRES.map((g) => {
            const active = genre === g.id;
            return (
              <Pressable
                key={String(g.id)}
                accessibilityRole="button"
                onPress={() => changeGenre(g.id)}
                style={{
                  paddingHorizontal: space.md,
                  paddingVertical: space.sm,
                  borderRadius: radius.pill,
                  borderWidth: 1.5,
                  borderColor: active ? theme.playAccent.picker : theme.color.border,
                  backgroundColor: active ? theme.tint.iris.bg : theme.color.surface,
                }}
              >
                <Text
                  role="caption"
                  color={active ? theme.tint.iris.fg : theme.color.textSecondary}
                  style={{ fontWeight: active ? '700' : '500' }}
                >
                  {g.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space.xs, paddingHorizontal: 2 }}
        >
          {MOVIE_DECADES.map((d) => {
            const active = decade === d.id;
            return (
              <Pressable
                key={d.id}
                accessibilityRole="button"
                onPress={() => changeDecade(d.id)}
                style={{
                  paddingHorizontal: space.sm,
                  paddingVertical: 3,
                  borderRadius: radius.pill,
                  backgroundColor: active ? theme.color.textPrimary : 'transparent',
                }}
              >
                <Text
                  role="caption"
                  tabular
                  color={active ? theme.color.bgBase : theme.color.textTertiary}
                  style={{ fontSize: 11, fontWeight: active ? '600' : '400' }}
                >
                  {d.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

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
                  {/* Poster thumbnail or brand gradient */}
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: theme.color.surfaceSunken,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {card.imageUrl ? (
                      <Image
                        source={{ uri: card.imageUrl }}
                        contentFit="cover"
                        transition={250}
                        style={{ width: '100%', height: '100%' }}
                      />
                    ) : (
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
                    )}

                    {/* Star Rating Badge */}
                    {card.rating ? (
                      <View
                        style={{
                          position: 'absolute',
                          top: space.md,
                          right: space.md,
                          backgroundColor: 'rgba(0,0,0,0.72)',
                          paddingHorizontal: space.sm,
                          paddingVertical: 3,
                          borderRadius: radius.pill,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        <Text
                          role="caption"
                          tabular
                          color="#F59E0B"
                          style={{ fontWeight: '800', fontSize: 12 }}
                        >
                          ★
                        </Text>
                        <Text
                          role="caption"
                          tabular
                          color="#FFFFFF"
                          style={{ fontWeight: '700', fontSize: 12 }}
                        >
                          {card.rating.toFixed(1)}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={{ padding: space.lg, gap: space.xs }}>
                    <Text role="title3" numberOfLines={1}>
                      {card.title}
                    </Text>
                    <Text role="caption" color={theme.color.textSecondary} numberOfLines={1}>
                      {card.meta}
                    </Text>
                    {card.overview ? (
                      <Text
                        role="caption"
                        color={theme.color.textTertiary}
                        numberOfLines={2}
                        style={{ marginTop: 2 }}
                      >
                        {card.overview}
                      </Text>
                    ) : null}
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
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          {canRewind ? (
            <View style={{ width: 56 }}>
              <Button
                label="↩"
                variant="neutral"
                full
                onPress={rewind}
              />
            </View>
          ) : null}
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

      {/* TMDB's API terms require this notice wherever its data is shown. */}
      <Text role="caption" center color={theme.color.textSecondary}>
        Movie data from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
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

function PickerSkeleton() {
  return (
    <Screen gap={space.xl}>
      <GameIntro game="picker" />

      {/* Filter chips placeholder */}
      <View style={{ gap: space.sm }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space.sm, paddingHorizontal: 2 }}
        >
          {[96, 110, 100, 92, 105].map((w, i) => (
            <Skeleton key={i} width={w} height={34} round={radius.pill} />
          ))}
        </ScrollView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space.xs, paddingHorizontal: 2 }}
        >
          {[60, 80, 55, 55, 75].map((w, i) => (
            <Skeleton key={i} width={w} height={20} round={radius.pill} />
          ))}
        </ScrollView>
      </View>

      {/* Card placeholder */}
      <View style={{ height: CARD_HEIGHT + 24, justifyContent: 'center' }}>
        <Card padded={false} style={{ height: CARD_HEIGHT, overflow: 'hidden', borderRadius: radius.xl }}>
          <Skeleton width="100%" height={290} round={0} />
          <View style={{ padding: space.lg, gap: space.sm }}>
            <Skeleton width="65%" height={20} />
            <Skeleton width="40%" height={14} />
            <Skeleton width="90%" height={12} />
            <Skeleton width="75%" height={12} />
          </View>
        </Card>
      </View>

      {/* Action buttons placeholder */}
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <View style={{ flex: 1 }}>
          <Skeleton width="100%" height={48} round={radius.md} />
        </View>
        <View style={{ flex: 1 }}>
          <Skeleton width="100%" height={48} round={radius.md} />
        </View>
      </View>
    </Screen>
  );
}
