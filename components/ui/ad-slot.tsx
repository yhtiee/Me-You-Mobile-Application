import { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';

import { Text } from '@/components/ui/text';
import { useAds } from '@/components/providers/ads-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { adUnitId, adsApi, usingTestAds } from '@/lib/ads';
import { gutter, radius, space } from '@/constants/tokens';

/**
 * Height a banner holds while it loads. Matches a standard banner's 50pt so the
 * common fill lands without the page moving.
 */
const RESERVED = 50;

/**
 * Clearance between the banner and whatever sits above it.
 *
 * Most screens end on something tappable — Home's "Send a message" button,
 * You's "Log out" row. AdMob's banner guidance singles out ads placed next to
 * buttons and navigation as a source of accidental clicks, and a mis-tap that
 * opens an ad instead of logging out is both a bad experience and invalid
 * traffic on the account. A fixed, generous gap is set here once rather than
 * trusted to every screen that mounts a slot.
 */
const CLEARANCE = space.xxl;

/**
 * The tallest an inline adaptive banner may grow.
 *
 * Inline adaptive banners size themselves to the creative and can run to a few
 * hundred points. On a screen whose content is a handful of cards, a 250pt ad
 * would be the largest thing on it — which is the "overwhelming" the placement
 * rules exist to prevent. Capping it keeps the ad the smallest block on screen.
 */
const MAX_HEIGHT = 100;

type Props = {
  /**
   * Whether the screen has content for the ad to sit under.
   *
   * This is an extra condition, never an override. It is AND-ed with the
   * entitlement, so a caller passing `true` cannot show an ad to a premium
   * couple — the old prop could, and that was how a paying user would have
   * seen one. Pass `false` on empty, loading and error states: AdMob does not
   * allow ads on screens without publisher content, and a banner under a
   * spinner is also simply bad.
   */
  show?: boolean;
};

/**
 * One banner, placed below a screen's last card.
 *
 * Where it may be mounted is the policy, so it is worth restating:
 *
 *   - Inline at the end of scroll content, never pinned to the bottom. The tab
 *     bar floats, and a banner anchored above it would sit between content and
 *     navigation, which AdMob flags for accidental clicks.
 *   - Never beside an input, a primary button, a chat composer or a swipe deck.
 *   - Never in a sheet, a dialog, onboarding, the paywall, or mid-game.
 *   - At most one per screen.
 *
 * Collapses to nothing when no ad fills. An empty rectangle where an ad was
 * expected reads as a broken layout, and holding space for an ad that is not
 * coming is paying the UX cost of an ad without the ad.
 */
export function AdSlot({ show = true }: Props) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { supported, ready, resolved, showAds, blocked } = useAds();
  const [failed, setFailed] = useState(false);
  const [height, setHeight] = useState(RESERVED);

  // Premium, or the screen has nothing to put an ad under.
  if (!show) return null;
  if (resolved && !showAds) return null;
  if (failed) return null;
  // Consent withheld or the SDK didn't start: no ad is coming, so no space either.
  if (blocked) return null;

  const ads = adsApi();

  /*
   * No SDK on this runtime — Expo Go. Development only: a dashed outline marks
   * where the banner will go, so placement can be reviewed without a native
   * build. A release build always has the SDK, so this branch never ships.
   */
  if (!supported || !ads) {
    return __DEV__ ? <Placeholder /> : null;
  }

  // Hold the space until entitlement and the SDK are both ready, so the ad
  // arrives into a slot rather than pushing the page down when it does.
  if (!ready || !resolved) {
    return <View style={{ height: RESERVED + LABEL_SPACE, marginTop: CLEARANCE }} />;
  }

  const unitId = adUnitId('banner');
  if (!unitId) return null;

  return (
    <View style={{ gap: space.xs, marginTop: CLEARANCE }}>
      {/*
        * Labelled, so an ad can never be mistaken for app content. "Sponsored"
        * rather than "Ad": it is the word people already recognise from feeds.
        */}
      <Text role="overline" color={theme.color.textTertiary}>
        {usingTestAds() ? 'Sponsored · test ad' : 'Sponsored'}
      </Text>

      <View
        style={{
          minHeight: height,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          overflow: 'hidden',
          alignItems: 'center',
        }}
      >
        <ads.BannerAd
          unitId={unitId}
          size={ads.BannerAdSize.INLINE_ADAPTIVE_BANNER}
          width={width - gutter * 2}
          maxHeight={MAX_HEIGHT}
          onAdLoaded={({ height: loaded }) => setHeight(Math.min(loaded, MAX_HEIGHT))}
          // No retry. A no-fill is the network saying "nothing for you right
          // now", and re-requesting in a loop is both wasteful and something
          // AdMob treats as suspicious traffic.
          onAdFailedToLoad={() => setFailed(true)}
        />
      </View>
    </View>
  );
}

/** The overline plus its gap, so the reserved height includes the label. */
const LABEL_SPACE = 22;

function Placeholder() {
  const theme = useTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: theme.color.border,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        paddingVertical: space.lg,
        alignItems: 'center',
        gap: space.xs,
        marginTop: CLEARANCE,
      }}
    >
      <Text role="overline" color={theme.color.textTertiary}>
        Ad slot
      </Text>
      <Text role="caption" color={theme.color.textTertiary}>
        Banner renders in a development build
      </Text>
    </View>
  );
}
