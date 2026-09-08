import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AuthGate } from '@/components/providers/auth-gate';
import { AuthProvider, useAuth } from '@/components/providers/auth-provider';
import { CoupleProvider } from '@/components/providers/couple-provider';
import { LoaderProvider } from '@/components/providers/loader-provider';
import { RealtimeProvider } from '@/components/providers/realtime-provider';
import { ThemeProvider, useTheme } from '@/components/providers/theme-provider';
import { ToastProvider } from '@/components/providers/toast-provider';
import { renderHeaderWithoutBell } from '@/components/ui/screen-header';
import { stackScreenOptions } from '@/constants/nav-options';
import { palette, radius } from '@/constants/tokens';

export const unstable_settings = {
  anchor: '(onboarding)',
};

/**
 * Navigation chrome uses the brand surface so pushed screens don't flash white
 * — or, in dark mode, don't flash white *at all*, which is the single most
 * visible way a dark app gives itself away during a push transition.
 */
function useNavTheme() {
  const theme = useTheme();

  return {
    ...(theme.scheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme.scheme === 'dark' ? DarkTheme : DefaultTheme).colors,
      primary: palette.brand.rose,
      background: theme.color.bgBase,
      card: theme.color.surface,
      text: theme.color.textPrimary,
      border: theme.color.border,
    },
  };
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  // Splash stays up until the brand faces are ready — swapping mid-render would
  // reflow every screen.
  if (!fontsLoaded) return null;

  /*
   * Provider order is load-bearing:
   *
   *   ThemeProvider   — everything below reads colours from it
   *   LoaderProvider  } overlays, so they must sit *outside* the navigator to
   *   ToastProvider   } paint above whatever screen is mounted
   *   AuthProvider    — owns the session
   *   RealtimeProvider— needs the couple id, so it sits under AuthProvider
   *   AuthGate        — reads the session and redirects; inside the router
   */
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <LoaderProvider>
          <ToastProvider>
            <AuthProvider>
              <RealtimeProvider>
                <CoupleProvider>
                  <ThemedNavigation />
                </CoupleProvider>
              </RealtimeProvider>
            </AuthProvider>
          </ToastProvider>
        </LoaderProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Split out so it can read `useTheme()`, which `RootLayout` cannot — it is the
 * component that provides it. Owns the status bar for the same reason: the bar
 * has to invert with the scheme, and a hardcoded `style="dark"` puts black
 * glyphs on a near-black background the moment dark mode is on.
 */
function ThemedNavigation() {
  const navTheme = useNavTheme();
  const theme = useTheme();

  return (
    <NavThemeProvider value={navTheme}>
      <AuthGate>
        <RootNavigator />
      </AuthGate>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
    </NavThemeProvider>
  );
}

/**
 * Split out so it can read `useAuth()` — a component cannot consume a context
 * its own parent provides.
 *
 * Rendering nothing while the session is being restored is the point: mounting
 * the navigator first would let expo-router paint the onboarding intro for a
 * frame before the gate redirects a returning user out of it.
 */
function RootNavigator() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(onboarding)" />
              <Stack.Screen name="(tabs)" />

              {/* Sheets — iOS native detents, M3 bottom sheet on Android. */}
              {/*
                * 0.75, not the old 0.62 — that was short enough to put the save
                * button below the fold. The form is about 450pt, which is 0.67
                * of an iPhone SE, so anything under ~0.7 fails on a small phone.
                *
                * Tried `sheetAllowedDetents: 'fitToContents'` here first, which
                * would size the sheet to the form exactly. It measured wrong and
                * the button disappeared entirely — do not reach for it again
                * without a device to check it on. The height is the belt; the
                * pinned footer in `checkin.tsx` is the braces.
                */}
              <Stack.Screen
                name="checkin"
                options={{
                  presentation: 'formSheet',
                  sheetGrabberVisible: true,
                  sheetAllowedDetents: [0.75],
                  sheetCornerRadius: radius.sheetIos,
                }}
              />
              {/* Same reason: five 54pt rows plus a title come to ~455pt, which
                  does not fit in the half screen this used to ask for. */}
              <Stack.Screen
                name="need"
                options={{
                  presentation: 'formSheet',
                  sheetGrabberVisible: true,
                  sheetAllowedDetents: [0.75],
                  sheetCornerRadius: radius.sheetIos,
                }}
              />
              <Stack.Screen
                name="handoff"
                options={{
                  presentation: 'formSheet',
                  sheetGrabberVisible: true,
                  sheetAllowedDetents: [0.48],
                  sheetCornerRadius: radius.sheetIos,
                }}
              />

              {/* Dialogs — transparent so the component draws its own scrim. */}
              <Stack.Screen name="streak" options={dialogOptions} />
              <Stack.Screen name="match" options={dialogOptions} />
              <Stack.Screen name="limit" options={dialogOptions} />
              <Stack.Screen name="unpair" options={dialogOptions} />

      {/* The bell's destination. Pushed from any tab, so it lives out here and
          opts back into the shared header — the root stack hides headers by
          default for onboarding, the sheets and the dialogs. */}
      <Stack.Screen
        name="notifications"
        options={{
          ...stackScreenOptions,
          headerShown: true,
          title: 'Notifications',
          header: renderHeaderWithoutBell,
        }}
      />

      <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

const dialogOptions = {
  presentation: 'transparentModal',
  animation: 'fade',
  contentStyle: { backgroundColor: 'transparent' },
} as const;
