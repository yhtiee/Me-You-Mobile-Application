import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { fontFamily, palette } from '@/constants/tokens';

/**
 * Shared stack chrome.
 *
 * DESIGN NOTE — the tokens doc specs a custom back affordance (chevron in a
 * 36px circle). We use the native header back button instead: it gets
 * swipe-back, hardware/gesture back on Android, and Dynamic Type for free,
 * which the parity table also asks for. Flagged for review; swap to a
 * `headerLeft` render prop if the circle is non-negotiable.
 */
export const stackScreenOptions: NativeStackNavigationOptions = {
  headerTransparent: true,
  headerShadowVisible: false,
  headerBlurEffect: 'systemUltraThinMaterialLight',
  headerLargeTitleShadowVisible: false,
  headerLargeStyle: { backgroundColor: 'transparent' },
  headerTintColor: palette.brand.rose,
  /**
   * Back chevron alone on the left, title centred. iOS centres compact titles
   * by default but Android left-aligns them next to the back arrow, so this is
   * doing real work only on Android — without it the two platforms disagree.
   *
   * The notch is already handled: `headerTopInsetEnabled` resolves to
   * `topInset !== 0` under edge-to-edge, so the bar pads itself down past the
   * status bar rather than sitting behind it.
   */
  headerTitleAlign: 'center',
  headerBackButtonDisplayMode: 'minimal',
  headerTitleStyle: {
    color: palette.light.textPrimary,
    fontFamily: fontFamily.display.bold,
    fontSize: 19,
  },
  headerLargeTitleStyle: {
    color: palette.light.textPrimary,
    fontFamily: fontFamily.display.bold,
    fontSize: 27,
  },
};

/**
 * Root of each tab.
 *
 * Large titles are off. On iOS they render big and left-aligned in a band below
 * the bar, which is the opposite of the centred title just under the notch the
 * design asks for — and since Android ignores `headerLargeTitle` entirely, the
 * two platforms disagreed about where a tab root's title even lived. Flip this
 * back to `true` if you want the iOS-native large-title treatment on the four
 * tab roots instead.
 */
export const rootScreenOptions: NativeStackNavigationOptions = {
  headerLargeTitle: false,
};
