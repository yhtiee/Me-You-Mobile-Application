import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { renderScreenHeader } from '@/components/ui/screen-header';

/**
 * Shared stack chrome.
 *
 * The native header is gone. Every stack now renders `ScreenHeader` — a JS
 * header — which is what lets the bar carry an avatar, a greeting and the
 * notifications bell, none of which a native title bar can hold. The tokens
 * doc's 36px back circle comes back with it; the note that used to sit here
 * saying we'd traded it away for native behaviour no longer applies, because
 * `headerShown: false` only turns off the *bar*: swipe-back, the Android
 * hardware and gesture back, and the stack's own animations are untouched.
 *
 * `headerTransparent` is load-bearing and must stay. It is what makes
 * react-navigation position the JS header absolutely over the route instead of
 * insetting the content below it — i.e. what makes screens scroll *under* the
 * header. `useChromeInsets` measures the rendered bar and hands the offset back
 * to `Screen`, so no route pads for it by hand.
 */
export const stackScreenOptions: NativeStackNavigationOptions = {
  headerTransparent: true,
  header: renderScreenHeader,
};
