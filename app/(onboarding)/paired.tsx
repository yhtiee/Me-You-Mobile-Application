import { Image } from 'expo-image';
import { router } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { partnerNameInSentence, useCouplePeople } from '@/hooks/use-couple-people';
import { useTheme } from '@/components/providers/theme-provider';
import { gutter, palette, radius, space } from '@/constants/tokens';

/** Pairing complete — Level 1, "Crushes" (PRD §5). */
export default function Paired() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // The partner who just redeemed the code, by their real name. This read
  // "Sarah" for everyone — the mock provider's placeholder — on the one screen
  // whose entire job is to confirm who you are now linked with.
  const people = useCouplePeople();

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bgBase }}>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', inset: 0, experimental_backgroundImage: theme.wash }}
      />
      <View
        style={{
          flex: 1,
          paddingHorizontal: gutter,
          paddingTop: insets.top,
          paddingBottom: insets.bottom + space.xl,
        }}
      >
        {/*
         * The celebration is centred in the room left above the CTA, which sits
         * on the bottom edge. It has to be its own flex child: the button used
         * to claim the gap with `marginTop: 'auto'`, and an auto margin eats
         * every spare pixel, so `justifyContent: 'center'` had nothing left to
         * centre with and the content stacked at the top instead.
         */}
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: space.xxl,
          }}
        >
          <Animated.View entering={FadeInUp.springify().damping(16)}>
            <Image
              source={require('@/assets/images/success-connect.png')}
              style={{ width: 260, height: 130 }}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(120)}
            style={{ gap: space.md, alignItems: 'center' }}
          >
            <Text role="title1" center>
              You and {partnerNameInSentence(people)} are linked
            </Text>
            <Text role="body" center color={theme.color.textSecondary}>
              That’s Level 1 — Crushes. Check in tomorrow and the streak starts counting.
            </Text>
          </Animated.View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              paddingHorizontal: space.lg,
              paddingVertical: space.sm,
              borderRadius: radius.pill,
              backgroundColor: palette.brand.amberSoft,
            }}
          >
            <Text role="overline" color="#B97400">
              Level 1 · Crushes
            </Text>
          </View>
        </View>

        {/* `full` already stretches the button, so no wrapper is needed. */}
        <Button label="Take me in" full onPress={() => router.replace('/(tabs)/(home)')} />
      </View>
    </View>
  );
}
