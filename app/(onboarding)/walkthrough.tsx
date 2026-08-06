import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { gutter, palette, radius, space } from '@/constants/tokens';

type Page = {
  illustration: ImageSourcePropType;
  title: string;
  body: string;
};

/** The three walkthrough screens named in PRD §3. */
const PAGES: Page[] = [
  {
    illustration: require('@/assets/images/a-streak-worth-keeping-asset.png'),
    title: 'A streak worth keeping',
    body: 'Check in on how you’re each doing — mood and battery, once a day. The streak only grows when you both show up.',
  },
  {
    illustration: require('@/assets/images/settle-dont-sweat-it-asset.png'),
    title: 'Settle it, don’t sweat it',
    body: 'Coin flips for who’s the bigger person, a wheel for whose turn it is, and a date setter that decides when neither of you can.',
  },
  {
    illustration: require('@/assets/images/never-forget-details-asset.png'),
    title: 'Never forget the details',
    body: 'Ring size, favourite flowers, the dream trip. Kept in one place, and there even when the signal isn’t.',
  },
];

/** Reached from the intro, which `replace`s into it so there is nothing behind. */
export default function Walkthrough() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const isLast = page === PAGES.length - 1;

  /**
   * Both halves are load-bearing: `setPage` alone only moved the dots, which is
   * why Next appeared to do nothing — the pager itself was never told to move.
   */
  const goTo = (next: number) => {
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    setPage(next);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bgBase }}>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', inset: 0, experimental_backgroundImage: theme.wash }}
      />

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setPage(Math.round(e.nativeEvent.contentOffset.x / width))
        }
        style={{ flex: 1 }}
      >
        {PAGES.map((p) => (
          <View
            key={p.title}
            style={{
              width,
              paddingHorizontal: gutter,
              paddingTop: insets.top,
              alignItems: 'center',
              justifyContent: 'center',
              gap: space.xxl,
            }}
          >
            {/* Fixed height rather than fixed width: the three run from 1.21
                to 1.61 aspect, so pinning the width would give each page a
                different illustration height and bounce the copy up and down
                as you swipe. */}
            <Image
              source={p.illustration}
              style={{ width: '100%', height: 220 }}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />

            <View style={{ gap: space.md, alignItems: 'center' }}>
              <Text role="title1" center>
                {p.title}
              </Text>
              <Text role="body" center color={theme.color.textSecondary}>
                {p.body}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: gutter,
          paddingBottom: insets.bottom + space.xl,
          gap: space.xl,
        }}
      >
        <View style={{ flexDirection: 'row', gap: space.sm, justifyContent: 'center' }}>
          {PAGES.map((p, i) => (
            <View
              key={p.title}
              style={{
                width: i === page ? 20 : 7,
                height: 7,
                borderRadius: radius.pill,
                backgroundColor: i === page ? palette.brand.rose : theme.color.border,
              }}
            />
          ))}
        </View>

        <Button
          label={isLast ? 'Get started' : 'Next'}
          full
          onPress={() => {
            if (isLast) router.push('/auth');
            else goTo(page + 1);
          }}
        />
        {!isLast ? (
          <Button label="Skip" variant="neutral" full onPress={() => router.push('/auth')} />
        ) : null}
      </View>
    </View>
  );
}
