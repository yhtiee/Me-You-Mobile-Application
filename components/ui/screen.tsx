import { createContext, use, useCallback, useRef } from 'react';
import { ScrollView, View, type ScrollViewProps } from 'react-native';

import { useTheme } from '@/components/providers/theme-provider';
import { gutter, space } from '@/constants/tokens';
import { useChromeInsets } from '@/hooks/use-chrome-insets';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';

type Props = ScrollViewProps & {
  /** Extra top room on top of the header clearance — deliberate breathing space, not chrome. */
  topPad?: number;
  /** Extra bottom room on top of the tab-bar clearance, e.g. to sit above a pinned CTA. */
  bottomPad?: number;
  gap?: number;
};

/**
 * Scrolls the surrounding `Screen` by `dy`, clamped at the top.
 *
 * Exists so a field can pull itself out from under the keyboard without every
 * form having to thread a scroll ref down by hand. No-ops outside a `Screen`.
 */
const ScreenScrollContext = createContext<(dy: number) => void>(() => {});

export function useScreenScroll() {
  return use(ScreenScrollContext);
}

/**
 * Standard screen shell: the rose-to-white wash behind a scroll view that
 * clears the app chrome on both platforms.
 *
 * Routes must not set their own `paddingTop`/`paddingBottom` here. The header
 * offset is measured (`useChromeInsets`) rather than guessed, and the bottom
 * accounts for a native tab bar that reports no insets of its own — anything a
 * route adds on top of that double-counts.
 *
 * The insets are measured, not adjusted natively: `contentInsetAdjustmentBehavior`
 * is `never` on purpose. `automatic` does nothing at all on Android, and on iOS
 * it only fires when the scroll view is the route's first child — which the
 * wash below breaks. `useChromeInsets` does the same arithmetic on both
 * platforms, so no route should need a hand-tuned `topPad` to compensate.
 */
export function Screen({
  topPad = 0,
  bottomPad = space.xxl,
  gap = space.md,
  contentContainerStyle,
  children,
  ...rest
}: Props) {
  const theme = useTheme();
  const chrome = useChromeInsets();
  const keyboard = useKeyboardInset();

  const scrollRef = useRef<ScrollView>(null);
  // Tracked rather than read back, because ScrollView exposes no offset getter.
  const offset = useRef(0);

  const scrollBy = useCallback((dy: number) => {
    scrollRef.current?.scrollTo({ y: Math.max(0, offset.current + dy), animated: true });
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bgBase }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 320,
          experimental_backgroundImage: theme.wash,
        }}
      />
      <ScrollView
        ref={scrollRef}
        contentInsetAdjustmentBehavior="never"
        /*
         * Keyboard handling, which every form screen needs and none had.
         *
         * iOS adds the keyboard height to the content inset itself. Android
         * ignores this prop — there the room comes from `useKeyboardInset`
         * below, because `adjustResize` is a no-op under edge-to-edge.
         *
         * Note there is deliberately no `keyboardDismissMode`: the default is
         * "none", and setting "on-drag" makes the keyboard close the instant a
         * scroll starts, which collapses that padding and takes the scroll
         * range away with it.
         */
        automaticallyAdjustKeyboardInsets
        /*
         * Load-bearing: without it the first tap on a button while the keyboard
         * is open is swallowed dismissing the keyboard, so "Log in" and "Add"
         * appear to need pressing twice.
         */
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        {...rest}
        onScroll={(e) => {
          offset.current = e.nativeEvent.contentOffset.y;
          rest.onScroll?.(e);
        }}
        scrollEventThrottle={16}
        contentContainerStyle={[
          {
            paddingHorizontal: gutter,
            paddingTop: chrome.top + topPad,
            paddingBottom: chrome.bottom + bottomPad + keyboard,
            gap,
          },
          contentContainerStyle,
        ]}
      >
        <ScreenScrollContext value={scrollBy}>{children}</ScreenScrollContext>
      </ScrollView>
    </View>
  );
}
