import { HeaderHeightContext, HeaderShownContext } from 'expo-router/react-navigation';
import { use } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabBarInset } from '@/components/ui/tab-bar-inset';
import { floatingTabBar } from '@/constants/tokens';

/**
 * Bar height without the status bar, matching react-navigation's own defaults
 * (`ANDROID_DEFAULT_HEADER_HEIGHT` and `getDefaultHeaderHeight` in
 * `NativeStackView.native.tsx`). Used as a floor, never as the answer.
 */
const DEFAULT_HEADER_BAR = Platform.select({ android: 56, default: 44 });

export type ChromeInsets = {
  /** Top padding a scroll view needs so content clears the transparent header. */
  top: number;
  /** Bottom padding a scroll view needs so content clears the native tab bar. */
  bottom: number;
  /** Measured header height; 0 on routes that hide their header. */
  headerHeight: number;
};

/**
 * The padding a scrollable route needs so its content clears the app chrome.
 *
 * Both stacks run `headerTransparent`, so content is laid out *underneath* the
 * header on purpose — the wash is meant to run behind it. Something has to put
 * that offset back, and we do it here, by measurement, on both platforms.
 *
 * We deliberately do *not* lean on `contentInsetAdjustmentBehavior="automatic"`
 * for this. It is a no-op on Android, where `edgeToEdgeEnabled` also drops
 * content under the status bar, and even on iOS it only fires when the scroll
 * view is the first child of the route — which `Screen` violates, since the
 * gradient wash renders ahead of it. Measuring is the same on every platform
 * and does not depend on view order. Screens used to paper over this with
 * `space.huge * 2.6` and friends, which is why they disagreed with each other
 * and with every device.
 *
 * `bottom` comes from the tab bar's own reported height; see `useTabBarInset`.
 */
export function useChromeInsets(): ChromeInsets {
  const safeArea = useSafeAreaInsets();
  const tabBar = useTabBarInset();
  // Both are `undefined` outside a header-bearing navigator.
  const reported = use(HeaderHeightContext) ?? 0;
  const headerShown = use(HeaderShownContext) ?? false;

  // The reported height is not trustworthy on its own. It arrives from a native
  // event that fires after first paint, and a `headerTransparent` header on
  // Android can report 0 outright — which silently costs a whole 56dp toolbar
  // and leaves content tucked under the title. Floor it at what the bar cannot
  // be smaller than, and let a taller measurement (iOS large titles) win.
  const headerHeight = headerShown ? Math.max(reported, safeArea.top + DEFAULT_HEADER_BAR) : 0;

  return {
    // The header height already includes the status bar; a headerless route
    // still has to clear it on its own.
    top: headerHeight || safeArea.top,
    /*
     * The floating capsule clears three things stacked on top of each other:
     * the gesture area it is lifted above, the lift itself, and the bar. The
     * `clearance` on top is so content stops short of the glass rather than
     * sliding right up under its rim.
     *
     * `tabBar` is the bar's own reported height and nothing else — the capsule
     * sets an explicit `height`, and `getTabBarHeight` returns an explicit
     * height verbatim without adding the safe-area inset it would otherwise
     * fold in. So the inset genuinely is ours to add here, and adding it is not
     * the double-count it would be for a bottom-anchored bar.
     *
     * Off the tab tree — onboarding, the paywall, the dialogs — the height is 0
     * and the safe-area inset is all there is.
     */
    bottom: tabBar
      ? safeArea.bottom + floatingTabBar.lift + tabBar + floatingTabBar.clearance
      : safeArea.bottom,
    headerHeight,
  };
}
