import { router } from 'expo-router';
import { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { useTools } from '@/hooks/use-tools';
import { radius, space } from '@/constants/tokens';

const SWIPE_THRESHOLD = 110;

/**
 * Movie & Meal Picker (PRD Module 2). "Alerts only when both swipe right" is
 * a server-side coincidence check; here the mock marks which cards the partner
 * already liked, and a right-swipe on one of those opens the match dialog.
 */
export default function PickerTool() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { pickerCards } = useTools();
  const [index, setIndex] = useState(0);

  const card = pickerCards[index];
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  const advance = (liked: boolean) => {
    if (liked && card?.partnerLiked) router.push('/match');
    setIndex((i) => i + 1);
    x.value = 0;
    y.value = 0;
  };

  const commit = (liked: boolean) => {
    x.value = withTiming(liked ? width : -width, { duration: 180 }, (done) => {
      if (done) runOnJS(advance)(liked);
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
        x.value = withTiming(liked ? 500 : -500, { duration: 180 }, (done) => {
          if (done) runOnJS(advance)(liked);
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

  const likeStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, x.value / SWIPE_THRESHOLD) }));
  const passStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, -x.value / SWIPE_THRESHOLD) }));

  return (
    <Screen gap={space.xl}>
      <View style={{ gap: space.sm }}>
        <Text role="title2">Swipe, don’t debate</Text>
        <Text role="body" color={theme.color.textSecondary}>
          You each swipe on your own. We only say something when you both said yes.
        </Text>
      </View>

      <View style={{ height: 330, justifyContent: 'center' }}>
        {!card ? (
          <EmptyState label="That’s everything for now — check back later" />
        ) : (
          <GestureDetector gesture={pan}>
            <Animated.View style={cardStyle}>
              <Card style={{ height: 310, justifyContent: 'flex-end', gap: space.sm }}>
                <Animated.View style={[stampStyle, { borderColor: theme.color.success }, likeStyle]}>
                  <Text role="title3" color={theme.color.success}>
                    YES
                  </Text>
                </Animated.View>
                <Animated.View
                  style={[stampStyle, { borderColor: theme.color.danger, right: space.xl, left: undefined }, passStyle]}
                >
                  <Text role="title3" color={theme.color.danger}>
                    NOPE
                  </Text>
                </Animated.View>

                <Text role="title2">{card.title}</Text>
                <Text role="body" color={theme.color.textSecondary}>
                  {card.meta}
                </Text>
              </Card>
            </Animated.View>
          </GestureDetector>
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
        <Button label="Start over" variant="secondary" full onPress={() => setIndex(0)} />
      )}

      <Text role="caption" center color={theme.color.textTertiary}>
        {Math.min(index + 1, pickerCards.length)} of {pickerCards.length}
      </Text>
    </Screen>
  );
}

const stampStyle = {
  position: 'absolute',
  top: space.xl,
  left: space.xl,
  borderWidth: 3,
  borderRadius: radius.sm,
  paddingHorizontal: space.md,
  paddingVertical: space.xs,
} as const;
