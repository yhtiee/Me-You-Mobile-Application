import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/components/providers/theme-provider';
import { palette, radius, shadow, space } from '@/constants/tokens';

type LoaderApi = {
  /** Shows the overlay. Returns the function that hides *this* request. */
  show: (label?: string) => () => void;
  /** Wraps a promise: shows while it runs, hides however it settles. */
  during: <T>(work: Promise<T>, label?: string) => Promise<T>;
};

const LoaderContext = createContext<LoaderApi | null>(null);

/**
 * Full-screen blocking loader for whole-screen waits.
 *
 * Reference-counted rather than a boolean. With a boolean, two overlapping
 * operations mean the first to finish hides the overlay while the second is
 * still running — the classic flicker. Each `show()` hands back its own hide,
 * and the overlay stays up until the last outstanding one is called.
 *
 * This is for waits that genuinely block the screen — restoring a session,
 * redeeming a pairing code. A button doing its own work should use the
 * button's own pending state instead: covering the whole screen to report that
 * one control is busy loses the user's place for no reason.
 */
export function LoaderProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const [count, setCount] = useState(0);
  const [label, setLabel] = useState<string | undefined>(undefined);
  // Tracked separately from `count` so a stale hide (one already called, or
  // called after a reset) cannot drive the count negative.
  const live = useRef(new Set<number>());
  const nextId = useRef(0);

  const show = useCallback((nextLabel?: string) => {
    nextId.current += 1;
    const id = nextId.current;
    live.current.add(id);
    setCount(live.current.size);
    if (nextLabel) setLabel(nextLabel);

    return () => {
      if (!live.current.delete(id)) return;
      setCount(live.current.size);
      if (live.current.size === 0) setLabel(undefined);
    };
  }, []);

  const during = useCallback(
    async <T,>(work: Promise<T>, nextLabel?: string): Promise<T> => {
      const hide = show(nextLabel);
      try {
        return await work;
      } finally {
        hide();
      }
    },
    [show]
  );

  const api = useMemo<LoaderApi>(() => ({ show, during }), [show, during]);

  return (
    <LoaderContext value={api}>
      {children}

      {count > 0 ? (
        <Animated.View
          entering={FadeIn.duration(140)}
          exiting={FadeOut.duration(140)}
          // Swallows taps on purpose: the point of a blocking loader is that
          // the screen underneath is mid-change and must not take input.
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(34,26,43,0.45)',
          }}
        >
          <View
            style={{
              alignItems: 'center',
              gap: space.md,
              minWidth: 132,
              paddingVertical: space.xl,
              paddingHorizontal: space.xxl,
              borderRadius: radius.lg,
              borderCurve: 'continuous',
              backgroundColor: theme.color.surface,
              boxShadow: shadow.s2,
            }}
          >
            <ActivityIndicator color={palette.brand.rose} />
            {label ? (
              <Text role="caption" center color={theme.color.textSecondary}>
                {label}
              </Text>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </LoaderContext>
  );
}

export function useLoader(): LoaderApi {
  const api = use(LoaderContext);
  if (!api) throw new Error('useLoader must be used inside <LoaderProvider>');
  return api;
}
