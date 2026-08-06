import { createContext, use, useCallback, useRef, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { gutter, radius, shadow, space, toastColors } from '@/constants/tokens';

export type ToastTone = 'success' | 'error' | 'info';

type Toast = {
  id: number;
  tone: ToastTone;
  message: string;
};

type ToastApi = {
  show: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  dismiss: () => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const VISIBLE_MS = 4000;

/**
 * One toast at a time, from the top.
 *
 * Top rather than bottom on purpose: the bottom edge is where this app puts the
 * thing you are about to tap — the CTA on every form, the tab bar everywhere
 * else — and a toast that lands on the primary button either gets tapped by
 * accident or blocks the retry it is telling you to make.
 *
 * A new toast replaces the current one instead of queueing. A queue implies the
 * user should read a backlog of things that already happened; in practice the
 * most recent message is the only one still true.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      if (timer.current) clearTimeout(timer.current);
      nextId.current += 1;
      // The id is the animation key, so replacing one toast with another
      // re-runs the entry rather than silently swapping the text.
      setToast({ id: nextId.current, tone, message });
      timer.current = setTimeout(() => setToast(null), VISIBLE_MS);
    },
    []
  );

  const api: ToastApi = {
    show,
    success: useCallback((message: string) => show(message, 'success'), [show]),
    error: useCallback((message: string) => show(message, 'error'), [show]),
    dismiss,
  };

  const fill =
    toast?.tone === 'success'
      ? toastColors.success
      : toast?.tone === 'error'
        ? toastColors.error
        : toastColors.info;

  return (
    <ToastContext value={api}>
      {children}

      {toast ? (
        <Animated.View
          key={toast.id}
          entering={FadeInUp.duration(220)}
          exiting={FadeOutUp.duration(160)}
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: insets.top + space.sm,
            left: gutter,
            right: gutter,
          }}
        >
          <Pressable
            accessibilityRole="alert"
            accessibilityLabel={toast.message}
            onPress={dismiss}
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: space.md,
              // The tone is the whole surface now, not a stripe on the edge.
              backgroundColor: fill,
              borderRadius: radius.md,
              borderCurve: 'continuous',
              padding: space.lg,
              boxShadow: shadow.s2,
            }}
          >
            <Text role="bodyStrong" style={{ flex: 1 }} color={toastColors.foreground}>
              {toast.message}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </ToastContext>
  );
}

export function useToast(): ToastApi {
  const api = use(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>');
  return api;
}
