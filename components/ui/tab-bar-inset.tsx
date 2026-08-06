import { createContext, use, type ReactNode } from 'react';

import { tabBarHeight } from '@/constants/tokens';

/**
 * How much room the native tab bar takes off the bottom of a screen.
 *
 * SDK 54's NativeTabs renders the bar natively and hands its screens nothing —
 * no safe-area context, no height hook (both arrive in SDK 55). So the tabs
 * layout publishes the constant itself and every scrollable route reads it back
 * through `useChromeInsets`. Routes outside the tab tree — onboarding, the
 * paywall, the dialogs — get the 0 default and pad by safe area alone.
 */
const TabBarInsetContext = createContext(0);

export function TabBarInsetProvider({ children }: { children: ReactNode }) {
  return <TabBarInsetContext value={tabBarHeight}>{children}</TabBarInsetContext>;
}

export function useTabBarInset(): number {
  return use(TabBarInsetContext);
}
