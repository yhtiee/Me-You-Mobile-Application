import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { use } from 'react';

/**
 * How much room the tab bar takes off the bottom of a screen.
 *
 * Measured, not guessed. This used to publish a `tabBarHeight` constant — 49 on
 * iOS, 80 on Android — because `NativeTabs` rendered the bar natively and
 * handed its screens no height at all. Every wrong guess showed up as content
 * stranded behind the bar or a gap floating above it, on exactly the devices
 * nobody tested.
 *
 * The JS tab bar publishes its height through this context. Because our bar
 * sets an explicit `height`, that is the capsule's height *only* —
 * `getTabBarHeight` returns an explicit height verbatim rather than folding in
 * the bottom safe-area inset the way it does for an auto-sized bar. The float
 * offset and the inset are added on top in `useChromeInsets`, which is the one
 * place that arithmetic lives.
 *
 * Returns 0 outside a tab navigator — onboarding, the paywall and the dialogs
 * all render off the tab tree and pad by safe area alone.
 */
export function useTabBarInset(): number {
  return use(BottomTabBarHeightContext) ?? 0;
}
